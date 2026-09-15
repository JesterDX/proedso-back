const pool = require('../config/db');


// ============================================================
// HELPERS
// ============================================================

function normalizarBooleano(valor, defecto = false) {
  if (valor === undefined || valor === null) {
    return defecto;
  }

  if (typeof valor === 'boolean') {
    return valor;
  }

  if (valor === 'true' || valor === '1') {
    return true;
  }

  if (valor === 'false' || valor === '0') {
    return false;
  }

  return defecto;
}


function numeroPositivo(valor, campo) {

  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error(
      `El campo ${campo} debe ser un número mayor que cero.`
    );
  }

  return numero;
}


function obtenerIdsMaquinas(maquinas = []) {

  return maquinas
    .filter(maquina => maquina && maquina.maquina_id !== undefined)
    .map(maquina => Number(maquina.maquina_id))
    .filter(Number.isInteger);
}


// ============================================================
// OBTENER INFORMACIÓN COMPLETA DE UN PLAN
// ============================================================

async function obtenerPlanCurso(id, client = pool) {

  const planResult = await client.query(
    `
    SELECT
      pc.id,
      pc.tipo_curso_id,
      pc.codigo,
      pc.nombre,
      pc.version,
      pc.permite_eleccion_personalizada,
      pc.vigente_desde,
      pc.vigente_hasta,
      pc.activo,
      pc.observaciones,

      tc.codigo AS tipo_curso_codigo,
      tc.nombre AS tipo_curso_nombre,
      tc.duracion_meses,
      tc.cantidad_maquinas

    FROM planes_curso pc

    INNER JOIN tipos_curso tc
      ON tc.id = pc.tipo_curso_id

    WHERE pc.id = $1

    LIMIT 1
    `,
    [id]
  );

  if (!planResult.rows.length) {
    return null;
  }

  const plan = planResult.rows[0];


  // ==========================================================
  // MÁQUINAS DEL PLAN
  // ==========================================================

  const maquinasResult = await client.query(
    `
    SELECT
      pm.id,
      pm.plan_curso_id,
      pm.maquina_id,
      pm.orden,
      pm.es_regalo,
      pm.obligatoria,
      pm.disponible_matricula,

      m.nombre AS maquina_nombre,
      m.activo AS maquina_activo,
      m.orden_visual

    FROM plan_maquinas pm

    INNER JOIN maquinas m
      ON m.id = pm.maquina_id

    WHERE pm.plan_curso_id = $1

    ORDER BY
      pm.es_regalo ASC,
      pm.orden ASC,
      m.orden_visual ASC NULLS LAST,
      m.id ASC
    `,
    [id]
  );


  // ==========================================================
  // HORAS DE PRÁCTICA
  // ==========================================================

  const horasResult = await client.query(
    `
    SELECT
      php.id,
      php.plan_curso_id,
      php.maquina_id,
      php.horas,
      php.sesiones_totales,

      m.nombre AS maquina_nombre,
      m.activo AS maquina_activo,
      m.orden_visual

    FROM plan_horas_practica php

    INNER JOIN maquinas m
      ON m.id = php.maquina_id

    WHERE php.plan_curso_id = $1

    ORDER BY
      m.orden_visual ASC NULLS LAST,
      m.id ASC
    `,
    [id]
  );


  // ==========================================================
  // PRECIOS
  // ==========================================================

  const preciosResult = await client.query(
    `
    SELECT
      pp.id,
      pp.plan_curso_id,
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
      pp.requiere_tractor,

      m.nombre AS aplica_maquina_nombre

    FROM plan_precios pp

    LEFT JOIN maquinas m
      ON m.id = pp.aplica_maquina_id

    WHERE pp.plan_curso_id = $1

    ORDER BY
      pp.activo DESC,
      pp.id ASC
    `,
    [id]
  );


  // ==========================================================
  // SEPARAR MÁQUINAS
  // ==========================================================

  const maquinas = maquinasResult.rows;

  const maquinasElegibles =
    maquinas.filter(maquina => !maquina.es_regalo);

  const maquinasRegalo =
    maquinas.filter(maquina => maquina.es_regalo);


  // ==========================================================
  // RETORNAR PLAN
  // ==========================================================

  return {

    ...plan,

    maquinas,

    maquinas_elegibles: maquinasElegibles,

    maquinas_regalo: maquinasRegalo,

    cantidad_maquinas_elegibles:
      maquinasElegibles.length,

    cantidad_maquinas_regalo:
      maquinasRegalo.length,

    horas_practica:
      horasResult.rows,

    precios:
      preciosResult.rows,

    cantidad_cuotas:
      preciosResult.rows.length
        ? Number(preciosResult.rows[0].cantidad_cuotas)
        : 0
  };
}


// ============================================================
// LISTAR PLANES
// ============================================================

async function listarPlanesCurso() {

  const result = await pool.query(
    `
    SELECT
      pc.id,
      pc.tipo_curso_id,
      pc.codigo,
      pc.nombre,
      pc.version,
      pc.permite_eleccion_personalizada,
      pc.vigente_desde,
      pc.vigente_hasta,
      pc.activo,
      pc.observaciones,

      tc.codigo AS tipo_curso_codigo,
      tc.nombre AS tipo_curso_nombre,
      tc.duracion_meses,
      tc.cantidad_maquinas,

      COUNT(
        DISTINCT CASE
          WHEN pm.es_regalo = false
          THEN pm.maquina_id
        END
      ) AS cantidad_maquinas_elegibles,

      COUNT(
        DISTINCT CASE
          WHEN pm.es_regalo = true
          THEN pm.maquina_id
        END
      ) AS cantidad_maquinas_regalo,

      COALESCE(
        MAX(pp.cantidad_cuotas)
        FILTER (WHERE pp.activo = true),
        0
      ) AS cantidad_cuotas

    FROM planes_curso pc

    INNER JOIN tipos_curso tc
      ON tc.id = pc.tipo_curso_id

    LEFT JOIN plan_maquinas pm
      ON pm.plan_curso_id = pc.id

    LEFT JOIN plan_precios pp
      ON pp.plan_curso_id = pc.id

    GROUP BY
      pc.id,
      tc.id

    ORDER BY
      pc.id ASC
    `
  );


  return result.rows.map(plan => ({

    ...plan,

    cantidad_maquinas:
      Number(plan.cantidad_maquinas),

    cantidad_maquinas_elegibles:
      Number(plan.cantidad_maquinas_elegibles),

    cantidad_maquinas_regalo:
      Number(plan.cantidad_maquinas_regalo),

    cantidad_cuotas:
      Number(plan.cantidad_cuotas)
  }));
}


// ============================================================
// GENERAR CÓDIGO
// ============================================================

async function generarCodigoPlan(
  client,
  tipoCursoId
) {

  const tipoResult = await client.query(
    `
    SELECT
      codigo,
      nombre
    FROM tipos_curso
    WHERE id = $1
    LIMIT 1
    `,
    [tipoCursoId]
  );


  if (!tipoResult.rows.length) {
    throw new Error(
      'El tipo de curso no existe.'
    );
  }


  const prefijo =
    tipoResult.rows[0].codigo;


  const base =
    `PLAN-${prefijo}-`;


  const result = await client.query(
    `
    SELECT codigo
    FROM planes_curso

    WHERE codigo LIKE $1

    ORDER BY id DESC

    LIMIT 1
    `,
    [`${base}%`]
  );


  let siguiente = 1;


  if (result.rows.length) {

    const codigoAnterior =
      result.rows[0].codigo;

    const match =
      codigoAnterior.match(/(\d+)$/);


    if (match) {
      siguiente =
        Number(match[1]) + 1;
    }
  }


  return (
    `${base}${String(siguiente).padStart(3, '0')}`
  );
}


// ============================================================
// VALIDAR MÁQUINAS
// ============================================================

async function validarMaquinasPlan(
  client,
  tipoCursoId,
  permiteEleccionPersonalizada,
  maquinas
) {

  const tipoResult = await client.query(
    `
    SELECT
      id,
      cantidad_maquinas
    FROM tipos_curso
    WHERE id = $1
    LIMIT 1
    `,
    [tipoCursoId]
  );


  if (!tipoResult.rows.length) {
    throw new Error(
      'El tipo de curso no existe.'
    );
  }


  const cantidadPermitida =
    Number(
      tipoResult.rows[0].cantidad_maquinas
    );


  const lista =
    Array.isArray(maquinas)
      ? maquinas
      : [];


  // ----------------------------------------------------------
  // Normalizar
  // ----------------------------------------------------------

  const normalizadas =
    lista.map((maquina, index) => {

      const maquinaId =
        Number(maquina.maquina_id);


      if (!Number.isInteger(maquinaId)) {

        throw new Error(
          `La máquina de la posición ${index + 1} no es válida.`
        );
      }


      return {

        maquina_id: maquinaId,

        orden:
          Number(maquina.orden) || index + 1,

        es_regalo:
          normalizarBooleano(
            maquina.es_regalo,
            false
          ),

        obligatoria:
          normalizarBooleano(
            maquina.obligatoria,
            true
          ),

        disponible_matricula:
          normalizarBooleano(
            maquina.disponible_matricula,
            true
          )
      };
    });


  // ----------------------------------------------------------
  // Evitar máquinas duplicadas
  // ----------------------------------------------------------

  const ids =
    normalizadas.map(
      maquina => maquina.maquina_id
    );


  const idsUnicos =
    new Set(ids);


  if (idsUnicos.size !== ids.length) {

    throw new Error(
      'No se puede repetir una máquina dentro del mismo plan.'
    );
  }


  // ----------------------------------------------------------
  // Verificar que existan
  // ----------------------------------------------------------

  if (ids.length) {

    const maquinasResult =
      await client.query(
        `
        SELECT id
        FROM maquinas
        WHERE id = ANY($1::smallint[])
        `,
        [ids]
      );


    if (
      maquinasResult.rows.length !== ids.length
    ) {

      throw new Error(
        'Una o más máquinas seleccionadas no existen.'
      );
    }
  }


  // ----------------------------------------------------------
  // Separar regalos
  // ----------------------------------------------------------

  const elegibles =
    normalizadas.filter(
      maquina => !maquina.es_regalo
    );


  const regalos =
    normalizadas.filter(
      maquina => maquina.es_regalo
    );


  // ----------------------------------------------------------
  // REGLA CLAVE
  //
  // Personalizado:
  // puede tener más máquinas disponibles que las que
  // finalmente elegirá el alumno.
  //
  // Ejemplo:
  // Múltiple personalizado = 11 disponibles
  // alumno elegirá 5.
  // ----------------------------------------------------------

  if (permiteEleccionPersonalizada) {

    if (elegibles.length < cantidadPermitida) {

      throw new Error(
        `El plan personalizado debe tener al menos ${cantidadPermitida} máquinas elegibles.`
      );
    }

  } else {

    // --------------------------------------------------------
    // Combo fijo
    //
    // Ejemplo Múltiple Opción 1:
    //
    // 5 normales
    // + 1 regalo
    // --------------------------------------------------------

    if (
      elegibles.length !== cantidadPermitida
    ) {

      throw new Error(
        `El plan debe tener exactamente ${cantidadPermitida} máquinas elegibles. Las máquinas de regalo no cuentan.`
      );
    }
  }


  return {

    maquinas: normalizadas,

    elegibles,

    regalos,

    cantidadPermitida
  };
}


// ============================================================
// GUARDAR MÁQUINAS
// ============================================================

async function guardarMaquinas(
  client,
  planId,
  maquinas
) {

  for (let index = 0; index < maquinas.length; index++) {

    const maquina =
      maquinas[index];


    await client.query(
      `
      INSERT INTO plan_maquinas (
        plan_curso_id,
        maquina_id,
        orden,
        es_regalo,
        obligatoria,
        disponible_matricula
      )

      VALUES (
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

        maquina.orden || index + 1,

        maquina.es_regalo,

        maquina.obligatoria,

        maquina.disponible_matricula
      ]
    );
  }
}


// ============================================================
// GUARDAR HORAS
// ============================================================

async function guardarHorasPractica(
  client,
  planId,
  horasPractica = []
) {

  if (!Array.isArray(horasPractica)) {
    return;
  }


  for (const practica of horasPractica) {

    const maquinaId =
      Number(practica.maquina_id);


    const horas =
      numeroPositivo(
        practica.horas,
        'horas'
      );


    const sesiones =
      numeroPositivo(
        practica.sesiones_totales,
        'sesiones_totales'
      );


    await client.query(
      `
      INSERT INTO plan_horas_practica (
        plan_curso_id,
        maquina_id,
        horas,
        sesiones_totales
      )

      VALUES (
        $1,
        $2,
        $3,
        $4
      )
      `,
      [
        planId,
        maquinaId,
        horas,
        sesiones
      ]
    );
  }
}


// ============================================================
// CREAR PRECIO BASE
// ============================================================

async function crearPrecioBase(
  client,
  planId,
  nombrePlan,
  cantidadCuotas
) {

  await client.query(
    `
    INSERT INTO plan_precios (
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

    VALUES (
      $1,
      $2,
      0,
      0,
      0,
      $3,
      0,
      CURRENT_DATE,
      NULL,
      true,
      'Precio base generado automáticamente. Valores monetarios pendientes de configuración.',
      NULL,
      false
    )
    `,
    [
      planId,
      `${nombrePlan} - Precio base`,
      cantidadCuotas
    ]
  );
}


// ============================================================
// ACTUALIZAR CUOTAS DE PRECIOS EXISTENTES
// ============================================================

async function actualizarCantidadCuotasPrecios(
  client,
  planId,
  cantidadCuotas
) {

  const result =
    await client.query(
      `
      UPDATE plan_precios

      SET
        cantidad_cuotas = $2

      WHERE
        plan_curso_id = $1
        AND activo = true

      RETURNING id
      `,
      [
        planId,
        cantidadCuotas
      ]
    );


  // Si el plan todavía no tiene precio,
  // creamos uno base.

  if (!result.rows.length) {

    const planResult =
      await client.query(
        `
        SELECT nombre
        FROM planes_curso
        WHERE id = $1
        LIMIT 1
        `,
        [planId]
      );


    if (!planResult.rows.length) {
      throw new Error(
        'No se encontró el plan para crear su precio base.'
      );
    }


    await crearPrecioBase(
      client,
      planId,
      planResult.rows[0].nombre,
      cantidadCuotas
    );
  }
}


// ============================================================
// CREAR PLAN
// ============================================================

async function crearPlanCurso(data) {

  const client =
    await pool.connect();


  try {

    await client.query('BEGIN');


    const tipoCursoId =
      Number(data.tipo_curso_id);


    if (!Number.isInteger(tipoCursoId)) {

      throw new Error(
        'Debe indicar un tipo de curso válido.'
      );
    }


    const tipoResult =
      await client.query(
        `
        SELECT
          id,
          codigo,
          nombre,
          duracion_meses,
          cantidad_maquinas
        FROM tipos_curso
        WHERE id = $1
        LIMIT 1
        `,
        [tipoCursoId]
      );


    if (!tipoResult.rows.length) {

      throw new Error(
        'El tipo de curso no existe.'
      );
    }


    const tipo =
      tipoResult.rows[0];


    const permiteEleccionPersonalizada =
      normalizarBooleano(
        data.permite_eleccion_personalizada,
        false
      );


    const validacion =
      await validarMaquinasPlan(
        client,
        tipoCursoId,
        permiteEleccionPersonalizada,
        data.maquinas
      );


    const cantidadCuotas =
      Number(data.cantidad_cuotas);


    if (
      !Number.isInteger(cantidadCuotas) ||
      cantidadCuotas <= 0
    ) {

      throw new Error(
        'La cantidad de cuotas debe ser mayor que cero.'
      );
    }


    const nombre =
      String(
        data.nombre ||
        tipo.nombre
      ).trim();


    if (!nombre) {

      throw new Error(
        'El nombre del plan es obligatorio.'
      );
    }


    const codigo =
      data.codigo
        ? String(data.codigo).trim()
        : await generarCodigoPlan(
            client,
            tipoCursoId
          );


    const vigenteDesde =
      data.vigente_desde ||
      new Date().toISOString().slice(0, 10);


    const vigenteHasta =
      data.vigente_hasta || null;


    const observaciones =
      data.observaciones !== undefined
        ? data.observaciones
        : null;


    // ========================================================
    // INSERTAR PLAN
    // ========================================================

    const planResult =
      await client.query(
        `
        INSERT INTO planes_curso (
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

        VALUES (
          $1,
          $2,
          $3,
          1,
          $4,
          $5,
          $6,
          true,
          $7
        )

        RETURNING id
        `,
        [
          tipoCursoId,
          codigo,
          nombre,
          permiteEleccionPersonalizada,
          vigenteDesde,
          vigenteHasta,
          observaciones
        ]
      );


    const planId =
      planResult.rows[0].id;


    // ========================================================
    // MÁQUINAS
    // ========================================================

    await guardarMaquinas(
      client,
      planId,
      validacion.maquinas
    );


    // ========================================================
    // HORAS
    // ========================================================

    await guardarHorasPractica(
      client,
      planId,
      data.horas_practica
    );


    // ========================================================
    // PRECIO
    // ========================================================

    await crearPrecioBase(
      client,
      planId,
      nombre,
      cantidadCuotas
    );


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
// ACTUALIZAR PLAN
// ============================================================

async function actualizarPlanCurso(
  id,
  data
) {

  const client =
    await pool.connect();


  try {

    await client.query('BEGIN');


    // ========================================================
    // EXISTENCIA
    // ========================================================

    const planActualResult =
      await client.query(
        `
        SELECT
          pc.*,
          tc.cantidad_maquinas
        FROM planes_curso pc

        INNER JOIN tipos_curso tc
          ON tc.id = pc.tipo_curso_id

        WHERE pc.id = $1

        FOR UPDATE
        `,
        [id]
      );


    if (!planActualResult.rows.length) {

      throw new Error(
        'El plan de curso no existe.'
      );
    }


    const planActual =
      planActualResult.rows[0];


    const tipoCursoId =
      Number(
        data.tipo_curso_id ||
        planActual.tipo_curso_id
      );


    const permiteEleccionPersonalizada =
      data.permite_eleccion_personalizada !== undefined

        ? normalizarBooleano(
            data.permite_eleccion_personalizada
          )

        : planActual.permite_eleccion_personalizada;


    // ========================================================
    // MÁQUINAS
    // ========================================================

    let maquinasValidadas = null;


    if (Array.isArray(data.maquinas)) {

      maquinasValidadas =
        await validarMaquinasPlan(
          client,
          tipoCursoId,
          permiteEleccionPersonalizada,
          data.maquinas
        );
    }


    // ========================================================
    // ACTUALIZAR PLAN
    // ========================================================

    const nombre =
      data.nombre !== undefined

        ? String(data.nombre).trim()

        : planActual.nombre;


    const codigo =
      data.codigo !== undefined

        ? String(data.codigo).trim()

        : planActual.codigo;


    const vigenteDesde =
      data.vigente_desde !== undefined

        ? data.vigente_desde

        : planActual.vigente_desde;


    const vigenteHasta =
      data.vigente_hasta !== undefined

        ? data.vigente_hasta

        : planActual.vigente_hasta;


    const observaciones =
      data.observaciones !== undefined

        ? data.observaciones

        : planActual.observaciones;


    await client.query(
      `
      UPDATE planes_curso

      SET
        tipo_curso_id = $1,
        codigo = $2,
        nombre = $3,
        permite_eleccion_personalizada = $4,
        vigente_desde = $5,
        vigente_hasta = $6,
        observaciones = $7

      WHERE id = $8
      `,
      [
        tipoCursoId,
        codigo,
        nombre,
        permiteEleccionPersonalizada,
        vigenteDesde,
        vigenteHasta,
        observaciones,
        id
      ]
    );


    // ========================================================
    // ACTUALIZAR MÁQUINAS
    // ========================================================

    if (maquinasValidadas) {

      await client.query(
        `
        DELETE FROM plan_maquinas
        WHERE plan_curso_id = $1
        `,
        [id]
      );


      await guardarMaquinas(
        client,
        id,
        maquinasValidadas.maquinas
      );
    }


    // ========================================================
    // ACTUALIZAR HORAS
    // ========================================================

    if (
      Array.isArray(data.horas_practica)
    ) {

      await client.query(
        `
        DELETE FROM plan_horas_practica
        WHERE plan_curso_id = $1
        `,
        [id]
      );


      await guardarHorasPractica(
        client,
        id,
        data.horas_practica
      );
    }


    // ========================================================
    // CUOTAS
    // ========================================================

    if (
      data.cantidad_cuotas !== undefined
    ) {

      const cantidadCuotas =
        Number(data.cantidad_cuotas);


      if (
        !Number.isInteger(cantidadCuotas) ||
        cantidadCuotas <= 0
      ) {

        throw new Error(
          'La cantidad de cuotas debe ser mayor que cero.'
        );
      }


      await actualizarCantidadCuotasPrecios(
        client,
        id,
        cantidadCuotas
      );
    }


    await client.query('COMMIT');


    return await obtenerPlanCurso(
      id
    );

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

  const result =
    await pool.query(
      `
      UPDATE planes_curso

      SET activo = $2

      WHERE id = $1

      RETURNING id
      `,
      [
        id,
        activo
      ]
    );


  if (!result.rows.length) {
    return null;
  }


  return await obtenerPlanCurso(
    id
  );
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
