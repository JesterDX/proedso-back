const pool = require('../config/db');
const { crearAsignacionPracticas } = require('./practicas.service');

// ==========================================================
// LISTAR MATRÍCULAS
// ==========================================================

async function listarMatriculas(filtros = {}) {

  const {
    estado = null,
    search = '',
    anio = null,
    mes = null
  } = filtros;

  const values = [];
  let where = `WHERE 1=1`;

  if (estado) {
    values.push(estado);

    where += `
      AND ea.codigo = $${values.length}
    `;
  }

  if (
    search &&
    String(search).trim() !== ''
  ) {

    const searchNormalizado =
      String(search)
        .trim()
        .toLowerCase();

    values.push(
      `%${searchNormalizado}%`
    );

    where += `
      AND (
        a.dni ILIKE $${values.length}

        OR unaccent(lower(a.nombres))
          LIKE unaccent($${values.length})

        OR unaccent(lower(a.apellidos))
          LIKE unaccent($${values.length})

        OR unaccent(
          lower(
            a.nombres || ' ' || a.apellidos
          )
        ) LIKE unaccent($${values.length})

        OR unaccent(
          lower(
            a.apellidos || ' ' || a.nombres
          )
        ) LIKE unaccent($${values.length})
      )
    `;
  }

  if (anio) {

    values.push(Number(anio));

    where += `
      AND EXTRACT(
        YEAR FROM m.fecha_matricula
      ) = $${values.length}
    `;
  }

  if (mes) {

    values.push(Number(mes));

    where += `
      AND EXTRACT(
        MONTH FROM m.fecha_matricula
      ) = $${values.length}
    `;
  }

  const query = `
    SELECT
      m.id,
      m.alumno_id,
      m.plan_curso_id,
      m.estado_alumno_id,
      m.fecha_matricula,
      m.fecha_inicio,
      m.fecha_fin_estimada,
      m.cronograma_url,
      m.notas,
      m.activo,
      m.fecha_creacion

    FROM matriculas m

    INNER JOIN estados_alumno ea
      ON ea.id = m.estado_alumno_id

    INNER JOIN alumnos a
      ON a.id = m.alumno_id

    ${where}

    ORDER BY
      m.fecha_matricula DESC,
      m.id DESC
  `;

  const result =
    await pool.query(
      query,
      values
    );

  return result.rows;
}


// ==========================================================
// OBTENER MATRÍCULA POR ID
// ==========================================================

async function obtenerMatriculaPorId(id) {

  const result =
    await pool.query(
      `
      SELECT *
      FROM matriculas
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

  return result.rows[0] || null;
}


// ==========================================================
// OBTENER ESTADO POR CÓDIGO
// ==========================================================

async function obtenerEstadoPorCodigo(
  codigo
) {

  const result =
    await pool.query(
      `
      SELECT
        id,
        codigo,
        nombre

      FROM estados_alumno

      WHERE codigo = $1

      LIMIT 1
      `,
      [codigo]
    );

  return result.rows[0] || null;
}


// ==========================================================
// ACTUALIZAR ESTADO
// ==========================================================

async function actualizarEstadoMatricula(
  id,
  estadoAlumnoId,
  user
) {

  const client =
    await pool.connect();

  try {

    await client.query('BEGIN');

    const result =
      await client.query(
        `
        UPDATE matriculas

        SET estado_alumno_id = $1

        WHERE id = $2

        RETURNING *
        `,
        [
          estadoAlumnoId,
          id
        ]
      );

    if (!result.rows[0]) {
      throw new Error(
        'Matrícula no encontrada.'
      );
    }

    await registrarHistorial(
      client,
      {
        matricula_id: id,
        accion: 'CAMBIO_ESTADO',
        descripcion:
          `Cambio de estado a ID ${estadoAlumnoId}`
      },
      user
    );

    await client.query('COMMIT');

    return result.rows[0];

  } catch (error) {

    await client.query(
      'ROLLBACK'
    );

    throw error;

  } finally {

    client.release();
  }
}


// ==========================================================
// ACTUALIZAR MATRÍCULA SIMPLE
// ==========================================================

async function actualizarMatricula(
  id,
  data
) {

  const result =
    await pool.query(
      `
      UPDATE matriculas

      SET
        alumno_id = $1,
        plan_curso_id = $2,
        estado_alumno_id = $3,
        fecha_matricula = $4,
        fecha_inicio = $5,
        fecha_fin_estimada = $6,
        notas = $7

      WHERE id = $8

      RETURNING *
      `,
      [
        data.alumno_id,
        data.plan_curso_id,
        data.estado_alumno_id,
        data.fecha_matricula,
        data.fecha_inicio || null,
        data.fecha_fin_estimada || null,
        data.notas || null,
        id
      ]
    );

  return result.rows[0] || null;
}


// ==========================================================
// OBTENER DETALLE DE MATRÍCULA
// ==========================================================

async function obtenerDetalleMatricula(
  id
) {

  const result =
    await pool.query(
      `
      SELECT
        m.id,
        m.alumno_id,
        m.plan_curso_id,
        m.estado_alumno_id,
        m.fecha_matricula,
        m.fecha_inicio,
        m.fecha_fin_estimada,
        m.cronograma_url,
        m.notas,
        m.activo,
        m.fecha_creacion,

        a.dni AS alumno_dni,
        a.nombres AS alumno_nombres,
        a.apellidos AS alumno_apellidos,
        a.fecha_nacimiento AS alumno_fecha_nacimiento,
        a.telefono AS alumno_telefono,
        a.correo AS alumno_correo,
        a.direccion AS alumno_direccion,
        a.foto_url AS alumno_foto_url,
        a.observaciones AS alumno_observaciones,
        a.seguro_alumno AS alumno_seguro_alumno,

        pc.codigo AS plan_codigo,
        pc.nombre AS plan_nombre,
        pc.permite_eleccion_personalizada,

        tc.codigo AS tipo_curso_codigo,
        tc.nombre AS tipo_curso_nombre,
        tc.cantidad_maquinas,

        ea.codigo AS estado_codigo,
        ea.nombre AS estado_nombre

      FROM matriculas m

      INNER JOIN alumnos a
        ON a.id = m.alumno_id

      INNER JOIN planes_curso pc
        ON pc.id = m.plan_curso_id

      INNER JOIN tipos_curso tc
        ON tc.id = pc.tipo_curso_id

      INNER JOIN estados_alumno ea
        ON ea.id = m.estado_alumno_id

      WHERE m.id = $1

      LIMIT 1
      `,
      [id]
    );

  return result.rows[0] || null;
}


// ==========================================================
// LISTAR MÁQUINAS DE MATRÍCULA
// ==========================================================

async function listarMaquinasDeMatricula(matriculaId) {
  const result = await pool.query(
    `
    SELECT
      mm.id,
      mm.matricula_id,
      mm.maquina_id,
      mm.orden,
      mm.es_regalo,
      mm.horas_asignadas,
      mm.sesiones_totales,
      mm.sesiones_completadas,
      mm.estado,

      m.nombre AS maquina_nombre

    FROM matricula_maquinas mm

    INNER JOIN maquinas m
      ON m.id = mm.maquina_id

    WHERE mm.matricula_id = $1
      AND mm.estado = 'PENDIENTE'

    ORDER BY
      mm.orden ASC,
      mm.id ASC
    `,
    [matriculaId]
  );

  return result.rows;
}

// ==========================================================
// OBTENER PLAN DE CURSO
// ==========================================================

async function obtenerPlanCursoDetalle(
  client,
  planCursoId
) {

  const result =
    await client.query(
      `
      SELECT
        pc.id,
        pc.codigo,
        pc.nombre,
        pc.permite_eleccion_personalizada,

        tc.codigo AS tipo_curso_codigo,
        tc.nombre AS tipo_curso_nombre,
        tc.cantidad_maquinas

      FROM planes_curso pc

      INNER JOIN tipos_curso tc
        ON tc.id = pc.tipo_curso_id

      WHERE pc.id = $1

      LIMIT 1
      `,
      [planCursoId]
    );

  return result.rows[0] || null;
}


// ==========================================================
// OBTENER MÁQUINA POR NOMBRE
// ==========================================================

async function obtenerMaquinaPorNombre(
  client,
  nombre
) {

  const result =
    await client.query(
      `
      SELECT
        id,
        nombre

      FROM maquinas

      WHERE LOWER(nombre) =
            LOWER($1)

      LIMIT 1
      `,
      [nombre]
    );

  return result.rows[0] || null;
}


// ==========================================================
// OBTENER MÁQUINAS DEL PLAN
// ==========================================================

async function obtenerPlanMaquinas(
  client,
  planCursoId
) {

  const result =
    await client.query(
      `
      SELECT
        maquina_id,
        orden,
        es_regalo

      FROM plan_maquinas

      WHERE plan_curso_id = $1

      ORDER BY
        orden ASC,
        id ASC
      `,
      [planCursoId]
    );

  return result.rows;
}


// ==========================================================
// OBTENER HORAS DE PRÁCTICA
// ==========================================================

async function obtenerHorasPlanPorMaquina(
  client,
  planCursoId,
  maquinaId
) {

  const result =
    await client.query(
      `
      SELECT
        horas,
        sesiones_totales

      FROM plan_horas_practica

      WHERE plan_curso_id = $1
        AND maquina_id = $2

      LIMIT 1
      `,
      [
        planCursoId,
        maquinaId
      ]
    );

  return result.rows[0] || null;
}


// ==========================================================
// INSERTAR MATRÍCULA-MÁQUINA
// ==========================================================

async function insertarMatriculaMaquina(
  client,
  data
) {

  const result =
    await client.query(
      `
      INSERT INTO matricula_maquinas (
        matricula_id,
        maquina_id,
        orden,
        es_regalo,
        horas_asignadas,
        sesiones_totales,
        sesiones_completadas,
        estado
      )

      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        0,
        'PENDIENTE'
      )

      RETURNING *
      `,
      [
        data.matricula_id,
        data.maquina_id,
        data.orden,
        data.es_regalo,
        data.horas_asignadas,
        data.sesiones_totales
      ]
    );

  return result.rows[0];
}


// ==========================================================
// OBTENER PRECIO VIGENTE
// ==========================================================

async function obtenerPlanPrecioVigente(
  client,
  planCursoId,
  fechaMatricula,
  maquinasAGuardar = [],
  tipoCursoCodigo = ''
) {

  const maquinasIds =
    maquinasAGuardar.map(
      m => Number(m.maquina_id)
    );

  const tractor =
    await obtenerMaquinaPorNombre(
      client,
      'Tractor de Cadenas'
    );

  const tieneTractor =
    tractor
      ? maquinasIds.includes(
          Number(tractor.id)
        )
      : false;

  const tipo =
    String(
      tipoCursoCodigo || ''
    ).toUpperCase();

  let query = `
    SELECT
      id,
      plan_curso_id,
      nombre,
      monto_total,
      matricula,
      certificacion,
      cantidad_cuotas,
      monto_cuota,
      vigente_desde,
      vigente_hasta,
      activo,
      observaciones,
      aplica_maquina_id,
      requiere_tractor

    FROM plan_precios

    WHERE plan_curso_id = $1
      AND activo = TRUE

      AND (
        vigente_desde IS NULL
        OR vigente_desde <= $2::date
      )

      AND (
        vigente_hasta IS NULL
        OR vigente_hasta >= $2::date
      )
  `;

  const values = [
    planCursoId,
    fechaMatricula
  ];

  if (tipo === 'INDIVIDUAL') {

    const maquinaPrincipal =
      maquinasAGuardar.find(
        m => !m.es_regalo
      ) ||
      maquinasAGuardar[0];

    if (!maquinaPrincipal) {

      throw new Error(
        'No se encontró la máquina seleccionada para calcular el precio individual.'
      );
    }

    values.push(
      Number(
        maquinaPrincipal.maquina_id
      )
    );

    query += `
      AND aplica_maquina_id =
          $${values.length}
    `;
  }

  if (tipo === 'DOBLE') {

    values.push(
      tieneTractor
    );

    query += `
      AND requiere_tractor =
          $${values.length}
    `;
  }

  if (
    tipo === 'TRIPLE' ||
    tipo === 'MULTIPLE'
  ) {

    query += `
      AND aplica_maquina_id IS NULL
    `;
  }

  query += `
    ORDER BY
      vigente_desde DESC NULLS LAST,
      id DESC

    LIMIT 1
  `;

  const result =
    await client.query(
      query,
      values
    );

  return result.rows[0] || null;
}


// ==========================================================
// CONCEPTO DE COBRO
// ==========================================================

async function obtenerConceptoCobroPorCodigo(
  client,
  codigo
) {

  const result =
    await client.query(
      `
      SELECT
        id,
        codigo,
        nombre

      FROM conceptos_cobro

      WHERE codigo = $1

      LIMIT 1
      `,
      [codigo]
    );

  return result.rows[0] || null;
}


// ==========================================================
// INSERTAR PLAN DE PAGOS
// ==========================================================

async function insertarPlanPagoAlumno(
  client,
  data
) {

  const result =
    await client.query(
      `
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
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9
      )

      RETURNING *
      `,
      [
        data.matricula_id,
        data.plan_precio_id,
        data.monto_total,
        data.monto_matricula,
        data.monto_certificacion,
        data.cantidad_cuotas,
        data.monto_cuota,
        data.nota_pago || null,
        data.modalidad_pago || 'MENSUAL'
      ]
    );

  return result.rows[0];
}


// ==========================================================
// INSERTAR CUOTA
// ==========================================================

async function insertarCuota(
  client,
  data
) {

  const result =
    await client.query(
      `
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
        $5,
        $6,
        0,
        $6,
        'PENDIENTE',
        $7
      )

      RETURNING *
      `,
      [
        data.plan_pago_alumno_id,
        data.numero_cuota,
        data.concepto_id,
        data.fecha_programada,
        data.fecha_vencimiento,
        data.monto_programado,
        data.observaciones || null
      ]
    );

  return result.rows[0];
}


// ==========================================================
// CALCULAR ESTRUCTURA FINANCIERA
//
// ESTA ES LA PARTE IMPORTANTE.
//
// El monto_total SIEMPRE debe cerrar:
//
// matrícula
// + cuotas
// + certificación
// = monto_total
//
// La última cuota absorbe cualquier diferencia de centavos.
// ==========================================================

function calcularEstructuraFinanciera(
  planPrecio,
  modalidadPago
) {

  const montoTotal =
    Number(
      planPrecio.monto_total || 0
    );

  const montoMatricula =
    Number(
      planPrecio.matricula || 0
    );

  const montoCertificacion =
    Number(
      planPrecio.certificacion || 0
    );

  const cantidadCuotasBase =
    Number(
      planPrecio.cantidad_cuotas || 0
    );

  const montoCuotaBase =
    Number(
      planPrecio.monto_cuota || 0
    );

  const modalidad =
    String(
      modalidadPago || 'MENSUAL'
    ).toUpperCase();

  if (
    montoTotal <= 0
  ) {
    throw new Error(
      'El monto total del plan de precio no es válido.'
    );
  }

  if (
    cantidadCuotasBase <= 0
  ) {
    throw new Error(
      'El plan de precio no tiene una cantidad válida de cuotas.'
    );
  }

  if (
    montoCuotaBase <= 0
  ) {
    throw new Error(
      'El plan de precio no tiene un monto de cuota válido.'
    );
  }

  const cantidadCuotasFinal =
    modalidad === 'QUINCENAL'
      ? cantidadCuotasBase * 2
      : cantidadCuotasBase;

  const montoDisponibleParaCuotas =
    Number(
      (
        montoTotal -
        montoMatricula -
        montoCertificacion
      ).toFixed(2)
    );

  if (
    montoDisponibleParaCuotas <= 0
  ) {
    throw new Error(
      'El monto destinado a cuotas no es válido.'
    );
  }

  let montoCuotaBaseFinal;

  if (
    modalidad === 'QUINCENAL'
  ) {

    montoCuotaBaseFinal =
      Number(
        (
          montoCuotaBase / 2
        ).toFixed(2)
      );

  } else {

    montoCuotaBaseFinal =
      Number(
        montoCuotaBase.toFixed(2)
      );
  }

  if (
    montoCuotaBaseFinal <= 0
  ) {
    throw new Error(
      'El monto calculado de la cuota no es válido.'
    );
  }

  // --------------------------------------------------------
  // Generar importes
  // --------------------------------------------------------

  const cuotas = [];

  let acumulado = 0;

  for (
    let i = 1;
    i <= cantidadCuotasFinal;
    i++
  ) {

    let monto;

    if (
      i === cantidadCuotasFinal
    ) {

      // ----------------------------------------------------
      // ÚLTIMA CUOTA
      //
      // Aquí cerramos exactamente el total.
      // ----------------------------------------------------

      monto =
        Number(
          (
            montoDisponibleParaCuotas -
            acumulado
          ).toFixed(2)
        );

    } else {

      monto =
        montoCuotaBaseFinal;
    }

    if (
      monto <= 0
    ) {
      throw new Error(
        `La cuota ${i} resultó con un monto inválido (${monto}).`
      );
    }

    acumulado =
      Number(
        (
          acumulado + monto
        ).toFixed(2)
      );

    cuotas.push({
      numero_cuota: i,
      monto: monto
    });
  }

  // --------------------------------------------------------
  // VALIDACIÓN FINAL
  // --------------------------------------------------------

  const totalCalculado =
    Number(
      (
        montoMatricula +
        acumulado +
        montoCertificacion
      ).toFixed(2)
    );

  if (
    totalCalculado !==
    Number(
      montoTotal.toFixed(2)
    )
  ) {

    throw new Error(
      `El plan de pagos no cierra. Total esperado: ${montoTotal}. Total calculado: ${totalCalculado}.`
    );
  }

  return {
    montoTotal,
    montoMatricula,
    montoCertificacion,
    cantidadCuotasBase,
    cantidadCuotasFinal,
    montoCuotaBase,
    montoCuotaFinal:
      cuotas.length > 0
        ? cuotas[0].monto
        : montoCuotaBaseFinal,
    cuotas,
    modalidad
  };
}


// ==========================================================
// GENERAR FECHAS DE CUOTAS
// ==========================================================

function generarFechasCuotas(
  fechaBase,
  cuotas,
  modalidadPago
) {

  const diasEntreCuotas =
    String(
      modalidadPago || 'MENSUAL'
    ).toUpperCase() === 'QUINCENAL'
      ? 14
      : 20;

  return cuotas.map(
    cuota => {

      const fecha =
        sumarDias(
          fechaBase,
          diasEntreCuotas *
            (
              cuota.numero_cuota - 1
            )
        );

      return {
        ...cuota,
        fecha_programada: fecha,
        fecha_vencimiento: fecha
      };
    }
  );
}


// ==========================================================
// OBTENER PLAN DE PAGO ACTUAL
// ==========================================================

async function obtenerPlanPagoAlumno(
  client,
  matriculaId
) {

  const result =
    await client.query(
      `
      SELECT *
      FROM planes_pago_alumno
      WHERE matricula_id = $1
      ORDER BY id DESC
      LIMIT 1
      `,
      [matriculaId]
    );

  return result.rows[0] || null;
}


// ==========================================================
// VALIDAR SI EXISTEN PAGOS
//
// No permitimos destruir/reconstruir cuotas si ya existe
// dinero pagado.
// ==========================================================

async function validarPlanSinPagos(
  client,
  planPagoAlumnoId
) {

  const result =
    await client.query(
      `
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(monto_pagado, 0) > 0
             OR estado IN (
               'PAGADO',
               'PARCIAL'
             )
        ) AS cuotas_con_pago,

        COALESCE(
          SUM(
            COALESCE(monto_pagado, 0)
          ),
          0
        ) AS total_pagado

      FROM cuotas

      WHERE plan_pago_alumno_id = $1
      `,
      [planPagoAlumnoId]
    );

  const fila =
    result.rows[0];

  const cuotasConPago =
    Number(
      fila.cuotas_con_pago || 0
    );

  const totalPagado =
    Number(
      fila.total_pagado || 0
    );

  if (
    cuotasConPago > 0 ||
    totalPagado > 0
  ) {

    throw new Error(
      'No se puede recalcular el plan de pagos porque la matrícula ya tiene pagos registrados. Los pagos existentes deben conservarse y el cambio financiero debe realizarse manualmente.'
    );
  }
}


// ==========================================================
// CREAR PLAN FINANCIERO COMPLETO
// ==========================================================

async function crearPlanFinanciero(
  client,
  {
    matriculaId,
    planPrecio,
    fechaMatricula,
    fechaInicio,
    fechaFinEstimada,
    modalidadPago,
    nombresMaquinas
  }
) {

  const conceptoMatricula =
    await obtenerConceptoCobroPorCodigo(
      client,
      'MATRICULA'
    );

  const conceptoCuota =
    await obtenerConceptoCobroPorCodigo(
      client,
      'CUOTA'
    );

  const conceptoCertificacion =
    await obtenerConceptoCobroPorCodigo(
      client,
      'CERTIFICACION'
    );

  if (
    !conceptoMatricula ||
    !conceptoCuota ||
    !conceptoCertificacion
  ) {

    throw new Error(
      'Faltan conceptos de cobro base.'
    );
  }

  const financiera =
    calcularEstructuraFinanciera(
      planPrecio,
      modalidadPago
    );

  const fechaBaseCuotas =
    fechaInicio ||
    fechaMatricula;

  if (!fechaBaseCuotas) {
    throw new Error(
      'No existe una fecha base para generar las cuotas.'
    );
  }

  const cuotasConFechas =
    generarFechasCuotas(
      fechaBaseCuotas,
      financiera.cuotas,
      financiera.modalidad
    );

  const notaPago =
    `${planPrecio.nombre} - Máquinas: ${nombresMaquinas.join(', ')}`;

  const planPagoAlumno =
    await insertarPlanPagoAlumno(
      client,
      {
        matricula_id:
          matriculaId,

        plan_precio_id:
          planPrecio.id,

        monto_total:
          financiera.montoTotal,

        monto_matricula:
          financiera.montoMatricula,

        monto_certificacion:
          financiera.montoCertificacion,

        cantidad_cuotas:
          financiera.cantidadCuotasFinal,

        monto_cuota:
          financiera.montoCuotaFinal,

        nota_pago:
          notaPago,

        modalidad_pago:
          financiera.modalidad
      }
    );

  // --------------------------------------------------------
  // MATRÍCULA
  // --------------------------------------------------------

  if (
    financiera.montoMatricula > 0
  ) {

    await insertarCuota(
      client,
      {
        plan_pago_alumno_id:
          planPagoAlumno.id,

        numero_cuota:
          0,

        concepto_id:
          conceptoMatricula.id,

        fecha_programada:
          fechaMatricula,

        fecha_vencimiento:
          fechaMatricula,

        monto_programado:
          financiera.montoMatricula,

        observaciones:
          'Pago de matrícula'
      }
    );
  }

  // --------------------------------------------------------
  // CUOTAS
  // --------------------------------------------------------

  for (
    const cuota
    of cuotasConFechas
  ) {

    await insertarCuota(
      client,
      {
        plan_pago_alumno_id:
          planPagoAlumno.id,

        numero_cuota:
          cuota.numero_cuota,

        concepto_id:
          conceptoCuota.id,

        fecha_programada:
          cuota.fecha_programada,

        fecha_vencimiento:
          cuota.fecha_vencimiento,

        monto_programado:
          cuota.monto,

        observaciones:
          `Cuota ${cuota.numero_cuota} de ${financiera.cantidadCuotasFinal} - ${financiera.modalidad}`
      }
    );
  }

  // --------------------------------------------------------
  // CERTIFICACIÓN
  // --------------------------------------------------------

  if (
    financiera.montoCertificacion > 0
  ) {

    const fechaCertificacion =
      fechaFinEstimada ||
      sumarMeses(
        fechaBaseCuotas,
        financiera.cantidadCuotasBase
      );

    await insertarCuota(
      client,
      {
        plan_pago_alumno_id:
          planPagoAlumno.id,

        numero_cuota:
          null,

        concepto_id:
          conceptoCertificacion.id,

        fecha_programada:
          fechaCertificacion,

        fecha_vencimiento:
          fechaCertificacion,

        monto_programado:
          financiera.montoCertificacion,

        observaciones:
          'Carpeta y certificación'
      }
    );
  }

  return planPagoAlumno;
}


// ==========================================================
// RECALCULAR PLAN FINANCIERO
//
// Se utiliza cuando cambia:
// - plan de curso
// - máquina que determina precio
// - modalidad de pago
//
// Solo se permite automáticamente si todavía no existen
// pagos registrados.
// ==========================================================

async function recalcularPlanFinanciero(
  client,
  {
    matriculaId,
    planPagoActual,
    planPrecio,
    fechaMatricula,
    fechaInicio,
    fechaFinEstimada,
    modalidadPago,
    nombresMaquinas
  }
) {

  if (!planPagoActual) {

    return await crearPlanFinanciero(
      client,
      {
        matriculaId,
        planPrecio,
        fechaMatricula,
        fechaInicio,
        fechaFinEstimada,
        modalidadPago,
        nombresMaquinas
      }
    );
  }

  await validarPlanSinPagos(
    client,
    planPagoActual.id
  );

  // --------------------------------------------------------
  // ELIMINAR SOLAMENTE LAS CUOTAS DEL PLAN ACTUAL
  //
  // Como validamos que no haya pagos, no destruimos
  // información financiera real.
  // --------------------------------------------------------

  await client.query(
    `
    DELETE FROM cuotas
    WHERE plan_pago_alumno_id = $1
    `,
    [
      planPagoActual.id
    ]
  );

  const financiera =
    calcularEstructuraFinanciera(
      planPrecio,
      modalidadPago
    );

  const fechaBaseCuotas =
    fechaInicio ||
    fechaMatricula;

  if (!fechaBaseCuotas) {
    throw new Error(
      'No existe una fecha base para generar las cuotas.'
    );
  }

  const cuotasConFechas =
    generarFechasCuotas(
      fechaBaseCuotas,
      financiera.cuotas,
      financiera.modalidad
    );

  const notaPago =
    `${planPrecio.nombre} - Máquinas: ${nombresMaquinas.join(', ')}`;

  // --------------------------------------------------------
  // ACTUALIZAR PLAN
  // --------------------------------------------------------

  await client.query(
    `
    UPDATE planes_pago_alumno

    SET
      plan_precio_id = $1,
      monto_total = $2,
      monto_matricula = $3,
      monto_certificacion = $4,
      cantidad_cuotas = $5,
      monto_cuota = $6,
      nota_pago = $7,
      modalidad_pago = $8

    WHERE id = $9
    `,
    [
      planPrecio.id,
      financiera.montoTotal,
      financiera.montoMatricula,
      financiera.montoCertificacion,
      financiera.cantidadCuotasFinal,
      financiera.montoCuotaFinal,
      notaPago,
      financiera.modalidad,
      planPagoActual.id
    ]
  );

  // --------------------------------------------------------
  // CONCEPTOS
  // --------------------------------------------------------

  const conceptoMatricula =
    await obtenerConceptoCobroPorCodigo(
      client,
      'MATRICULA'
    );

  const conceptoCuota =
    await obtenerConceptoCobroPorCodigo(
      client,
      'CUOTA'
    );

  const conceptoCertificacion =
    await obtenerConceptoCobroPorCodigo(
      client,
      'CERTIFICACION'
    );

  if (
    !conceptoMatricula ||
    !conceptoCuota ||
    !conceptoCertificacion
  ) {

    throw new Error(
      'Faltan conceptos de cobro base.'
    );
  }

  // --------------------------------------------------------
  // MATRÍCULA
  // --------------------------------------------------------

  if (
    financiera.montoMatricula > 0
  ) {

    await insertarCuota(
      client,
      {
        plan_pago_alumno_id:
          planPagoActual.id,

        numero_cuota:
          0,

        concepto_id:
          conceptoMatricula.id,

        fecha_programada:
          fechaMatricula,

        fecha_vencimiento:
          fechaMatricula,

        monto_programado:
          financiera.montoMatricula,

        observaciones:
          'Pago de matrícula'
      }
    );
  }

  // --------------------------------------------------------
  // CUOTAS
  // --------------------------------------------------------

  for (
    const cuota
    of cuotasConFechas
  ) {

    await insertarCuota(
      client,
      {
        plan_pago_alumno_id:
          planPagoActual.id,

        numero_cuota:
          cuota.numero_cuota,

        concepto_id:
          conceptoCuota.id,

        fecha_programada:
          cuota.fecha_programada,

        fecha_vencimiento:
          cuota.fecha_vencimiento,

        monto_programado:
          cuota.monto,

        observaciones:
          `Cuota ${cuota.numero_cuota} de ${financiera.cantidadCuotasFinal} - ${financiera.modalidad}`
      }
    );
  }

  // --------------------------------------------------------
  // CERTIFICACIÓN
  // --------------------------------------------------------

  if (
    financiera.montoCertificacion > 0
  ) {

    const fechaCertificacion =
      fechaFinEstimada ||
      sumarMeses(
        fechaBaseCuotas,
        financiera.cantidadCuotasBase
      );

    await insertarCuota(
      client,
      {
        plan_pago_alumno_id:
          planPagoActual.id,

        numero_cuota:
          null,

        concepto_id:
          conceptoCertificacion.id,

        fecha_programada:
          fechaCertificacion,

        fecha_vencimiento:
          fechaCertificacion,

        monto_programado:
          financiera.montoCertificacion,

        observaciones:
          'Carpeta y certificación'
      }
    );
  }

  const actualizado =
    await obtenerPlanPagoAlumno(
      client,
      matriculaId
    );

  return actualizado;
}


// ==========================================================
// CREAR MATRÍCULA
// ==========================================================

async function crearMatricula(
  data,
  user
) {

  const client =
    await pool.connect();

  try {

    await client.query(
      'BEGIN'
    );

    // ------------------------------------------------------
    // CREAR MATRÍCULA
    // ------------------------------------------------------

    const matriculaResult =
      await client.query(
        `
        INSERT INTO matriculas (
          alumno_id,
          plan_curso_id,
          estado_alumno_id,
          fecha_matricula,
          fecha_inicio,
          fecha_fin_estimada,
          cronograma_url,
          notas,
          activo
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          TRUE
        )

        RETURNING *
        `,
        [
          data.alumno_id,
          data.plan_curso_id,
          data.estado_alumno_id,
          data.fecha_matricula,
          data.fecha_inicio || null,
          data.fecha_fin_estimada || null,
          null,
          data.notas || null
        ]
      );

    const nuevaMatricula =
      matriculaResult.rows[0];

    const matriculaId =
      nuevaMatricula.id;

    // ------------------------------------------------------
    // HISTORIAL
    // ------------------------------------------------------

    await registrarHistorial(
      client,
      {
        matricula_id:
          matriculaId,

        accion:
          'CREACION',

        descripcion:
          `Matrícula creada con estado ID ${data.estado_alumno_id}`
      },
      user
    );

    // ------------------------------------------------------
    // PLAN
    // ------------------------------------------------------

    const plan =
      await obtenerPlanCursoDetalle(
        client,
        data.plan_curso_id
      );

    if (!plan) {
      throw new Error(
        'No se encontró el plan de curso.'
      );
    }

    // ------------------------------------------------------
    // MÁQUINAS
    // ------------------------------------------------------

    const maquinasAGuardar =
      await determinarMaquinas(
        client,
        plan,
        data.maquinas_seleccionadas
      );

    // ------------------------------------------------------
    // INSERTAR MÁQUINAS
    // ------------------------------------------------------

    const nombresMaquinas = [];

    for (
      const item
      of maquinasAGuardar
    ) {

      const maquinaResult =
        await client.query(
          `
          SELECT nombre
          FROM maquinas
          WHERE id = $1
          `,
          [
            item.maquina_id
          ]
        );

      if (
        maquinaResult.rows[0]
      ) {

        nombresMaquinas.push(
          maquinaResult.rows[0].nombre
        );
      }

      const horasPlan =
        await obtenerHorasPlanPorMaquina(
          client,
          data.plan_curso_id,
          item.maquina_id
        );

      if (!horasPlan) {

        throw new Error(
          `No existe configuración de horas prácticas para la máquina ID ${item.maquina_id}.`
        );
      }

      await insertarMatriculaMaquina(
        client,
        {
          matricula_id:
            matriculaId,

          maquina_id:
            item.maquina_id,

          orden:
            item.orden,

          es_regalo:
            item.es_regalo,

          horas_asignadas:
            Number(
              horasPlan.horas
            ),

          sesiones_totales:
            Number(
              horasPlan.sesiones_totales
            )
        }
      );
    }

    // ------------------------------------------------------
    // PRÁCTICAS
    // ------------------------------------------------------

    await crearAsignacionPracticas(
      matriculaId,
      client
    );

    // ------------------------------------------------------
    // PRECIO
    // ------------------------------------------------------

    const planPrecio =
      await obtenerPlanPrecioVigente(
        client,
        data.plan_curso_id,
        data.fecha_matricula,
        maquinasAGuardar,
        plan.tipo_curso_codigo
      );

    if (!planPrecio) {

      throw new Error(
        'No se encontró un plan de precios activo para este curso y configuración de máquinas.'
      );
    }

    // ------------------------------------------------------
    // PLAN FINANCIERO
    // ------------------------------------------------------

    await crearPlanFinanciero(
      client,
      {
        matriculaId,
        planPrecio,
        fechaMatricula:
          data.fecha_matricula,
        fechaInicio:
          data.fecha_inicio || null,
        fechaFinEstimada:
          data.fecha_fin_estimada || null,
        modalidadPago:
          data.modalidad_pago || 'MENSUAL',
        nombresMaquinas
      }
    );

    await client.query(
      'COMMIT'
    );

    return nuevaMatricula;

  } catch (error) {

    await client.query(
      'ROLLBACK'
    );

    throw error;

  } finally {

    client.release();
  }
}


// ==========================================================
// DETERMINAR MÁQUINAS
// ==========================================================

async function determinarMaquinas(
  client,
  plan,
  maquinasSeleccionadas
) {

  let maquinasAGuardar = [];

  if (
    plan.permite_eleccion_personalizada
  ) {

    const seleccionadas =
      Array.isArray(
        maquinasSeleccionadas
      )
        ? maquinasSeleccionadas
            .map(Number)
            .filter(Boolean)
        : [];

    if (
      seleccionadas.length !==
      Number(
        plan.cantidad_maquinas
      )
    ) {

      throw new Error(
        `Debes seleccionar exactamente ${plan.cantidad_maquinas} máquina(s) para este plan.`
      );
    }

    maquinasAGuardar =
      seleccionadas.map(
        (
          maquinaId,
          index
        ) => ({
          maquina_id:
            maquinaId,

          orden:
            index + 1,

          es_regalo:
            false
        })
      );

  } else {

    const planMaquinas =
      await obtenerPlanMaquinas(
        client,
        plan.id
      );

    if (
      !planMaquinas.length
    ) {

      throw new Error(
        'El plan de curso no tiene máquinas configuradas.'
      );
    }

    maquinasAGuardar =
      planMaquinas.map(
        item => ({
          maquina_id:
            Number(
              item.maquina_id
            ),

          orden:
            Number(
              item.orden
            ),

          es_regalo:
            Boolean(
              item.es_regalo
            )
        })
      );
  }

  // --------------------------------------------------------
  // MULTIPLE → CAMIONETA GRATIS
  // --------------------------------------------------------

  const esMultiple =
    String(
      plan.tipo_curso_codigo
    ).toUpperCase() ===
    'MULTIPLE';

  if (esMultiple) {

    const camioneta =
      await obtenerMaquinaPorNombre(
        client,
        'Camioneta'
      );

    if (!camioneta) {

      throw new Error(
        'No se encontró la máquina Camioneta.'
      );
    }

    const yaExiste =
      maquinasAGuardar.some(
        item =>
          Number(
            item.maquina_id
          ) ===
          Number(
            camioneta.id
          )
      );

    if (!yaExiste) {

      maquinasAGuardar.push({
        maquina_id:
          Number(
            camioneta.id
          ),

        orden:
          maquinasAGuardar.length + 1,

        es_regalo:
          true
      });
    }
  }

  return maquinasAGuardar;
}

// ==========================================================
// PROCESAR ACTUALIZACIÓN COMPLETA
// ==========================================================

async function procesarTodo(
  id,
  data,
  user
) {
  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    // ======================================================
    // 1. OBTENER MATRÍCULA ACTUAL
    // ======================================================

    const actualResult = await client.query(
      `
      SELECT *
      FROM matriculas
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    const actual = actualResult.rows[0];

    if (!actual) {
      throw new Error(
        'Matrícula no encontrada.'
      );
    }

    // ======================================================
    // 2. OBTENER TODAS LAS MÁQUINAS HISTÓRICAS
    //
    // IMPORTANTE:
    //
    // NO filtramos RETIRADA aquí.
    //
    // Necesitamos saber si una máquina ya existió alguna
    // vez para evitar el UNIQUE:
    //
    // (matricula_id, maquina_id)
    // ======================================================

    const todasMaquinasResult =
      await client.query(
        `
        SELECT
          mm.id,
          mm.matricula_id,
          mm.maquina_id,
          mm.orden,
          mm.es_regalo,
          mm.horas_asignadas,
          mm.sesiones_totales,
          mm.sesiones_completadas,
          mm.estado

        FROM matricula_maquinas mm

        WHERE mm.matricula_id = $1

        ORDER BY
          mm.orden ASC,
          mm.id ASC
        `,
        [id]
      );

    const todasMaquinas =
      todasMaquinasResult.rows;

    // ======================================================
    // 3. OBTENER SOLO LAS MÁQUINAS ACTIVAS
    //
    // Estas son las que realmente tiene actualmente
    // la matrícula.
    // ======================================================

    const maquinasActuales =
      todasMaquinas.filter(
        maquina =>
          String(maquina.estado)
            .toUpperCase() !== 'RETIRADA'
      );

    // ======================================================
    // 4. DETECTAR SI EL FRONT ENVIÓ MÁQUINAS
    // ======================================================

    const seEnvioMaquinas =
      Array.isArray(
        data.maquinas_seleccionadas
      );

    let maquinasNuevas = [];

    // ======================================================
    // 5. DETERMINAR MÁQUINAS NUEVAS
    // ======================================================

    if (seEnvioMaquinas) {

      const planActualizado =
        await obtenerPlanCursoDetalle(
          client,
          data.plan_curso_id
        );

      if (!planActualizado) {
        throw new Error(
          'No se encontró el plan de curso.'
        );
      }

      maquinasNuevas =
        await determinarMaquinas(
          client,
          planActualizado,
          data.maquinas_seleccionadas
        );
    }

    // ======================================================
    // 6. DETECTAR CAMBIO DE PLAN
    // ======================================================

    const cambioPlan =
      Number(actual.plan_curso_id) !==
      Number(data.plan_curso_id);

    // ======================================================
    // 7. DETECTAR CAMBIO DE MÁQUINAS
    // ======================================================

    let cambioMaquinas = false;

    if (seEnvioMaquinas) {

      const idsActuales =
        maquinasActuales
          .map(
            item =>
              Number(item.maquina_id)
          )
          .sort(
            (a, b) => a - b
          );

      const idsNuevos =
        maquinasNuevas
          .map(
            item =>
              Number(item.maquina_id)
          )
          .sort(
            (a, b) => a - b
          );

      cambioMaquinas =
        idsActuales.length !==
          idsNuevos.length ||

        idsActuales.some(
          (maquinaId, index) =>
            maquinaId !==
            idsNuevos[index]
        );
    }

    // ======================================================
    // 8. ACTUALIZAR DATOS DE MATRÍCULA
    // ======================================================

    await client.query(
      `
      UPDATE matriculas
      SET
        alumno_id = $1,
        plan_curso_id = $2,
        estado_alumno_id = $3,
        fecha_matricula = $4,
        fecha_inicio = $5,
        fecha_fin_estimada = $6,
        notas = $7
      WHERE id = $8
      `,
      [
        data.alumno_id,
        data.plan_curso_id,
        data.estado_alumno_id,
        data.fecha_matricula,
        data.fecha_inicio || null,
        data.fecha_fin_estimada || null,
        data.notas || null,
        id
      ]
    );

    // ======================================================
    // 9. VARIABLES DE HISTORIAL
    // ======================================================

    let maquinasEliminadas = [];
    let maquinasConservadas = [];
    let maquinasAgregadas = [];
    let maquinasReactivadas = [];

    // ======================================================
    // 10. PROCESAR MÁQUINAS
    // ======================================================

    if (
      seEnvioMaquinas &&
      cambioMaquinas
    ) {

      // ====================================================
      // IDS NUEVOS
      // ====================================================

      const idsNuevos =
        new Set(
          maquinasNuevas.map(
            item =>
              Number(item.maquina_id)
          )
        );

      // ====================================================
      // IDS ACTIVOS ACTUALES
      // ====================================================

      const idsActuales =
        new Set(
          maquinasActuales.map(
            item =>
              Number(item.maquina_id)
          )
        );

      // ====================================================
      // 10.1 MÁQUINAS QUE SE RETIRAN
      //
      // Estaban activas y ya no vienen.
      // ====================================================

      maquinasEliminadas =
        maquinasActuales.filter(
          maquina =>
            !idsNuevos.has(
              Number(
                maquina.maquina_id
              )
            )
        );

      // ====================================================
      // 10.2 MÁQUINAS CONSERVADAS
      //
      // Siguen seleccionadas.
      // ====================================================

      maquinasConservadas =
        maquinasActuales.filter(
          maquina =>
            idsNuevos.has(
              Number(
                maquina.maquina_id
              )
            )
        );

      // ====================================================
      // 10.3 MARCAR COMO RETIRADAS
      // ====================================================

      for (
        const maquina
        of maquinasEliminadas
      ) {

        await client.query(
          `
          UPDATE matricula_maquinas
          SET
            estado = 'RETIRADA'
          WHERE id = $1
          `,
          [
            maquina.id
          ]
        );
      }

      // ====================================================
      // 10.4 ACTUALIZAR ORDEN DE CONSERVADAS
      //
      // IMPORTANTE:
      //
      // NO modificamos:
      //
      // - sesiones_completadas
      // - horas_asignadas
      // - sesiones_totales
      //
      // Solo:
      //
      // - orden
      // - es_regalo
      // ====================================================

      for (
        const nueva
        of maquinasNuevas
      ) {

        const existente =
          maquinasConservadas.find(
            actualMaquina =>
              Number(
                actualMaquina.maquina_id
              ) ===
              Number(
                nueva.maquina_id
              )
          );

        if (!existente) {
          continue;
        }

        await client.query(
          `
          UPDATE matricula_maquinas
          SET
            orden = $1,
            es_regalo = $2
          WHERE id = $3
          `,
          [
            nueva.orden,
            nueva.es_regalo,
            existente.id
          ]
        );
      }

      // ====================================================
      // 10.5 PROCESAR CADA MÁQUINA NUEVA
      //
      // Aquí tenemos tres posibilidades:
      //
      // A) Ya está activa
      //    → no insertar.
      //
      // B) Existe pero está RETIRADA
      //    → reactivar.
      //
      // C) Nunca existió
      //    → insertar.
      // ====================================================

      for (
        const nueva
        of maquinasNuevas
      ) {

        // --------------------------------------------------
        // BUSCAR CUALQUIER REGISTRO HISTÓRICO
        // --------------------------------------------------

        const existenteResult =
          await client.query(
            `
            SELECT
              id,
              matricula_id,
              maquina_id,
              orden,
              es_regalo,
              horas_asignadas,
              sesiones_totales,
              sesiones_completadas,
              estado

            FROM matricula_maquinas

            WHERE matricula_id = $1
              AND maquina_id = $2

            LIMIT 1
            `,
            [
              id,
              nueva.maquina_id
            ]
          );

        const existente =
          existenteResult.rows[0];

        // ==================================================
        // CASO A/B: YA EXISTE
        // ==================================================

        if (existente) {

          // -----------------------------------------------
          // A. YA ESTÁ ACTIVA
          // -----------------------------------------------

          if (
            String(existente.estado)
              .toUpperCase() !==
            'RETIRADA'
          ) {

            // Ya fue procesada como conservada.
            // Solo guardamos referencia para prácticas
            // si fuera necesario.

            maquinasAgregadas.push({
              ...nueva,
              matricula_maquina_id:
                existente.id,
              ya_existia: true
            });

            continue;
          }

          // -----------------------------------------------
          // B. ESTABA RETIRADA
          //
          // REACTIVAMOS EL MISMO REGISTRO.
          //
          // NO INSERTAMOS.
          // -----------------------------------------------

          const horasPlan =
            await obtenerHorasPlanPorMaquina(
              client,
              data.plan_curso_id,
              nueva.maquina_id
            );

          if (!horasPlan) {
            throw new Error(
              `No existe configuración de horas prácticas para la máquina ID ${nueva.maquina_id} en el plan seleccionado.`
            );
          }

          await client.query(
            `
            UPDATE matricula_maquinas
            SET
              orden = $1,
              es_regalo = $2,
              estado = 'PENDIENTE'
            WHERE id = $3
            `,
            [
              nueva.orden,
              nueva.es_regalo,
              existente.id
            ]
          );

          maquinasReactivadas.push({
            ...nueva,
            matricula_maquina_id:
              existente.id
          });

          continue;
        }

        // ==================================================
        // CASO C: REALMENTE NUNCA EXISTIÓ
        // ==================================================

        const horasPlan =
          await obtenerHorasPlanPorMaquina(
            client,
            data.plan_curso_id,
            nueva.maquina_id
          );

        if (!horasPlan) {
          throw new Error(
            `No existe configuración de horas prácticas para la máquina ID ${nueva.maquina_id} en el plan seleccionado.`
          );
        }

        const nuevaMM =
          await insertarMatriculaMaquina(
            client,
            {
              matricula_id: id,
              maquina_id:
                nueva.maquina_id,
              orden:
                nueva.orden,
              es_regalo:
                nueva.es_regalo,
              horas_asignadas:
                Number(
                  horasPlan.horas
                ),
              sesiones_totales:
                Number(
                  horasPlan.sesiones_totales
                )
            }
          );

        maquinasAgregadas.push({
          ...nueva,
          matricula_maquina_id:
            nuevaMM.id
        });
      }

      // ====================================================
      // 10.6 GENERAR PRÁCTICAS
      //
      // SOLO para:
      //
      // - máquinas realmente nuevas
      //
      // NO para:
      //
      // - conservadas
      // - reactivadas
      //
      // porque esas ya pueden tener prácticas históricas.
      // ====================================================

      for (
        const nueva
        of maquinasAgregadas
      ) {

        if (
          nueva.ya_existia
        ) {
          continue;
        }

        if (
          !nueva.matricula_maquina_id
        ) {
          throw new Error(
            `No se pudo obtener el ID de matrícula-máquina para la máquina ID ${nueva.maquina_id}.`
          );
        }

        await crearAsignacionPracticas(
          id,
          client,
          nueva.matricula_maquina_id
        );
      }
    }

    // ======================================================
    // 11. CAMBIO FINANCIERO
    //
    // IMPORTANTE:
    //
    // Por ahora SOLO dejamos detectado el cambio.
    //
    // Aquí es donde debe entrar la conciliación de cuotas:
    //
    // PAGADAS    → conservar
    // PENDIENTES → recalcular
    // SOBRANTES  → anular
    // NUEVAS     → insertar
    //
    // ======================================================

    if (cambioPlan) {

      // ----------------------------------------------------
      // AQUÍ NO SE BORRA EL PLAN DE PAGOS ACTUAL.
      //
      // La conciliación financiera se debe hacer
      // respetando los pagos realizados.
      // ----------------------------------------------------

      // Esta parte se implementará con la función
      // de conciliación de cuotas.
    }

    // ======================================================
    // 12. HISTORIAL
    // ======================================================

    let descripcion =
      'Se actualizó la matrícula.';

    if (cambioPlan) {
      descripcion +=
        ' Se cambió el plan de curso.';
    }

    // ====================================================
    // HISTORIAL DE MÁQUINAS
    // ====================================================

    if (
      seEnvioMaquinas &&
      cambioMaquinas
    ) {

      // --------------------------------------------------
      // CONSERVADAS
      // --------------------------------------------------

      if (
        maquinasConservadas.length > 0
      ) {

        const idsConservadas =
          maquinasConservadas.map(
            item =>
              Number(
                item.maquina_id
              )
          );

        const nombresResult =
          await client.query(
            `
            SELECT nombre
            FROM maquinas
            WHERE id = ANY($1::int[])
            ORDER BY nombre
            `,
            [
              idsConservadas
            ]
          );

        const nombres =
          nombresResult.rows
            .map(
              row => row.nombre
            )
            .join(', ');

        if (nombres) {
          descripcion +=
            ` Máquinas conservadas: ${nombres}.`;
        }
      }

      // --------------------------------------------------
      // NUEVAS
      // --------------------------------------------------

      const idsNuevas = [
        ...maquinasAgregadas,
        ...maquinasReactivadas
      ]
        .map(
          item =>
            Number(
              item.maquina_id
            )
        );

      if (
        idsNuevas.length > 0
      ) {

        const nombresResult =
          await client.query(
            `
            SELECT nombre
            FROM maquinas
            WHERE id = ANY($1::int[])
            ORDER BY nombre
            `,
            [
              idsNuevas
            ]
          );

        const nombres =
          nombresResult.rows
            .map(
              row => row.nombre
            )
            .join(', ');

        if (nombres) {
          descripcion +=
            ` Máquinas agregadas/reactivadas: ${nombres}.`;
        }
      }

      // --------------------------------------------------
      // RETIRADAS
      // --------------------------------------------------

      if (
        maquinasEliminadas.length > 0
      ) {

        const idsRetiradas =
          maquinasEliminadas.map(
            item =>
              Number(
                item.maquina_id
              )
          );

        const nombresResult =
          await client.query(
            `
            SELECT nombre
            FROM maquinas
            WHERE id = ANY($1::int[])
            ORDER BY nombre
            `,
            [
              idsRetiradas
            ]
          );

        const nombres =
          nombresResult.rows
            .map(
              row => row.nombre
            )
            .join(', ');

        if (nombres) {
          descripcion +=
            ` Máquinas retiradas: ${nombres}.`;
        }
      }
    }

    // ======================================================
    // 13. REGISTRAR HISTORIAL
    // ======================================================

    await registrarHistorial(
      client,
      {
        matricula_id: id,
        accion: 'ACTUALIZACION',
        descripcion
      },
      user
    );

    // ======================================================
    // 14. COMMIT
    // ======================================================

    await client.query('COMMIT');

    // ======================================================
    // 15. DEVOLVER MATRÍCULA ACTUALIZADA
    // ======================================================

    return await obtenerMatriculaPorId(id);

  } catch (error) {

    await client.query(
      'ROLLBACK'
    );

    throw error;

  } finally {

    client.release();
  }
}

// ==========================================================
// OBTENER NOMBRES DE MÁQUINAS
// ==========================================================

async function obtenerNombresMaquinas(
  client,
  maquinas
) {

  const ids =
    maquinas
      .map(
        item =>
          Number(
            item.maquina_id
          )
      )
      .filter(Boolean);

  if (!ids.length) {
    return [];
  }

  const result =
    await client.query(
      `
      SELECT
        id,
        nombre

      FROM maquinas

      WHERE id = ANY($1::int[])

      ORDER BY nombre
      `,
      [ids]
    );

  return result.rows.map(
    row =>
      row.nombre
  );
}


// ==========================================================
// REGENERAR TODO
// ==========================================================

async function regenerarTodo(
  client,
  matriculaId,
  data
) {

  const plan =
    await obtenerPlanCursoDetalle(
      client,
      data.plan_curso_id
    );

  if (!plan) {

    throw new Error(
      'Plan no encontrado.'
    );
  }

  // --------------------------------------------------------
  // DETERMINAR MÁQUINAS
  // --------------------------------------------------------

  const maquinasAGuardar =
    await determinarMaquinas(
      client,
      plan,
      data.maquinas_seleccionadas
    );

  // --------------------------------------------------------
  // NOMBRES
  // --------------------------------------------------------

  const nombresMaquinas =
    await obtenerNombresMaquinas(
      client,
      maquinasAGuardar
    );

  // --------------------------------------------------------
  // CREAR MATRÍCULA-MÁQUINAS
  // --------------------------------------------------------

  for (
    const item
    of maquinasAGuardar
  ) {

    const horasPlan =
      await obtenerHorasPlanPorMaquina(
        client,
        data.plan_curso_id,
        item.maquina_id
      );

    if (!horasPlan) {

      throw new Error(
        `No existe configuración de horas prácticas para la máquina ID ${item.maquina_id} en el plan seleccionado.`
      );
    }

    await insertarMatriculaMaquina(
      client,
      {
        matricula_id:
          matriculaId,

        maquina_id:
          item.maquina_id,

        orden:
          item.orden,

        es_regalo:
          item.es_regalo,

        horas_asignadas:
          Number(
            horasPlan.horas
          ),

        sesiones_totales:
          Number(
            horasPlan.sesiones_totales
          )
      }
    );
  }

  // --------------------------------------------------------
  // PRÁCTICAS
  // --------------------------------------------------------

  await crearAsignacionPracticas(
    matriculaId,
    client
  );

  // --------------------------------------------------------
  // PRECIO
  // --------------------------------------------------------

  const planPrecio =
    await obtenerPlanPrecioVigente(
      client,
      data.plan_curso_id,
      data.fecha_matricula,
      maquinasAGuardar,
      plan.tipo_curso_codigo
    );

  if (!planPrecio) {

    throw new Error(
      'No hay precio activo para este curso.'
    );
  }

  // --------------------------------------------------------
  // PLAN FINANCIERO
  // --------------------------------------------------------

  await crearPlanFinanciero(
    client,
    {
      matriculaId,
      planPrecio,
      fechaMatricula:
        data.fecha_matricula,
      fechaInicio:
        data.fecha_inicio || null,
      fechaFinEstimada:
        data.fecha_fin_estimada || null,
      modalidadPago:
        data.modalidad_pago || 'MENSUAL',
      nombresMaquinas
    }
  );
}


// ==========================================================
// RESUMEN FINANCIERO
// ==========================================================

async function obtenerResumenFinanzasMatricula(
  matriculaId
) {

  const result =
    await pool.query(
      `
      SELECT
        ppa.id,
        ppa.matricula_id,
        ppa.plan_precio_id,
        ppa.monto_total,
        ppa.monto_matricula,
        ppa.monto_certificacion,
        ppa.cantidad_cuotas,
        ppa.monto_cuota,
        ppa.modalidad_pago,
        ppa.nota_pago,
        ppa.fecha_creacion

      FROM planes_pago_alumno ppa

      WHERE ppa.matricula_id = $1

      ORDER BY ppa.id DESC

      LIMIT 1
      `,
      [matriculaId]
    );

  return result.rows[0] || null;
}


// ==========================================================
// LISTAR CUOTAS
// ==========================================================

async function listarCuotasDeMatricula(
  matriculaId
) {

  const result =
    await pool.query(
      `
      SELECT
        c.id,
        c.plan_pago_alumno_id,
        c.numero_cuota,
        c.concepto_id,

        cc.codigo AS concepto_codigo,
        cc.nombre AS concepto_nombre,

        c.fecha_programada,
        c.fecha_vencimiento,
        c.monto_programado,
        c.monto_pagado,
        c.saldo_pendiente,
        c.estado,
        c.observaciones

      FROM cuotas c

      INNER JOIN planes_pago_alumno ppa
        ON ppa.id =
           c.plan_pago_alumno_id

      INNER JOIN conceptos_cobro cc
        ON cc.id =
           c.concepto_id

      WHERE ppa.matricula_id = $1

      ORDER BY
        CASE
          WHEN cc.codigo = 'MATRICULA'
            THEN 0

          WHEN cc.codigo = 'CUOTA'
            THEN 1

          WHEN cc.codigo = 'CERTIFICACION'
            THEN 2

          ELSE 3
        END,

        c.numero_cuota ASC NULLS LAST,
        c.fecha_vencimiento ASC,
        c.id ASC
      `,
      [matriculaId]
    );

  return result.rows;
}


// ==========================================================
// HISTORIAL
// ==========================================================

async function registrarHistorial(
  client,
  data,
  user
) {

  const nombreUsuario =
    user &&
    (
      user.nombres ||
      user.apellidos
    )
      ? `${user.nombres || ''} ${user.apellidos || ''}`.trim()
      : 'sistema';

  await client.query(
    `
    INSERT INTO matricula_historial (
      matricula_id,
      accion,
      descripcion,
      usuario
    )

    VALUES (
      $1,
      $2,
      $3,
      $4
    )
    `,
    [
      data.matricula_id,
      data.accion,
      data.descripcion,
      nombreUsuario
    ]
  );
}


// ==========================================================
// SUMAR MESES
// ==========================================================

function sumarMeses(
  fechaBase,
  meses
) {

  const [
    anioStr,
    mesStr,
    diaStr
  ] =
    String(
      fechaBase
    ).split('-');

  const fecha =
    new Date(
      Number(anioStr),
      Number(mesStr) - 1,
      Number(diaStr)
    );

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {

    throw new Error(
      'Fecha inválida para calcular cuotas.'
    );
  }

  fecha.setMonth(
    fecha.getMonth() + meses
  );

  const anio =
    fecha.getFullYear();

  const mes =
    String(
      fecha.getMonth() + 1
    ).padStart(2, '0');

  const dia =
    String(
      fecha.getDate()
    ).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}


// ==========================================================
// SUMAR DÍAS
// ==========================================================

function sumarDias(
  fechaBase,
  dias
) {

  const [
    anioStr,
    mesStr,
    diaStr
  ] =
    String(
      fechaBase
    ).split('-');

  const fecha =
    new Date(
      Number(anioStr),
      Number(mesStr) - 1,
      Number(diaStr)
    );

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {

    throw new Error(
      'Fecha inválida para calcular cuotas.'
    );
  }

  fecha.setDate(
    fecha.getDate() + dias
  );

  const anio =
    fecha.getFullYear();

  const mes =
    String(
      fecha.getMonth() + 1
    ).padStart(2, '0');

  const dia =
    String(
      fecha.getDate()
    ).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}


// ==========================================================
// OBTENER HISTORIAL
// ==========================================================

async function obtenerHistorial(
  matriculaId
) {

  const result =
    await pool.query(
      `
      SELECT *
      FROM matricula_historial

      WHERE matricula_id = $1

      ORDER BY fecha DESC
      `,
      [matriculaId]
    );

  return result.rows;
}


// ==========================================================
// CREAR PLAN DE PAGO MANUAL
//
// ESTE NO SE MODIFICA CON LA LÓGICA AUTOMÁTICA.
// ==========================================================

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

    await client.query(
      'BEGIN'
    );

    // ------------------------------------------------------
    // MATRÍCULA
    // ------------------------------------------------------

    const matriculaRes =
      await client.query(
        `
        SELECT *
        FROM matriculas

        WHERE id = $1

        LIMIT 1
        `,
        [matricula_id]
      );

    const matricula =
      matriculaRes.rows[0];

    if (!matricula) {

      throw new Error(
        'Matrícula no encontrada.'
      );
    }

    // ------------------------------------------------------
    // VALIDAR PLAN EXISTENTE
    // ------------------------------------------------------

    const existePlan =
      await client.query(
        `
        SELECT id

        FROM planes_pago_alumno

        WHERE matricula_id = $1

        LIMIT 1
        `,
        [matricula_id]
      );

    if (
      existePlan.rows.length > 0
    ) {

      throw new Error(
        'La matrícula ya tiene un plan de pagos.'
      );
    }

    // ------------------------------------------------------
    // VALIDAR CUOTAS
    // ------------------------------------------------------

    if (
      !Array.isArray(cuotas) ||
      cuotas.length === 0
    ) {

      throw new Error(
        'Debe enviar al menos una cuota.'
      );
    }

    // ------------------------------------------------------
    // CONCEPTOS
    // ------------------------------------------------------

    const conceptosRes =
      await client.query(
        `
        SELECT
          id,
          codigo

        FROM conceptos_cobro
        `
      );

    const conceptos = {};

    for (
      const concepto
      of conceptosRes.rows
    ) {

      conceptos[
        concepto.codigo
      ] =
        concepto.id;
    }

    if (
      !conceptos.MATRICULA ||
      !conceptos.CUOTA ||
      !conceptos.CERTIFICACION
    ) {

      throw new Error(
        'Faltan conceptos de cobro base.'
      );
    }

    // ------------------------------------------------------
    // DATOS
    // ------------------------------------------------------

    const cantidad_cuotas =
      cuotas.length;

    const monto_cuota =
      Number(
        (
          cuotas.reduce(
            (
              acc,
              item
            ) =>
              acc +
              Number(
                item.monto || 0
              ),
            0
          ) /
          cantidad_cuotas
        ).toFixed(2)
      );

    // ------------------------------------------------------
    // PLAN
    // ------------------------------------------------------

    const planPagoRes =
      await client.query(
        `
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
        `,
        [
          matricula_id,
          monto_total,
          monto_matricula,
          monto_certificacion,
          cantidad_cuotas,
          monto_cuota,
          nota_pago,
          modalidad_pago
        ]
      );

    const planPago =
      planPagoRes.rows[0];

    // ------------------------------------------------------
    // MATRÍCULA
    // ------------------------------------------------------

    if (
      Number(
        monto_matricula
      ) > 0
    ) {

      await client.query(
        `
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
        `,
        [
          planPago.id,
          conceptos.MATRICULA,
          monto_matricula
        ]
      );
    }

    // ------------------------------------------------------
    // CUOTAS
    // ------------------------------------------------------

    for (
      const cuota
      of cuotas
    ) {

      await client.query(
        `
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
        `,
        [
          planPago.id,
          cuota.numero_cuota,
          conceptos.CUOTA,
          cuota.fecha_vencimiento,
          cuota.monto,
          cuota.observaciones ||
            `Cuota ${cuota.numero_cuota}`
        ]
      );
    }

    // ------------------------------------------------------
    // CERTIFICACIÓN
    // ------------------------------------------------------

    if (
      Number(
        monto_certificacion
      ) > 0
    ) {

      const ultimaFecha =
        cuotas[
          cuotas.length - 1
        ].fecha_vencimiento;

      await client.query(
        `
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
        `,
        [
          planPago.id,
          conceptos.CERTIFICACION,
          ultimaFecha,
          monto_certificacion
        ]
      );
    }

    await client.query(
      'COMMIT'
    );

    return {
      mensaje:
        'Plan manual creado correctamente',

      plan_pago_alumno_id:
        planPago.id
    };

  } catch (error) {

    await client.query(
      'ROLLBACK'
    );

    throw error;

  } finally {

    client.release();
  }
}


// ==========================================================
// EXPORTS
// ==========================================================

module.exports = {

  listarMatriculas,

  obtenerMatriculaPorId,

  crearMatricula,

  obtenerEstadoPorCodigo,

  actualizarEstadoMatricula,

  actualizarMatricula,

  obtenerDetalleMatricula,

  listarMaquinasDeMatricula,

  obtenerResumenFinanzasMatricula,

  listarCuotasDeMatricula,

  procesarTodo,

  obtenerHistorial,

  crearPlanPagoManual
};
