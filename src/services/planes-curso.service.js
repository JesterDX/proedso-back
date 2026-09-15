const pool = require('../config/db');

// ============================================================
// LISTAR PLANES DE CURSO
// ============================================================

async function listarPlanesCurso() {

  const query = `
    SELECT
      pc.id,
      pc.codigo,
      pc.nombre,
      pc.version,
      pc.permite_eleccion_personalizada,
      pc.vigente_desde,
      pc.vigente_hasta,
      pc.activo,
      pc.observaciones,

      tc.id AS tipo_curso_id,
      tc.codigo AS tipo_curso_codigo,
      tc.nombre AS tipo_curso_nombre,
      tc.duracion_meses,
      tc.cantidad_maquinas,

      COALESCE(
        (
          SELECT pp.cantidad_cuotas
          FROM plan_precios pp
          WHERE pp.plan_curso_id = pc.id
            AND pp.activo = true
          ORDER BY pp.id DESC
          LIMIT 1
        ),
        0
      ) AS cantidad_cuotas,

      (
        SELECT COUNT(*)
        FROM plan_maquinas pm
        WHERE pm.plan_curso_id = pc.id
          AND pm.disponible_matricula = true
          AND pm.es_regalo = false
      ) AS maquinas_disponibles

    FROM planes_curso pc

    INNER JOIN tipos_curso tc
      ON tc.id = pc.tipo_curso_id

    ORDER BY tc.nombre ASC, pc.nombre ASC
  `;

  const result = await pool.query(query);

  return result.rows;
}


// ============================================================
// OBTENER DETALLE DE UN PLAN DE CURSO
// ============================================================

async function obtenerPlanCurso(id) {

  // ----------------------------------------------------------
  // DATOS PRINCIPALES
  // ----------------------------------------------------------

  const planQuery = `
    SELECT
      pc.id,
      pc.codigo,
      pc.nombre,
      pc.version,
      pc.permite_eleccion_personalizada,
      pc.vigente_desde,
      pc.vigente_hasta,
      pc.activo,
      pc.observaciones,

      tc.id AS tipo_curso_id,
      tc.codigo AS tipo_curso_codigo,
      tc.nombre AS tipo_curso_nombre,
      tc.duracion_meses,
      tc.cantidad_maquinas

    FROM planes_curso pc

    INNER JOIN tipos_curso tc
      ON tc.id = pc.tipo_curso_id

    WHERE pc.id = $1
  `;

  const planResult = await pool.query(
    planQuery,
    [id]
  );

  if (planResult.rows.length === 0) {
    return null;
  }

  const plan = planResult.rows[0];


  // ----------------------------------------------------------
  // MÁQUINAS DEL PLAN
  // ----------------------------------------------------------

  const maquinasQuery = `
    SELECT
      pm.id,
      pm.maquina_id,
      m.nombre AS maquina_nombre,
      m.activo AS maquina_activa,
      pm.orden,
      pm.es_regalo,
      pm.obligatoria,
      pm.disponible_matricula

    FROM plan_maquinas pm

    INNER JOIN maquinas m
      ON m.id = pm.maquina_id

    WHERE pm.plan_curso_id = $1

    ORDER BY
      pm.orden ASC,
      m.orden_visual ASC,
      m.nombre ASC
  `;

  const maquinasResult = await pool.query(
    maquinasQuery,
    [id]
  );


  // ----------------------------------------------------------
  // HORAS Y SESIONES
  // ----------------------------------------------------------

  const horasQuery = `
    SELECT
      php.id,
      php.maquina_id,
      m.nombre AS maquina_nombre,
      php.horas,
      php.sesiones_totales

    FROM plan_horas_practica php

    INNER JOIN maquinas m
      ON m.id = php.maquina_id

    WHERE php.plan_curso_id = $1

    ORDER BY
      m.orden_visual ASC,
      m.nombre ASC
  `;

  const horasResult = await pool.query(
    horasQuery,
    [id]
  );


  // ----------------------------------------------------------
  // CONFIGURACIÓN DE CUOTAS
  // ----------------------------------------------------------

  const cuotasQuery = `
    SELECT
      pp.id,
      pp.cantidad_cuotas,
      pp.activo

    FROM plan_precios pp

    WHERE pp.plan_curso_id = $1

    ORDER BY pp.id DESC

    LIMIT 1
  `;

  const cuotasResult = await pool.query(
    cuotasQuery,
    [id]
  );


  const cantidadCuotas =
    cuotasResult.rows.length > 0
      ? Number(cuotasResult.rows[0].cantidad_cuotas || 0)
      : 0;


  // ----------------------------------------------------------
  // RESPUESTA
  // ----------------------------------------------------------

  return {
    ...plan,

    cantidad_cuotas: cantidadCuotas,

    maquinas: maquinasResult.rows,

    horas_practica: horasResult.rows,

    // Se mantiene para no romper el contrato actual
    precios: cuotasResult.rows
  };
}


// ============================================================
// OBTENER TIPO DE CURSO
// ============================================================

async function obtenerTipoCurso(
  client,
  tipoCursoId
) {

  const result = await client.query(
    `
    SELECT
      id,
      codigo,
      nombre,
      duracion_meses,
      cantidad_maquinas,
      activo
    FROM tipos_curso
    WHERE id = $1
    `,
    [tipoCursoId]
  );

  if (result.rows.length === 0) {
    throw new Error(
      'El tipo de curso no existe.'
    );
  }

  return result.rows[0];
}


// ============================================================
// OBTENER TODAS LAS MÁQUINAS ACTIVAS
// ============================================================

async function obtenerMaquinasActivas(client) {

  const result = await client.query(
    `
    SELECT
      id,
      nombre,
      activo,
      orden_visual
    FROM maquinas
    WHERE activo = true
    ORDER BY
      orden_visual ASC,
      nombre ASC
    `
  );

  return result.rows;
}


// ============================================================
// NORMALIZAR MÁQUINAS
// ============================================================

function normalizarMaquinas(
  maquinas = []
) {

  return maquinas.map(
    (maquina, index) => ({
      maquina_id:
        Number(maquina.maquina_id),

      orden:
        maquina.orden != null
          ? Number(maquina.orden)
          : index + 1,

      es_regalo:
        Boolean(
          maquina.es_regalo ?? false
        ),

      obligatoria:
        Boolean(
          maquina.obligatoria ?? false
        ),

      disponible_matricula:
        Boolean(
          maquina.disponible_matricula ?? true
        )
    })
  );
}


// ============================================================
// VALIDAR MÁQUINAS
// ============================================================

async function validarMaquinas(
  client,
  maquinas
) {

  const ids = maquinas.map(
    maquina => maquina.maquina_id
  );

  const idsUnicos = new Set(ids);

  if (idsUnicos.size !== ids.length) {
    throw new Error(
      'No se puede seleccionar la misma máquina más de una vez.'
    );
  }


  if (ids.length === 0) {
    throw new Error(
      'El plan debe tener al menos una máquina configurada.'
    );
  }


  const result = await client.query(
    `
    SELECT id
    FROM maquinas
    WHERE activo = true
      AND id = ANY($1::smallint[])
    `,
    [ids]
  );


  if (
    result.rows.length !== ids.length
  ) {
    throw new Error(
      'Una o más máquinas seleccionadas no existen o están inactivas.'
    );
  }
}


// ============================================================
// VALIDAR CONFIGURACIÓN DE MÁQUINAS
// ============================================================

function validarConfiguracionMaquinas(
  maquinas,
  cantidadPermitida
) {

  /*
    IMPORTANTE:

    El plan puede tener MUCHAS máquinas disponibles.

    Ejemplo:

    Tipo DOBLE
    cantidadPermitida = 2

    El plan puede tener 11 máquinas.

    El límite de 2 se aplica cuando el alumno
    realiza la matrícula, NO al configurar el plan.
  */

  const disponibles = maquinas.filter(
    maquina =>
      maquina.disponible_matricula &&
      !maquina.es_regalo
  );


  if (disponibles.length < cantidadPermitida) {

    throw new Error(
      `El plan debe tener al menos ${cantidadPermitida} máquina(s) disponibles para matrícula.`
    );
  }


  const obligatorias = maquinas.filter(
    maquina =>
      maquina.obligatoria &&
      !maquina.es_regalo &&
      maquina.disponible_matricula
  );


  if (
    obligatorias.length > cantidadPermitida
  ) {

    throw new Error(
      `No puede haber más de ${cantidadPermitida} máquina(s) obligatorias para este tipo de curso.`
    );
  }
}


// ============================================================
// NORMALIZAR HORAS
// ============================================================

function normalizarHoras(
  horasPractica = []
) {

  return horasPractica.map(
    hora => ({
      maquina_id:
        Number(hora.maquina_id),

      horas:
        Number(hora.horas),

      sesiones_totales:
        Number(hora.sesiones_totales)
    })
  );
}


// ============================================================
// VALIDAR HORAS
// ============================================================

function validarHoras(
  horas,
  maquinas
) {

  const maquinasDelPlan =
    new Set(
      maquinas.map(
        maquina => maquina.maquina_id
      )
    );


  const maquinasHoras =
    new Set();


  for (const hora of horas) {

    if (
      maquinasHoras.has(
        hora.maquina_id
      )
    ) {

      throw new Error(
        'No se puede registrar horas dos veces para la misma máquina.'
      );
    }


    maquinasHoras.add(
      hora.maquina_id
    );


    if (
      !maquinasDelPlan.has(
        hora.maquina_id
      )
    ) {

      throw new Error(
        'Las horas de práctica solo pueden configurarse para máquinas incluidas en el plan.'
      );
    }


    if (
      !Number.isFinite(hora.horas) ||
      hora.horas <= 0
    ) {

      throw new Error(
        'Las horas de práctica deben ser mayores que cero.'
      );
    }


    if (
      !Number.isInteger(
        hora.sesiones_totales
      ) ||
      hora.sesiones_totales <= 0
    ) {

      throw new Error(
        'Las sesiones totales deben ser un número entero mayor que cero.'
      );
    }
  }
}


// ============================================================
// OBTENER CANTIDAD DE CUOTAS
// ============================================================

function obtenerCantidadCuotas(data) {

  const cantidad =
    Number(
      data.cantidad_cuotas
      ?? data.precios?.[0]?.cantidad_cuotas
      ?? 0
    );


  if (
    !Number.isInteger(cantidad) ||
    cantidad <= 0
  ) {

    throw new Error(
      'La cantidad de cuotas debe ser un número entero mayor que cero.'
    );
  }


  return cantidad;
}


// ============================================================
// CREAR CONFIGURACIÓN TÉCNICA DE CUOTAS
// ============================================================

async function crearConfiguracionCuotas(
  client,
  planId,
  nombrePlan,
  cantidadCuotas
) {

  await client.query(
    `
    INSERT INTO plan_precios
    (
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
    )

    VALUES
    (
      $1,
      $2,
      0,
      0,
      0,
      $3,
      0,
      NULL,
      NULL,
      true,
      $4,
      NULL,
      false
    )
    `,
    [
      planId,
      `${nombrePlan} - Configuración de cuotas`,
      cantidadCuotas,
      'Los montos se ingresan manualmente al momento de la matrícula.'
    ]
  );
}


// ============================================================
// CREAR PLAN DE CURSO
// ============================================================

async function crearPlanCurso(data) {

  const client =
    await pool.connect();

  try {

    await client.query('BEGIN');


    const {
      tipo_curso_id,
      maquinas = [],
      horas_practica = [],
      activo = true,
      observaciones = null
    } = data;


    // --------------------------------------------------------
    // TIPO DE CURSO
    // --------------------------------------------------------

    if (!tipo_curso_id) {

      throw new Error(
        'El tipo de curso es obligatorio.'
      );
    }


    const tipoCurso =
      await obtenerTipoCurso(
        client,
        tipo_curso_id
      );


    if (!tipoCurso.activo) {

      throw new Error(
        'El tipo de curso seleccionado está inactivo.'
      );
    }


    // --------------------------------------------------------
    // CÓDIGO AUTOMÁTICO
    // --------------------------------------------------------

    const codigoBase =
      `PLAN-${tipoCurso.codigo}-001`;


    // --------------------------------------------------------
    // NOMBRE AUTOMÁTICO
    // --------------------------------------------------------

    const nombrePlan =
      `Plan ${tipoCurso.nombre}`;


    // --------------------------------------------------------
    // MÁQUINAS
    // --------------------------------------------------------

    const maquinasNormalizadas =
      normalizarMaquinas(maquinas);


    await validarMaquinas(
      client,
      maquinasNormalizadas
    );


    validarConfiguracionMaquinas(
      maquinasNormalizadas,
      Number(
        tipoCurso.cantidad_maquinas
      )
    );


    // --------------------------------------------------------
    // HORAS
    // --------------------------------------------------------

    const horasNormalizadas =
      normalizarHoras(
        horas_practica
      );


    validarHoras(
      horasNormalizadas,
      maquinasNormalizadas
    );


    // --------------------------------------------------------
    // CUOTAS
    // --------------------------------------------------------

    const cantidadCuotas =
      obtenerCantidadCuotas(data);


    // --------------------------------------------------------
    // INSERTAR PLAN
    // --------------------------------------------------------

    const planResult =
      await client.query(
        `
        INSERT INTO planes_curso
        (
          tipo_curso_id,
          codigo,
          nombre,
          version,
          permite_eleccion_personalizada,
          vigente_desde,
          vigente_hasta,
          activo,
          observaciones
        )

        VALUES
        (
          $1,
          $2,
          $3,
          1,
          true,
          NULL,
          NULL,
          $4,
          $5
        )

        RETURNING *
        `,
        [
          tipo_curso_id,
          codigoBase,
          nombrePlan,
          activo,
          observaciones
        ]
      );


    const plan =
      planResult.rows[0];


    const planId =
      plan.id;


    // --------------------------------------------------------
    // INSERTAR MÁQUINAS
    // --------------------------------------------------------

    for (
      const maquina
      of maquinasNormalizadas
    ) {

      await client.query(
        `
        INSERT INTO plan_maquinas
        (
          plan_curso_id,
          maquina_id,
          orden,
          es_regalo,
          obligatoria,
          disponible_matricula
        )

        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )
        `,
        [
          planId,
          maquina.maquina_id,
          maquina.orden,
          maquina.es_regalo,
          maquina.obligatoria,
          maquina.disponible_matricula
        ]
      );
    }


    // --------------------------------------------------------
    // INSERTAR HORAS
    // --------------------------------------------------------

    for (
      const hora
      of horasNormalizadas
    ) {

      await client.query(
        `
        INSERT INTO plan_horas_practica
        (
          plan_curso_id,
          maquina_id,
          horas,
          sesiones_totales
        )

        VALUES
        (
          $1,
          $2,
          $3,
          $4
        )
        `,
        [
          planId,
          hora.maquina_id,
          hora.horas,
          hora.sesiones_totales
        ]
      );
    }


    // --------------------------------------------------------
    // INSERTAR CONFIGURACIÓN DE CUOTAS
    // --------------------------------------------------------

    await crearConfiguracionCuotas(
      client,
      planId,
      nombrePlan,
      cantidadCuotas
    );


    // --------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------

    await client.query('COMMIT');


    return await obtenerPlanCurso(
      planId
    );

  } catch (error) {

    await client.query('ROLLBACK');

    throw error;

  } finally {

    client.release();
  }
}


// ============================================================
// ACTUALIZAR PLAN DE CURSO
// ============================================================

async function actualizarPlanCurso(
  id,
  data
) {

  const client =
    await pool.connect();

  try {

    await client.query('BEGIN');


    // --------------------------------------------------------
    // VERIFICAR PLAN
    // --------------------------------------------------------

    const existeResult =
      await client.query(
        `
        SELECT
          id,
          activo
        FROM planes_curso
        WHERE id = $1
        `,
        [id]
      );


    if (
      existeResult.rows.length === 0
    ) {

      throw new Error(
        'El plan de curso no existe.'
      );
    }


    // --------------------------------------------------------
    // TIPO DE CURSO
    // --------------------------------------------------------

    const tipoCurso =
      await obtenerTipoCurso(
        client,
        data.tipo_curso_id
      );


    if (!tipoCurso.activo) {

      throw new Error(
        'El tipo de curso seleccionado está inactivo.'
      );
    }


    // --------------------------------------------------------
    // MÁQUINAS
    // --------------------------------------------------------

    const maquinasNormalizadas =
      normalizarMaquinas(
        data.maquinas || []
      );


    await validarMaquinas(
      client,
      maquinasNormalizadas
    );


    validarConfiguracionMaquinas(
      maquinasNormalizadas,
      Number(
        tipoCurso.cantidad_maquinas
      )
    );


    // --------------------------------------------------------
    // HORAS
    // --------------------------------------------------------

    const horasNormalizadas =
      normalizarHoras(
        data.horas_practica || []
      );


    validarHoras(
      horasNormalizadas,
      maquinasNormalizadas
    );


    // --------------------------------------------------------
    // CUOTAS
    // --------------------------------------------------------

    const cantidadCuotas =
      obtenerCantidadCuotas(data);


    // --------------------------------------------------------
    // CÓDIGO Y NOMBRE
    // --------------------------------------------------------

    const codigo =
      `PLAN-${tipoCurso.codigo}-001`;


    const nombre =
      `Plan ${tipoCurso.nombre}`;


    // --------------------------------------------------------
    // ACTUALIZAR PLAN
    // --------------------------------------------------------

    await client.query(
      `
      UPDATE planes_curso

      SET
        tipo_curso_id = $1,
        codigo = $2,
        nombre = $3,
        version = 1,
        permite_eleccion_personalizada = true,
        vigente_desde = NULL,
        vigente_hasta = NULL,
        activo = $4,
        observaciones = $5

      WHERE id = $6
      `,
      [
        data.tipo_curso_id,
        codigo,
        nombre,
        data.activo ?? true,
        data.observaciones ?? null,
        id
      ]
    );


    // --------------------------------------------------------
    // ELIMINAR CONFIGURACIÓN ANTERIOR
    // --------------------------------------------------------

    await client.query(
      `
      DELETE FROM plan_maquinas
      WHERE plan_curso_id = $1
      `,
      [id]
    );


    await client.query(
      `
      DELETE FROM plan_horas_practica
      WHERE plan_curso_id = $1
      `,
      [id]
    );


    await client.query(
      `
      DELETE FROM plan_precios
      WHERE plan_curso_id = $1
      `,
      [id]
    );


    // --------------------------------------------------------
    // INSERTAR MÁQUINAS
    // --------------------------------------------------------

    for (
      const maquina
      of maquinasNormalizadas
    ) {

      await client.query(
        `
        INSERT INTO plan_maquinas
        (
          plan_curso_id,
          maquina_id,
          orden,
          es_regalo,
          obligatoria,
          disponible_matricula
        )

        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )
        `,
        [
          id,
          maquina.maquina_id,
          maquina.orden,
          maquina.es_regalo,
          maquina.obligatoria,
          maquina.disponible_matricula
        ]
      );
    }


    // --------------------------------------------------------
    // INSERTAR HORAS
    // --------------------------------------------------------

    for (
      const hora
      of horasNormalizadas
    ) {

      await client.query(
        `
        INSERT INTO plan_horas_practica
        (
          plan_curso_id,
          maquina_id,
          horas,
          sesiones_totales
        )

        VALUES
        (
          $1,
          $2,
          $3,
          $4
        )
        `,
        [
          id,
          hora.maquina_id,
          hora.horas,
          hora.sesiones_totales
        ]
      );
    }


    // --------------------------------------------------------
    // INSERTAR CONFIGURACIÓN DE CUOTAS
    // --------------------------------------------------------

    await crearConfiguracionCuotas(
      client,
      id,
      nombre,
      cantidadCuotas
    );


    // --------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------

    await client.query('COMMIT');


    return await obtenerPlanCurso(id);

  } catch (error) {

    await client.query('ROLLBACK');

    throw error;

  } finally {

    client.release();
  }
}


// ============================================================
// CAMBIAR ESTADO DEL PLAN
// ============================================================

async function cambiarEstadoPlanCurso(
  id,
  activo
) {

  const query = `
    UPDATE planes_curso

    SET activo = $1

    WHERE id = $2

    RETURNING *
  `;


  const result =
    await pool.query(
      query,
      [
        activo,
        id
      ]
    );


  if (
    result.rows.length === 0
  ) {
    return null;
  }


  return result.rows[0];
}


// ============================================================
// EXPORTAR
// ============================================================

module.exports = {

  listarPlanesCurso,

  obtenerPlanCurso,

  crearPlanCurso,

  actualizarPlanCurso,

  cambiarEstadoPlanCurso

};
