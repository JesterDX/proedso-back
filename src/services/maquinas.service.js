const pool = require('../config/db');

async function listarMaquinas() {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        nombre, 
        activo, 
        orden_visual
      FROM maquinas
      WHERE activo = TRUE
      ORDER BY orden_visual ASC NULLS LAST, nombre ASC
    `);

    return result.rows;
  } catch (error) {
    console.error('Error al listar máquinas:', error);
    throw new Error('Error al obtener la lista de máquinas');
  }
}

async function crearMaquina(data) {
  const query = `
    INSERT INTO maquinas
    (
      nombre,
      orden_visual,
      activo
    )
    VALUES ($1,$2,true)
    RETURNING *;
  `;

  const result = await pool.query(query, [
    data.nombre,
    data.orden_visual
  ]);

  return result.rows[0];
}

async function actualizarMaquina(id, data) {
  const query = `
    UPDATE maquinas
    SET
      nombre = $1,
      orden_visual = $2
    WHERE id = $3
    RETURNING *;
  `;

  const result = await pool.query(query, [
    data.nombre,
    data.orden_visual,
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
