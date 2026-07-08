const pool = require('../config/db');

async function listarPagos(filtros = {}) {
  const { search = '', estado = null, matricula_id = null } = filtros;

  const values = [];
  let where = `WHERE 1=1`;

  if (matricula_id) {
    values.push(matricula_id);
    where += ` AND m.id = $${values.length}`;
  }

  if (estado) {
    values.push(estado);
    where += ` AND c.estado = $${values.length}`;
  }

  if (search && String(search).trim() !== '') {
    values.push(`%${search.toLowerCase()}%`);
    where += `
      AND (
        a.dni ILIKE $${values.length}
        OR unaccent(lower(a.nombres || ' ' || a.apellidos)) LIKE unaccent($${values.length})
      )
    `;
  }

  const result = await pool.query(`
  SELECT
    c.id,
    c.numero_cuota,
    c.fecha_vencimiento,
    c.monto_programado,
    c.monto_pagado,
    c.saldo_pendiente,
    c.estado,

    cc.codigo AS concepto_codigo,
    cc.nombre AS concepto_nombre,

    m.id AS matricula_id,

    a.id AS alumno_id,
    a.nombres || ' ' || a.apellidos AS alumno,
    a.telefono,
    a.correo,
    a.foto_url,

    ppa.id AS plan_pago_alumno_id,

    STRING_AGG(ma.nombre, ', ') AS maquinas,

    pc.nombre AS plan_nombre

  FROM cuotas c

  INNER JOIN conceptos_cobro cc
    ON cc.id = c.concepto_id

  INNER JOIN planes_pago_alumno ppa
    ON ppa.id = c.plan_pago_alumno_id

  INNER JOIN matriculas m
    ON m.id = ppa.matricula_id

  INNER JOIN matricula_maquinas mm
    ON mm.matricula_id = m.id

  INNER JOIN maquinas ma
    ON ma.id = mm.maquina_id

  INNER JOIN alumnos a
    ON a.id = m.alumno_id

  INNER JOIN planes_curso pc
    ON pc.id = m.plan_curso_id

  ${where}

  GROUP BY
    c.id,
    c.numero_cuota,
    c.fecha_vencimiento,
    c.monto_programado,
    c.monto_pagado,
    c.saldo_pendiente,
    c.estado,

    cc.codigo,
    cc.nombre,

    m.id,

    a.id,
    a.nombres,
    a.apellidos,
    a.telefono,
    a.correo,
    a.foto_url,

    ppa.id,

    pc.nombre

  ORDER BY c.fecha_vencimiento ASC
`, values);

  return result.rows;
}

async function recalcularPlanPago({
  plan_pago_alumno_id,
  tipo, // 'MENSUAL' | 'QUINCENAL'
  fecha_inicio,
  cantidad_cuotas
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener cuotas actuales
    const cuotasRes = await client.query(`
      SELECT *
      FROM cuotas
      WHERE plan_pago_alumno_id = $1
      ORDER BY numero_cuota
      FOR UPDATE
    `, [plan_pago_alumno_id]);

    const cuotas = cuotasRes.rows;

    if (!cuotas.length) {
      throw new Error('No hay cuotas para este plan');
    }

    // 2. Separar
    const pagadas = cuotas.filter(c => Number(c.monto_pagado) > 0);
    const conceptoCuotaRes = await client.query(`
  SELECT id
  FROM conceptos_cobro
  WHERE codigo = 'CUOTA'
`);

    const conceptoCuotaId = conceptoCuotaRes.rows[0].id;

    const pendientes = cuotas.filter(
      c =>
        Number(c.saldo_pendiente) > 0 &&
        c.concepto_id === conceptoCuotaId
    );
    // 3. Calcular deuda restante
    const deudaRestante = pendientes.reduce(
      (sum, c) => sum + Number(c.saldo_pendiente),
      0
    );

    if (deudaRestante <= 0) {
      throw new Error('No hay deuda pendiente para recalcular');
    }

    // 4. Eliminar cuotas pendientes
    await client.query(`
    DELETE FROM cuotas
    WHERE plan_pago_alumno_id = $1
    AND saldo_pendiente > 0
    AND concepto_id = (
      SELECT id
      FROM conceptos_cobro
      WHERE codigo = 'CUOTA'
    )
`, [plan_pago_alumno_id]);
    // 5. Generar nuevas cuotas
    const montoBase = Math.round((deudaRestante / cantidad_cuotas) * 100) / 100;

    let acumulado = 0;
    const nuevasCuotas = [];

    for (let i = 0; i < cantidad_cuotas; i++) {

      const fecha = new Date(fecha_inicio);

      const diasEntreCuotas =
        tipo === 'QUINCENAL'
          ? 14
          : 20;

      fecha.setDate(
        fecha.getDate() + (diasEntreCuotas * i)
      );

      let monto = montoBase;

      // Ajuste última cuota
      if (i === cantidad_cuotas - 1) {
        monto = deudaRestante - acumulado;
      }

      acumulado += monto;

      nuevasCuotas.push({
        numero_cuota: pagadas.length + i + 1,
        fecha_vencimiento: fecha,
        monto_programado: monto,
        monto_pagado: 0,
        saldo_pendiente: monto,
        estado: 'PENDIENTE'
      });
    }

    // 6. Insertar nuevas cuotas
    for (const c of nuevasCuotas) {
      await client.query(`
        INSERT INTO cuotas (
          plan_pago_alumno_id,
          numero_cuota,
          fecha_vencimiento,
          monto_programado,
          monto_pagado,
          saldo_pendiente,
          estado,
          concepto_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,
          (SELECT id FROM conceptos_cobro WHERE codigo = 'CUOTA')
        )
      `, [
        plan_pago_alumno_id,
        c.numero_cuota,
        c.fecha_vencimiento,
        c.monto_programado,
        c.monto_pagado,
        c.saldo_pendiente,
        c.estado
      ]);
    }

    await client.query('COMMIT');

    return {
      mensaje: 'Plan recalculado correctamente',
      nuevas_cuotas: nuevasCuotas.length
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
async function editarCuota({
  cuota_id,
  fecha_vencimiento,
  monto_programado
}) {

  const cuotaRes = await pool.query(`
    SELECT *
    FROM cuotas
    WHERE id = $1
  `, [cuota_id]);

  const cuota = cuotaRes.rows[0];

  if (!cuota) {
    throw new Error('Cuota no encontrada');
  }

  // 🔒 NO permitir editar pagadas
  if (cuota.estado === 'PAGADO') {
    throw new Error('No se puede editar una cuota pagada');
  }

  await pool.query(`
    UPDATE cuotas
    SET
      fecha_vencimiento = $1,
      monto_programado = $2,
      saldo_pendiente = $2 - monto_pagado
    WHERE id = $3
  `, [
    fecha_vencimiento,
    monto_programado,
    cuota_id
  ]);

  return {
    mensaje: 'Cuota actualizada correctamente'
  };
}

async function listarResumenPagos() {
  const result = await pool.query(`
  SELECT
    m.id AS matricula_id,
    a.nombres || ' ' || a.apellidos AS alumno,
    a.foto_url,
    pc.nombre AS plan_nombre,
    m.fecha_matricula,

    SUM(c.saldo_pendiente) AS total_deuda,

      SUM(c.saldo_pendiente) AS total_deuda,

      -- Cuotas vencidas
      COUNT(
        CASE
          WHEN c.saldo_pendiente > 0
          AND c.fecha_vencimiento < CURRENT_DATE
          THEN 1
        END
      ) AS cuotas_vencidas,

      -- Próximas cuotas (vence en 5 días)
      COUNT(
        CASE
          WHEN c.saldo_pendiente > 0
          AND c.fecha_vencimiento BETWEEN CURRENT_DATE
          AND CURRENT_DATE + INTERVAL '5 days'
          THEN 1
        END
      ) AS cuotas_por_vencer,

      CASE
        -- Tiene deuda vencida
        WHEN COUNT(
          CASE
            WHEN c.saldo_pendiente > 0
            AND c.fecha_vencimiento < CURRENT_DATE
            THEN 1
          END
        ) > 0
        THEN 'MOROSO'

        -- Próximo a vencer
        WHEN COUNT(
          CASE
            WHEN c.saldo_pendiente > 0
            AND c.fecha_vencimiento BETWEEN CURRENT_DATE
            AND CURRENT_DATE + INTERVAL '5 days'
            THEN 1
          END
        ) > 0
        THEN 'POR_VENCER'

        -- Todo correcto
        ELSE 'AL_DIA'
      END AS estado_financiero

    FROM cuotas c
    INNER JOIN planes_pago_alumno ppa
      ON ppa.id = c.plan_pago_alumno_id

    INNER JOIN matriculas m
      ON m.id = ppa.matricula_id

    INNER JOIN alumnos a
      ON a.id = m.alumno_id

    INNER JOIN planes_curso pc
      ON pc.id = m.plan_curso_id

    GROUP BY
      m.id,
      a.nombres,
      a.apellidos,
      a.foto_url,
      pc.nombre

    ORDER BY alumno
  `);

  return result.rows;
}

async function obtenerHistorialPagos(matricula_id) {
  const result = await pool.query(`
    SELECT
      p.id,
      p.monto,
      p.fecha_pago,
      p.metodo_pago,
      p.comprobante_url, 
      cc.nombre AS concepto_nombre
    FROM pagos p
    INNER JOIN cuotas c ON c.id = p.cuota_id
    INNER JOIN conceptos_cobro cc ON cc.id = c.concepto_id
    WHERE c.plan_pago_alumno_id IN (
      SELECT id FROM planes_pago_alumno WHERE matricula_id = $1
    )
    ORDER BY p.fecha_pago DESC
  `, [matricula_id]);

  return result.rows;
}
async function registrarPago({ cuota_id, monto, metodo_pago, comprobante_url }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const cuotaRes = await client.query(`
      SELECT saldo_pendiente, plan_pago_alumno_id
      FROM cuotas
      WHERE id = $1
      FOR UPDATE
    `, [cuota_id]);

    if (!cuotaRes.rows.length) throw new Error('Cuota no encontrada');

    const { saldo_pendiente: saldo, plan_pago_alumno_id } = cuotaRes.rows[0];

    if (!plan_pago_alumno_id) throw new Error('Cuota sin plan');
    if (saldo <= 0) throw new Error('Ya pagada');
    if (monto <= 0) throw new Error('Monto inválido');
    if (monto > saldo) throw new Error(`Excede saldo`);

    const pago = await client.query(`
      INSERT INTO pagos (plan_pago_alumno_id, cuota_id, monto, metodo_pago, comprobante_url, fecha_pago)
      VALUES ($1,$2,$3,$4,$5,NOW())
      RETURNING *
    `, [plan_pago_alumno_id, cuota_id, monto, metodo_pago, comprobante_url]);

    await client.query(`
      UPDATE cuotas
      SET
        monto_pagado = monto_pagado + $1,
        saldo_pendiente = saldo_pendiente - $1,
        estado = CASE WHEN saldo_pendiente - $1 <= 0 THEN 'PAGADO' ELSE 'PENDIENTE' END
      WHERE id = $2
    `, [monto, cuota_id]);

    await client.query('COMMIT');

    return pago.rows[0];

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function buscarMatriculasParaPago(search = '') {

  const result = await pool.query(`
    SELECT
      m.id AS matricula_id,

      a.id AS alumno_id,
      a.dni,
      a.nombres,
      a.apellidos,
      a.foto_url,

      pc.nombre AS plan_nombre,

      STRING_AGG(ma.nombre, ', ') AS maquinas

    FROM matriculas m

    INNER JOIN alumnos a
      ON a.id = m.alumno_id

    INNER JOIN planes_curso pc
      ON pc.id = m.plan_curso_id

    INNER JOIN matricula_maquinas mm
      ON mm.matricula_id = m.id

    INNER JOIN maquinas ma
      ON ma.id = mm.maquina_id

    WHERE
      m.activo = true -- ¡AQUÍ ESTABA EL ERROR! Cambiado de m.estado = 'ACTIVO'
      AND (
        a.dni ILIKE $1
        OR unaccent(lower(a.nombres || ' ' || a.apellidos))
          LIKE unaccent(lower($1))
      )

    GROUP BY
      m.id,
      a.id,
      pc.nombre

    ORDER BY a.nombres
    LIMIT 15
  `, [`%${search}%`]);

  return result.rows;
}
// ===============================
// CREAR PLAN DE PAGOS MANUAL
// ===============================

async function crearPlanPagoManual({
  matricula_id,
  modalidad_pago,
  monto_total,
  monto_matricula = 0,
  monto_certificacion = 0,
  cuotas = [],
  nota_pago = null
}) {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    // ======================================
    // VALIDAR MATRÍCULA
    // ======================================

    const matriculaRes = await client.query(`
      SELECT *
      FROM matriculas
      WHERE id = $1
      LIMIT 1
    `, [matricula_id]);

    const matricula = matriculaRes.rows[0];

    if (!matricula) {
      throw new Error('Matrícula no encontrada');
    }

    // ======================================
    // VALIDAR SI YA EXISTE PLAN
    // ======================================

    const existePlan = await client.query(`
      SELECT id
      FROM planes_pago_alumno
      WHERE matricula_id = $1
      LIMIT 1
    `, [matricula_id]);

    if (existePlan.rows.length > 0) {
      throw new Error('La matrícula ya tiene un plan de pagos');
    }

    // ======================================
    // VALIDAR CUOTAS
    // ======================================

    if (!Array.isArray(cuotas) || cuotas.length === 0) {
      throw new Error('Debe enviar al menos una cuota');
    }

    // ======================================
    // OBTENER CONCEPTOS
    // ======================================

    const conceptosRes = await client.query(`
      SELECT id, codigo
      FROM conceptos_cobro
    `);

    const conceptos = {};

    for (const c of conceptosRes.rows) {
      conceptos[c.codigo] = c.id;
    }

    // ======================================
    // CALCULAR DATOS
    // ======================================

    const cantidad_cuotas = cuotas.length;

    const monto_cuota = Number(
      (
        cuotas.reduce(
          (acc, item) => acc + Number(item.monto),
          0
        ) / cantidad_cuotas
      ).toFixed(2)
    );

    // ======================================
    // CREAR PLAN PAGO
    // ======================================

    const planPagoRes = await client.query(`
      INSERT INTO planes_pago_alumno (
        matricula_id,
        plan_precio_id,
        monto_total,
        monto_matricula,
        monto_certificacion,
        cantidad_cuotas,
        monto_cuota,
        nota_pago,
        modalidad_pago
      )
      VALUES (
        $1,
        NULL,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8
      )
      RETURNING *
    `, [
      matricula_id,
      monto_total,
      monto_matricula,
      monto_certificacion,
      cantidad_cuotas,
      monto_cuota,
      nota_pago,
      modalidad_pago
    ]);

    const planPago = planPagoRes.rows[0];

    // ======================================
    // CREAR MATRÍCULA
    // ======================================

    if (Number(monto_matricula) > 0) {

      await client.query(`
        INSERT INTO cuotas (
          plan_pago_alumno_id,
          numero_cuota,
          concepto_id,
          fecha_programada,
          fecha_vencimiento,
          monto_programado,
          monto_pagado,
          saldo_pendiente,
          estado,
          observaciones
        )
        VALUES (
          $1,
          0,
          $2,
          CURRENT_DATE,
          CURRENT_DATE,
          $3,
          0,
          $3,
          'PENDIENTE',
          'Pago de matrícula'
        )
      `, [
        planPago.id,
        conceptos['MATRICULA'],
        monto_matricula
      ]);

    }

    // ======================================
    // CREAR CUOTAS MANUALES
    // ======================================

    for (const cuota of cuotas) {

      await client.query(`
        INSERT INTO cuotas (
          plan_pago_alumno_id,
          numero_cuota,
          concepto_id,
          fecha_programada,
          fecha_vencimiento,
          monto_programado,
          monto_pagado,
          saldo_pendiente,
          estado,
          observaciones
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $4,
          $5,
          0,
          $5,
          'PENDIENTE',
          $6
        )
      `, [
        planPago.id,
        cuota.numero_cuota,
        conceptos['CUOTA'],
        cuota.fecha_vencimiento,
        cuota.monto,
        cuota.observaciones || `Cuota ${cuota.numero_cuota}`
      ]);

    }

    // ======================================
    // CREAR CERTIFICACIÓN
    // ======================================

    if (Number(monto_certificacion) > 0) {

      const ultimaFecha =
        cuotas[cuotas.length - 1].fecha_vencimiento;

      await client.query(`
        INSERT INTO cuotas (
          plan_pago_alumno_id,
          numero_cuota,
          concepto_id,
          fecha_programada,
          fecha_vencimiento,
          monto_programado,
          monto_pagado,
          saldo_pendiente,
          estado,
          observaciones
        )
        VALUES (
          $1,
          NULL,
          $2,
          $3,
          $3,
          $4,
          0,
          $4,
          'PENDIENTE',
          'Pago de certificación'
        )
      `, [
        planPago.id,
        conceptos['CERTIFICACION'],
        ultimaFecha,
        monto_certificacion
      ]);

    }

    await client.query('COMMIT');

    return {
      mensaje: 'Plan manual creado correctamente',
      plan_pago_alumno_id: planPago.id
    };

  } catch (err) {

    await client.query('ROLLBACK');
    throw err;

  } finally {

    client.release();

  }

}

async function editarPago({
  pago_id,
  metodo_pago,
  numero_operacion,
  comprobante_url,
  observaciones
}) {

  const query = `
    UPDATE pagos
    SET
      metodo_pago = $1,
      numero_operacion = $2,
      comprobante_url = $3,
      observaciones = $4
    WHERE id = $5
    RETURNING *
  `;

  const result = await pool.query(query, [
    metodo_pago,
    numero_operacion,
    comprobante_url,
    observaciones,
    pago_id
  ]);

  if (!result.rows.length) {
    throw new Error('Pago no encontrado');
  }

  return result.rows[0];
}
async function actualizarFechas(cuotas) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const cuota of cuotas) {
      const idParaActualizar = cuota.cuota_id || cuota.id;

      if (!idParaActualizar) {
        throw new Error('ID de cuota no proporcionado');
      }

      await client.query(`
        UPDATE cuotas 
        SET fecha_vencimiento = $1 
        WHERE id = $2
      `, [cuota.fecha_vencimiento, idParaActualizar]);
    }

    await client.query('COMMIT');
    return { mensaje: 'Fechas actualizadas correctamente' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function eliminarPago(id) {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');


    const pagoRes = await client.query(`
      SELECT *
      FROM pagos
      WHERE id = $1
      FOR UPDATE
    `,[id]);


    const pago = pagoRes.rows[0];


    if(!pago){
      throw new Error('Pago no encontrado');
    }


    if(pago.cuota_id){

      await client.query(`
        UPDATE cuotas
        SET
          monto_pagado = monto_pagado - $1,
          saldo_pendiente = saldo_pendiente + $1,
          estado = 'PENDIENTE'
        WHERE id = $2
      `,
      [
        pago.monto,
        pago.cuota_id
      ]);

    }


    await client.query(`
      DELETE FROM pagos
      WHERE id=$1
    `,
    [id]);


    await client.query('COMMIT');


    return {
      mensaje:'Pago eliminado correctamente'
    };


  } catch(error){

    await client.query('ROLLBACK');
    throw error;

  } finally {

    client.release();

  }

}
module.exports = {
  listarPagos,
  listarResumenPagos,
  obtenerHistorialPagos,
  registrarPago,
  recalcularPlanPago,
  editarCuota,
  crearPlanPagoManual,
  actualizarFechas,
  buscarMatriculasParaPago,
  editarPago,
  eliminarPago
};


