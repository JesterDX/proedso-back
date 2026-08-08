
const pool = require('../config/db');


// ============================================================
// HELPERS
// ============================================================

function redondear(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function sumar(arr, campo) {
  return redondear(
    arr.reduce((total, item) => total + Number(item[campo] || 0), 0)
  );
}

function agregarDias(fecha, dias) {
  const resultado = new Date(fecha);
  resultado.setDate(resultado.getDate() + Number(dias));
  return resultado;
}

function normalizarFecha(fecha) {
  if (!fecha) return null;

  if (fecha instanceof Date) {
    return fecha.toISOString().split('T')[0];
  }

  return String(fecha).substring(0, 10);
}

function obtenerIntervalo(modalidad) {
  return modalidad === 'QUINCENAL' ? 14 : 20;
}


// ============================================================
// LISTAR PAGOS
// ============================================================

async function listarPagos(filtros = {}) {

  const {
    search = '',
    estado = null,
    matricula_id = null
  } = filtros;

  const values = [];
  let where = `WHERE 1=1`;

  if (matricula_id) {
    values.push(matricula_id);

    where += `
      AND m.id = $${values.length}
    `;
  }

  if (estado) {
    values.push(estado);

    where += `
      AND c.estado = $${values.length}
    `;
  }

  if (search && String(search).trim() !== '') {

    values.push(`%${search.toLowerCase()}%`);

    where += `
      AND (
        a.dni ILIKE $${values.length}
        OR unaccent(
          lower(a.nombres || ' ' || a.apellidos)
        ) LIKE unaccent($${values.length})
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

      STRING_AGG(
        ma.nombre,
        ', '
        ORDER BY mm.orden, mm.id
      ) FILTER (
        WHERE mm.estado = 'PENDIENTE'
      ) AS maquinas,

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

    ORDER BY
      c.fecha_vencimiento ASC
  `, values);

  return result.rows;
}


// ============================================================
// RESUMEN DE PAGOS
// ============================================================

async function listarResumenPagos() {

  const result = await pool.query(`
    SELECT

      m.id AS matricula_id,

      a.nombres || ' ' || a.apellidos AS alumno,

      a.foto_url,

      pc.nombre AS plan_nombre,

      m.fecha_matricula,

      SUM(c.saldo_pendiente) AS total_deuda,

      COUNT(
        CASE
          WHEN
            c.saldo_pendiente > 0
            AND c.fecha_vencimiento < CURRENT_DATE
          THEN 1
        END
      ) AS cuotas_vencidas,

      COUNT(
        CASE
          WHEN
            c.saldo_pendiente > 0
            AND c.fecha_vencimiento BETWEEN
              CURRENT_DATE
              AND CURRENT_DATE + INTERVAL '5 days'
          THEN 1
        END
      ) AS cuotas_por_vencer,

      CASE

        WHEN COUNT(
          CASE
            WHEN
              c.saldo_pendiente > 0
              AND c.fecha_vencimiento < CURRENT_DATE
            THEN 1
          END
        ) > 0

        THEN 'MOROSO'

        WHEN COUNT(
          CASE
            WHEN
              c.saldo_pendiente > 0
              AND c.fecha_vencimiento BETWEEN
                CURRENT_DATE
                AND CURRENT_DATE + INTERVAL '5 days'
            THEN 1
          END
        ) > 0

        THEN 'POR_VENCER'

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
      pc.nombre,
      m.fecha_matricula

    ORDER BY alumno
  `);

  return result.rows;
}


// ============================================================
// HISTORIAL
// ============================================================

async function obtenerHistorialPagos(matricula_id) {

  const result = await pool.query(`
    SELECT

      p.id,
      p.monto,
      p.fecha_pago,
      p.metodo_pago,
      p.numero_operacion,
      p.comprobante_url,
      p.observaciones,

      cc.nombre AS concepto_nombre

    FROM pagos p

    INNER JOIN cuotas c
      ON c.id = p.cuota_id

    INNER JOIN conceptos_cobro cc
      ON cc.id = c.concepto_id

    WHERE c.plan_pago_alumno_id IN (

      SELECT id
      FROM planes_pago_alumno
      WHERE matricula_id = $1

    )

    ORDER BY p.fecha_pago DESC
  `, [matricula_id]);

  return result.rows;
}


// ============================================================
// REGISTRAR PAGO
// ============================================================

async function registrarPago({
  cuota_id,
  monto,
  metodo_pago,
  comprobante_url
}) {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const cuotaRes = await client.query(`
      SELECT
        saldo_pendiente,
        plan_pago_alumno_id
      FROM cuotas
      WHERE id = $1
      FOR UPDATE
    `, [cuota_id]);

    if (!cuotaRes.rows.length) {
      throw new Error('Cuota no encontrada');
    }

    const {
      saldo_pendiente: saldo,
      plan_pago_alumno_id
    } = cuotaRes.rows[0];

    if (!plan_pago_alumno_id) {
      throw new Error('Cuota sin plan');
    }

    if (Number(saldo) <= 0) {
      throw new Error('Ya pagada');
    }

    if (Number(monto) <= 0) {
      throw new Error('Monto inválido');
    }

    if (Number(monto) > Number(saldo)) {
      throw new Error('El monto excede el saldo pendiente');
    }

    const pago = await client.query(`
      INSERT INTO pagos (
        plan_pago_alumno_id,
        cuota_id,
        monto,
        metodo_pago,
        comprobante_url,
        fecha_pago
      )

      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        NOW()
      )

      RETURNING *
    `, [
      plan_pago_alumno_id,
      cuota_id,
      monto,
      metodo_pago,
      comprobante_url
    ]);

    await client.query(`
      UPDATE cuotas
      SET

        monto_pagado =
          monto_pagado + $1,

        saldo_pendiente =
          saldo_pendiente - $1,

        estado =
          CASE
            WHEN saldo_pendiente - $1 <= 0
            THEN 'PAGADO'
            ELSE 'PENDIENTE'
          END

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


// ============================================================
// BUSCAR MATRÍCULAS
// ============================================================

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

      STRING_AGG(
        ma.nombre,
        ', '
      ) AS maquinas

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

      m.activo = true

      AND (
        a.dni ILIKE $1

        OR unaccent(
          lower(
            a.nombres || ' ' || a.apellidos
          )
        )
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


// ============================================================
// EDITAR CUOTA
// ============================================================

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

  if (cuota.estado === 'PAGADO') {
    throw new Error(
      'No se puede editar una cuota pagada'
    );
  }

  const monto = redondear(monto_programado);

  if (monto <= 0) {
    throw new Error(
      'El monto debe ser mayor a cero'
    );
  }

  await pool.query(`
    UPDATE cuotas

    SET

      fecha_vencimiento = $1,

      monto_programado = $2,

      saldo_pendiente =
        $2 - monto_pagado,

      estado =
        CASE
          WHEN $2 - monto_pagado <= 0
          THEN 'PAGADO'
          ELSE 'PENDIENTE'
        END

    WHERE id = $3
  `, [
    fecha_vencimiento,
    monto,
    cuota_id
  ]);

  return {
    mensaje: 'Cuota actualizada correctamente'
  };
}


// ============================================================
// ACTUALIZAR FECHAS
// ============================================================

async function actualizarFechas(cuotas) {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    for (const cuota of cuotas) {

      const idParaActualizar =
        cuota.cuota_id || cuota.id;

      if (!idParaActualizar) {
        throw new Error(
          'ID de cuota no proporcionado'
        );
      }

      await client.query(`
        UPDATE cuotas

        SET fecha_vencimiento = $1

        WHERE id = $2
      `, [
        cuota.fecha_vencimiento,
        idParaActualizar
      ]);
    }

    await client.query('COMMIT');

    return {
      mensaje:
        'Fechas actualizadas correctamente'
    };

  } catch (err) {

    await client.query('ROLLBACK');

    throw err;

  } finally {

    client.release();

  }
}


// ============================================================
// EDITAR PAGO
// ============================================================

async function editarPago({
  pago_id,
  metodo_pago,
  numero_operacion,
  comprobante_url,
  observaciones
}) {

  const result = await pool.query(`
    UPDATE pagos

    SET

      metodo_pago = $1,
      numero_operacion = $2,
      comprobante_url = $3,
      observaciones = $4

    WHERE id = $5

    RETURNING *
  `, [
    metodo_pago,
    numero_operacion,
    comprobante_url,
    observaciones,
    pago_id
  ]);

  if (!result.rows.length) {
    throw new Error(
      'Pago no encontrado'
    );
  }

  return result.rows[0];
}


// ============================================================
// ELIMINAR PAGO
// ============================================================

async function eliminarPago(id) {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const pagoRes = await client.query(`
      SELECT *
      FROM pagos
      WHERE id = $1
      FOR UPDATE
    `, [id]);

    const pago = pagoRes.rows[0];

    if (!pago) {
      throw new Error(
        'Pago no encontrado'
      );
    }

    if (pago.cuota_id) {

      await client.query(`
        UPDATE cuotas

        SET

          monto_pagado =
            monto_pagado - $1,

          saldo_pendiente =
            saldo_pendiente + $1,

          estado = 'PENDIENTE'

        WHERE id = $2
      `, [
        pago.monto,
        pago.cuota_id
      ]);
    }

    await client.query(`
      DELETE FROM pagos
      WHERE id = $1
    `, [id]);

    await client.query('COMMIT');

    return {
      mensaje:
        'Pago eliminado correctamente'
    };

  } catch (error) {

    await client.query('ROLLBACK');

    throw error;

  } finally {

    client.release();

  }
}


// ============================================================
// CREAR PLAN MANUAL
// ============================================================

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

    const matriculaRes = await client.query(`
      SELECT *
      FROM matriculas
      WHERE id = $1
      LIMIT 1
    `, [matricula_id]);

    if (!matriculaRes.rows.length) {
      throw new Error(
        'Matrícula no encontrada'
      );
    }

    const existePlan = await client.query(`
      SELECT id
      FROM planes_pago_alumno
      WHERE matricula_id = $1
      LIMIT 1
    `, [matricula_id]);

    if (existePlan.rows.length) {
      throw new Error(
        'La matrícula ya tiene un plan de pagos'
      );
    }

    if (
      !Array.isArray(cuotas) ||
      cuotas.length === 0
    ) {
      throw new Error(
        'Debe enviar al menos una cuota'
      );
    }

    const conceptosRes = await client.query(`
      SELECT id, codigo
      FROM conceptos_cobro
    `);

    const conceptos = {};

    for (const concepto of conceptosRes.rows) {
      conceptos[concepto.codigo] =
        concepto.id;
    }

    const cantidad_cuotas =
      cuotas.length;

    const monto_cuota =
      redondear(
        cuotas.reduce(
          (acc, item) =>
            acc + Number(item.monto),
          0
        ) / cantidad_cuotas
      );

    const planPagoRes =
      await client.query(`
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

    const planPago =
      planPagoRes.rows[0];

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
        conceptos.MATRICULA,
        monto_matricula
      ]);
    }

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
        conceptos.CUOTA,
        cuota.fecha_vencimiento,
        cuota.monto,
        cuota.observaciones ||
          `Cuota ${cuota.numero_cuota}`
      ]);
    }

    if (Number(monto_certificacion) > 0) {

      const ultimaFecha =
        cuotas[cuotas.length - 1]
          .fecha_vencimiento;

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
        conceptos.CERTIFICACION,
        ultimaFecha,
        monto_certificacion
      ]);
    }

    await client.query('COMMIT');

    return {
      mensaje:
        'Plan manual creado correctamente',

      plan_pago_alumno_id:
        planPago.id
    };

  } catch (err) {

    await client.query('ROLLBACK');

    throw err;

  } finally {

    client.release();

  }
}


// ============================================================
// OBTENER PLAN + CUOTAS
// ============================================================

async function obtenerDatosCambioPlan(
  client,
  matricula_id,
  nuevo_plan_precio_id
) {

  const planActualRes =
    await client.query(`
      SELECT

        ppa.*,

        pp.nombre AS plan_nombre_actual,

        pp.plan_curso_id AS plan_curso_actual

      FROM planes_pago_alumno ppa

      LEFT JOIN plan_precios pp
        ON pp.id = ppa.plan_precio_id

      WHERE ppa.matricula_id = $1

      LIMIT 1

      FOR UPDATE OF ppa
    `, [matricula_id]);

  if (!planActualRes.rows.length) {
    throw new Error(
      'La matrícula no tiene un plan de pagos'
    );
  }

  const planActual =
    planActualRes.rows[0];

  const nuevoPlanRes =
    await client.query(`
      SELECT *

      FROM plan_precios

      WHERE id = $1

      LIMIT 1
    `, [nuevo_plan_precio_id]);

  if (!nuevoPlanRes.rows.length) {
    throw new Error(
      'Plan de precio no encontrado'
    );
  }

  const nuevoPlan =
    nuevoPlanRes.rows[0];

  const cuotasRes =
    await client.query(`
      SELECT

        c.*,

        cc.codigo AS concepto_codigo,

        cc.nombre AS concepto_nombre

      FROM cuotas c

      INNER JOIN conceptos_cobro cc
        ON cc.id = c.concepto_id

      WHERE
        c.plan_pago_alumno_id = $1

      ORDER BY

        CASE
          WHEN c.numero_cuota IS NULL
          THEN 999999
          ELSE c.numero_cuota
        END,

        c.id
    `, [planActual.id]);

  return {
    planActual,
    nuevoPlan,
    cuotas: cuotasRes.rows
  };
}


// ============================================================
// CONSTRUIR PREVISUALIZACIÓN
// ============================================================

function construirCambioPlan({
  planActual,
  nuevoPlan,
  cuotas,
  modalidad
}) {

  const cuotasNormales =
    cuotas.filter(
      c => c.concepto_codigo === 'CUOTA'
    );

  const matricula =
    cuotas.find(
      c => c.concepto_codigo === 'MATRICULA'
    );

  const certificacion =
    cuotas.find(
      c => c.concepto_codigo === 'CERTIFICACION'
    );

  // ----------------------------------------------------------
  // PAGOS
  // ----------------------------------------------------------

  const totalPagado =
    sumar(cuotas, 'monto_pagado');

  const totalPagadoCuotas =
    sumar(
      cuotasNormales,
      'monto_pagado'
    );

  const cuotasConPago =
    cuotasNormales.filter(
      c => Number(c.monto_pagado) > 0
    );

  const cuotasPagadas =
    cuotasNormales.filter(
      c =>
        Number(c.saldo_pendiente) <= 0
    );

  const cuotasPendientes =
    cuotasNormales.filter(
      c =>
        Number(c.saldo_pendiente) > 0
    );

  // ----------------------------------------------------------
  // NUEVO TOTAL
  // ----------------------------------------------------------

  const nuevoTotal =
    Number(nuevoPlan.monto_total || 0);

  const nuevoSaldoTotal =
    redondear(
      nuevoTotal - totalPagado
    );

  if (nuevoSaldoTotal < 0) {

    throw new Error(
      `El alumno ya ha pagado S/ ${totalPagado.toFixed(2)}, ` +
      `superando el nuevo valor del plan de S/ ${nuevoTotal.toFixed(2)}`
    );
  }

  // ----------------------------------------------------------
  // CUOTAS DISPONIBLES
  // ----------------------------------------------------------

  const cantidadNueva =
    Number(nuevoPlan.cantidad_cuotas || 0);

  const cantidadPagadas =
    cuotasConPago.length;

  const cuotasRegularesDisponibles =
    Math.max(
      cantidadNueva - cantidadPagadas,
      0
    );

  // ----------------------------------------------------------
  // FECHA BASE
  // ----------------------------------------------------------

  const cuotasOrdenadas =
    [...cuotasNormales].sort(
      (a, b) =>
        Number(a.numero_cuota || 0) -
        Number(b.numero_cuota || 0)
    );

  const ultimaCuota =
    cuotasOrdenadas.length
      ? cuotasOrdenadas[
          cuotasOrdenadas.length - 1
        ]
      : null;

  const fechaBase =
    ultimaCuota?.fecha_vencimiento
      ? normalizarFecha(
          ultimaCuota.fecha_vencimiento
        )
      : new Date()
          .toISOString()
          .split('T')[0];

  const intervalo =
    obtenerIntervalo(modalidad);

  // ----------------------------------------------------------
  // SALDO PARA CUOTAS
  // ----------------------------------------------------------

  let saldoParaCuotas =
    nuevoSaldoTotal;

  // ----------------------------------------------------------
  // MATRÍCULA
  // ----------------------------------------------------------

  const nuevaMatricula =
    Number(nuevoPlan.matricula || 0);

  const pagadoMatricula =
    Number(
      matricula?.monto_pagado || 0
    );

  const saldoMatricula =
    redondear(
      Math.max(
        nuevaMatricula -
          pagadoMatricula,
        0
      )
    );

  // ----------------------------------------------------------
  // CERTIFICACIÓN
  // ----------------------------------------------------------

  const nuevaCertificacion =
    Number(
      nuevoPlan.certificacion || 0
    );

  const pagadoCertificacion =
    Number(
      certificacion?.monto_pagado || 0
    );

  const saldoCertificacion =
    redondear(
      Math.max(
        nuevaCertificacion -
          pagadoCertificacion,
        0
      )
    );

  // ----------------------------------------------------------
  // EL SALDO DE CUOTAS ES LO QUE QUEDA DESPUÉS
  // DE MATRÍCULA Y CERTIFICACIÓN
  // ----------------------------------------------------------

  saldoParaCuotas =
    redondear(
      Math.max(
        nuevoTotal -
          totalPagado -
          saldoMatricula -
          saldoCertificacion,
        0
      )
    );

  // ----------------------------------------------------------
  // GENERAR CRONOGRAMA PREVISTO
  // ----------------------------------------------------------

  const cronograma = [];

  let acumulado = 0;

  // Primero conservamos todas las cuotas
  // que tienen pagos.

  for (const cuota of cuotasConPago) {

    cronograma.push({
      tipo: 'EXISTENTE',

      cuota_id: cuota.id,

      numero_cuota:
        cuota.numero_cuota,

      fecha_vencimiento:
        normalizarFecha(
          cuota.fecha_vencimiento
        ),

      monto_programado:
        Number(cuota.monto_programado),

      monto_pagado:
        Number(cuota.monto_pagado),

      saldo_pendiente:
        Number(cuota.saldo_pendiente),

      estado:
        cuota.estado,

      observaciones:
        cuota.observaciones
    });
  }

  // ----------------------------------------------------------
  // DISTRIBUIR SALDO
  // ----------------------------------------------------------

  const cuotasNuevas = [];

  if (
    saldoParaCuotas > 0 &&
    cuotasRegularesDisponibles > 0
  ) {

    const montoBase =
      redondear(
        saldoParaCuotas /
          cuotasRegularesDisponibles
      );

    let acumuladoNuevo = 0;

    for (
      let i = 0;
      i < cuotasRegularesDisponibles;
      i++
    ) {

      let monto =
        montoBase;

      if (
        i ===
        cuotasRegularesDisponibles - 1
      ) {

        monto =
          redondear(
            saldoParaCuotas -
              acumuladoNuevo
          );
      }

      acumuladoNuevo =
        redondear(
          acumuladoNuevo + monto
        );

      const fecha =
        agregarDias(
          fechaBase,
          intervalo * (i + 1)
        );

      cuotasNuevas.push({

        tipo: 'NUEVA',

        cuota_id: null,

        numero_cuota:
          cantidadPagadas + i + 1,

        fecha_vencimiento:
          normalizarFecha(fecha),

        monto_programado:
          monto,

        monto_pagado: 0,

        saldo_pendiente:
          monto,

        estado: 'PENDIENTE',

        observaciones:
          `Cuota ${cantidadPagadas + i + 1} ` +
          `de ${cantidadNueva} - ` +
          `${modalidad}`
      });
    }
  }

  // ----------------------------------------------------------
  // RESPALDO
  // ----------------------------------------------------------

  const totalCronograma =
    sumar(
      cuotasNuevas,
      'monto_programado'
    );

  const diferenciaRespaldo =
    redondear(
      saldoParaCuotas -
        totalCronograma
    );

  const respaldos = [];

  if (diferenciaRespaldo > 0) {

    respaldos.push({

      tipo: 'RESPALDO',

      cuota_id: null,

      numero_cuota: null,

      fecha_vencimiento:
        normalizarFecha(
          agregarDias(
            fechaBase,
            intervalo *
              Math.max(
                cantidadNueva,
                cantidadPagadas
              ) + intervalo
          )
        ),

      monto_programado:
        diferenciaRespaldo,

      monto_pagado: 0,

      saldo_pendiente:
        diferenciaRespaldo,

      estado: 'PENDIENTE',

      observaciones:
        'CUOTA DE RESPALDO - ' +
        'Diferencia generada por reajuste de plan'
    });
  }

  // ----------------------------------------------------------
  // RESULTADO
  // ----------------------------------------------------------

  const cronogramaFinal = [
    ...cronograma,
    ...cuotasNuevas,
    ...respaldos
  ];

  const totalCronogramaFinal =
    redondear(
      sumar(
        cronogramaFinal,
        'monto_programado'
      )
    );

  return {

    plan_actual: {

      id:
        planActual.plan_precio_id,

      nombre:
        planActual.plan_nombre_actual,

      monto_total:
        Number(
          planActual.monto_total
        ),

      cantidad_cuotas:
        Number(
          planActual.cantidad_cuotas
        ),

      monto_cuota:
        Number(
          planActual.monto_cuota || 0
        )
    },

    plan_nuevo: {

      id:
        nuevoPlan.id,

      nombre:
        nuevoPlan.nombre,

      monto_total:
        nuevoTotal,

      matricula:
        nuevaMatricula,

      certificacion:
        nuevaCertificacion,

      cantidad_cuotas:
        cantidadNueva,

      monto_cuota:
        Number(
          nuevoPlan.monto_cuota || 0
        )
    },

    resumen: {

      total_pagado:
        totalPagado,

      nuevo_total:
        nuevoTotal,

      nuevo_saldo:
        nuevoSaldoTotal,

      cuotas_con_pago:
        cantidadConPagoSeguro(
          cuotasConPago
        ),

      cuotas_pagadas:
        cuotasPagadas.length,

      cuotas_pendientes:
        cuotasPendientes.length,

      cuotas_nuevas:
        cuotasNuevas.length,

      cuotas_respaldo:
        respaldos.length,

      monto_respaldo:
        diferenciaRespaldo > 0
          ? diferenciaRespaldo
          : 0,

      saldo_matricula:
        saldoMatricula,

      saldo_certificacion:
        saldoCertificacion,

      total_cronograma:
        totalCronogramaFinal,

      diferencia_control:
        redondear(
          nuevoTotal -
            totalPagado -
            totalCronogramaFinal
        )
    },

    cronograma: cronogramaFinal
  };
}


// ============================================================
// HELPER PEQUEÑO
// ============================================================

function cantidadConPagoSeguro(cuotas) {
  return Array.isArray(cuotas)
    ? cuotas.length
    : 0;
}


// ============================================================
// PREVISUALIZAR CAMBIO DE PLAN
// ============================================================

async function previsualizarCambioPlan({
  matricula_id,
  nuevo_plan_precio_id,
  modalidad_pago = 'MENSUAL'
}) {

  const client = await pool.connect();

  try {

    const datos =
      await obtenerDatosCambioPlan(
        client,
        matricula_id,
        nuevo_plan_precio_id
      );

    const resultado =
      construirCambioPlan({
        ...datos,
        modalidad:
          modalidad_pago ||
          datos.planActual.modalidad_pago ||
          'MENSUAL'
      });

    return {
      ok: true,
      modo: 'PREVISUALIZACION',
      matricula_id,
      ...resultado
    };

  } finally {

    client.release();

  }
}


// ============================================================
// APLICAR CAMBIO DE PLAN
// ============================================================

async function aplicarCambioPlan({
  matricula_id,
  nuevo_plan_precio_id,
  modalidad_pago = null
}) {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    // --------------------------------------------------------
    // OBTENER DATOS
    // --------------------------------------------------------

    const datos =
      await obtenerDatosCambioPlan(
        client,
        matricula_id,
        nuevo_plan_precio_id
      );

    const modalidad =
      modalidad_pago ||
      datos.planActual.modalidad_pago ||
      'MENSUAL';

    const resultado =
      construirCambioPlan({
        ...datos,
        modalidad
      });

    // --------------------------------------------------------
    // PROTECCIÓN
    // --------------------------------------------------------

    if (
      Math.abs(
        Number(
          resultado.resumen.diferencia_control
        )
      ) > 0.01
    ) {

      throw new Error(
        'El reajuste no cuadra con el monto total del nuevo plan'
      );
    }

    // --------------------------------------------------------
    // ACTUALIZAR PLAN
    // --------------------------------------------------------

    await client.query(`
      UPDATE planes_pago_alumno

      SET

        plan_precio_id = $1,

        monto_total = $2,

        monto_matricula = $3,

        monto_certificacion = $4,

        cantidad_cuotas = $5,

        monto_cuota = $6,

        modalidad_pago = $7

      WHERE id = $8
    `, [

      datos.nuevoPlan.id,

      datos.nuevoPlan.monto_total,

      datos.nuevoPlan.matricula,

      datos.nuevoPlan.certificacion,

      datos.nuevoPlan.cantidad_cuotas,

      datos.nuevoPlan.monto_cuota,

      modalidad,

      datos.planActual.id

    ]);

    // --------------------------------------------------------
    // ELIMINAR SOLAMENTE CUOTAS SIN PAGOS
    // --------------------------------------------------------

    await client.query(`
      DELETE FROM cuotas

      WHERE

        plan_pago_alumno_id = $1

        AND concepto_id = (
          SELECT id
          FROM conceptos_cobro
          WHERE codigo = 'CUOTA'
        )

        AND monto_pagado = 0
    `, [
      datos.planActual.id
    ]);

    // --------------------------------------------------------
    // OBTENER CONCEPTO CUOTA
    // --------------------------------------------------------

    const conceptoRes =
      await client.query(`
        SELECT id
        FROM conceptos_cobro
        WHERE codigo = 'CUOTA'
        LIMIT 1
      `);

    if (!conceptoRes.rows.length) {
      throw new Error(
        'No existe el concepto CUOTA'
      );
    }

    const conceptoCuotaId =
      conceptoRes.rows[0].id;

    // --------------------------------------------------------
    // RECONSTRUIR CUOTAS NUEVAS
    // --------------------------------------------------------

    for (
      const cuota
      of resultado.cronograma
    ) {

      // Las cuotas existentes con pago
      // NO se vuelven a insertar.

      if (
        cuota.tipo === 'EXISTENTE'
      ) {
        continue;
      }

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

        datos.planActual.id,

        cuota.tipo === 'RESPALDO'
          ? null
          : cuota.numero_cuota,

        conceptoCuotaId,

        cuota.fecha_vencimiento,

        cuota.monto_programado,

        cuota.observaciones

      ]);
    }

    // --------------------------------------------------------
    // ACTUALIZAR MATRÍCULA
    // SI CAMBIAR DE PLAN TAMBIÉN CAMBIA EL PLAN DE CURSO
    // --------------------------------------------------------

    await client.query(`
      UPDATE matriculas

      SET plan_curso_id = $1

      WHERE id = $2
    `, [
      datos.nuevoPlan.plan_curso_id,
      matricula_id
    ]);

    // --------------------------------------------------------
    // CERTIFICACIÓN
    // --------------------------------------------------------

    const certRes =
      await client.query(`
        SELECT *

        FROM cuotas

        WHERE

          plan_pago_alumno_id = $1

          AND concepto_id = (
            SELECT id
            FROM conceptos_cobro
            WHERE codigo = 'CERTIFICACION'
          )

        LIMIT 1
      `, [
        datos.planActual.id
      ]);

    const certificacion =
      certRes.rows[0];

    const nuevoMontoCert =
      Number(
        datos.nuevoPlan.certificacion || 0
      );

    if (certificacion) {

      if (
        Number(certificacion.monto_pagado) > 0
      ) {

        const nuevoSaldo =
          redondear(
            nuevoMontoCert -
              Number(
                certificacion.monto_pagado
              )
          );

        await client.query(`
          UPDATE cuotas

          SET

            monto_programado = $1,

            saldo_pendiente = $2,

            estado =
              CASE
                WHEN $2 <= 0
                THEN 'PAGADO'
                ELSE 'PENDIENTE'
              END

          WHERE id = $3
        `, [
          nuevoMontoCert,
          Math.max(nuevoSaldo, 0),
          certificacion.id
        ]);

      } else {

        await client.query(`
          UPDATE cuotas

          SET

            monto_programado = $1,

            saldo_pendiente = $1,

            estado =
              CASE
                WHEN $1 <= 0
                THEN 'PAGADO'
                ELSE 'PENDIENTE'
              END

          WHERE id = $2
        `, [
          nuevoMontoCert,
          certificacion.id
        ]);
      }

    } else if (nuevoMontoCert > 0) {

      const ultimaFechaRes =
        await client.query(`
          SELECT MAX(fecha_vencimiento) AS fecha
          FROM cuotas
          WHERE
            plan_pago_alumno_id = $1
            AND concepto_id = $2
        `, [
          datos.planActual.id,
          conceptoCuotaId
        ]);

      const fecha =
        ultimaFechaRes.rows[0]?.fecha ||
        new Date();

      const conceptoCertRes =
        await client.query(`
          SELECT id
          FROM conceptos_cobro
          WHERE codigo = 'CERTIFICACION'
          LIMIT 1
        `);

      if (
        conceptoCertRes.rows.length
      ) {

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
          datos.planActual.id,
          conceptoCertRes.rows[0].id,
          fecha,
          nuevoMontoCert
        ]);
      }
    }

    // --------------------------------------------------------
    // MATRÍCULA
    // --------------------------------------------------------

    const matriculaRes =
      await client.query(`
        SELECT *

        FROM cuotas

        WHERE

          plan_pago_alumno_id = $1

          AND concepto_id = (
            SELECT id
            FROM conceptos_cobro
            WHERE codigo = 'MATRICULA'
          )

        LIMIT 1
      `, [
        datos.planActual.id
      ]);

    const cuotaMatricula =
      matriculaRes.rows[0];

    const nuevoMontoMatricula =
      Number(
        datos.nuevoPlan.matricula || 0
      );

    if (cuotaMatricula) {

      const pagado =
        Number(
          cuotaMatricula.monto_pagado
        );

      const nuevoSaldo =
        Math.max(
          redondear(
            nuevoMontoMatricula -
              pagado
          ),
          0
        );

      await client.query(`
        UPDATE cuotas

        SET

          monto_programado = $1,

          saldo_pendiente = $2,

          estado =
            CASE
              WHEN $2 <= 0
              THEN 'PAGADO'
              ELSE 'PENDIENTE'
            END

        WHERE id = $3
      `, [
        nuevoMontoMatricula,
        nuevoSaldo,
        cuotaMatricula.id
      ]);

    } else if (
      nuevoMontoMatricula > 0
    ) {

      const conceptoMatRes =
        await client.query(`
          SELECT id
          FROM conceptos_cobro
          WHERE codigo = 'MATRICULA'
          LIMIT 1
        `);

      if (
        conceptoMatRes.rows.length
      ) {

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
          datos.planActual.id,
          conceptoMatRes.rows[0].id,
          nuevoMontoMatricula
        ]);
      }
    }

    // --------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------

    await client.query('COMMIT');

    return {

      ok: true,

      mensaje:
        'Cambio de plan aplicado correctamente',

      matricula_id,

      plan_anterior:
        datos.planActual.plan_nombre_actual,

      plan_nuevo:
        datos.nuevoPlan.nombre,

      resumen:
        resultado.resumen,

      cronograma:
        resultado.cronograma

    };

  } catch (error) {

    await client.query('ROLLBACK');

    throw error;

  } finally {

    client.release();

  }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  listarPagos,

  listarResumenPagos,

  obtenerHistorialPagos,

  registrarPago,

  editarCuota,

  crearPlanPagoManual,

  actualizarFechas,

  buscarMatriculasParaPago,

  editarPago,

  eliminarPago,

  previsualizarCambioPlan,

  aplicarCambioPlan

};

