const pool = require('../config/db');

async function listarAlumnos({ search = '', activos = true, anio = null, mes = null }) {
  const values = [];
  let where = 'WHERE 1=1';

  if (activos !== undefined) {
    values.push(activos);
    where += ` AND activo = $${values.length}`;
  }

  if (anio) {
    values.push(Number(anio));
    where += ` AND anio_ingreso = $${values.length}`;
  }

  if (mes && String(mes).trim() !== '') {
    values.push(String(mes).trim().toUpperCase());
    where += ` AND UPPER(COALESCE(mes_ingreso, '')) = $${values.length}`;
  }

  if (search && search.trim() !== '') {
    values.push(`%${search.trim()}%`);
    const idx = values.length;

    where += ` AND (
      unaccent(COALESCE(dni, '')) ILIKE unaccent($${idx})
      OR unaccent(COALESCE(nombres, '')) ILIKE unaccent($${idx})
      OR unaccent(COALESCE(apellidos, '')) ILIKE unaccent($${idx})
      OR unaccent(COALESCE(correo, '')) ILIKE unaccent($${idx})
      OR unaccent(COALESCE(telefono, '')) ILIKE unaccent($${idx})
      OR unaccent(COALESCE(TRIM(nombres || ' ' || apellidos), '')) ILIKE unaccent($${idx})
      OR unaccent(COALESCE(TRIM(apellidos || ' ' || nombres), '')) ILIKE unaccent($${idx})
    )`;
  }

  const query = `
    SELECT
      id,
      dni,
      nombres,
      apellidos,
      fecha_nacimiento,
      telefono,
      correo,
      direccion,
      foto_url,
      observaciones,
      fecha_registro,
      activo,
      seguro_alumno,
      anio_ingreso,
      mes_ingreso
    FROM alumnos
    ${where}
    ORDER BY
      anio_ingreso DESC NULLS LAST,
      CASE UPPER(COALESCE(mes_ingreso, ''))
        WHEN 'ENERO' THEN 1
        WHEN 'FEBRERO' THEN 2
        WHEN 'MARZO' THEN 3
        WHEN 'ABRIL' THEN 4
        WHEN 'MAYO' THEN 5
        WHEN 'JUNIO' THEN 6
        WHEN 'JULIO' THEN 7
        WHEN 'AGOSTO' THEN 8
        WHEN 'SEPTIEMBRE' THEN 9
        WHEN 'OCTUBRE' THEN 10
        WHEN 'NOVIEMBRE' THEN 11
        WHEN 'DICIEMBRE' THEN 12
        ELSE 99
      END ASC,
      id DESC
  `;

  const result = await pool.query(query, values);
  return result.rows;
}

async function obtenerAlumnoPorId(id) {
  const query = `
    SELECT
      id,
      dni,
      nombres,
      apellidos,
      fecha_nacimiento,
      telefono,
      correo,
      direccion,
      foto_url,
      observaciones,
      fecha_registro,
      activo,
      seguro_alumno,
      anio_ingreso,
      mes_ingreso
    FROM alumnos
    WHERE id = $1
    LIMIT 1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

async function crearAlumno(data) {
  const query = `
    INSERT INTO alumnos (
      dni,
      nombres,
      apellidos,
      fecha_nacimiento,
      telefono,
      correo,
      direccion,
      foto_url,
      observaciones,
      activo,
      seguro_alumno,
      anio_ingreso,
      mes_ingreso
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10,$11,$12)
    RETURNING *
  `;

  const values = [
    data.dni,
    data.nombres,
    data.apellidos,
    data.fecha_nacimiento || null,
    data.telefono || null,
    data.correo || null,
    data.direccion || null,
    data.foto_url || null,
    data.observaciones || null,
    data.seguro_alumno ? String(data.seguro_alumno).trim().toUpperCase() : null,
    data.anio_ingreso ? Number(data.anio_ingreso) : null,
    data.mes_ingreso ? String(data.mes_ingreso).trim().toUpperCase() : null
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

async function actualizarAlumno(id, data) {
  const query = `
    UPDATE alumnos
    SET
      dni = $1,
      nombres = $2,
      apellidos = $3,
      fecha_nacimiento = $4,
      telefono = $5,
      correo = $6,
      direccion = $7,
      foto_url = $8,
      observaciones = $9,
      seguro_alumno = $10,
      anio_ingreso = $11,
      mes_ingreso = $12
    WHERE id = $13
    RETURNING *
  `;

  const values = [
    data.dni,
    data.nombres,
    data.apellidos,
    data.fecha_nacimiento || null,
    data.telefono || null,
    data.correo || null,
    data.direccion || null,
    data.foto_url || null,
    data.observaciones || null,
    data.seguro_alumno ? String(data.seguro_alumno).trim().toUpperCase() : null,
    data.anio_ingreso ? Number(data.anio_ingreso) : null,
    data.mes_ingreso ? String(data.mes_ingreso).trim().toUpperCase() : null,
    id
  ];

  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

async function eliminarAlumnoLogico(id) {
  const query = `
    UPDATE alumnos
    SET activo = FALSE
    WHERE id = $1
    RETURNING id, activo
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

async function reactivarAlumno(id) {
  const query = `
    UPDATE alumnos
    SET activo = TRUE
    WHERE id = $1
    RETURNING *
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

module.exports = {
  listarAlumnos,
  obtenerAlumnoPorId,
  crearAlumno,
  actualizarAlumno,
  eliminarAlumnoLogico,
  reactivarAlumno
};