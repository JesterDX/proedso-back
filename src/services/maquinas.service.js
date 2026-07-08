const pool = require('../config/db');

async function listarMaquinas() {
  const result = await pool.query(`
    SELECT
      id,
      nombre,
      activo
    FROM maquinas
    ORDER BY orden_visual ASC NULLS LAST;
  `);

  return result.rows;
}

async function crearMaquina(data) {
  const query = `
    INSERT INTO maquinas
    (
      nombre,
      orden_visual,
      activo
    )
    VALUES
    (
      $1,
      (
        SELECT COALESCE(MAX(orden_visual),0) + 1
        FROM maquinas
      ),
      true
    )
    RETURNING *;
  `;

  const result = await pool.query(query, [
    data.nombre
  ]);

  return result.rows[0];
}

async function actualizarMaquina(id, data) {
  const query = `
    UPDATE maquinas
    SET
      nombre = $1
    WHERE id = $2
    RETURNING *;
  `;

  const result = await pool.query(query, [
    data.nombre,
    id
  ]);

  return result.rows[0];
}

async function cambiarEstadoMaquina(id) {
  const query = `
    UPDATE maquinas
    SET activo = NOT activo
    WHERE id = $1
    RETURNING *;
  `;

  const result = await pool.query(query, [id]);

  return result.rows[0];
}

module.exports = {
  listarMaquinas,
  crearMaquina,
  actualizarMaquina,
  cambiarEstadoMaquina
};
