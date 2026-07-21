const pool = require('../config/db');

async function listarPlanesCurso() {
  const check = await pool.query(`
    SELECT
      current_database() AS db,
      current_user AS usuario,
      current_schema() AS schema_actual,
      current_setting('search_path') AS search_path,
      inet_server_addr() AS server_addr,
      inet_server_port() AS server_port
  `);

  console.log('CHECK CONEXION:', check.rows[0]);

  const bytes = await pool.query(`
    SELECT
      id,
      nombre,
      encode(convert_to(nombre, 'UTF8'), 'hex') AS nombre_hex,
      observaciones,
      encode(convert_to(observaciones, 'UTF8'), 'hex') AS obs_hex
    FROM planes_curso
    WHERE id IN (4, 6)
    ORDER BY id
  `);

  // console.log('CHECK BYTES PLANES:', bytes.rows);

  const tipos = await pool.query(`
    SELECT
      id,
      nombre,
      encode(convert_to(nombre, 'UTF8'), 'hex') AS nombre_hex
    FROM tipos_curso
    WHERE id = 8
  `);

  console.log('CHECK BYTES TIPOS:', tipos.rows);

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
      tc.nombre AS tipo_curso_nombre
    FROM planes_curso pc
    INNER JOIN tipos_curso tc
      ON tc.id = pc.tipo_curso_id
    WHERE pc.activo = TRUE
    ORDER BY pc.id ASC
  `;

  const result = await pool.query(query);
  // console.log('PLANES BACKEND:', result.rows);

  return result.rows;
}
async function listarPlanesCursoActivos() {
  const check = await pool.query(`
    SELECT
      current_database() AS db,
      current_user AS usuario,
      current_schema() AS schema_actual,
      current_setting('search_path') AS search_path,
      inet_server_addr() AS server_addr,
      inet_server_port() AS server_port
  `);

  console.log('CHECK CONEXION:', check.rows[0]);

  const bytes = await pool.query(`
    SELECT
      id,
      nombre,
      encode(convert_to(nombre, 'UTF8'), 'hex') AS nombre_hex,
      observaciones,
      encode(convert_to(observaciones, 'UTF8'), 'hex') AS obs_hex
    FROM planes_curso
    WHERE id IN (4, 6)
    ORDER BY id
  `);

  // console.log('CHECK BYTES PLANES:', bytes.rows);

  const tipos = await pool.query(`
    SELECT
      id,
      nombre,
      encode(convert_to(nombre, 'UTF8'), 'hex') AS nombre_hex
    FROM tipos_curso
    WHERE id = 8
  `);

  console.log('CHECK BYTES TIPOS:', tipos.rows);

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
      tc.nombre AS tipo_curso_nombre
    FROM planes_curso pc
    INNER JOIN tipos_curso tc
      ON tc.id = pc.tipo_curso_id
    ORDER BY pc.id ASC
  `;

  const result = await pool.query(query);
  // console.log('PLANES BACKEND:', result.rows);

  return result.rows;
}


async function crearPlanCursoCompleto(data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insertar el plan de curso
    const queryPlan = `
      INSERT INTO planes_curso (
        codigo,
        nombre,
        version,
        tipo_curso_id,
        permite_eleccion_personalizada,
        vigente_desde,
        vigente_hasta,
        activo,
        observaciones
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
      RETURNING *;
    `;

    const valuesPlan = [
      data.codigo,
      data.nombre,
      data.version,
      data.tipo_curso_id,
      data.permite_eleccion_personalizada,
      data.vigente_desde,
      data.vigente_hasta,
      data.observaciones
    ];

    const resultPlan = await client.query(queryPlan, valuesPlan);
    const nuevoPlan = resultPlan.rows[0];

    // 2. Insertar la configuración de máquinas si vienen en el payload
    if (data.maquinas && Array.isArray(data.maquinas)) {
      for (const m of data.maquinas) {
        if (!m.seleccionada) continue;

        await client.query(
          `
          INSERT INTO plan_maquinas (
            plan_curso_id,
            maquina_id,
            obligatoria,
            es_regalo,
            orden
          )
          VALUES ($1, $2, $3, $4, $5)
          `,
          [nuevoPlan.id, m.id, m.obligatoria, m.es_regalo, m.orden]
        );

        await client.query(
          `
          INSERT INTO plan_horas_practica (
            plan_curso_id,
            maquina_id,
            horas,
            sesiones_totales
          )
          VALUES ($1, $2, $3, $4)
          `,
          [nuevoPlan.id, m.id, m.horas, m.sesiones_totales]
        );
      }
    }

    await client.query('COMMIT');

    return nuevoPlan;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function actualizarPlanCurso(id, data) {

  const query = `
    UPDATE planes_curso
    SET
      codigo=$1,
      nombre=$2,
      version=$3,
      tipo_curso_id=$4,
      permite_eleccion_personalizada=$5,
      vigente_desde=$6,
      vigente_hasta=$7,
      observaciones=$8
    WHERE id=$9
    RETURNING *;
  `;

  const values = [
    data.codigo,
    data.nombre,
    data.version,
    data.tipo_curso_id,
    data.permite_eleccion_personalizada,
    data.vigente_desde,
    data.vigente_hasta,
    data.observaciones,
    id
  ];

  const result = await pool.query(query, values);

  return result.rows[0];

}

async function obtenerMaquinasPlan(idPlan) {

  const query = `
    SELECT

      m.id,
      m.nombre,

      CASE
        WHEN pm.id IS NULL THEN false
        ELSE true
      END AS seleccionada,

      COALESCE(pm.obligatoria, false) AS obligatoria,

      COALESCE(pm.es_regalo, false) AS es_regalo,

      pm.orden,

      COALESCE(php.horas, 0) AS horas,

      COALESCE(php.sesiones_totales, 0) AS sesiones_totales

    FROM maquinas m

    LEFT JOIN plan_maquinas pm
      ON pm.maquina_id = m.id
     AND pm.plan_curso_id = $1

    LEFT JOIN plan_horas_practica php
      ON php.maquina_id = m.id
     AND php.plan_curso_id = $1

    WHERE m.activo = true

    ORDER BY
      pm.orden NULLS LAST,
      m.orden_visual;

  `;

  const result = await pool.query(query, [idPlan]);

  return result.rows;

}

async function cambiarEstadoPlanCurso(id) {

  const query = `
    UPDATE planes_curso
    SET activo = NOT activo
    WHERE id=$1
    RETURNING *;
  `;

  const result = await pool.query(query,[id]);

  return result.rows[0];

}


async function crearPlanCurso(data) {
  const query = `
      INSERT INTO planes_curso
      (
        codigo,
        nombre,
        version,
        tipo_curso_id,
        permite_eleccion_personalizada,
        vigente_desde,
        vigente_hasta,
        activo,
        observaciones
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,true,$8)
      RETURNING *;
  `;

  const values = [
    data.codigo,
    data.nombre,
    data.version,
    data.tipo_curso_id,
    data.permite_eleccion_personalizada,
    data.vigente_desde,
    data.vigente_hasta,
    data.observaciones
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}


async function obtenerPlanCursoPorId(id) {

  const query = `
    SELECT
      pc.id,
      pc.codigo,
      pc.nombre,
      pc.version,
      pc.tipo_curso_id,
      tc.nombre AS tipo_curso_nombre,
      pc.vigente_desde,
      pc.vigente_hasta,
      pc.permite_eleccion_personalizada,
      pc.activo,
      pc.observaciones
    FROM planes_curso pc
    INNER JOIN tipos_curso tc
      ON tc.id = pc.tipo_curso_id
    WHERE pc.id = $1;
  `;


  const result = await pool.query(query,[id]);


  return result.rows[0];

}

async function guardarConfiguracionPlan(idPlan, maquinas) {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');


    // ===================================
    // ELIMINAR CONFIGURACIÓN ANTERIOR
    // ===================================

    await client.query(
      `
      DELETE FROM plan_maquinas
      WHERE plan_curso_id=$1
      `,
      [idPlan]
    );


    await client.query(
      `
      DELETE FROM plan_horas_practica
      WHERE plan_curso_id=$1
      `,
      [idPlan]
    );



    // ===================================
    // INSERTAR NUEVA CONFIGURACIÓN
    // ===================================

    for (const m of maquinas) {


      if (!m.seleccionada) {
        continue;
      }


      await client.query(
        `
        INSERT INTO plan_maquinas
        (
          plan_curso_id,
          maquina_id,
          obligatoria,
          es_regalo,
          orden
        )
        VALUES
        ($1,$2,$3,$4,$5)
        `,
        [
          idPlan,
          m.id,
          m.obligatoria,
          m.es_regalo,
          m.orden
        ]
      );



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
        ($1,$2,$3,$4)
        `,
        [
          idPlan,
          m.id,
          m.horas,
          m.sesiones_totales
        ]
      );


    }


    await client.query('COMMIT');


    return {
      plan_id:idPlan,
      maquinas_configuradas:
      maquinas.filter(m=>m.seleccionada).length
    };


  } catch(error){

    await client.query('ROLLBACK');

    throw error;

  } finally {

    client.release();

  }

}
module.exports = {
  listarPlanesCurso,
  listarPlanesCursoActivos,
  crearPlanCurso,
  actualizarPlanCurso,
  crearPlanCursoCompleto,
  cambiarEstadoPlanCurso,
  obtenerPlanCursoPorId,
  obtenerMaquinasPlan,
  guardarConfiguracionPlan
};
