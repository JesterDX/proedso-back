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

module.exports = {
  listarPlanesCurso,
  listarPlanesCursoActivos,
  crearPlanCurso,
  actualizarPlanCurso,
  cambiarEstadoPlanCurso,
  obtenerPlanCursoPorId
};
