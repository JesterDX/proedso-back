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

module.exports = {
  listarMaquinas
};