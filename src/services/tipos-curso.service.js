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

async function actualizarTipoCurso(id, data) {

  const {
    codigo,
    nombre,
    duracion_meses,
    cantidad_maquinas
  } = data;

  const query = `
    UPDATE tipos_curso
    SET
      codigo = $1,
      nombre = $2,
      duracion_meses = $3,
      cantidad_maquinas = $4
    WHERE id = $5
    RETURNING *
  `;

  const result = await pool.query(query, [
    codigo,
    nombre,
    duracion_meses,
    cantidad_maquinas,
    id
  ]);

  return result.rows[0];

}

async function cambiarEstado(id, activo) {

  const query = `
    UPDATE tipos_curso
    SET activo = $1
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [
    activo,
    id
  ]);

  return result.rows[0];

}

module.exports = {
  listarTiposCurso,
  crearTipoCurso,
  actualizarTipoCurso,
  cambiarEstado
};
