const db = require('../config/db');

exports.obtenerDashboard = async () => {

  const [
    alumnos,
    matriculados,
    egresados,
    retirados,
    alumnosAlDia,
    alumnosConDeuda,
    maquinas,
    cursos,
    estados
  ] = await Promise.all([

    // Total alumnos
    db.query(`
      SELECT COUNT(*) total
      FROM alumnos
    `),

    // Matriculados
    db.query(`
      SELECT COUNT(DISTINCT m.alumno_id) total
      FROM matriculas m
      JOIN estados_alumno ea
        ON ea.id = m.estado_alumno_id
      WHERE UPPER(ea.nombre) = 'MATRICULADO'
    `),

    // Egresados
    db.query(`
      SELECT COUNT(DISTINCT m.alumno_id) total
      FROM matriculas m
      JOIN estados_alumno ea
        ON ea.id = m.estado_alumno_id
      WHERE UPPER(ea.nombre) = 'EGRESADO'
    `),

    // Retirados
    db.query(`
      SELECT COUNT(DISTINCT m.alumno_id) total
      FROM matriculas m
      JOIN estados_alumno ea
        ON ea.id = m.estado_alumno_id
      WHERE UPPER(ea.nombre) = 'RETIRADO'
    `),

    // Alumnos al día
    db.query(`
      SELECT COUNT(DISTINCT a.id) total
      FROM alumnos a
      JOIN matriculas m
        ON m.alumno_id = a.id
      JOIN planes_pago_alumno p
        ON p.matricula_id = m.id
      WHERE NOT EXISTS (
        SELECT 1
        FROM cuotas c
        WHERE c.plan_pago_alumno_id = p.id
          AND c.estado <> 'PAGADO'
      )
    `),

    // Alumnos con deuda
    db.query(`
      SELECT COUNT(DISTINCT a.id) total
      FROM alumnos a
      JOIN matriculas m
        ON m.alumno_id = a.id
      JOIN planes_pago_alumno p
        ON p.matricula_id = m.id
      JOIN cuotas c
        ON c.plan_pago_alumno_id = p.id
      WHERE c.estado <> 'PAGADO'
    `),

    // Máquinas activas
    db.query(`
      SELECT COUNT(*) total
      FROM maquinas
      WHERE activo = true
    `),

    // Cursos activos
    db.query(`
      SELECT COUNT(*) total
      FROM tipos_curso
      WHERE activo = true
    `),

    // Estados de alumnos (para gráfico)
    db.query(`
      SELECT
        ea.nombre,
        COUNT(*)::int AS cantidad
      FROM matriculas m
      JOIN estados_alumno ea
        ON ea.id = m.estado_alumno_id
      GROUP BY ea.nombre
      ORDER BY cantidad DESC
    `)

  ]);

  return {

    resumen: {

      totalAlumnos: Number(alumnos.rows[0].total),

      matriculados: Number(matriculados.rows[0].total),

      egresados: Number(egresados.rows[0].total),

      retirados: Number(retirados.rows[0].total),

      alumnosAlDia: Number(alumnosAlDia.rows[0].total),

      alumnosConDeuda: Number(alumnosConDeuda.rows[0].total),

      maquinas: Number(maquinas.rows[0].total),

      cursos: Number(cursos.rows[0].total)

    },

    graficos: {

      estadosAlumno: estados.rows

    }

  };

};
