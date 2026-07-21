const db = require('../config/db');

exports.obtenerDashboard = async () => {
  const [
    kpisAlumnos,
    operatividadMaquinas,
    certificaciones,
    demandaMaquinas,
    distribucionEstados
  ] = await Promise.all([

    // 1. KPIs de Alumnado (% Al día, % Deuda, % Retención)
    db.query(`
      WITH stats AS (
        SELECT 
          COUNT(DISTINCT a.id)::numeric AS total_alumnos,
          COUNT(DISTINCT CASE WHEN UPPER(ea.nombre) IN ('MATRICULADO', 'EGRESADO') THEN a.id END)::numeric AS activos_egresados,
          COUNT(DISTINCT CASE WHEN NOT EXISTS (
            SELECT 1 FROM cuotas c JOIN planes_pago_alumno p ON c.plan_pago_alumno_id = p.id 
            WHERE p.matricula_id = m.id AND c.estado <> 'PAGADO' AND c.fecha_vencimiento < CURRENT_DATE
          ) THEN a.id END)::numeric AS al_dia
        FROM alumnos a
        JOIN matriculas m ON m.alumno_id = a.id
        JOIN estados_alumno ea ON ea.id = m.estado_alumno_id
      )
      SELECT 
        total_alumnos::int,
        ROUND((al_dia * 100.0 / NULLIF(total_alumnos, 0)), 1) AS porcentaje_al_dia,
        ROUND(((total_alumnos - al_dia) * 100.0 / NULLIF(total_alumnos, 0)), 1) AS porcentaje_morosidad,
        ROUND((activos_egresados * 100.0 / NULLIF(total_alumnos, 0)), 1) AS porcentaje_retencion
      FROM stats;
    `),

    // 2. Operatividad de la Flota de Maquinaria (%)
    db.query(`
      SELECT 
        COUNT(*)::int AS total_maquinas,
        ROUND((COUNT(CASE WHEN activo = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 1) AS porcentaje_operatividad
      FROM maquinas;
    `),

    // 3. Eficiencia en Certificación (% Entregados vs Pendientes)
    db.query(`
      SELECT 
        ROUND((COUNT(CASE WHEN estado = 'ENTREGADO' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 1) AS porcentaje_entregados,
        ROUND((COUNT(CASE WHEN estado <> 'ENTREGADO' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 1) AS porcentaje_en_tramite
      FROM carpetas_certificado;
    `),

    // 4. Top 5 Máquinas Más Demandadas (% del total de matrículas)
    db.query(`
      SELECT 
        mq.nombre,
        ROUND((COUNT(mm.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM matricula_maquinas), 0)), 1) AS porcentaje_demanda
      FROM maquinas mq
      JOIN matricula_maquinas mm ON mm.maquina_id = mq.id
      GROUP BY mq.nombre
      ORDER BY porcentaje_demanda DESC
      LIMIT 5;
    `),

    // 5. Distribución Porcentual por Estado de Alumno
    db.query(`
      SELECT 
        ea.nombre,
        ROUND((COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM matriculas), 0)), 1) AS porcentaje
      FROM matriculas m
      JOIN estados_alumno ea ON ea.id = m.estado_alumno_id
      GROUP BY ea.nombre
      ORDER BY porcentaje DESC;
    `)
  ]);

  return {
    kpis: {
      totalAlumnos: kpisAlumnos.rows[0]?.total_alumnos ?? 0,
      porcentajeAlDia: Number(kpisAlumnos.rows[0]?.porcentaje_al_dia ?? 0),
      porcentajeMorosidad: Number(kpisAlumnos.rows[0]?.porcentaje_morosidad ?? 0),
      porcentajeRetencion: Number(kpisAlumnos.rows[0]?.porcentaje_retencion ?? 0),
      porcentajeOperatividadFlota: Number(operatividadMaquinas.rows[0]?.porcentaje_operatividad ?? 0),
      porcentajeCertificadosEntregados: Number(certificaciones.rows[0]?.porcentaje_entregados ?? 0)
    },
    graficos: {
      demandaMaquinas: demandaMaquinas.rows,
      distribucionEstados: distribucionEstados.rows
    }
  };
};
