const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

async function listarAdjuntos({ modulo, registro_id }) {
  const query = `
    SELECT
      id,
      modulo,
      registro_id,
      tipo_archivo,
      nombre_archivo,
      url_archivo,
      observaciones,
      fecha_subida
    FROM adjuntos
    WHERE modulo = $1
      AND registro_id = $2
    ORDER BY fecha_subida DESC, id DESC
  `;

  const result = await pool.query(query, [modulo, registro_id]);
  return result.rows;
}

async function crearAdjunto(data) {
  const query = `
    INSERT INTO adjuntos (
      modulo,
      registro_id,
      tipo_archivo,
      nombre_archivo,
      url_archivo,
      observaciones
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const values = [
    data.modulo,
    data.registro_id,
    data.tipo_archivo || null,
    data.nombre_archivo || null,
    data.url_archivo,
    data.observaciones || null
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}


async function eliminarAdjunto(id) {
  const query = `SELECT * FROM adjuntos WHERE id = $1 LIMIT 1`;
  const result = await pool.query(query, [id]);

  const adjunto = result.rows[0];
  if (!adjunto) return null;

  if (adjunto.url_archivo) {
    const filePath = path.join(__dirname, '../../', adjunto.url_archivo);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  await pool.query(`DELETE FROM adjuntos WHERE id = $1`, [id]);

  return true;
}

module.exports = {
  listarAdjuntos,
  crearAdjunto,
  eliminarAdjunto
};