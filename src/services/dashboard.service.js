const db = require('../config/db');

exports.obtenerDashboard = async () => {

  const alumnos = await db.query(`
    SELECT COUNT(*) total
    FROM alumnos
  `);

  const alumnosActivos = await db.query(`
    SELECT COUNT(*) total
    FROM alumnos
    WHERE activo = true
  `);

  const matriculasActivas = await db.query(`
    SELECT COUNT(*) total
    FROM matriculas m
    JOIN estados_alumno ea
      ON ea.id = m.estado_alumno_id
    WHERE UPPER(ea.nombre) = 'ACTIVO'
  `);

  const maquinas = await db.query(`
    SELECT COUNT(*) total
    FROM maquinas
    WHERE activo = true
  `);

  const cursos = await db.query(`
    SELECT COUNT(*) total
    FROM tipos_curso
    WHERE activo = true
  `);

  const ingresos = await db.query(`
    SELECT COALESCE(SUM(monto),0) total
    FROM pagos
  `);

  const cuotasPendientes = await db.query(`
    SELECT COUNT(*) total
    FROM cuotas
    WHERE estado <> 'PAGADO'
  `);

  return {
    alumnos: Number(alumnos.rows[0].total),
    alumnosActivos: Number(alumnosActivos.rows[0].total),
    matriculasActivas: Number(matriculasActivas.rows[0].total),
    maquinas: Number(maquinas.rows[0].total),
    cursos: Number(cursos.rows[0].total),
    ingresos: Number(ingresos.rows[0].total),
    cuotasPendientes: Number(cuotasPendientes.rows[0].total)
  };
};
