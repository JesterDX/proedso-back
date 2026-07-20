const pool = require('../config/db');


async function listarAlumnosDisponibles(filtros = {}) {

  const {
    anio,
    mes,
    cursoId,
    maquinaId,
    nombre
  } = filtros;

  let sql = `
    SELECT

      m.id AS matricula_id,

      mm.id AS matricula_maquina_id,

      a.nombres || ' ' || a.apellidos AS alumno,

      pc.id AS curso_id,
      pc.nombre AS curso,

      maq.id AS maquina_id,
      maq.nombre AS maquina,

      m.fecha_matricula,

      EXTRACT(YEAR FROM m.fecha_matricula)::INT AS anio,
      EXTRACT(MONTH FROM m.fecha_matricula)::INT AS mes,

      COALESCE(php.horas,0) * 2 AS sesiones_totales,

      COALESCE(pa.sesiones_completadas,0) AS sesiones_realizadas,

      (
        COALESCE(php.horas,0) * 2
        -
        COALESCE(pa.sesiones_completadas,0)
      ) AS sesiones_restantes,

      CASE

        WHEN EXISTS (

          SELECT 1
          FROM planes_pago_alumno ppa
          INNER JOIN cuotas c
            ON c.plan_pago_alumno_id=ppa.id

          WHERE
            ppa.matricula_id=m.id
            AND c.saldo_pendiente>0
            AND c.fecha_vencimiento<CURRENT_DATE

        )

        THEN 'MOROSO'

        WHEN EXISTS (

          SELECT 1
          FROM planes_pago_alumno ppa
          INNER JOIN cuotas c
            ON c.plan_pago_alumno_id=ppa.id

          WHERE
            ppa.matricula_id=m.id
            AND c.saldo_pendiente>0

        )

        THEN 'PENDIENTE'

        ELSE 'AL_DIA'

      END AS estado_financiero

    FROM matriculas m

    INNER JOIN alumnos a
      ON a.id=m.alumno_id

    INNER JOIN planes_curso pc
      ON pc.id=m.plan_curso_id

    INNER JOIN matricula_maquinas mm
      ON mm.matricula_id=m.id

    INNER JOIN maquinas maq
      ON maq.id=mm.maquina_id

    LEFT JOIN plan_horas_practica php
      ON php.plan_curso_id=m.plan_curso_id
     AND php.maquina_id=mm.maquina_id

    LEFT JOIN practicas_asignaciones pa
      ON pa.matricula_maquina_id=mm.id

    WHERE 1=1
  `;

  const values = [];

  if (anio) {
    values.push(anio);
    sql += `
      AND EXTRACT(YEAR FROM m.fecha_matricula)= $${values.length}
    `;
  }

  if (mes) {
    values.push(mes);
    sql += `
      AND EXTRACT(MONTH FROM m.fecha_matricula)= $${values.length}
    `;
  }

  if (cursoId) {
    values.push(cursoId);
    sql += `
      AND pc.id=$${values.length}
    `;
  }

  if (maquinaId) {
    values.push(maquinaId);
    sql += `
      AND maq.id=$${values.length}
    `;
  }

  if (nombre) {
    values.push(`%${nombre}%`);
    sql += `
      AND (
        a.nombres || ' ' || a.apellidos
      ) ILIKE $${values.length}
    `;
  }

  sql += `
    ORDER BY
      anio DESC,
      mes DESC,
      alumno ASC,
      maq.nombre ASC
  `;

  const result = await pool.query(sql, values);

  const filas = result.rows.filter(
    fila => Number(fila.sesiones_restantes) > 0
  );

  const alumnos = [];

  for (const fila of filas) {

    let alumno = alumnos.find(
      a => a.matricula_id == fila.matricula_id
    );

    if (!alumno) {

      alumno = {

        matricula_id: Number(fila.matricula_id),

        alumno: fila.alumno,

        curso_id: Number(fila.curso_id),

        curso: fila.curso,

        anio: Number(fila.anio),

        mes: Number(fila.mes),

        estado_financiero: fila.estado_financiero,

        maquinas: []

      };

      alumnos.push(alumno);

    }

    alumno.maquinas.push({

      matricula_maquina_id: Number(fila.matricula_maquina_id),

      maquina_id: Number(fila.maquina_id),

      maquina: fila.maquina,

      sesiones_totales: Number(fila.sesiones_totales),

      sesiones_realizadas: Number(fila.sesiones_realizadas),

      sesiones_restantes: Number(fila.sesiones_restantes)

    });

  }

  return alumnos;

}

async function crearSesionGrupal(payload) {

  const { fecha, detalle } = payload;

  if (!detalle || detalle.length === 0) {
    throw new Error("No hay alumnos seleccionados.");
  }

  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    //=========================================
    // SOLO UNA SESIÓN ABIERTA
    //=========================================

    const abierta = await client.query(`
      SELECT id
      FROM practicas_sesiones_grupales
      WHERE estado IN ('PENDIENTE','EN_CURSO')
      LIMIT 1
    `);

    if (abierta.rows.length > 0) {
      throw new Error("Ya existe una sesión grupal pendiente.");
    }

    //=========================================
    // VALIDAR CADA ALUMNO
    //=========================================

    for (const item of detalle) {

      const validar = await client.query(`
        SELECT

          mm.id,

          pa.sesiones_totales,

          pa.sesiones_completadas,

          (
            pa.sesiones_totales -
            pa.sesiones_completadas
          ) AS sesiones_restantes

        FROM matricula_maquinas mm

        INNER JOIN practicas_asignaciones pa
          ON pa.matricula_maquina_id = mm.id

        WHERE mm.id = $1
      `,[item.matriculaMaquinaId]);

      if(validar.rows.length===0){
        throw new Error(
          "No existe asignación de prácticas."
        );
      }

      const restante =
        Number(validar.rows[0].sesiones_restantes);

      if(item.sesiones>restante){

        throw new Error(
          `La máquina ${item.matriculaMaquinaId} solo tiene ${restante} sesiones restantes.`
        );

      }

    }

    //=========================================
    // CREAR SESIÓN
    //=========================================

    const sesion = await client.query(`
      INSERT INTO practicas_sesiones_grupales(

        fecha,

        estado

      )

      VALUES(

        $1,

        'PENDIENTE'

      )

      RETURNING *
    `,[fecha]);

    const sesionGrupal = sesion.rows[0];

    //=========================================
    // INSERTAR DETALLE
    //=========================================

    for(const item of detalle){

      await client.query(`
        INSERT INTO practicas_sesiones_grupales_detalle(

          sesion_grupal_id,

          matricula_maquina_id,

          sesiones_asignadas

        )

        VALUES(

          $1,

          $2,

          $3

        )
      `,[

        sesionGrupal.id,

        item.matriculaMaquinaId,

        item.sesiones

      ]);

    }

    await client.query("COMMIT");

    return sesionGrupal;

  }
    catch (error) {
    
      await client.query("ROLLBACK");
    
      console.error("=================================");
      console.error("ERROR crearSesionGrupal");
      console.error(error);
      console.error(error.message);
      console.error(error.stack);
      console.error("=================================");
    
      throw error;
    
    }
  finally{

    client.release();

  }

}


async function obtenerSesionGrupal(id) {

  const result = await pool.query(

    `
    SELECT

      sg.id,

      sg.fecha,

      sg.estado,

      d.id AS detalle_id,

      d.sesiones_asignadas,

      mm.id AS matricula_maquina_id,

      maq.nombre AS maquina,

      a.nombres || ' ' || a.apellidos AS alumno,

      m.id AS matricula_id

    FROM practicas_sesiones_grupales sg

    INNER JOIN practicas_sesiones_grupales_detalle d
      ON d.sesion_grupal_id = sg.id

    INNER JOIN matricula_maquinas mm
      ON mm.id = d.matricula_maquina_id

    INNER JOIN matriculas m
      ON m.id = mm.matricula_id

    INNER JOIN alumnos a
      ON a.id = m.alumno_id

    INNER JOIN maquinas maq
      ON maq.id = mm.maquina_id

    WHERE sg.id=$1

    ORDER BY

      alumno,

      maquina

    `,
    [id]

  );

  if(result.rows.length===0){

    throw new Error("Sesión no encontrada.");

  }

  const sesion={

    id:result.rows[0].id,

    fecha:result.rows[0].fecha,

    estado:result.rows[0].estado,

    detalle:[]

  };

  result.rows.forEach(r=>{

    sesion.detalle.push({

      detalle_id:Number(r.detalle_id),

      matricula_id:Number(r.matricula_id),

      matricula_maquina_id:Number(r.matricula_maquina_id),

      alumno:r.alumno,

      maquina:r.maquina,

      sesiones_asignadas:Number(r.sesiones_asignadas)

    });

  });

  return sesion;

}

async function validarPracticas(matriculaId) {

  const matriculaResult = await pool.query(
    `
    SELECT
      m.id,
      a.nombres || ' ' || a.apellidos AS alumno
    FROM matriculas m
    INNER JOIN alumnos a
      ON a.id = m.alumno_id
    WHERE m.id = $1
    `,
    [matriculaId]
  );

  if (!matriculaResult.rows.length) {
    throw new Error('No se encontró la matrícula.');
  }

  // ==========================================
  // VALIDAR PAGOS
  // ==========================================
  const cuotasResult = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM cuotas c

    INNER JOIN conceptos_cobro cc
      ON cc.id = c.concepto_id

    INNER JOIN planes_pago_alumno ppa
      ON ppa.id = c.plan_pago_alumno_id

    WHERE ppa.matricula_id = $1
      AND cc.codigo = 'CUOTA'
      AND c.fecha_vencimiento < CURRENT_DATE
      AND c.saldo_pendiente > 0
    `,
    [matriculaId]
  );

  const cuotasVencidas =
    Number(cuotasResult.rows[0].total || 0);

  return {
    alumno: matriculaResult.rows[0].alumno,
    puede_practicar: cuotasVencidas < 2,
    cuotas_vencidas: cuotasVencidas
  };

}

// ==========================================
// CREAR ASIGNACIONES
// ==========================================
async function crearAsignacionPracticas(
  matriculaId
) {

  const validacion =
    await validarPracticas(matriculaId);

  if (!validacion.puede_practicar) {

    throw new Error(
      'Alumno no habilitado para prácticas.'
    );

  }

  // ==========================================
  // OBTENER MÁQUINAS
  // ==========================================
  const maquinasResult = await pool.query(
    `
    SELECT
      mm.id AS matricula_maquina_id,
      mm.matricula_id,
      mm.maquina_id,
      maq.nombre AS maquina,
      php.horas AS horas_practica -- 👈 1. Alias corregido para que coincida con tu JS abajo
    FROM matricula_maquinas mm
    INNER JOIN maquinas maq
      ON maq.id = mm.maquina_id
    INNER JOIN matriculas m
      ON m.id = mm.matricula_id -- 👈 2. Traemos la matrícula para saber el curso exacto
    LEFT JOIN plan_horas_practica php
      ON php.maquina_id = mm.maquina_id
     AND php.plan_curso_id = m.plan_curso_id -- 👈 3. ¡Corregido el "idhoras" y evitamos duplicados!
    WHERE mm.matricula_id = $1
    ORDER BY mm.id ASC
    `,
    [matriculaId]
  );

  if (!maquinasResult.rows.length) {

    throw new Error(
      'No existen máquinas asignadas.'
    );

  }

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const asignaciones = [];

    for (const maquina of maquinasResult.rows) {

      // ==========================================
      // EVITAR DUPLICADOS
      // ==========================================
      const existeResult = await client.query(
        `
        SELECT id
        FROM practicas_asignaciones
        WHERE matricula_maquina_id = $1
        `,
        [maquina.matricula_maquina_id]
      );

      if (existeResult.rows.length > 0) {
        continue;
      }

      const horas =
        Number(maquina.horas_practica || 0);

      const sesionesTotales =
        horas * 2;

      // ==========================================
      // CREAR ASIGNACIÓN
      // ==========================================
      const asignacionResult =
        await client.query(
          `
          INSERT INTO practicas_asignaciones (
            matricula_maquina_id,
            fecha_inicio,
            sesiones_totales,
            sesiones_completadas,
            estado
          )
          VALUES (
            $1,
            CURRENT_DATE,
            $2,
            0,
            'PENDIENTE'
          )
          RETURNING *
          `,
          [
            maquina.matricula_maquina_id,
            sesionesTotales
          ]
        );

      const asignacion =
        asignacionResult.rows[0];

      // ==========================================
      // GENERAR SESIONES
      // ==========================================
      for (
        let s = 1;
        s <= sesionesTotales;
        s++
      ) {

        await client.query(
          `
          INSERT INTO practicas_sesiones (
            asignacion_id,
            numero_sesion,
            fecha_programada,
            duracion_minutos,
            recuperada
          )
          VALUES (
            $1,
            $2,
            CURRENT_DATE,
            30,
            false
          )
          `,
          [
            asignacion.id,
            s
          ]
        );

      }

      asignaciones.push(asignacion);

    }

    await client.query('COMMIT');

    return asignaciones;

  } catch (error) {

    await client.query('ROLLBACK');

    throw error;

  } finally {

    client.release();

  }

}

// ==========================================
// LISTAR ASIGNACIONES
// ==========================================
async function listarAsignaciones() {

  const result = await pool.query(
    `
    SELECT
      pa.id,

      m.id AS matricula_id,

      a.nombres || ' ' || a.apellidos
        AS alumno,

      maq.nombre AS maquina,

      pa.sesiones_totales,

      pa.sesiones_completadas,

      pa.estado,

      ROUND(
        (
          pa.sesiones_completadas::decimal
          /
          NULLIF(
            pa.sesiones_totales,
            0
          )
        ) * 100,
        2
      ) AS progreso

    FROM practicas_asignaciones pa

    INNER JOIN matricula_maquinas mm
      ON mm.id = pa.matricula_maquina_id

    INNER JOIN matriculas m
      ON m.id = mm.matricula_id

    INNER JOIN alumnos a
      ON a.id = m.alumno_id

    INNER JOIN maquinas maq
      ON maq.id = mm.maquina_id

    ORDER BY pa.id DESC
    `
  );

  return result.rows;

}

// ==========================================
// LISTAR SESIONES
// ==========================================
async function listarSesiones(
  asignacionId
) {

  const result = await pool.query(
    `
    SELECT *
    FROM practicas_sesiones
    WHERE asignacion_id = $1
    ORDER BY numero_sesion ASC
    `,
    [asignacionId]
  );

  return result.rows;

}

// ==========================================
// REGISTRAR ASISTENCIA
// ==========================================
async function registrarAsistencia(
  sesionId,
  payload
) {

  const {
    asistio,
    observaciones = '',
    recuperada = false
  } = payload;

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const sesionResult =
      await client.query(
        `
        UPDATE practicas_sesiones
        SET
          asistio = $1,
          observaciones = $2,
          recuperada = $3
        WHERE id = $4
        RETURNING *
        `,
        [
          asistio,
          observaciones,
          recuperada,
          sesionId
        ]
      );

    if (!sesionResult.rows.length) {
      throw new Error('Sesión no encontrada.');
    }

    const sesion =
      sesionResult.rows[0];

    // ==========================================
    // RECALCULAR
    // ==========================================
    await client.query(
      `
      UPDATE practicas_asignaciones
      SET sesiones_completadas = (
        SELECT COUNT(*)
        FROM practicas_sesiones
        WHERE asignacion_id = $1
          AND asistio = true
      )
      WHERE id = $1
      `,
      [sesion.asignacion_id]
    );

    // ==========================================
    // VALIDAR COMPLETADO
    // ==========================================
    await client.query(
      `
      UPDATE practicas_asignaciones
      SET estado = 'COMPLETADO'
      WHERE id = $1
        AND sesiones_completadas >= sesiones_totales
      `,
      [sesion.asignacion_id]
    );

    await client.query('COMMIT');

    return {
      ok: true
    };

  } catch (error) {

    await client.query('ROLLBACK');

    throw error;

  } finally {

    client.release();

  }

}

// ==========================================
// LISTAR MATRÍCULAS ACTIVAS
// ==========================================
async function listarMatriculasActivas() {

  const result = await pool.query(
    `
    SELECT
      m.id AS matricula_id,

      a.nombres || ' ' || a.apellidos
        AS alumno,

      pc.nombre AS curso

    FROM matriculas m

    INNER JOIN alumnos a
      ON a.id = m.alumno_id

    INNER JOIN planes_curso pc
      ON pc.id = m.plan_curso_id

    INNER JOIN estados_alumno ea
      ON ea.id = m.estado_alumno_id

    WHERE ea.codigo = 'MATRICULADO'

    ORDER BY m.id DESC
    `
  );

  return result.rows;

}
// ==========================================
// LISTAR PRÁCTICAS ORDENADAS
// ==========================================
async function listarPracticasOrdenadas() {

  const result = await pool.query(
    `
    SELECT
      m.id AS matricula_id,
      m.fecha_matricula,
      a.dni AS alumno_dni,
      a.nombres || ' ' || a.apellidos AS alumno_nombre_completo,
      a.telefono AS alumno_telefono,
      pc.nombre AS plan_nombre,
      tc.codigo AS tipo_curso_codigo,
      tc.nombre AS tipo_curso_nombre,
      ea.nombre AS estado_matricula,

      -- 🌟 CALCULAMOS EL ESTADO FINANCIERO DIRECTAMENTE
      CASE
        -- Si tiene al menos una cuota vencida con saldo
        WHEN COUNT(
          CASE
            WHEN c.saldo_pendiente > 0
            AND c.fecha_vencimiento < CURRENT_DATE
            THEN 1
          END
        ) > 0 THEN 'MOROSO'

        -- Si no tiene vencidas, pero tiene una por vencer en los próximos 5 días
        WHEN COUNT(
          CASE
            WHEN c.saldo_pendiente > 0
            AND c.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '5 days'
            THEN 1
          END
        ) > 0 THEN 'POR_VENCER'

        -- Si no debe nada o todo está al día
        ELSE 'AL_DIA'
      -- Necesitamos agrupar por el plan del alumno para que el COUNT funcione por fila
      END AS estado_financiero

    FROM matriculas m
    INNER JOIN alumnos a ON a.id = m.alumno_id
    INNER JOIN planes_curso pc ON pc.id = m.plan_curso_id
    INNER JOIN tipos_curso tc ON tc.id = pc.tipo_curso_id
    INNER JOIN estados_alumno ea ON ea.id = m.estado_alumno_id
    
    -- 🌟 Unimos con los pagos del alumno de manera segura
    LEFT JOIN planes_pago_alumno ppa ON ppa.matricula_id = m.id
    LEFT JOIN cuotas c ON c.plan_pago_alumno_id = ppa.id

    GROUP BY
      m.id,
      m.fecha_matricula,
      a.dni,
      a.nombres,
      a.apellidos,
      a.telefono,
      pc.nombre,
      tc.codigo,
      tc.nombre,
      ea.nombre

    ORDER BY
      a.nombres ASC
    `
  );

  return result.rows;
}


async function obtenerDetallePracticas(
  matriculaId
) {


  const alumnoResult = await pool.query(
    `
    SELECT
      m.id AS matricula_id,

      a.nombres || ' ' || a.apellidos
        AS alumno,

      a.dni,

      a.telefono,

      pc.nombre AS curso

    FROM matriculas m

    INNER JOIN alumnos a
      ON a.id = m.alumno_id

    INNER JOIN planes_curso pc
      ON pc.id = m.plan_curso_id

    WHERE m.id = $1
    `,
    [matriculaId]
  );

  if (!alumnoResult.rows.length) {
    throw new Error(
      'Alumno no encontrado.'
    );
  }

  // ==========================================
  // MÁQUINAS
  // ==========================================
  const maquinasResult = await pool.query(
    `
  SELECT
    mm.id AS matricula_maquina_id,
    maq.nombre AS maquina,
    php.horas AS horas_practica -- 👈 Asegúrate si es "horas" o "horas_practica" en tu tabla
  FROM matricula_maquinas mm

  INNER JOIN maquinas maq
    ON maq.id = mm.maquina_id

  -- 1. Unimos con matrículas para saber el plan del alumno
  INNER JOIN matriculas m
    ON m.id = mm.matricula_id

  -- 2. Filtramos el plan de horas POR EL PLAN DEL ALUMNO (Evita la duplicación)
  LEFT JOIN plan_horas_practica php
    ON php.maquina_id = mm.maquina_id
   AND php.plan_curso_id = m.plan_curso_id -- 👈 ¡ESTA LINEA ES LA CLAVE!

  WHERE mm.matricula_id = $1
  ORDER BY maq.nombre ASC
  `,
    [matriculaId]
  );

  // ==========================================
  // ASIGNACIONES
  // ==========================================
  const asignacionesResult = await pool.query(
    `
    SELECT
      pa.id,

      maq.nombre AS maquina,

      pa.estado,

      pa.sesiones_totales,

      pa.sesiones_completadas,

      ROUND(
        (
          pa.sesiones_completadas::decimal
          /
          NULLIF(
            pa.sesiones_totales,
            0
          )
        ) * 100,
        2
      ) AS progreso

    FROM practicas_asignaciones pa

    INNER JOIN matricula_maquinas mm
      ON mm.id = pa.matricula_maquina_id

    INNER JOIN maquinas maq
      ON maq.id = mm.maquina_id

    WHERE mm.matricula_id = $1

    ORDER BY pa.id ASC
    `,
    [matriculaId]
  );

  // ==========================================
  // SESIONES
  // ==========================================
  const sesionesResult = await pool.query(
    `
    SELECT
      ps.id,

      ps.asignacion_id,

      ps.numero_sesion,

      ps.fecha_programada,

      ps.asistio,

      ps.recuperada,

      ps.observaciones,

      maq.nombre AS maquina

    FROM practicas_sesiones ps

    INNER JOIN practicas_asignaciones pa
      ON pa.id = ps.asignacion_id

    INNER JOIN matricula_maquinas mm
      ON mm.id = pa.matricula_maquina_id

    INNER JOIN maquinas maq
      ON maq.id = mm.maquina_id

    WHERE mm.matricula_id = $1

    ORDER BY
      ps.fecha_programada ASC,
      ps.numero_sesion ASC
    `,
    [matriculaId]
  );

  return {
    alumno:
      alumnoResult.rows[0],

    maquinas:
      maquinasResult.rows,

    asignaciones:
      asignacionesResult.rows,

    sesiones:
      sesionesResult.rows
  };

}
module.exports = {
  listarAlumnosDisponibles,
  crearSesionGrupal,
  obtenerSesionGrupal,
  validarPracticas,
  listarMatriculasActivas,
  listarPracticasOrdenadas,
  crearAsignacionPracticas,
  listarAsignaciones,
  listarSesiones,
  registrarAsistencia,
  obtenerDetallePracticas
};
