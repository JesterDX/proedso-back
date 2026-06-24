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

module.exports = {
  listarPlanesCurso
};