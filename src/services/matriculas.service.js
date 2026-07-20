const pool = require('../config/db');

async function listarMatriculas(filtros = {}) {
  const { estado = null, search = '', anio = null, mes = null } = filtros;

  const values = [];
  let where = `WHERE 1=1`;

  if (estado) {
    values.push(estado);
    where += ` AND ea.codigo = $${values.length}`;
  }

  if (search && String(search).trim() !== '') {
    const searchNormalizado = String(search).trim().toLowerCase();
    values.push(`%${searchNormalizado}%`);

    where += `
      AND (
        a.dni ILIKE $${values.length}
        OR unaccent(lower(a.nombres)) LIKE unaccent($${values.length})
        OR unaccent(lower(a.apellidos)) LIKE unaccent($${values.length})
        OR unaccent(lower(a.nombres || ' ' || a.apellidos)) LIKE unaccent($${values.length})
        OR unaccent(lower(a.apellidos || ' ' || a.nombres)) LIKE unaccent($${values.length})
      )
    `;
  }

  if (anio) {
    values.push(Number(anio));
    where += ` AND EXTRACT(YEAR FROM m.fecha_matricula) = $${values.length}`;
  }

  if (mes) {
    values.push(Number(mes));
    where += ` AND EXTRACT(MONTH FROM m.fecha_matricula) = $${values.length}`;
  }

  const query = `
    SELECT
      m.id,
      m.alumno_id,
      m.plan_curso_id,
      m.estado_alumno_id,
      m.fecha_matricula,
      m.fecha_inicio,
      m.fecha_fin_estimada,
      m.cronograma_url,
      m.notas,
      m.activo,
      m.fecha_creacion
    FROM matriculas m
    INNER JOIN estados_alumno ea ON ea.id = m.estado_alumno_id
    INNER JOIN alumnos a ON a.id = m.alumno_id
    ${where}
    ORDER BY m.fecha_matricula DESC, m.id DESC
  `;

  const result = await pool.query(query, values);
  return result.rows;
}

async function obtenerMatriculaPorId(id) {
  const result = await pool.query(
    `
    SELECT *
    FROM matriculas
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function obtenerEstadoPorCodigo(codigo) {
  const result = await pool.query(
    `
    SELECT id, codigo, nombre
    FROM estados_alumno
    WHERE codigo = $1
    LIMIT 1
    `,
    [codigo]
  );

  return result.rows[0] || null;
}

async function actualizarEstadoMatricula(id, estadoAlumnoId, user) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
      UPDATE matriculas
      SET estado_alumno_id = $1
      WHERE id = $2
      RETURNING *
      `,
      [estadoAlumnoId, id]
    );

    await registrarHistorial(client, {
      matricula_id: id,
      accion: 'CAMBIO_ESTADO',
      descripcion: `Cambio de estado a ID ${estadoAlumnoId}`
    }, user);

    await client.query('COMMIT');
    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function actualizarMatricula(id, data) {
  const result = await pool.query(
    `
    UPDATE matriculas
    SET
      alumno_id = $1,
      plan_curso_id = $2,
      estado_alumno_id = $3,
      fecha_matricula = $4,
      fecha_inicio = $5,
      fecha_fin_estimada = $6,
      notas = $7
    WHERE id = $8
    RETURNING *
    `,
    [
      data.alumno_id,
      data.plan_curso_id,
      data.estado_alumno_id,
      data.fecha_matricula,
      data.fecha_inicio || null,
      data.fecha_fin_estimada || null,
      data.notas || null,
      id
    ]
  );

  return result.rows[0] || null;
}

async function obtenerDetalleMatricula(id) {
  const result = await pool.query(
    `
    SELECT
      m.id,
      m.alumno_id,
      m.plan_curso_id,
      m.estado_alumno_id,
      m.fecha_matricula,
      m.fecha_inicio,
      m.fecha_fin_estimada,
      m.cronograma_url,
      m.notas,
      m.activo,
      m.fecha_creacion,

      a.dni AS alumno_dni,
      a.nombres AS alumno_nombres,
      a.apellidos AS alumno_apellidos,
      a.fecha_nacimiento AS alumno_fecha_nacimiento,
      a.telefono AS alumno_telefono,
      a.correo AS alumno_correo,
      a.direccion AS alumno_direccion,
      a.foto_url AS alumno_foto_url,
      a.observaciones AS alumno_observaciones,
      a.seguro_alumno AS alumno_seguro_alumno,

      pc.codigo AS plan_codigo,
      pc.nombre AS plan_nombre,
      pc.permite_eleccion_personalizada,

      tc.codigo AS tipo_curso_codigo,
      tc.nombre AS tipo_curso_nombre,

      ea.codigo AS estado_codigo,
      ea.nombre AS estado_nombre
    FROM matriculas m
    INNER JOIN alumnos a ON a.id = m.alumno_id
    INNER JOIN planes_curso pc ON pc.id = m.plan_curso_id
    INNER JOIN tipos_curso tc ON tc.id = pc.tipo_curso_id
    INNER JOIN estados_alumno ea ON ea.id = m.estado_alumno_id
    WHERE m.id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function listarMaquinasDeMatricula(matriculaId) {
  const result = await pool.query(
    `
    SELECT
      mm.id,
      mm.matricula_id,
      mm.maquina_id,
      mm.orden,
      mm.es_regalo,
      mm.horas_asignadas,
      mm.sesiones_totales,
      mm.sesiones_completadas,
      mm.estado,
      m.nombre AS maquina_nombre
    FROM matricula_maquinas mm
    INNER JOIN maquinas m ON m.id = mm.maquina_id
    WHERE mm.matricula_id = $1
    ORDER BY mm.orden ASC, mm.id ASC
    `,
    [matriculaId]
  );

  return result.rows;
}

async function obtenerPlanCursoDetalle(client, planCursoId) {
  const result = await client.query(
    `
    SELECT
      pc.id,
      pc.codigo,
      pc.nombre,
      pc.permite_eleccion_personalizada,
      tc.codigo AS tipo_curso_codigo,
      tc.nombre AS tipo_curso_nombre,
      tc.cantidad_maquinas
    FROM planes_curso pc
    INNER JOIN tipos_curso tc ON tc.id = pc.tipo_curso_id
    WHERE pc.id = $1
    LIMIT 1
    `,
    [planCursoId]
  );

  return result.rows[0] || null;
}

async function obtenerMaquinaPorNombre(client, nombre) {
  const result = await client.query(
    `
    SELECT id, nombre
    FROM maquinas
    WHERE LOWER(nombre) = LOWER($1)
    LIMIT 1
    `,
    [nombre]
  );

  return result.rows[0] || null;
}

async function obtenerPlanMaquinas(client, planCursoId) {
  const result = await client.query(
    `
    SELECT maquina_id, orden, es_regalo
    FROM plan_maquinas
    WHERE plan_curso_id = $1
    ORDER BY orden ASC, id ASC
    `,
    [planCursoId]
  );

  return result.rows;
}

async function obtenerHorasPlanPorMaquina(client, planCursoId, maquinaId) {
  const result = await client.query(
    `
    SELECT horas, sesiones_totales
    FROM plan_horas_practica
    WHERE plan_curso_id = $1
      AND maquina_id = $2
    LIMIT 1
    `,
    [planCursoId, maquinaId]
  );

  return result.rows[0] || null;
}

async function insertarMatriculaMaquina(client, data) {
  const result = await client.query(
    `
    INSERT INTO matricula_maquinas (
      matricula_id,
      maquina_id,
      orden,
      es_regalo,
      horas_asignadas,
      sesiones_totales,
      sesiones_completadas,
      estado
    )
    VALUES ($1,$2,$3,$4,$5,$6,0,'PENDIENTE')
    RETURNING *
    `,
    [
      data.matricula_id,
      data.maquina_id,
      data.orden,
      data.es_regalo,
      data.horas_asignadas,
      data.sesiones_totales
    ]
  );

  return result.rows[0];
}

async function obtenerPlanPrecioVigente(client, planCursoId, fechaMatricula, maquinasAGuardar = [], tipoCursoCodigo = '') {
  const maquinasIds = maquinasAGuardar.map(m => Number(m.maquina_id));

  const tractor = await obtenerMaquinaPorNombre(client, 'Tractor de Cadenas');
  const tieneTractor = tractor
    ? maquinasIds.includes(Number(tractor.id))
    : false;

  const tipo = String(tipoCursoCodigo || '').toUpperCase();

  let query = `
    SELECT
      id,
      plan_curso_id,
      nombre,
      monto_total,
      matricula,
      certificacion,
      cantidad_cuotas,
      monto_cuota,
      vigente_desde,
      vigente_hasta,
      activo,
      observaciones,
      aplica_maquina_id,
      requiere_tractor
    FROM plan_precios
    WHERE plan_curso_id = $1
      AND activo = TRUE
      AND (vigente_desde IS NULL OR vigente_desde <= $2::date)
      AND (vigente_hasta IS NULL OR vigente_hasta >= $2::date)
  `;

  const values = [planCursoId, fechaMatricula];

  if (tipo === 'INDIVIDUAL') {
    const maquinaPrincipal = maquinasAGuardar.find(m => !m.es_regalo) || maquinasAGuardar[0];

    if (!maquinaPrincipal) {
      throw new Error('No se encontró la máquina seleccionada para calcular el precio individual.');
    }

    values.push(Number(maquinaPrincipal.maquina_id));
    query += ` AND aplica_maquina_id = $${values.length}`;
  }

  if (tipo === 'DOBLE') {
    values.push(tieneTractor);
    query += ` AND requiere_tractor = $${values.length}`;
  }

  if (tipo === 'TRIPLE' || tipo === 'MULTIPLE') {
    query += ` AND aplica_maquina_id IS NULL`;
  }

  query += `
    ORDER BY vigente_desde DESC NULLS LAST, id DESC
    LIMIT 1
  `;

  const result = await client.query(query, values);
  return result.rows[0] || null;
}
async function obtenerConceptoCobroPorCodigo(client, codigo) {
  const result = await client.query(
    `
    SELECT id, codigo, nombre
    FROM conceptos_cobro
    WHERE codigo = $1
    LIMIT 1
    `,
    [codigo]
  );

  return result.rows[0] || null;
}

async function insertarPlanPagoAlumno(client, data) {
  const result = await client.query(
    `
    INSERT INTO planes_pago_alumno (
      matricula_id,
      plan_precio_id,
      monto_total,
      monto_matricula,
      monto_certificacion,
      cantidad_cuotas,
      monto_cuota,
      nota_pago,
      modalidad_pago
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
    `,
    [
      data.matricula_id,
      data.plan_precio_id,
      data.monto_total,
      data.monto_matricula,
      data.monto_certificacion,
      data.cantidad_cuotas,
      data.monto_cuota,
      data.nota_pago || null,
      data.modalidad_pago || 'MENSUAL'
    ]
  );

  return result.rows[0];
}

async function insertarCuota(client, data) {
  const result = await client.query(
    `
    INSERT INTO cuotas (
      plan_pago_alumno_id,
      numero_cuota,
      concepto_id,
      fecha_programada,
      fecha_vencimiento,
      monto_programado,
      monto_pagado,
      saldo_pendiente,
      estado,
      observaciones
    )
    VALUES ($1,$2,$3,$4,$5,$6,0,$6,'PENDIENTE',$7)
    RETURNING *
    `,
    [
      data.plan_pago_alumno_id,
      data.numero_cuota,
      data.concepto_id,
      data.fecha_programada,
      data.fecha_vencimiento,
      data.monto_programado,
      data.observaciones || null
    ]
  );

  return result.rows[0];
}

async function crearMatricula(data, user) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const matriculaResult = await client.query(
      `
      INSERT INTO matriculas (
        alumno_id,
        plan_curso_id,
        estado_alumno_id,
        fecha_matricula,
        fecha_inicio,
        fecha_fin_estimada,
        cronograma_url,
        notas,
        activo
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
      RETURNING *
      `,
      [
        data.alumno_id,
        data.plan_curso_id,
        data.estado_alumno_id,
        data.fecha_matricula,
        data.fecha_inicio || null,
        data.fecha_fin_estimada || null,
        null,
        data.notas || null
      ]
    );

    const nuevaMatricula = matriculaResult.rows[0];
    await registrarHistorial(client, {
      matricula_id: nuevaMatricula.id,
      accion: 'CREACION',
      descripcion: `Matrícula creada con estado ID ${data.estado_alumno_id}`
    }, user);
    const plan = await obtenerPlanCursoDetalle(client, data.plan_curso_id);
    if (!plan) throw new Error('No se encontró el plan de curso.');

    let maquinasAGuardar = [];

    if (plan.permite_eleccion_personalizada) {
      const seleccionadas = Array.isArray(data.maquinas_seleccionadas)
        ? data.maquinas_seleccionadas.map(Number).filter(Boolean)
        : [];

      if (seleccionadas.length !== Number(plan.cantidad_maquinas)) {
        throw new Error(`Debes seleccionar exactamente ${plan.cantidad_maquinas} máquina(s) para este plan.`);
      }

      maquinasAGuardar = seleccionadas.map((maquinaId, index) => ({
        maquina_id: maquinaId,
        orden: index + 1,
        es_regalo: false
      }));
    } else {
      const planMaquinas = await obtenerPlanMaquinas(client, data.plan_curso_id);
      if (!planMaquinas.length) throw new Error('El plan de curso no tiene máquinas configuradas.');

      maquinasAGuardar = planMaquinas.map((item) => ({
        maquina_id: Number(item.maquina_id),
        orden: Number(item.orden),
        es_regalo: Boolean(item.es_regalo)
      }));
    }

    const esMultiple = String(plan.tipo_curso_codigo).toUpperCase() === 'MULTIPLE';

    if (esMultiple) {
      const camioneta = await obtenerMaquinaPorNombre(client, 'Camioneta');
      if (!camioneta) throw new Error('No se encontró la máquina Camioneta para registrar el regalo.');

      const yaExisteCamioneta = maquinasAGuardar.some(
        (item) => Number(item.maquina_id) === Number(camioneta.id)
      );

      if (!yaExisteCamioneta) {
        maquinasAGuardar.push({
          maquina_id: Number(camioneta.id),
          orden: maquinasAGuardar.length + 1,
          es_regalo: true
        });
      }
    }
    const nombresMaquinas = [];

    for (const item of maquinasAGuardar) {
      const result = await client.query(
        `SELECT nombre FROM maquinas WHERE id = $1`,
        [item.maquina_id]
      );

      if (result.rows[0]) {
        nombresMaquinas.push(result.rows[0].nombre);
      }
    }

    const maquinasTexto = nombresMaquinas.join(', ');

    for (const item of maquinasAGuardar) {
    
      const horasPlan =
        await obtenerHorasPlanPorMaquina(
          client,
          data.plan_curso_id,
          item.maquina_id
        );
    
      await insertarMatriculaMaquina(client, {
        matricula_id: matriculaId,
        maquina_id: item.maquina_id,
        orden: item.orden,
        es_regalo: item.es_regalo,
        horas_asignadas: horasPlan
          ? Number(horasPlan.horas)
          : 1,
        sesiones_totales: horasPlan
          ? Number(horasPlan.sesiones_totales)
          : 1
      });
    
    }
    
    // ==========================================
    // REGENERAR ASIGNACIONES DE PRÁCTICAS
    // ==========================================
    
    await client.query(
      `
      DELETE FROM practicas_asignaciones
      WHERE matricula_maquina_id IN (
          SELECT id
          FROM matricula_maquinas
          WHERE matricula_id = $1
      )
      `,
      [matriculaId]
    );
    
    await generarAsignacionesPracticas(
      client,
      matriculaId,
      data.plan_curso_id
    );

    const planPrecio = await obtenerPlanPrecioVigente(
      client,
      data.plan_curso_id,
      data.fecha_matricula,
      maquinasAGuardar,
      plan.tipo_curso_codigo
    );
    if (!planPrecio) throw new Error('No se encontró un plan de precios activo para este curso.');

    const conceptoMatricula = await obtenerConceptoCobroPorCodigo(client, 'MATRICULA');
    const conceptoCuota = await obtenerConceptoCobroPorCodigo(client, 'CUOTA');
    const conceptoCertificacion = await obtenerConceptoCobroPorCodigo(client, 'CERTIFICACION');

    if (!conceptoMatricula || !conceptoCuota || !conceptoCertificacion) {
      throw new Error('Faltan conceptos de cobro base: MATRICULA, CUOTA o CERTIFICACION.');
    }

    const montoTotal = Number(planPrecio.monto_total || 0);
    const montoMatricula = Number(planPrecio.matricula || 0);
    const montoCertificacion = Number(planPrecio.certificacion || 0);
    const cantidadCuotasBase = Number(planPrecio.cantidad_cuotas || 0);

    const fechaBaseCuotas = data.fecha_inicio || data.fecha_matricula;
    const modalidadPago = String(data.modalidad_pago || 'MENSUAL').toUpperCase();

    const diasEntreCuotas = modalidadPago === 'QUINCENAL' ? 14 : 20;

    const cantidadCuotasFinal =
      modalidadPago === 'QUINCENAL'
        ? cantidadCuotasBase * 2
        : cantidadCuotasBase;

    const montoCuotaBase = Number(planPrecio.monto_cuota || 0);

    const montoCuotaFinal =
      modalidadPago === 'QUINCENAL'
        ? Number((montoCuotaBase / 2).toFixed(2))
        : montoCuotaBase;
    const planPagoAlumno = await insertarPlanPagoAlumno(client, {
      matricula_id: nuevaMatricula.id,
      plan_precio_id: planPrecio.id,
      monto_total: montoTotal,
      monto_matricula: montoMatricula,
      monto_certificacion: montoCertificacion,
      cantidad_cuotas: cantidadCuotasFinal,
      monto_cuota: montoCuotaFinal,
      nota_pago: `${planPrecio.nombre} - Máquinas: ${maquinasTexto}` || null,
      modalidad_pago: modalidadPago
    });

    if (montoMatricula > 0) {
      await insertarCuota(client, {
        plan_pago_alumno_id: planPagoAlumno.id,
        numero_cuota: 0,
        concepto_id: conceptoMatricula.id,
        fecha_programada: data.fecha_matricula,
        fecha_vencimiento: data.fecha_matricula,
        monto_programado: montoMatricula,
        observaciones: 'Pago de matrícula'
      });
    }

    for (let i = 1; i <= cantidadCuotasFinal; i++) {
      const fechaCuota = sumarDias(fechaBaseCuotas, diasEntreCuotas * (i - 1));

      await insertarCuota(client, {
        plan_pago_alumno_id: planPagoAlumno.id,
        numero_cuota: i,
        concepto_id: conceptoCuota.id,
        fecha_programada: fechaCuota,
        fecha_vencimiento: fechaCuota,
        monto_programado: montoCuotaFinal,
        observaciones: `Cuota ${i} de ${cantidadCuotasFinal} - ${modalidadPago}`
      });
    }

    if (montoCertificacion > 0) {
      const fechaCertificacion = data.fecha_fin_estimada || sumarMeses(fechaBaseCuotas, cantidadCuotasBase);

      await insertarCuota(client, {
        plan_pago_alumno_id: planPagoAlumno.id,
        numero_cuota: null,
        concepto_id: conceptoCertificacion.id,
        fecha_programada: fechaCertificacion,
        fecha_vencimiento: fechaCertificacion,
        monto_programado: montoCertificacion,
        observaciones: 'Carpeta y certificación'
      });
    }

    await client.query('COMMIT');
    return nuevaMatricula;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function obtenerResumenFinanzasMatricula(matriculaId) {
  const result = await pool.query(
    `
    SELECT
      ppa.id,
      ppa.matricula_id,
      ppa.plan_precio_id,
      ppa.monto_total,
      ppa.monto_matricula,
      ppa.monto_certificacion,
      ppa.cantidad_cuotas,
      ppa.monto_cuota,
      ppa.modalidad_pago,
      ppa.nota_pago,
      ppa.fecha_creacion
    FROM planes_pago_alumno ppa
    WHERE ppa.matricula_id = $1
    LIMIT 1
    `,
    [matriculaId]
  );

  return result.rows[0] || null;
}

async function listarCuotasDeMatricula(matriculaId) {
  const result = await pool.query(
    `
    SELECT
      c.id,
      c.plan_pago_alumno_id,
      c.numero_cuota,
      c.concepto_id,
      cc.codigo AS concepto_codigo,
      cc.nombre AS concepto_nombre,
      c.fecha_programada,
      c.fecha_vencimiento,
      c.monto_programado,
      c.monto_pagado,
      c.saldo_pendiente,
      c.estado,
      c.observaciones
    FROM cuotas c
    INNER JOIN planes_pago_alumno ppa ON ppa.id = c.plan_pago_alumno_id
    INNER JOIN conceptos_cobro cc ON cc.id = c.concepto_id
    WHERE ppa.matricula_id = $1
    ORDER BY
      CASE
        WHEN cc.codigo = 'MATRICULA' THEN 0
        WHEN cc.codigo = 'CUOTA' THEN 1
        WHEN cc.codigo = 'CERTIFICACION' THEN 2
        ELSE 3
      END,
      c.numero_cuota ASC NULLS LAST,
      c.fecha_vencimiento ASC,
      c.id ASC
    `,
    [matriculaId]
  );

  return result.rows;
}

async function procesarTodo(id, data, user) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const actualResult = await client.query(
      `SELECT * FROM matriculas WHERE id = $1 LIMIT 1`,
      [id]
    );

    const actual = actualResult.rows[0];
    if (!actual) throw new Error('Matrícula no encontrada.');

    const cambioPlan = Number(actual.plan_curso_id) !== Number(data.plan_curso_id);
    const cambioMaquinas = Array.isArray(data.maquinas_seleccionadas) && data.maquinas_seleccionadas.length > 0;

    await client.query(
      `
      UPDATE matriculas
      SET
        alumno_id = $1,
        plan_curso_id = $2,
        estado_alumno_id = $3,
        fecha_matricula = $4,
        fecha_inicio = $5,
        fecha_fin_estimada = $6,
        notas = $7
      WHERE id = $8
      `,
      [
        data.alumno_id,
        data.plan_curso_id,
        data.estado_alumno_id,
        data.fecha_matricula,
        data.fecha_inicio || null,
        data.fecha_fin_estimada || null,
        data.notas || null,
        id
      ]
    );
      if (cambioPlan) {
      
        // eliminar asignaciones
        await client.query(`
            DELETE FROM practicas_asignaciones
            WHERE matricula_maquina_id IN (
                SELECT id
                FROM matricula_maquinas
                WHERE matricula_id = $1
            )
        `, [id]);
      
        // eliminar máquinas
        await client.query(
            `DELETE FROM matricula_maquinas WHERE matricula_id = $1`,
            [id]
        );
      
        // eliminar cuotas
        await client.query(`
            DELETE FROM cuotas
            WHERE plan_pago_alumno_id IN (
                SELECT id
                FROM planes_pago_alumno
                WHERE matricula_id = $1
            )
        `, [id]);
      
        await client.query(
            `DELETE FROM planes_pago_alumno WHERE matricula_id = $1`,
            [id]
        );
      
        await regenerarTodo(client, id, data);
      
      }
    else if (cambioMaquinas) {
      await client.query(`DELETE FROM matricula_maquinas WHERE matricula_id = $1`, [id]);
      await client.query(`
        DELETE FROM cuotas
        WHERE plan_pago_alumno_id IN (
          SELECT id FROM planes_pago_alumno WHERE matricula_id = $1
        )
      `, [id]);
      await client.query(`DELETE FROM planes_pago_alumno WHERE matricula_id = $1`, [id]);
      await regenerarTodo(client, id, data);
    }
    // 🔥 obtener nombres de máquinas nuevas
    let maquinasTexto = '';

    if (Array.isArray(data.maquinas_seleccionadas) && data.maquinas_seleccionadas.length > 0) {
      const nombres = [];
      for (const maquinaId of data.maquinas_seleccionadas) {
        const result = await client.query(
          `SELECT nombre FROM maquinas WHERE id = $1`,
          [maquinaId]
        );
        if (result.rows[0]) {
          nombres.push(result.rows[0].nombre);
        }
      }
      maquinasTexto = nombres.join(', ');
    }

    // CORRECCIÓN: Armar la descripción incluyendo las máquinas si existen
    let descripcionHistorial = 'Se actualizó la matrícula';
    if (maquinasTexto !== '') {
      descripcionHistorial += `. Máquinas: ${maquinasTexto}`;
    }

    await registrarHistorial(client, {
      matricula_id: id,
      accion: 'ACTUALIZACION',
      descripcion: descripcionHistorial
    }, user);

    await client.query('COMMIT');
    return await obtenerMatriculaPorId(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function regenerarTodo(client, matriculaId, data) {

  const plan = await obtenerPlanCursoDetalle(client, data.plan_curso_id);

  if (!plan) {
    throw new Error('Plan no encontrado.');
  }

  let maquinasAGuardar = [];

  if (plan.permite_eleccion_personalizada) {

    maquinasAGuardar = data.maquinas_seleccionadas.map((id, i) => ({
      maquina_id: Number(id),
      orden: i + 1,
      es_regalo: false
    }));

  } else {

    const planMaquinas = await obtenerPlanMaquinas(
      client,
      data.plan_curso_id
    );

    maquinasAGuardar = planMaquinas.map(m => ({
      maquina_id: Number(m.maquina_id),
      orden: Number(m.orden),
      es_regalo: Boolean(m.es_regalo)
    }));

  }
  const esMultiple =
    String(plan.tipo_curso_codigo).toUpperCase() === 'MULTIPLE';

  if (esMultiple) {

    const camioneta = await obtenerMaquinaPorNombre(
      client,
      'Camioneta'
    );

    if (!camioneta) {
      throw new Error(
        'No se encontró la máquina Camioneta.'
      );
    }

    const yaExisteCamioneta =
      maquinasAGuardar.some(
        item =>
          Number(item.maquina_id) === Number(camioneta.id)
      );

    if (!yaExisteCamioneta) {

      maquinasAGuardar.push({
        maquina_id: Number(camioneta.id),
        orden: maquinasAGuardar.length + 1,
        es_regalo: true
      });

    }

  }
  const nombresMaquinas = [];

  for (const item of maquinasAGuardar) {

    const result = await client.query(
      `SELECT nombre FROM maquinas WHERE id = $1`,
      [item.maquina_id]
    );

    if (result.rows[0]) {
      nombresMaquinas.push(result.rows[0].nombre);
    }

  }

  const maquinasTexto = nombresMaquinas.join(', ');

  for (const item of maquinasAGuardar) {

    const horasPlan =
      await obtenerHorasPlanPorMaquina(
        client,
        data.plan_curso_id,
        item.maquina_id
      );

    await insertarMatriculaMaquina(client, {
      matricula_id: matriculaId,
      maquina_id: item.maquina_id,
      orden: item.orden,
      es_regalo: item.es_regalo,
      horas_asignadas: horasPlan
        ? Number(horasPlan.horas)
        : 1,
      sesiones_totales: horasPlan
        ? Number(horasPlan.sesiones_totales)
        : 1
    });

  }

  const planPrecio = await obtenerPlanPrecioVigente(
    client,
    data.plan_curso_id,
    data.fecha_matricula,
    maquinasAGuardar,
    plan.tipo_curso_codigo
  );

  if (!planPrecio) {
    throw new Error(
      'No hay precio activo para este curso.'
    );
  }

  const conceptoMatricula =
    await obtenerConceptoCobroPorCodigo(
      client,
      'MATRICULA'
    );

  const conceptoCuota =
    await obtenerConceptoCobroPorCodigo(
      client,
      'CUOTA'
    );

  const conceptoCertificacion =
    await obtenerConceptoCobroPorCodigo(
      client,
      'CERTIFICACION'
    );

  if (
    !conceptoMatricula ||
    !conceptoCuota ||
    !conceptoCertificacion
  ) {
    throw new Error(
      'Faltan conceptos base de cobro.'
    );
  }

  const montoTotal =
    Number(planPrecio.monto_total || 0);

  const montoMatricula =
    Number(planPrecio.matricula || 0);

  const montoCertificacion =
    Number(planPrecio.certificacion || 0);

  const cantidadCuotasBase =
    Number(planPrecio.cantidad_cuotas || 0);

  const montoCuotaBase =
    Number(planPrecio.monto_cuota || 0);

  const fechaBaseCuotas =
    data.fecha_inicio || data.fecha_matricula;

  const modalidadPago = String(
    data.modalidad_pago || 'MENSUAL'
  ).toUpperCase();

  const diasEntreCuotas =
    modalidadPago === 'QUINCENAL'
      ? 14
      : 20;

  const cantidadCuotasFinal =
    modalidadPago === 'QUINCENAL'
      ? cantidadCuotasBase * 2
      : cantidadCuotasBase;

  const montoCuotaFinal =
    modalidadPago === 'QUINCENAL'
      ? Number(
        (montoCuotaBase / 2).toFixed(2)
      )
      : montoCuotaBase;


  const planPago =
    await insertarPlanPagoAlumno(client, {
      matricula_id: matriculaId,
      plan_precio_id: planPrecio.id,
      monto_total: montoTotal,
      monto_matricula: montoMatricula,
      monto_certificacion: montoCertificacion,
      cantidad_cuotas: cantidadCuotasFinal,
      monto_cuota: montoCuotaFinal,
      nota_pago:
        `${planPrecio.nombre} - Máquinas: ${maquinasTexto}`,
      modalidad_pago: modalidadPago
    });

  if (montoMatricula > 0) {

    await insertarCuota(client, {
      plan_pago_alumno_id: planPago.id,
      numero_cuota: 0,
      concepto_id: conceptoMatricula.id,
      fecha_programada: data.fecha_matricula,
      fecha_vencimiento: data.fecha_matricula,
      monto_programado: montoMatricula,
      observaciones: 'Pago de matrícula'
    });

  }


  for (
    let i = 1;
    i <= cantidadCuotasFinal;
    i++
  ) {

    const fechaCuota = sumarDias(
      fechaBaseCuotas,
      diasEntreCuotas * (i - 1)
    );

    await insertarCuota(client, {
      plan_pago_alumno_id: planPago.id,
      numero_cuota: i,
      concepto_id: conceptoCuota.id,
      fecha_programada: fechaCuota,
      fecha_vencimiento: fechaCuota,
      monto_programado: montoCuotaFinal,
      observaciones:
        `Cuota ${i} de ${cantidadCuotasFinal} - ${modalidadPago}`
    });

  }


  if (montoCertificacion > 0) {

    const fechaCertificacion =
      data.fecha_fin_estimada ||
      sumarMeses(
        fechaBaseCuotas,
        cantidadCuotasBase
      );

    await insertarCuota(client, {
      plan_pago_alumno_id: planPago.id,
      numero_cuota: null,
      concepto_id: conceptoCertificacion.id,
      fecha_programada: fechaCertificacion,
      fecha_vencimiento: fechaCertificacion,
      monto_programado: montoCertificacion,
      observaciones:
        'Carpeta y certificación'
    });

  }

}

async function registrarHistorial(client, data, user) {
  const nombreUsuario =
    user && (user.nombres || user.apellidos)
      ? `${user.nombres || ''} ${user.apellidos || ''}`.trim()
      : 'sistema';

  await client.query(
    `
    INSERT INTO matricula_historial (
      matricula_id,
      accion,
      descripcion,
      usuario
    )
    VALUES ($1, $2, $3, $4)
    `,
    [
      data.matricula_id,
      data.accion,
      data.descripcion,
      nombreUsuario
    ]
  );
}
function sumarMeses(fechaBase, meses) {
  const [anioStr, mesStr, diaStr] = String(fechaBase).split('-');
  const fecha = new Date(Number(anioStr), Number(mesStr) - 1, Number(diaStr));

  if (Number.isNaN(fecha.getTime())) {
    throw new Error('Fecha inválida para calcular cuotas.');
  }

  fecha.setMonth(fecha.getMonth() + meses);

  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}

function sumarDias(fechaBase, dias) {
  const [anioStr, mesStr, diaStr] = String(fechaBase).split('-');
  const fecha = new Date(Number(anioStr), Number(mesStr) - 1, Number(diaStr));

  if (Number.isNaN(fecha.getTime())) {
    throw new Error('Fecha inválida para calcular cuotas.');
  }

  fecha.setDate(fecha.getDate() + dias);

  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}
async function obtenerHistorial(matriculaId) {
  const result = await pool.query(
    `
    SELECT *
    FROM matricula_historial
    WHERE matricula_id = $1
    ORDER BY fecha DESC
    `,
    [matriculaId]
  );

  return result.rows;
}
async function crearPlanPagoManual({
  matricula_id,
  modalidad_pago,
  monto_total,
  monto_matricula = 0,
  monto_certificacion = 0,
  cuotas = [],
  nota_pago = null
}) {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');
    const matriculaRes = await client.query(`
      SELECT *
      FROM matriculas
      WHERE id = $1
      LIMIT 1
    `, [matricula_id]);

    const matricula = matriculaRes.rows[0];

    if (!matricula) {
      throw new Error('Matrícula no encontrada');
    }

    // ======================================
    // VALIDAR SI YA EXISTE PLAN
    // ======================================

    const existePlan = await client.query(`
      SELECT id
      FROM planes_pago_alumno
      WHERE matricula_id = $1
      LIMIT 1
    `, [matricula_id]);

    if (existePlan.rows.length > 0) {
      throw new Error('La matrícula ya tiene un plan de pagos');
    }

    // ======================================
    // VALIDAR CUOTAS
    // ======================================

    if (!Array.isArray(cuotas) || cuotas.length === 0) {
      throw new Error('Debe enviar al menos una cuota');
    }

    // ======================================
    // OBTENER CONCEPTOS
    // ======================================

    const conceptosRes = await client.query(`
      SELECT id, codigo
      FROM conceptos_cobro
    `);

    const conceptos = {};

    for (const c of conceptosRes.rows) {
      conceptos[c.codigo] = c.id;
    }

    // ======================================
    // CALCULAR DATOS
    // ======================================

    const cantidad_cuotas = cuotas.length;

    const monto_cuota = Number(
      (
        cuotas.reduce(
          (acc, item) => acc + Number(item.monto),
          0
        ) / cantidad_cuotas
      ).toFixed(2)
    );

    // ======================================
    // CREAR PLAN PAGO
    // ======================================

    const planPagoRes = await client.query(`
      INSERT INTO planes_pago_alumno (
        matricula_id,
        plan_precio_id,
        monto_total,
        monto_matricula,
        monto_certificacion,
        cantidad_cuotas,
        monto_cuota,
        nota_pago,
        modalidad_pago
      )
      VALUES (
        $1,
        NULL,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8
      )
      RETURNING *
    `, [
      matricula_id,
      monto_total,
      monto_matricula,
      monto_certificacion,
      cantidad_cuotas,
      monto_cuota,
      nota_pago,
      modalidad_pago
    ]);

    const planPago = planPagoRes.rows[0];

    // ======================================
    // CREAR MATRÍCULA
    // ======================================

    if (Number(monto_matricula) > 0) {

      await client.query(`
        INSERT INTO cuotas (
          plan_pago_alumno_id,
          numero_cuota,
          concepto_id,
          fecha_programada,
          fecha_vencimiento,
          monto_programado,
          monto_pagado,
          saldo_pendiente,
          estado,
          observaciones
        )
        VALUES (
          $1,
          0,
          $2,
          CURRENT_DATE,
          CURRENT_DATE,
          $3,
          0,
          $3,
          'PENDIENTE',
          'Pago de matrícula'
        )
      `, [
        planPago.id,
        conceptos['MATRICULA'],
        monto_matricula
      ]);

    }

    // ======================================
    // CREAR CUOTAS MANUALES
    // ======================================

    for (const cuota of cuotas) {

      await client.query(`
        INSERT INTO cuotas (
          plan_pago_alumno_id,
          numero_cuota,
          concepto_id,
          fecha_programada,
          fecha_vencimiento,
          monto_programado,
          monto_pagado,
          saldo_pendiente,
          estado,
          observaciones
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $4,
          $5,
          0,
          $5,
          'PENDIENTE',
          $6
        )
      `, [
        planPago.id,
        cuota.numero_cuota,
        conceptos['CUOTA'],
        cuota.fecha_vencimiento,
        cuota.monto,
        cuota.observaciones || `Cuota ${cuota.numero_cuota}`
      ]);

    }

    // ======================================
    // CREAR CERTIFICACIÓN
    // ======================================

    if (Number(monto_certificacion) > 0) {

      const ultimaFecha =
        cuotas[cuotas.length - 1].fecha_vencimiento;

      await client.query(`
        INSERT INTO cuotas (
          plan_pago_alumno_id,
          numero_cuota,
          concepto_id,
          fecha_programada,
          fecha_vencimiento,
          monto_programado,
          monto_pagado,
          saldo_pendiente,
          estado,
          observaciones
        )
        VALUES (
          $1,
          NULL,
          $2,
          $3,
          $3,
          $4,
          0,
          $4,
          'PENDIENTE',
          'Pago de certificación'
        )
      `, [
        planPago.id,
        conceptos['CERTIFICACION'],
        ultimaFecha,
        monto_certificacion
      ]);

    }

    await client.query('COMMIT');

    return {
      mensaje: 'Plan manual creado correctamente',
      plan_pago_alumno_id: planPago.id
    };

  } catch (err) {

    await client.query('ROLLBACK');
    throw err;

  } finally {

    client.release();

  }

}
module.exports = {
  listarMatriculas,
  obtenerMatriculaPorId,
  crearMatricula,
  obtenerEstadoPorCodigo,
  actualizarEstadoMatricula,
  actualizarMatricula,
  obtenerDetalleMatricula,
  listarMaquinasDeMatricula,
  obtenerResumenFinanzasMatricula,
  listarCuotasDeMatricula,
  procesarTodo,
  obtenerHistorial,
  crearPlanPagoManual
};
