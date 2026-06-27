const pool = require('../config/db');

async function listarTiposCurso() {
  const query = `
    SELECT
      id,
      codigo,
      nombre,
      duracion_meses,
      cantidad_maquinas,
      activo
    FROM tipos_curso
    ORDER BY nombre ASC
  `;

  const result = await pool.query(query);
  return result.rows;
}

async function crearTipoCurso(data) {
  const {
    codigo,
    nombre,
    duracion_meses,
    cantidad_maquinas,
    activo
  } = data;

  const query = `
    INSERT INTO tipos_curso
    (
      codigo,
      nombre,
      duracion_meses,
      cantidad_maquinas,
      activo
    )
    VALUES
    ($1,$2,$3,$4,$5)
    RETURNING *
  `;

  const result = await pool.query(query, [
    codigo,
    nombre,
    duracion_meses,
    cantidad_maquinas,
    activo ?? true
  ]);

  return result.rows[0];
}

module.exports = {
  listarTiposCurso,
  crearTipoCurso
};
