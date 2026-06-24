const pool = require('../config/db');

async function listarAuditoriaGlobal(filtros = {}) {
  const { search = '', accion = null, desde = null, hasta = null } = filtros;

  const values = [];
  let where = `WHERE 1=1`;

  if (accion) {
    values.push(accion);
    where += ` AND mh.accion = $${values.length}`;
  }

  if (search) {
    values.push(`%${search}%`);
    where += ` AND mh.descripcion ILIKE $${values.length}`;
  }

  if (desde) {
    values.push(desde);
    where += ` AND mh.fecha >= $${values.length}`;
  }

  if (hasta) {
    values.push(hasta);
    where += ` AND mh.fecha <= $${values.length}`;
  }

  const query = `
    SELECT
      mh.id,
      mh.matricula_id,
      mh.accion,
      mh.descripcion,
      mh.fecha,
      mh.usuario,
      m.alumno_id,
      a.nombres,
      a.apellidos
    FROM matricula_historial mh
    LEFT JOIN matriculas m ON m.id = mh.matricula_id
    LEFT JOIN alumnos a ON a.id = m.alumno_id
    ${where}
    ORDER BY mh.fecha DESC
    LIMIT 200
  `;

  const result = await pool.query(query, values);
  return result.rows;
}

async function obtenerAuditoriaPorMatricula(matriculaId) {
  const result = await pool.query(
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

module.exports = {
  listarAuditoriaGlobal,
  obtenerAuditoriaPorMatricula
};