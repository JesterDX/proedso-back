const db = require('../config/db'); // Ajusta a tu ruta de conexión DB

exports.getDashboardData = async () => {
  const [
    alumnosStats,
    maquinasStats,
    estadosMatricula,
    demandaMaquinas
  ] = await Promise.all([

    // 1. KPIs de Alumnos (%)
    db.query(`
      SELECT 
        COUNT(*)::int AS total,
        COALESCE(ROUND((COUNT(CASE WHEN activo = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 1), 0) AS porcentaje_activos,
        COALESCE(ROUND((COUNT(CASE WHEN activo = false THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 1), 0) AS porcentaje_inactivos
      FROM alumnos;
    `),

    // 2. KPIs de Flota de Maquinaria (%)
    db.query(`
      SELECT 
        COUNT(*)::int AS total,
        COALESCE(ROUND((COUNT(CASE WHEN activo = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 1), 0) AS porcentaje_operatividad
      FROM maquinas;
    `),

    // 3. Gráfico: Distribución por Estado de Matrículas
    db.query(`
      SELECT 
        COALESCE(ea.nombre, 'Sin Estado') AS nombre,
        COALESCE(ROUND((COUNT(m.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM matriculas WHERE activo = true), 0)), 1), 0) AS porcentaje
      FROM matriculas m
      LEFT JOIN estados_alumno ea ON ea.id = m.estado_alumno_id
      WHERE m.activo = true
      GROUP BY ea.nombre
      ORDER BY porcentaje DESC;
    `),

    // 4. Gráfico: Maquinaria Más Demandada
    db.query(`
      SELECT 
        mq.nombre,
        COALESCE(ROUND((COUNT(mm.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM matricula_maquinas), 0)), 1), 0) AS porcentaje_demanda
      FROM maquinas mq
      LEFT JOIN matricula_maquinas mm ON mm.maquina_id = mq.id
      WHERE mq.activo = true
      GROUP BY mq.nombre
      ORDER BY porcentaje_demanda DESC
      LIMIT 5;
    `)
  ]);

  return {
    kpis: {
      totalAlumnos: alumnosStats.rows[0]?.total ?? 0,
      porcentajeAlumnosActivos: Number(alumnosStats.rows[0]?.porcentaje_activos ?? 0),
      porcentajeInactivos: Number(alumnosStats.rows[0]?.porcentaje_inactivos ?? 0),
      totalMaquinas: maquinasStats.rows[0]?.total ?? 0,
      porcentajeOperatividadFlota: Number(maquinasStats.rows[0]?.porcentaje_operatividad ?? 0)
    },
    graficos: {
      distribucionEstados: estadosMatricula.rows || [],
      demandaMaquinas: demandaMaquinas.rows || []
    }
  };
};
