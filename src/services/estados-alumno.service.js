const pool = require('../config/db');

async function listarEstadosAlumno() {
  const query = `
    SELECT
      id,
      codigo,
      nombre,
      descripcion
    FROM estados_alumno
    ORDER BY id ASC
  `;

  const result = await pool.query(query);
  return result.rows;
}

module.exports = {
  listarEstadosAlumno
};