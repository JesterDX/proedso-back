const pool = require('../config/db');


// ============================================================
// HELPERS
// ============================================================

function redondear(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return Math.round((numero + Number.EPSILON) * 100) / 100;
}


function numeroSeguro(valor, defecto = 0) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : defecto;
}


function sumar(arr, campo) {
  if (!Array.isArray(arr)) {
    return 0;
  }

  return redondear(
    arr.reduce(
      (total, item) =>
        total + numeroSeguro(item?.[campo]),
      0
    )
  );
}


function agregarDias(fecha, dias) {
  const resultado = new Date(fecha);

  resultado.setDate(
    resultado.getDate() + Number(dias || 0)
  );

  return resultado;
}


function normalizarFecha(fecha) {
  if (!fecha) {
    return null;
  }

  if (fecha instanceof Date) {
    return fecha.toISOString().substring(0, 10);
  }

  const valor = String(fecha);

  // PostgreSQL puede devolver:
  // 2026-08-08
  // 2026-08-08T00:00:00.000Z
  if (/^\d{4}-\d{2}-\d{2}/.test(valor)) {
    return valor.substring(0, 10);
  }

  return valor.substring(0, 10);
}


function fechaValida(fecha) {
  if (!fecha) {
    return false;
  }

  const normalizada = normalizarFecha(fecha);

  return /^\d{4}-\d{2}-\d{2}$/.test(normalizada);
}


function obtenerIntervalo(modalidad) {
  const modalidadNormalizada =
    String(modalidad || 'MENSUAL')
      .trim()
      .toUpperCase();

  switch (modalidadNormalizada) {
    case 'QUINCENAL':
      return 14;

    case 'MENSUAL':
      return 30;

    case 'CADA_20_DIAS':
      return 20;

    case 'SEMANAL':
      return 7;

    default:
      return 30;
  }
}


function normalizarModalidad(modalidad) {
  const valor =
    String(modalidad || 'MENSUAL')
      .trim()
      .toUpperCase();

  const permitidas = [
    'MENSUAL',
    'QUINCENAL',
    'CADA_20_DIAS',
    'SEMANAL'
  ];

  return permitidas.includes(valor)
    ? valor
    : 'MENSUAL';
}


function obtenerNumeroCuota(cuota) {
  const numero = Number(cuota?.numero_cuota);

  return Number.isFinite(numero)
    ? numero
    : null;
}


function obtenerFechaActualLocal() {
  const ahora = new Date();

  return ahora
    .toISOString()
    .substring(0, 10);
}


function validarMontoPositivo(monto, mensaje = 'Monto inválido') {
  const numero = redondear(monto);

  if (numero <= 0) {
    throw new Error(mensaje);
  }

  return numero;
}


function validarMontoNoNegativo(
  monto,
  mensaje = 'El monto no puede ser negativo'
) {
  const numero = redondear(monto);

  if (numero < 0) {
    throw new Error(mensaje);
  }

  return numero;
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

  let where = `
    WHERE 1 = 1
  `;


  // ----------------------------------------------------------
  // MATRÍCULA
  // ----------------------------------------------------------

  if (
    matricula_id !== null &&
    matricula_id !== undefined &&
    String(matricula_id).trim() !== ''
  ) {

    const id = Number(matricula_id);

    if (!Number.isInteger(id)) {
      throw new Error('matricula_id inválido');
    }

    values.push(id);

    where += `
      AND m.id = $${values.length}
    `;
  }


  // ----------------------------------------------------------
  // ESTADO
  // ----------------------------------------------------------

  if (
    estado !== null &&
    estado !== undefined &&
    String(estado).trim() !== ''
  ) {

    values.push(
      String(estado).trim().toUpperCase()
    );

    where += `
      AND c.estado = $${values.length}
    `;
  }


  // ----------------------------------------------------------
  // BUSCADOR
  // ----------------------------------------------------------

  if (
    search !== null &&
    search !== undefined &&
    String(search).trim() !== ''
  ) {

    const termino =
      `%${String(search).trim().toLowerCase()}%`;

    values.push(termino);

    where += `
      AND (
        LOWER(COALESCE(a.dni, '')) LIKE $${values.length}

        OR unaccent(
          LOWER(
            COALESCE(a.nombres, '') || ' ' ||
            COALESCE(a.apellidos, '')
          )
        ) LIKE unaccent($${values.length})

        OR unaccent(
          LOWER(
            COALESCE(cc.nombre, '')
          )
        ) LIKE unaccent($${values.length})
      )
    `;
  }


  // ----------------------------------------------------------
  // QUERY
  // ----------------------------------------------------------

  const result = await pool.query(`
    SELECT

      c.id,
      c.numero_cuota,

      c.fecha_programada,
      c.fecha_vencimiento,

      c.monto_programado,
      c.monto_pagado,
      c.saldo_pendiente,

      c.estado,
      c.observaciones,

      cc.codigo AS concepto_codigo,
      cc.nombre AS concepto_nombre,

      m.id AS matricula_id,

      a.id AS alumno_id,

      a.dni,

      a.nombres || ' ' ||
      a.apellidos AS alumno,

      a.nombres,
      a.apellidos,

      a.telefono,
      a.correo,
      a.foto_url,

      ppa.id AS plan_pago_alumno_id,

      STRING_AGG(
        DISTINCT ma.nombre,
        ', '
        ORDER BY ma.nombre
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

    INNER JOIN alumnos a
      ON a.id = m.alumno_id

    INNER JOIN planes_curso pc
      ON pc.id = m.plan_curso_id

    LEFT JOIN matricula_maquinas mm
      ON mm.matricula_id = m.id

    LEFT JOIN maquinas ma
      ON ma.id = mm.maquina_id

    ${where}

    GROUP BY

      c.id,
      c.numero_cuota,
      c.fecha_programada,
      c.fecha_vencimiento,
      c.monto_programado,
      c.monto_pagado,
      c.saldo_pendiente,
      c.estado,
      c.observaciones,

      cc.codigo,
      cc.nombre,

      m.id,

      a.id,
      a.dni,
      a.nombres,
      a.apellidos,
      a.telefono,
      a.correo,
      a.foto_url,

      ppa.id,

      pc.nombre

    ORDER BY
      c.fecha_vencimiento ASC NULLS LAST,
      c.numero_cuota ASC NULLS LAST,
      c.id ASC
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

      a.id AS alumno_id,

      a.dni,

      a.nombres || ' ' ||
      a.apellidos AS alumno,

      a.foto_url,

      pc.nombre AS plan_nombre,

      m.fecha_matricula,

      COALESCE(
        SUM(c.saldo_pendiente),
        0
      ) AS total_deuda,

      COUNT(*) FILTER (
        WHERE
          c.saldo_pendiente > 0
          AND c.fecha_vencimiento < CURRENT_DATE
      ) AS cuotas_vencidas,

      COUNT(*) FILTER (
        WHERE
          c.saldo_pendiente > 0
          AND c.fecha_vencimiento >= CURRENT_DATE
          AND c.fecha_vencimiento <=
            CURRENT_DATE + INTERVAL '5 days'
      ) AS cuotas_por_vencer,

      COUNT(*) FILTER (
        WHERE
          c.estado = 'PAGADO'
      ) AS cuotas_pagadas,

      COUNT(*) FILTER (
        WHERE
          c.saldo_pendiente > 0
      ) AS cuotas_pendientes,

      CASE

        WHEN COUNT(*) FILTER (
          WHERE
            c.saldo_pendiente > 0
            AND c.fecha_vencimiento < CURRENT_DATE
        ) > 0

        THEN 'MOROSO'

        WHEN COUNT(*) FILTER (
          WHERE
            c.saldo_pendiente > 0
            AND c.fecha_vencimiento >= CURRENT_DATE
            AND c.fecha_vencimiento <=
              CURRENT_DATE + INTERVAL '5 days'
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
      a.id,
      a.dni,
      a.nombres,
      a.apellidos,
      a.foto_url,
      pc.nombre,
      m.fecha_matricula

    ORDER BY
      alumno ASC
  `);

  return result.rows;
}


// ============================================================
// HISTORIAL DE PAGOS
// ============================================================

async function obtenerHistorialPagos(matricula_id) {

  const id = Number(matricula_id);

  if (!Number.isInteger(id)) {
    throw new Error('matricula_id inválido');
  }

  const result = await pool.query(`
    SELECT

      p.id,

      p.plan_pago_alumno_id,
      p.cuota_id,

      p.monto,

      p.fecha_pago,

      p.metodo_pago,

      p.numero_operacion,

      p.comprobante_url,

      p.observaciones,

      c.numero_cuota,

      c.fecha_vencimiento,

      cc.codigo AS concepto_codigo,
      cc.nombre AS concepto_nombre

    FROM pagos p

    INNER JOIN cuotas c
      ON c.id = p.cuota_id

    INNER JOIN conceptos_cobro cc
      ON cc.id = c.concepto_id

    INNER JOIN planes_pago_alumno ppa
      ON ppa.id = p.plan_pago_alumno_id

    WHERE ppa.matricula_id = $1

    ORDER BY
      p.fecha_pago DESC,
      p.id DESC
  `, [id]);

  return result.rows;
}


// ============================================================
// REGISTRAR PAGO
// ============================================================

async function registrarPago({
  cuota_id,
  monto,
  metodo_pago = null,
  numero_operacion = null,
  comprobante_url = null,
  observaciones = null
}) {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');


    // --------------------------------------------------------
    // VALIDACIONES
    // --------------------------------------------------------

    const cuotaId = Number(cuota_id);

    if (!Number.isInteger(cuotaId)) {
      throw new Error('cuota_id inválido');
    }

    const montoPago =
      validarMontoPositivo(
        monto,
        'El monto debe ser mayor a cero'
      );


    // --------------------------------------------------------
    // BLOQUEAR CUOTA
    // --------------------------------------------------------

    const cuotaRes = await client.query(`
      SELECT

        id,

        saldo_pendiente,

        monto_programado,

        monto_pagado,

        estado,

        plan_pago_alumno_id

      FROM cuotas

      WHERE id = $1

      FOR UPDATE
    `, [cuotaId]);


    if (!cuotaRes.rows.length) {
      throw new Error('Cuota no encontrada');
    }


    const cuota =
      cuotaRes.rows[0];


    const saldoActual =
      redondear(
        cuota.saldo_pendiente
      );


    const planPagoAlumnoId =
      cuota.plan_pago_alumno_id;


    if (!planPagoAlumnoId) {
      throw new Error(
        'La cuota no tiene plan de pago asociado'
      );
    }


    if (saldoActual <= 0) {
      throw new Error(
        'La cuota ya está pagada'
      );
    }


    if (montoPago > saldoActual) {
      throw new Error(
        `El monto excede el saldo pendiente de S/ ${saldoActual.toFixed(2)}`
      );
    }


    // --------------------------------------------------------
    // INSERTAR PAGO
    // --------------------------------------------------------

    const pagoRes = await client.query(`
      INSERT INTO pagos (

        plan_pago_alumno_id,

        cuota_id,

        monto,

        metodo_pago,

        numero_operacion,

        comprobante_url,

        observaciones,

        fecha_pago

      )

      VALUES (

        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        NOW()

      )

      RETURNING *
    `, [

      planPagoAlumnoId,

      cuotaId,

      montoPago,

      metodo_pago,

      numero_operacion,

      comprobante_url,

      observaciones

    ]);


    // --------------------------------------------------------
    // NUEVOS VALORES
    // --------------------------------------------------------

    const nuevoMontoPagado =
      redondear(
        numeroSeguro(cuota.monto_pagado) +
        montoPago
      );


    const nuevoSaldo =
      redondear(
        Math.max(
          saldoActual - montoPago,
          0
        )
      );


    const nuevoEstado =
      nuevoSaldo <= 0
        ? 'PAGADO'
        : 'PENDIENTE';


    // --------------------------------------------------------
    // ACTUALIZAR CUOTA
    // --------------------------------------------------------

    await client.query(`
      UPDATE cuotas

      SET

        monto_pagado = $1,

        saldo_pendiente = $2,

        estado = $3

      WHERE id = $4
    `, [

      nuevoMontoPagado,

      nuevoSaldo,

      nuevoEstado,

      cuotaId

    ]);


    await client.query('COMMIT');


    return {
      ...pagoRes.rows[0],

      cuota_id: cuotaId,

      monto_pagado:
        nuevoMontoPagado,

      saldo_pendiente:
        nuevoSaldo,

      estado:
        nuevoEstado
    };

  } catch (error) {

    await client.query('ROLLBACK');

    throw error;

  } finally {

    client.release();

  }
}


// ============================================================
// BUSCAR MATRÍCULAS PARA PAGO
// ============================================================

async function buscarMatriculasParaPago(search = '') {

  const termino =
    String(search || '').trim();


  const result = await pool.query(`
    SELECT

      m.id AS matricula_id,

      a.id AS alumno_id,

      a.dni,

      a.nombres,

      a.apellidos,

      a.nombres || ' ' ||
      a.apellidos AS alumno,

      a.foto_url,

      a.telefono,

      a.correo,

      pc.nombre AS plan_nombre,

      STRING_AGG(
        DISTINCT ma.nombre,
        ', '
        ORDER BY ma.nombre
      ) AS maquinas

    FROM matriculas m

    INNER JOIN alumnos a
      ON a.id = m.alumno_id

    INNER JOIN planes_curso pc
      ON pc.id = m.plan_curso_id

    LEFT JOIN matricula_maquinas mm
      ON mm.matricula_id = m.id

    LEFT JOIN maquinas ma
      ON ma.id = mm.maquina_id

    WHERE

      m.activo = true

      AND (

        $1 = ''

        OR LOWER(
          COALESCE(a.dni, '')
        ) LIKE LOWER($2)

        OR unaccent(
          LOWER(
            COALESCE(a.nombres, '') || ' ' ||
            COALESCE(a.apellidos, '')
          )
        ) LIKE unaccent(LOWER($2))

      )

    GROUP BY

      m.id,

      a.id,

      a.dni,

      a.nombres,

      a.apellidos,

      a.foto_url,

      a.telefono,

      a.correo,

      pc.nombre

    ORDER BY

      a.apellidos ASC,
      a.nombres ASC

    LIMIT 15
  `, [
    termino,
    `%${termino}%`
  ]);

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

  const cuotaId =
    Number(cuota_id);


  if (!Number.isInteger(cuotaId)) {
    throw new Error('cuota_id inválido');
  }


  if (!fechaValida(fecha_vencimiento)) {
    throw new Error(
      'Fecha de vencimiento inválida'
    );
  }


  const monto =
    validarMontoPositivo(
      monto_programado,
      'El monto debe ser mayor a cero'
    );


  const cuotaRes = await pool.query(`
    SELECT *

    FROM cuotas

    WHERE id = $1
  `, [cuotaId]);


  if (!cuotaRes.rows.length) {
    throw new Error(
      'Cuota no encontrada'
    );
  }


  const cuota =
    cuotaRes.rows[0];


  const montoPagado =
    redondear(
      cuota.monto_pagado
    );


  // ----------------------------------------------------------
  // No permitir que el nuevo monto sea inferior a lo pagado
  // ----------------------------------------------------------

  if (monto < montoPagado) {
    throw new Error(
      `El monto programado no puede ser menor al monto ya pagado de S/ ${montoPagado.toFixed(2)}`
    );
  }


  const nuevoSaldo =
    redondear(
      Math.max(
        monto - montoPagado,
        0
      )
    );


  const nuevoEstado =
    nuevoSaldo <= 0
      ? 'PAGADO'
      : 'PENDIENTE';


  await pool.query(`
    UPDATE cuotas

    SET

      fecha_vencimiento = $1,

      monto_programado = $2,

      saldo_pendiente = $3,

      estado = $4

    WHERE id = $5
  `, [

    normalizarFecha(
      fecha_vencimiento
    ),

    monto,

    nuevoSaldo,

    nuevoEstado,

    cuotaId

  ]);


  return {
    mensaje:
      'Cuota actualizada correctamente',

    cuota_id:
      cuotaId,

    monto_programado:
      monto,

    monto_pagado:
      montoPagado,

    saldo_pendiente:
      nuevoSaldo,

    estado:
      nuevoEstado
  };
}


// ============================================================
// ACTUALIZAR FECHAS
// ============================================================

async function actualizarFechas(cuotas) {

  if (!Array.isArray(cuotas)) {
    throw new Error(
      'Debe enviar un arreglo de cuotas'
    );
  }


  if (cuotas.length === 0) {
    return {
      mensaje:
        'No hay fechas para actualizar',
      actualizadas: 0
    };
  }


  const client =
    await pool.connect();


  try {

    await client.query('BEGIN');


    let actualizadas = 0;


    for (const cuota of cuotas) {

      const idParaActualizar =
        cuota.cuota_id ||
        cuota.id;


      const id =
        Number(idParaActualizar);


      if (!Number.isInteger(id)) {
        throw new Error(
          'ID de cuota no proporcionado'
        );
      }


      if (
        !fechaValida(
          cuota.fecha_vencimiento
        )
      ) {
        throw new Error(
          `Fecha inválida para la cuota ${id}`
        );
      }


      const result =
        await client.query(`
          UPDATE cuotas

          SET
            fecha_vencimiento = $1

          WHERE id = $2
        `, [

          normalizarFecha(
            cuota.fecha_vencimiento
          ),

          id

        ]);


      if (result.rowCount === 0) {
        throw new Error(
          `Cuota ${id} no encontrada`
        );
      }


      actualizadas++;
    }


    await client.query('COMMIT');


    return {
      mensaje:
        'Fechas actualizadas correctamente',

      actualizadas
    };

  } catch (error) {

    await client.query('ROLLBACK');

    throw error;

  } finally {

    client.release();

  }
}


// ============================================================
// EDITAR PAGO
// ============================================================

async function editarPago({
  pago_id,
  metodo_pago = null,
  numero_operacion = null,
  comprobante_url = null,
  observaciones = null
}) {

  const pagoId =
    Number(pago_id);


  if (!Number.isInteger(pagoId)) {
    throw new Error(
      'pago_id inválido'
    );
  }


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

    pagoId

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

  const pagoId =
    Number(id);


  if (!Number.isInteger(pagoId)) {
    throw new Error(
      'ID de pago inválido'
    );
  }


  const client =
    await pool.connect();


  try {

    await client.query('BEGIN');


    // --------------------------------------------------------
    // OBTENER PAGO
    // --------------------------------------------------------

    const pagoRes =
      await client.query(`
        SELECT *

        FROM pagos

        WHERE id = $1

        FOR UPDATE
      `, [pagoId]);


    if (!pagoRes.rows.length) {
      throw new Error(
        'Pago no encontrado'
      );
    }


    const pago =
      pagoRes.rows[0];


    const montoPago =
      redondear(
        pago.monto
      );


    // --------------------------------------------------------
    // BLOQUEAR CUOTA
    // --------------------------------------------------------

    if (pago.cuota_id) {

      const cuotaRes =
        await client.query(`
          SELECT

            id,

            monto_pagado,

            monto_programado

          FROM cuotas

          WHERE id = $1

          FOR UPDATE
        `, [
          pago.cuota_id
        ]);


      if (!cuotaRes.rows.length) {
        throw new Error(
          'La cuota asociada al pago no existe'
        );
      }


      const cuota =
        cuotaRes.rows[0];


      const nuevoPagado =
        redondear(
          Math.max(
            numeroSeguro(
              cuota.monto_pagado
            ) - montoPago,
            0
          )
        );


      const nuevoSaldo =
        redondear(
          Math.max(
            numeroSeguro(
              cuota.monto_programado
            ) - nuevoPagado,
            0
          )
        );


      const nuevoEstado =
        nuevoSaldo <= 0
          ? 'PAGADO'
          : 'PENDIENTE';


      await client.query(`
        UPDATE cuotas

        SET

          monto_pagado = $1,

          saldo_pendiente = $2,

          estado = $3

        WHERE id = $4
      `, [

        nuevoPagado,

        nuevoSaldo,

        nuevoEstado,

        pago.cuota_id

      ]);
    }


    // --------------------------------------------------------
    // ELIMINAR PAGO
    // --------------------------------------------------------

    await client.query(`
      DELETE FROM pagos

      WHERE id = $1
    `, [pagoId]);


    await client.query('COMMIT');


    return {
      mensaje:
        'Pago eliminado correctamente',

      pago_id:
        pagoId
    };

  } catch (error) {

    await client.query('ROLLBACK');

    throw error;

  } finally {

    client.release();

  }
}


// ============================================================
// OBTENER CONCEPTOS
// ============================================================

async function obtenerConceptosCobro(client) {

  const result =
    await client.query(`
      SELECT
        id,
        codigo,
        nombre

      FROM conceptos_cobro

      WHERE codigo IN (
        'MATRICULA',
        'CUOTA',
        'CERTIFICACION'
      )
    `);


  const conceptos = {};


  for (const concepto of result.rows) {

    conceptos[
      concepto.codigo
    ] = concepto.id;
  }


  if (!conceptos.MATRICULA) {
    throw new Error(
      'No existe el concepto MATRICULA'
    );
  }


  if (!conceptos.CUOTA) {
    throw new Error(
      'No existe el concepto CUOTA'
    );
  }


  if (!conceptos.CERTIFICACION) {
    throw new Error(
      'No existe el concepto CERTIFICACION'
    );
  }


  return conceptos;
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

  const client =
    await pool.connect();


  try {

    await client.query('BEGIN');


    // --------------------------------------------------------
    // VALIDAR MATRÍCULA
    // --------------------------------------------------------

    const matriculaId =
      Number(matricula_id);


    if (!Number.isInteger(matriculaId)) {
      throw new Error(
        'matricula_id inválido'
      );
    }


    const matriculaRes =
      await client.query(`
        SELECT *

        FROM matriculas

        WHERE id = $1

        LIMIT 1

        FOR UPDATE
      `, [matriculaId]);


    if (!matriculaRes.rows.length) {
      throw new Error(
        'Matrícula no encontrada'
      );
    }


    // --------------------------------------------------------
    // VALIDAR QUE NO EXISTA PLAN
    // --------------------------------------------------------

    const existePlan =
      await client.query(`
        SELECT id

        FROM planes_pago_alumno

        WHERE matricula_id = $1

        LIMIT 1
      `, [matriculaId]);


    if (existePlan.rows.length) {
      throw new Error(
        'La matrícula ya tiene un plan de pagos'
      );
    }


    // --------------------------------------------------------
    // VALIDAR CUOTAS
    // --------------------------------------------------------

    if (
      !Array.isArray(cuotas) ||
      cuotas.length === 0
    ) {
      throw new Error(
        'Debe enviar al menos una cuota'
      );
    }


    // --------------------------------------------------------
    // CONCEPTOS
    // --------------------------------------------------------

    const conceptos =
      await obtenerConceptosCobro(
        client
      );


    // --------------------------------------------------------
    // MONTOS
    // --------------------------------------------------------

    const montoTotal =
      validarMontoNoNegativo(
        monto_total,
        'Monto total inválido'
      );


    const montoMatricula =
      validarMontoNoNegativo(
        monto_matricula,
        'Monto de matrícula inválido'
      );


    const montoCertificacion =
      validarMontoNoNegativo(
        monto_certificacion,
        'Monto de certificación inválido'
      );


    // --------------------------------------------------------
    // NORMALIZAR CUOTAS
    // --------------------------------------------------------

    const cuotasNormalizadas =
      cuotas.map(
        (cuota, index) => {

          const numero =
            Number(
              cuota.numero_cuota
            );


          if (!Number.isInteger(numero)) {
            throw new Error(
              `Número de cuota inválido en posición ${index + 1}`
            );
          }


          if (
            !fechaValida(
              cuota.fecha_vencimiento
            )
          ) {
            throw new Error(
              `Fecha inválida en la cuota ${numero}`
            );
          }


          const monto =
            validarMontoPositivo(
              cuota.monto,
              `Monto inválido en la cuota ${numero}`
            );


          return {

            numero_cuota:
              numero,

            fecha_vencimiento:
              normalizarFecha(
                cuota.fecha_vencimiento
              ),

            monto,

            observaciones:
              cuota.observaciones ||
              `Cuota ${numero}`

          };
        }
      );


    // --------------------------------------------------------
    // VALIDAR DUPLICADOS
    // --------------------------------------------------------

    const numeros =
      cuotasNormalizadas.map(
        c => c.numero_cuota
      );


    if (
      new Set(numeros).size !==
      numeros.length
    ) {
      throw new Error(
        'Existen números de cuota duplicados'
      );
    }


    // --------------------------------------------------------
    // TOTAL DE CUOTAS
    // --------------------------------------------------------

    const totalCuotas =
      sumar(
        cuotasNormalizadas,
        'monto'
      );


    const totalCalculado =
      redondear(
        montoMatricula +
        totalCuotas +
        montoCertificacion
      );


    // --------------------------------------------------------
    // VALIDAR TOTAL
    // --------------------------------------------------------

    if (
      Math.abs(
        totalCalculado -
        montoTotal
      ) > 0.01
    ) {

      throw new Error(
        `El plan no cuadra. ` +
        `Total declarado: S/ ${montoTotal.toFixed(2)}. ` +
        `Total calculado: S/ ${totalCalculado.toFixed(2)}`
      );
    }


    const cantidadCuotas =
      cuotasNormalizadas.length;


    const montoCuota =
      redondear(
        totalCuotas /
        cantidadCuotas
      );


    const modalidad =
      normalizarModalidad(
        modalidad_pago
      );


    // --------------------------------------------------------
    // CREAR PLAN
    // --------------------------------------------------------

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

        matriculaId,

        montoTotal,

        montoMatricula,

        montoCertificacion,

        cantidadCuotas,

        montoCuota,

        nota_pago,

        modalidad

      ]);


    const planPago =
      planPagoRes.rows[0];


    // --------------------------------------------------------
    // MATRÍCULA
    // --------------------------------------------------------

    if (montoMatricula > 0) {

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

        montoMatricula

      ]);
    }


    // --------------------------------------------------------
    // CUOTAS
    // --------------------------------------------------------

    for (const cuota of cuotasNormalizadas) {

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

        cuota.observaciones

      ]);
    }


    // --------------------------------------------------------
    // CERTIFICACIÓN
    // --------------------------------------------------------

    if (montoCertificacion > 0) {

      const ultimaFecha =
        cuotasNormalizadas[
          cuotasNormalizadas.length - 1
        ].fecha_vencimiento;


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

        montoCertificacion

      ]);
    }


    await client.query('COMMIT');


    return {

      mensaje:
        'Plan manual creado correctamente',

      plan_pago_alumno_id:
        planPago.id

    };

  } catch (error) {

    await client.query('ROLLBACK');

    throw error;

  } finally {

    client.release();

  }
}


// ============================================================
// OBTENER DATOS PARA CAMBIO DE PLAN
// ============================================================

async function obtenerDatosCambioPlan(
  client,
  matricula_id,
  nuevo_plan_precio_id
) {

  const matriculaId =
    Number(matricula_id);


  const nuevoPlanPrecioId =
    Number(nuevo_plan_precio_id);


  if (!Number.isInteger(matriculaId)) {
    throw new Error(
      'matricula_id inválido'
    );
  }


  if (!Number.isInteger(nuevoPlanPrecioId)) {
    throw new Error(
      'nuevo_plan_precio_id inválido'
    );
  }


  // ----------------------------------------------------------
  // PLAN ACTUAL
  // ----------------------------------------------------------

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
    `, [matriculaId]);


  if (!planActualRes.rows.length) {
    throw new Error(
      'La matrícula no tiene un plan de pagos'
    );
  }


  const planActual =
    planActualRes.rows[0];


  // ----------------------------------------------------------
  // NUEVO PLAN
  // ----------------------------------------------------------

  const nuevoPlanRes =
    await client.query(`
      SELECT *

      FROM plan_precios

      WHERE id = $1

      LIMIT 1
    `, [nuevoPlanPrecioId]);


  if (!nuevoPlanRes.rows.length) {
    throw new Error(
      'Plan de precio no encontrado'
    );
  }


  const nuevoPlan =
    nuevoPlanRes.rows[0];


  // ----------------------------------------------------------
  // CUOTAS
  // ----------------------------------------------------------

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
    `, [
      planActual.id
    ]);


  return {

    planActual,

    nuevoPlan,

    cuotas:
      cuotasRes.rows

  };
}


// ============================================================
// CONSTRUIR PREVISUALIZACIÓN DE CAMBIO DE PLAN
// ============================================================

function construirCambioPlan({
  planActual,
  nuevoPlan,
  cuotas,
  modalidad
}) {

  const modalidadNormalizada =
    normalizarModalidad(
      modalidad ||
      planActual.modalidad_pago
    );


  // ----------------------------------------------------------
  // SEPARAR CONCEPTOS
  // ----------------------------------------------------------

  const cuotasNormales =
    cuotas
      .filter(
        c =>
          c.concepto_codigo === 'CUOTA'
      )
      .sort(
        (a, b) =>
          Number(a.numero_cuota || 0) -
          Number(b.numero_cuota || 0)
      );


  const cuotaMatricula =
    cuotas.find(
      c =>
        c.concepto_codigo ===
        'MATRICULA'
    );


  const cuotaCertificacion =
    cuotas.find(
      c =>
        c.concepto_codigo ===
        'CERTIFICACION'
    );


  // ----------------------------------------------------------
  // PAGOS
  // ----------------------------------------------------------

  const totalPagado =
    sumar(
      cuotas,
      'monto_pagado'
    );


  const cuotasConPago =
    cuotasNormales.filter(
      c =>
        numeroSeguro(
          c.monto_pagado
        ) > 0
    );


  const cuotasPagadas =
    cuotasNormales.filter(
      c =>
        numeroSeguro(
          c.saldo_pendiente
        ) <= 0
    );


  const cuotasPendientes =
    cuotasNormales.filter(
      c =>
        numeroSeguro(
          c.saldo_pendiente
        ) > 0
    );


  const totalPagadoCuotas =
    sumar(
      cuotasNormales,
      'monto_pagado'
    );


  // ----------------------------------------------------------
  // NUEVO PLAN
  // ----------------------------------------------------------

  const nuevoTotal =
    redondear(
      numeroSeguro(
        nuevoPlan.monto_total
      )
    );


  const nuevoSaldoTotal =
    redondear(
      nuevoTotal -
      totalPagado
    );


  if (nuevoSaldoTotal < -0.01) {

    throw new Error(
      `El alumno ya ha pagado S/ ${totalPagado.toFixed(2)}, ` +
      `superando el nuevo valor del plan de ` +
      `S/ ${nuevoTotal.toFixed(2)}`
    );
  }


  const saldoTotalReal =
    Math.max(
      nuevoSaldoTotal,
      0
    );


  // ----------------------------------------------------------
  // CANTIDAD DE CUOTAS
  // ----------------------------------------------------------

  const cantidadNueva =
    Math.max(
      Number(
        nuevoPlan.cantidad_cuotas || 0
      ),
      0
    );


  const cantidadConPago =
    cuotasConPago.length;


  /*
   * Una cuota que ya tiene un pago se conserva.
   *
   * Las cuotas sin pagos pueden eliminarse
   * y reconstruirse.
   */

  const cuotasNuevasDisponibles =
    Math.max(
      cantidadNueva -
      cantidadConPago,
      0
    );


  // ----------------------------------------------------------
  // FECHA BASE
  // ----------------------------------------------------------

  const cuotasConFecha =
    cuotasNormales.filter(
      c =>
        fechaValida(
          c.fecha_vencimiento
        )
    );


  const ultimaCuota =
    cuotasConFecha.length
      ? cuotasConFecha[
          cuotasConFecha.length - 1
        ]
      : null;


  const fechaBase =
    ultimaCuota
      ? normalizarFecha(
          ultimaCuota.fecha_vencimiento
        )
      : obtenerFechaActualLocal();


  const intervalo =
    obtenerIntervalo(
      modalidadNormalizada
    );


  // ----------------------------------------------------------
  // NUEVA MATRÍCULA
  // ----------------------------------------------------------

  const nuevaMatricula =
    redondear(
      numeroSeguro(
        nuevoPlan.matricula
      )
    );


  const pagadoMatricula =
    redondear(
      numeroSeguro(
        cuotaMatricula?.monto_pagado
      )
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
  // NUEVA CERTIFICACIÓN
  // ----------------------------------------------------------

  const nuevaCertificacion =
    redondear(
      numeroSeguro(
        nuevoPlan.certificacion
      )
    );


  const pagadoCertificacion =
    redondear(
      numeroSeguro(
        cuotaCertificacion?.monto_pagado
      )
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
  // SALDO QUE REALMENTE DEBE IR A CUOTAS
  // ----------------------------------------------------------

  const saldoParaCuotas =
    redondear(
      Math.max(
        saldoTotalReal -
        saldoMatricula -
        saldoCertificacion,
        0
      )
    );


  // ----------------------------------------------------------
  // CUOTAS EXISTENTES CON PAGOS
  // ----------------------------------------------------------

  const cronogramaExistente =
    cuotasConPago.map(
      cuota => ({

        tipo:
          'EXISTENTE',

        cuota_id:
          cuota.id,

        numero_cuota:
          cuota.numero_cuota,

        fecha_vencimiento:
          normalizarFecha(
            cuota.fecha_vencimiento
          ),

        monto_programado:
          redondear(
            cuota.monto_programado
          ),

        monto_pagado:
          redondear(
            cuota.monto_pagado
          ),

        saldo_pendiente:
          redondear(
            cuota.saldo_pendiente
          ),

        estado:
          cuota.estado,

        observaciones:
          cuota.observaciones

      })
    );


  // ----------------------------------------------------------
  // SALDO DE CUOTAS QUE YA TIENEN PAGO
  // ----------------------------------------------------------

  const saldoCuotasExistentes =
    sumar(
      cuotasConPago,
      'saldo_pendiente'
    );


  /*
   * Ese saldo sigue siendo parte de las cuotas.
   *
   * Por tanto solamente necesitamos generar
   * el resto.
   */

  const saldoParaCuotasNuevas =
    redondear(
      Math.max(
        saldoParaCuotas -
        saldoCuotasExistentes,
        0
      )
    );


  // ----------------------------------------------------------
  // GENERAR NUEVAS CUOTAS
  // ----------------------------------------------------------

  const cuotasNuevas = [];


  if (
    saldoParaCuotasNuevas > 0 &&
    cuotasNuevasDisponibles > 0
  ) {

    const montoBase =
      redondear(
        saldoParaCuotasNuevas /
        cuotasNuevasDisponibles
      );


    let acumulado =
      0;


    const ultimaNumero =
      cuotasConPago.length
        ? Math.max(
            ...cuotasConPago.map(
              c =>
                Number(
                  c.numero_cuota || 0
                )
            )
          )
        : 0;


    for (
      let i = 0;
      i < cuotasNuevasDisponibles;
      i++
    ) {

      let monto =
        montoBase;


      if (
        i ===
        cuotasNuevasDisponibles - 1
      ) {

        monto =
          redondear(
            saldoParaCuotasNuevas -
            acumulado
          );
      }


      monto =
        Math.max(
          monto,
          0
        );


      acumulado =
        redondear(
          acumulado +
          monto
        );


      const numeroCuota =
        ultimaNumero +
        i +
        1;


      const fecha =
        agregarDias(
          fechaBase,
          intervalo * (i + 1)
        );


      cuotasNuevas.push({

        tipo:
          'NUEVA',

        cuota_id:
          null,

        numero_cuota:
          numeroCuota,

        fecha_vencimiento:
          normalizarFecha(
            fecha
          ),

        monto_programado:
          monto,

        monto_pagado:
          0,

        saldo_pendiente:
          monto,

        estado:
          'PENDIENTE',

        observaciones:
          `Cuota ${numeroCuota} de ${cantidadNueva} - ${modalidadNormalizada}`

      });
    }
  }


  // ----------------------------------------------------------
  // RESPALDO
  // ----------------------------------------------------------

  /*
   * Si el nuevo plan tiene menos cuotas que las cuotas
   * que ya tienen pagos, puede quedar saldo pendiente
   * que no cabe dentro de las nuevas cuotas.
   *
   * En ese caso se genera una cuota de respaldo.
   */

  const totalCubiertoPorCuotasNuevas =
    sumar(
      cuotasNuevas,
      'monto_programado'
    );


  const diferenciaSinDistribuir =
    redondear(
      Math.max(
        saldoParaCuotasNuevas -
        totalCubiertoPorCuotasNuevas,
        0
      )
    );


  const respaldos = [];


  if (
    diferenciaSinDistribuir > 0
  ) {

    const ultimoNumero =
      Math.max(
        cantidadNueva,
        cantidadConPago,
        0
      );


    const fechaRespaldo =
      agregarDias(
        fechaBase,
        intervalo *
        (ultimoNumero + 1)
      );


    respaldos.push({

      tipo:
        'RESPALDO',

      cuota_id:
        null,

      numero_cuota:
        null,

      fecha_vencimiento:
        normalizarFecha(
          fechaRespaldo
        ),

      monto_programado:
        diferenciaSinDistribuir,

      monto_pagado:
        0,

      saldo_pendiente:
        diferenciaSinDistribuir,

      estado:
        'PENDIENTE',

      observaciones:
        'CUOTA DE RESPALDO - Diferencia generada por reajuste de plan'

    });
  }


  // ----------------------------------------------------------
  // CRONOGRAMA FINAL
  // ----------------------------------------------------------

  const cronograma =
    [
      ...cronogramaExistente,
      ...cuotasNuevas,
      ...respaldos
    ];


  // ----------------------------------------------------------
  // TOTALES DE CONTROL
  // ----------------------------------------------------------

  const saldoCronogramaExistente =
    sumar(
      cronogramaExistente,
      'saldo_pendiente'
    );


  const saldoCronogramaNuevas =
    sumar(
      cuotasNuevas,
      'saldo_pendiente'
    );


  const saldoRespaldo =
    sumar(
      respaldos,
      'saldo_pendiente'
    );


  const saldoCronograma =
    redondear(
      saldoCronogramaExistente +
      saldoCronogramaNuevas +
      saldoRespaldo +
      saldoMatricula +
      saldoCertificacion
    );


  const diferenciaControl =
    redondear(
      saldoTotalReal -
      saldoCronograma
    );


  // ----------------------------------------------------------
  // RESULTADO
  // ----------------------------------------------------------

  return {

    plan_actual: {

      id:
        planActual.plan_precio_id,

      nombre:
        planActual.plan_nombre_actual,

      plan_curso_id:
        planActual.plan_curso_actual,

      monto_total:
        redondear(
          planActual.monto_total
        ),

      cantidad_cuotas:
        Number(
          planActual.cantidad_cuotas || 0
        ),

      monto_cuota:
        redondear(
          planActual.monto_cuota
        ),

      modalidad_pago:
        planActual.modalidad_pago

    },


    plan_nuevo: {

      id:
        nuevoPlan.id,

      nombre:
        nuevoPlan.nombre,

      plan_curso_id:
        nuevoPlan.plan_curso_id,

      monto_total:
        nuevoTotal,

      matricula:
        nuevaMatricula,

      certificacion:
        nuevaCertificacion,

      cantidad_cuotas:
        cantidadNueva,

      monto_cuota:
        redondear(
          nuevoPlan.monto_cuota
        )

    },


    resumen: {

      total_pagado:
        totalPagado,

      total_pagado_cuotas:
        totalPagadoCuotas,

      nuevo_total:
        nuevoTotal,

      nuevo_saldo:
        saldoTotalReal,

      saldo_matricula:
        saldoMatricula,

      saldo_certificacion:
        saldoCertificacion,

      saldo_cuotas_existentes:
        saldoCuotasExistentes,

      saldo_cuotas_nuevas:
        saldoParaCuotasNuevas,

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
        diferenciaSinDistribuir,

      saldo_cronograma:
        saldoCronograma,

      diferencia_control:
        diferenciaControl

    },


    cronograma

  };
}


// ============================================================
// HELPER
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
  modalidad_pago = null
}) {

  const client =
    await pool.connect();


  try {

    const datos =
      await obtenerDatosCambioPlan(
        client,
        matricula_id,
        nuevo_plan_precio_id
      );


    const modalidad =
      normalizarModalidad(
        modalidad_pago ||
        datos.planActual.modalidad_pago ||
        'MENSUAL'
      );


    const resultado =
      construirCambioPlan({

        ...datos,

        modalidad

      });


    return {

      ok:
        true,

      modo:
        'PREVISUALIZACION',

      matricula_id:
        Number(matricula_id),

      modalidad_pago:
        modalidad,

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

  const client =
    await pool.connect();


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
      normalizarModalidad(
        modalidad_pago ||
        datos.planActual.modalidad_pago ||
        'MENSUAL'
      );


    // --------------------------------------------------------
    // CONSTRUIR PREVISUALIZACIÓN
    // --------------------------------------------------------

    const resultado =
      construirCambioPlan({

        ...datos,

        modalidad

      });


    // --------------------------------------------------------
    // PROTECCIÓN MATEMÁTICA
    // --------------------------------------------------------

    if (
      Math.abs(
        Number(
          resultado.resumen.diferencia_control
        )
      ) > 0.01
    ) {

      throw new Error(
        `El reajuste no cuadra. ` +
        `Diferencia: S/ ${Number(
          resultado.resumen.diferencia_control
        ).toFixed(2)}`
      );
    }


    // --------------------------------------------------------
    // OBTENER CONCEPTOS
    // --------------------------------------------------------

    const conceptos =
      await obtenerConceptosCobro(
        client
      );


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

      resultado.plan_nuevo.monto_total,

      resultado.plan_nuevo.matricula,

      resultado.plan_nuevo.certificacion,

      resultado.plan_nuevo.cantidad_cuotas,

      resultado.plan_nuevo.monto_cuota,

      modalidad,

      datos.planActual.id

    ]);


    // ========================================================
    // ELIMINAR CUOTAS REGULARES SIN PAGOS
    // ========================================================

    await client.query(`
      DELETE FROM cuotas

      WHERE

        plan_pago_alumno_id = $1

        AND concepto_id = $2

        AND COALESCE(monto_pagado, 0) = 0
    `, [

      datos.planActual.id,

      conceptos.CUOTA

    ]);


    // ========================================================
    // ACTUALIZAR CUOTAS EXISTENTES CON PAGOS
    // ========================================================

    /*
     * Las cuotas que tienen pagos permanecen.
     *
     * Solamente se reajusta su monto programado al
     * nuevo cronograma cuando sea necesario.
     *
     * El pago histórico NO se modifica.
     */

    for (
      const cuota
      of resultado.cronograma
    ) {

      if (
        cuota.tipo !==
        'EXISTENTE'
      ) {
        continue;
      }


      const montoProgramado =
        redondear(
          cuota.monto_programado
        );


      const montoPagado =
        redondear(
          cuota.monto_pagado
        );


      const nuevoSaldo =
        redondear(
          Math.max(
            montoProgramado -
            montoPagado,
            0
          )
        );


      const nuevoEstado =
        nuevoSaldo <= 0
          ? 'PAGADO'
          : 'PENDIENTE';


      await client.query(`
        UPDATE cuotas

        SET

          monto_programado = $1,

          saldo_pendiente = $2,

          estado = $3

        WHERE id = $4

          AND plan_pago_alumno_id = $5
      `, [

        montoProgramado,

        nuevoSaldo,

        nuevoEstado,

        cuota.cuota_id,

        datos.planActual.id

      ]);
    }


    // ========================================================
    // INSERTAR NUEVAS CUOTAS
    // ========================================================

    for (
      const cuota
      of resultado.cronograma
    ) {

      if (
        cuota.tipo !== 'NUEVA' &&
        cuota.tipo !== 'RESPALDO'
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

        conceptos.CUOTA,

        cuota.fecha_vencimiento,

        cuota.monto_programado,

        cuota.observaciones

      ]);
    }


    // ========================================================
    // ACTUALIZAR MATRÍCULA
    // ========================================================

    if (
      datos.nuevoPlan.plan_curso_id
    ) {

      await client.query(`
        UPDATE matriculas

        SET plan_curso_id = $1

        WHERE id = $2
      `, [

        datos.nuevoPlan.plan_curso_id,

        matricula_id

      ]);
    }


    // ========================================================
    // MATRÍCULA
    // ========================================================

    const matriculaRes =
      await client.query(`
        SELECT *

        FROM cuotas

        WHERE

          plan_pago_alumno_id = $1

          AND concepto_id = $2

        ORDER BY id ASC

        LIMIT 1

        FOR UPDATE
      `, [

        datos.planActual.id,

        conceptos.MATRICULA

      ]);


    const cuotaMatricula =
      matriculaRes.rows[0];


    const nuevoMontoMatricula =
      redondear(
        datos.nuevoPlan.matricula
      );


    if (cuotaMatricula) {

      const pagado =
        redondear(
          cuotaMatricula.monto_pagado
        );


      if (
        nuevoMontoMatricula <
        pagado
      ) {

        throw new Error(
          `El nuevo monto de matrícula ` +
          `S/ ${nuevoMontoMatricula.toFixed(2)} ` +
          `es menor al monto ya pagado ` +
          `S/ ${pagado.toFixed(2)}`
        );
      }


      const nuevoSaldo =
        redondear(
          Math.max(
            nuevoMontoMatricula -
            pagado,
            0
          )
        );


      const estado =
        nuevoSaldo <= 0
          ? 'PAGADO'
          : 'PENDIENTE';


      if (
        nuevoMontoMatricula <= 0 &&
        pagado <= 0
      ) {

        await client.query(`
          DELETE FROM cuotas

          WHERE id = $1
        `, [
          cuotaMatricula.id
        ]);

      } else {

        await client.query(`
          UPDATE cuotas

          SET

            monto_programado = $1,

            saldo_pendiente = $2,

            estado = $3

          WHERE id = $4
        `, [

          nuevoMontoMatricula,

          nuevoSaldo,

          estado,

          cuotaMatricula.id

        ]);
      }

    } else if (
      nuevoMontoMatricula > 0
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

        conceptos.MATRICULA,

        nuevoMontoMatricula

      ]);
    }


    // ========================================================
    // CERTIFICACIÓN
    // ========================================================

    const certificacionRes =
      await client.query(`
        SELECT *

        FROM cuotas

        WHERE

          plan_pago_alumno_id = $1

          AND concepto_id = $2

        ORDER BY id ASC

        LIMIT 1

        FOR UPDATE
      `, [

        datos.planActual.id,

        conceptos.CERTIFICACION

      ]);


    const cuotaCertificacion =
      certificacionRes.rows[0];


    const nuevoMontoCertificacion =
      redondear(
        datos.nuevoPlan.certificacion
      );


    if (cuotaCertificacion) {

      const pagado =
        redondear(
          cuotaCertificacion.monto_pagado
        );


      if (
        nuevoMontoCertificacion <
        pagado
      ) {

        throw new Error(
          `El nuevo monto de certificación ` +
          `S/ ${nuevoMontoCertificacion.toFixed(2)} ` +
          `es menor al monto ya pagado ` +
          `S/ ${pagado.toFixed(2)}`
        );
      }


      const nuevoSaldo =
        redondear(
          Math.max(
            nuevoMontoCertificacion -
            pagado,
            0
          )
        );


      const estado =
        nuevoSaldo <= 0
          ? 'PAGADO'
          : 'PENDIENTE';


      if (
        nuevoMontoCertificacion <= 0 &&
        pagado <= 0
      ) {

        await client.query(`
          DELETE FROM cuotas

          WHERE id = $1
        `, [
          cuotaCertificacion.id
        ]);

      } else {

        await client.query(`
          UPDATE cuotas

          SET

            monto_programado = $1,

            saldo_pendiente = $2,

            estado = $3

          WHERE id = $4
        `, [

          nuevoMontoCertificacion,

          nuevoSaldo,

          estado,

          cuotaCertificacion.id

        ]);
      }

    } else if (
      nuevoMontoCertificacion > 0
    ) {

      // ------------------------------------------------------
      // Buscar fecha de última cuota
      // ------------------------------------------------------

      const ultimaFechaRes =
        await client.query(`
          SELECT
            MAX(fecha_vencimiento) AS fecha

          FROM cuotas

          WHERE

            plan_pago_alumno_id = $1

            AND concepto_id = $2
        `, [

          datos.planActual.id,

          conceptos.CUOTA

        ]);


      const fecha =
        ultimaFechaRes.rows[0]?.fecha ||
        obtenerFechaActualLocal();


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

        conceptos.CERTIFICACION,

        fecha,

        nuevoMontoCertificacion

      ]);
    }


    // ========================================================
    // VERIFICACIÓN FINAL
    // ========================================================

    const verificacionRes =
      await client.query(`
        SELECT

          COALESCE(
            SUM(monto_programado),
            0
          ) AS total_programado,

          COALESCE(
            SUM(monto_pagado),
            0
          ) AS total_pagado,

          COALESCE(
            SUM(saldo_pendiente),
            0
          ) AS total_saldo

        FROM cuotas

        WHERE plan_pago_alumno_id = $1
      `, [
        datos.planActual.id
      ]);


    const verificacion =
      verificacionRes.rows[0];


    const totalSaldoFinal =
      redondear(
        verificacion.total_saldo
      );


    const totalPagadoFinal =
      redondear(
        verificacion.total_pagado
      );


    const totalEsperado =
      redondear(
        resultado.plan_nuevo.monto_total
      );


    /*
     * La relación fundamental es:
     *
     * NUEVO TOTAL =
     * PAGADO HISTÓRICO + SALDO ACTUAL
     */

    const diferenciaFinal =
      redondear(
        totalEsperado -
        totalPagadoFinal -
        totalSaldoFinal
      );


    if (
      Math.abs(
        diferenciaFinal
      ) > 0.01
    ) {

      throw new Error(
        `El plan aplicado no cuadra. ` +
        `Total nuevo: S/ ${totalEsperado.toFixed(2)}. ` +
        `Pagado: S/ ${totalPagadoFinal.toFixed(2)}. ` +
        `Saldo: S/ ${totalSaldoFinal.toFixed(2)}. ` +
        `Diferencia: S/ ${diferenciaFinal.toFixed(2)}`
      );
    }


    // ========================================================
    // COMMIT
    // ========================================================

    await client.query('COMMIT');


    return {

      ok:
        true,

      mensaje:
        'Cambio de plan aplicado correctamente',

      matricula_id:
        Number(matricula_id),

      plan_anterior:
        datos.planActual.plan_nombre_actual,

      plan_nuevo:
        datos.nuevoPlan.nombre,

      modalidad_pago:
        modalidad,

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
