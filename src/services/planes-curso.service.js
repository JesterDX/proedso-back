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
      tc.cantidad_maquinas

    FROM planes_curso pc

    INNER JOIN tipos_curso tc
      ON tc.id = pc.tipo_curso_id

    ORDER BY pc.nombre ASC
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

  const planResult = await pool.query(planQuery, [id]);

  if (planResult.rows.length === 0) {
    return null;
  }

  const plan = planResult.rows[0];


  // ----------------------------------------------------------
  // MÁQUINAS
  // ----------------------------------------------------------

  const maquinasQuery = `
    SELECT
      pm.id,
      pm.maquina_id,
      m.nombre AS maquina_nombre,
      pm.orden,
      pm.es_regalo,
      pm.obligatoria

    FROM plan_maquinas pm

    INNER JOIN maquinas m
      ON m.id = pm.maquina_id

    WHERE pm.plan_curso_id = $1

    ORDER BY pm.orden ASC
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

    ORDER BY m.orden_visual ASC, m.nombre ASC
  `;

  const horasResult = await pool.query(
    horasQuery,
    [id]
  );


  // ----------------------------------------------------------
  // PRECIOS
  // ----------------------------------------------------------

  const preciosQuery = `
    SELECT
      pp.id,
      pp.nombre,
      pp.monto_total,
      pp.matricula,
      pp.certificacion,
      pp.cantidad_cuotas,
      pp.monto_cuota,
      pp.vigente_desde,
      pp.vigente_hasta,
      pp.activo,
      pp.observaciones,
      pp.aplica_maquina_id,
      m.nombre AS aplica_maquina_nombre,
      pp.requiere_tractor

    FROM plan_precios pp

    LEFT JOIN maquinas m
      ON m.id = pp.aplica_maquina_id

    WHERE pp.plan_curso_id = $1

    ORDER BY pp.id ASC
  `;

  const preciosResult = await pool.query(
    preciosQuery,
    [id]
  );


  // ----------------------------------------------------------
  // RESPUESTA
  // ----------------------------------------------------------

  return {
    ...plan,

    maquinas: maquinasResult.rows,

    horas_practica: horasResult.rows,

    precios: preciosResult.rows
  };
}


// ============================================================
// CREAR PLAN DE CURSO
// ============================================================

async function crearPlanCurso(data) {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');


    // --------------------------------------------------------
    // DATOS RECIBIDOS
    // --------------------------------------------------------

    const {
      tipo_curso_id,
      codigo,
      nombre,
      version = 1,
      permite_eleccion_personalizada = false,
      vigente_desde = null,
      vigente_hasta = null,
      activo = true,
      observaciones = null,

      maquinas = [],
      horas_practica = [],
      precios = []

    } = data;


    // --------------------------------------------------------
    // VALIDACIONES BÁSICAS
    // --------------------------------------------------------

    if (!tipo_curso_id) {
      throw new Error(
        'El tipo de curso es obligatorio.'
      );
    }

    if (!codigo || !codigo.trim()) {
      throw new Error(
        'El código del plan es obligatorio.'
      );
    }

    if (!nombre || !nombre.trim()) {
      throw new Error(
        'El nombre del plan es obligatorio.'
      );
    }


    // --------------------------------------------------------
    // OBTENER TIPO DE CURSO
    // --------------------------------------------------------

    const tipoQuery = `
      SELECT
        id,
        codigo,
        nombre,
        duracion_meses,
        cantidad_maquinas,
        activo

      FROM tipos_curso

      WHERE id = $1
    `;

    const tipoResult = await client.query(
      tipoQuery,
      [tipo_curso_id]
    );

    if (tipoResult.rows.length === 0) {
      throw new Error(
        'El tipo de curso no existe.'
      );
    }

    const tipoCurso = tipoResult.rows[0];


    // --------------------------------------------------------
    // VALIDAR QUE EL TIPO ESTÉ ACTIVO
    // --------------------------------------------------------

    if (!tipoCurso.activo) {
      throw new Error(
        'El tipo de curso seleccionado está inactivo.'
      );
    }


    // --------------------------------------------------------
    // NORMALIZAR MÁQUINAS
    // --------------------------------------------------------

    const maquinasNormalizadas = maquinas.map(
      (maquina, index) => ({
        maquina_id: Number(maquina.maquina_id),
        orden:
          maquina.orden != null
            ? Number(maquina.orden)
            : index + 1,
        es_regalo:
          maquina.es_regalo ?? false,
        obligatoria:
          maquina.obligatoria ?? true
      })
    );


    // --------------------------------------------------------
    // VALIDAR MÁQUINAS DUPLICADAS
    // --------------------------------------------------------

    const maquinaIds =
      maquinasNormalizadas.map(
        maquina => maquina.maquina_id
      );

    const maquinaIdsUnicos =
      new Set(maquinaIds);

    if (
      maquinaIdsUnicos.size !==
      maquinaIds.length
    ) {
      throw new Error(
        'No se puede seleccionar la misma máquina más de una vez.'
      );
    }


    // --------------------------------------------------------
    // VALIDAR CANTIDAD DE MÁQUINAS
    // --------------------------------------------------------

    const cantidadPermitida =
      Number(tipoCurso.cantidad_maquinas);

    const permiteEleccion =
      Boolean(
        permite_eleccion_personalizada
      );


    /*
      Si el plan NO permite elección personalizada:
      debe tener exactamente la cantidad configurada.

      Ejemplo:

      INDIVIDUAL -> 1
      DOBLE      -> 2
      TRIPLE     -> 3
      CUÁDRUPLE  -> 4
      SÉXTUPLE   -> 6
    */

    if (
      !permiteEleccion &&
      maquinaIds.length !== cantidadPermitida
    ) {
      throw new Error(
        `El tipo de curso "${tipoCurso.nombre}" requiere ${cantidadPermitida} máquina(s).`
      );
    }


    /*
      Si permite elección personalizada:

      puede tener varias máquinas disponibles,
      pero como mínimo debe tener la cantidad
      establecida por el tipo.
    */

    if (
      permiteEleccion &&
      maquinaIds.length < cantidadPermitida
    ) {
      throw new Error(
        `El plan debe tener como mínimo ${cantidadPermitida} máquina(s).`
      );
    }


    // --------------------------------------------------------
    // VALIDAR QUE LAS MÁQUINAS EXISTAN Y ESTÉN ACTIVAS
    // --------------------------------------------------------

    if (maquinaIds.length > 0) {

      const maquinasResult =
        await client.query(
          `
          SELECT id
          FROM maquinas
          WHERE activo = true
            AND id = ANY($1::smallint[])
          `,
          [maquinaIds]
        );

      if (
        maquinasResult.rows.length !==
        maquinaIds.length
      ) {
        throw new Error(
          'Una o más máquinas seleccionadas no existen o están inactivas.'
        );
      }
    }


    // --------------------------------------------------------
    // INSERTAR PLAN PRINCIPAL
    // --------------------------------------------------------

    const planQuery = `
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
        $4,
        $5,
        $6,
        $7,
        $8,
        $9
      )

      RETURNING *
    `;

    const planResult =
      await client.query(
        planQuery,
        [
          tipo_curso_id,
          codigo.trim(),
          nombre.trim(),
          version,
          permiteEleccion,
          vigente_desde,
          vigente_hasta,
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
          obligatoria
        )

        VALUES
        ($1, $2, $3, $4, $5)
        `,
        [
          planId,
          maquina.maquina_id,
          maquina.orden,
          maquina.es_regalo,
          maquina.obligatoria
        ]
      );
    }


    // --------------------------------------------------------
    // NORMALIZAR HORAS
    // --------------------------------------------------------

    const horasNormalizadas =
      horas_practica.map(
        hora => ({
          maquina_id:
            Number(hora.maquina_id),

          horas:
            Number(hora.horas),

          sesiones_totales:
            Number(hora.sesiones_totales)
        })
      );


    // --------------------------------------------------------
    // VALIDAR HORAS
    // --------------------------------------------------------

    const maquinasDelPlan =
      new Set(maquinaIds);


    const maquinasHoras =
      new Set();


    for (
      const hora
      of horasNormalizadas
    ) {

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


    // --------------------------------------------------------
    // INSERTAR HORAS Y SESIONES
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
        ($1, $2, $3, $4)
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
    // INSERTAR PRECIOS
    // --------------------------------------------------------

    for (
      const precio
      of precios
    ) {

      const aplicaMaquinaId =
        precio.aplica_maquina_id != null
          ? Number(precio.aplica_maquina_id)
          : null;


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
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13
        )
        `,
        [
          planId,
          precio.nombre,
          precio.monto_total ?? null,
          precio.matricula ?? 0,
          precio.certificacion ?? 0,
          precio.cantidad_cuotas ?? 0,
          precio.monto_cuota ?? null,
          precio.vigente_desde ?? null,
          precio.vigente_hasta ?? null,
          precio.activo ?? true,
          precio.observaciones ?? null,
          aplicaMaquinaId,
          precio.requiere_tractor ?? false
        ]
      );
    }


    // --------------------------------------------------------
    // CONFIRMAR TRANSACCIÓN
    // --------------------------------------------------------

    await client.query('COMMIT');


    // --------------------------------------------------------
    // DEVOLVER PLAN COMPLETO
    // --------------------------------------------------------

    return await obtenerPlanCurso(planId);

  } catch (error) {

    // --------------------------------------------------------
    // DESHACER TODO SI OCURRIÓ UN ERROR
    // --------------------------------------------------------

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

  const client = await pool.connect();

  try {

    await client.query('BEGIN');


    // --------------------------------------------------------
    // DATOS RECIBIDOS
    // --------------------------------------------------------

    const {
      tipo_curso_id,
      codigo,
      nombre,
      version = 1,
      permite_eleccion_personalizada = false,
      vigente_desde = null,
      vigente_hasta = null,
      activo = true,
      observaciones = null,

      maquinas = [],
      horas_practica = [],
      precios = []

    } = data;


    // --------------------------------------------------------
    // VERIFICAR PLAN
    // --------------------------------------------------------

    const existeResult =
      await client.query(
        `
        SELECT id
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
    // VERIFICAR TIPO DE CURSO
    // --------------------------------------------------------

    const tipoResult =
      await client.query(
        `
        SELECT
          id,
          nombre,
          cantidad_maquinas,
          activo

        FROM tipos_curso

        WHERE id = $1
        `,
        [tipo_curso_id]
      );


    if (
      tipoResult.rows.length === 0
    ) {
      throw new Error(
        'El tipo de curso no existe.'
      );
    }


    const tipoCurso =
      tipoResult.rows[0];


    if (!tipoCurso.activo) {
      throw new Error(
        'El tipo de curso seleccionado está inactivo.'
      );
    }


    // --------------------------------------------------------
    // MÁQUINAS
    // --------------------------------------------------------

    const maquinasNormalizadas =
      maquinas.map(
        (maquina, index) => ({
          maquina_id:
            Number(maquina.maquina_id),

          orden:
            maquina.orden != null
              ? Number(maquina.orden)
              : index + 1,

          es_regalo:
            maquina.es_regalo ?? false,

          obligatoria:
            maquina.obligatoria ?? true
        })
      );


    const maquinaIds =
      maquinasNormalizadas.map(
        maquina => maquina.maquina_id
      );


    const maquinaIdsUnicos =
      new Set(maquinaIds);


    if (
      maquinaIdsUnicos.size !==
      maquinaIds.length
    ) {
      throw new Error(
        'No se puede seleccionar la misma máquina más de una vez.'
      );
    }


    // --------------------------------------------------------
    // VALIDAR CANTIDAD
    // --------------------------------------------------------

    const cantidadPermitida =
      Number(
        tipoCurso.cantidad_maquinas
      );

    const permiteEleccion =
      Boolean(
        permite_eleccion_personalizada
      );


    if (
      !permiteEleccion &&
      maquinaIds.length !== cantidadPermitida
    ) {
      throw new Error(
        `El tipo de curso "${tipoCurso.nombre}" requiere ${cantidadPermitida} máquina(s).`
      );
    }


    if (
      permiteEleccion &&
      maquinaIds.length < cantidadPermitida
    ) {
      throw new Error(
        `El plan debe tener como mínimo ${cantidadPermitida} máquina(s).`
      );
    }


    // --------------------------------------------------------
    // VALIDAR MÁQUINAS ACTIVAS
    // --------------------------------------------------------

    if (maquinaIds.length > 0) {

      const maquinasResult =
        await client.query(
          `
          SELECT id
          FROM maquinas
          WHERE activo = true
            AND id = ANY($1::smallint[])
          `,
          [maquinaIds]
        );


      if (
        maquinasResult.rows.length !==
        maquinaIds.length
      ) {
        throw new Error(
          'Una o más máquinas seleccionadas no existen o están inactivas.'
        );
      }
    }


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
        version = $4,
        permite_eleccion_personalizada = $5,
        vigente_desde = $6,
        vigente_hasta = $7,
        activo = $8,
        observaciones = $9

      WHERE id = $10
      `,
      [
        tipo_curso_id,
        codigo.trim(),
        nombre.trim(),
        version,
        permiteEleccion,
        vigente_desde,
        vigente_hasta,
        activo,
        observaciones,
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
    // INSERTAR NUEVAS MÁQUINAS
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
          obligatoria
        )

        VALUES
        ($1, $2, $3, $4, $5)
        `,
        [
          id,
          maquina.maquina_id,
          maquina.orden,
          maquina.es_regalo,
          maquina.obligatoria
        ]
      );
    }


    // --------------------------------------------------------
    // HORAS
    // --------------------------------------------------------

    const horasNormalizadas =
      horas_practica.map(
        hora => ({
          maquina_id:
            Number(hora.maquina_id),

          horas:
            Number(hora.horas),

          sesiones_totales:
            Number(hora.sesiones_totales)
        })
      );


    const maquinasDelPlan =
      new Set(maquinaIds);

    const maquinasHoras =
      new Set();


    for (
      const hora
      of horasNormalizadas
    ) {

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
        ($1, $2, $3, $4)
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
    // INSERTAR PRECIOS
    // --------------------------------------------------------

    for (
      const precio
      of precios
    ) {

      const aplicaMaquinaId =
        precio.aplica_maquina_id != null
          ? Number(precio.aplica_maquina_id)
          : null;


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
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13
        )
        `,
        [
          id,
          precio.nombre,
          precio.monto_total ?? null,
          precio.matricula ?? 0,
          precio.certificacion ?? 0,
          precio.cantidad_cuotas ?? 0,
          precio.monto_cuota ?? null,
          precio.vigente_desde ?? null,
          precio.vigente_hasta ?? null,
          precio.activo ?? true,
          precio.observaciones ?? null,
          aplicaMaquinaId,
          precio.requiere_tractor ?? false
        ]
      );
    }


    // --------------------------------------------------------
    // CONFIRMAR
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
// CAMBIAR ESTADO
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
