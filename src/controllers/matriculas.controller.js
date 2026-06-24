const matriculasService = require('../services/matriculas.service');

function validarMatricula(body) {
  const errores = [];

  if (!body.alumno_id) errores.push('El alumno es obligatorio.');
  if (!body.plan_curso_id) errores.push('El plan de curso es obligatorio.');
  if (!body.estado_alumno_id) errores.push('El estado del alumno es obligatorio.');
  if (!body.fecha_matricula) errores.push('La fecha de matrícula es obligatoria.');

  return errores;
}
function obtenerNombreUsuario(req) {
  return req.user
    ? `${req.user.nombres || ''} ${req.user.apellidos || ''}`.trim()
    : 'sistema';
}

async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const errores = validarMatricula(req.body);

    if (errores.length > 0) {
      return res.status(400).json({ ok: false, message: 'Datos inválidos.', errores });
    }

    const existente = await matriculasService.obtenerMatriculaPorId(id);
    if (!existente) {
      return res.status(404).json({ ok: false, message: 'Matrícula no encontrada.' });
    }

    // PASO CORREGIDO: Extraemos el string del usuario y lo pasamos como 3er argumento
    const usuarioFormateado = obtenerNombreUsuario(req);
    const actualizada = await matriculasService.procesarTodo(id, req.body, req.user);

    res.json({ ok: true, message: 'Matrícula actualizada correctamente.', data: actualizada });
  } catch (error) {
    console.error('Error al actualizar matrícula:', error);
    res.status(500).json({ ok: false, message: 'Error al actualizar matrícula.' });
  }
}

async function obtenerHistorial(req, res) {
  try {
    const { id } = req.params;

    const data = await matriculasService.obtenerHistorial(id);

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al obtener historial.'
    });
  }
}

async function listar(req, res) {
  try {
    const { estado, search, anio, mes } = req.query;

    const data = await matriculasService.listarMatriculas({
      estado: estado || null,
      search: search || '',
      anio: anio || null,
      mes: mes || null
    });

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error al listar matrículas:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al listar matrículas.'
    });
  }
}
async function obtenerPorId(req, res) {
  try {
    const { id } = req.params;
    const matricula = await matriculasService.obtenerMatriculaPorId(id);

    if (!matricula) {
      return res.status(404).json({
        ok: false,
        message: 'Matrícula no encontrada.'
      });
    }

    res.json({
      ok: true,
      data: matricula
    });
  } catch (error) {
    console.error('Error al obtener matrícula:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al obtener matrícula.'
    });
  }
}

async function obtenerDetalle(req, res) {
  try {
    const { id } = req.params;
    const detalle = await matriculasService.obtenerDetalleMatricula(id);

    if (!detalle) {
      return res.status(404).json({
        ok: false,
        message: 'Detalle de matrícula no encontrado.'
      });
    }

    res.json({
      ok: true,
      data: detalle
    });
  } catch (error) {
    console.error('Error al obtener detalle de matrícula:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al obtener detalle de matrícula.'
    });
  }
}

async function crear(req, res) {
  try {
    const errores = validarMatricula(req.body);
    if (errores.length > 0) {
      return res.status(400).json({ ok: false, message: 'Datos inválidos.', errores });
    }

    // PASO CORREGIDO: Pasamos el usuario como 2do argumento, separado del body
    const usuarioFormateado = obtenerNombreUsuario(req);
    const nueva = await matriculasService.crearMatricula(req.body, req.user);
    res.status(201).json({ ok: true, message: 'Matrícula creada correctamente.', data: nueva });
  } catch (error) {
    console.error('Error al crear matrícula:', error);
    res.status(500).json({ ok: false, message: error.message || 'Error al crear matrícula.' });
  }
}

async function cambiarEstado(req, res) {
  try {
    const { id } = req.params;
    const { codigo_estado } = req.body;

    if (!codigo_estado || String(codigo_estado).trim() === '') {
      return res.status(400).json({ ok: false, message: 'El código de estado es obligatorio.' });
    }

    const matricula = await matriculasService.obtenerMatriculaPorId(id);
    if (!matricula) {
      return res.status(404).json({ ok: false, message: 'Matrícula no encontrada.' });
    }

    const estado = await matriculasService.obtenerEstadoPorCodigo(codigo_estado);
    if (!estado) {
      return res.status(404).json({ ok: false, message: 'Estado no encontrado.' });
    }

    // PASO CORREGIDO: Pasamos el usuario como 3er argumento explícito
    const usuarioFormateado = obtenerNombreUsuario(req);
    const actualizada = await matriculasService.procesarTodo(id, req.body, req.user);
    res.json({ ok: true, message: `La matrícula ahora está en estado ${estado.nombre}.`, data: actualizada });
  } catch (error) {
    console.error('Error al cambiar estado de matrícula:', error);
    res.status(500).json({ ok: false, message: 'Error al cambiar estado de matrícula.' });
  }
}
async function listarMaquinas(req, res) {
  try {
    const { id } = req.params;
    const data = await matriculasService.listarMaquinasDeMatricula(id);

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error al listar máquinas de la matrícula:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al listar máquinas de la matrícula.'
    });
  }
}
async function obtenerFinanzas(req, res) {
  try {
    const { id } = req.params;

    const matricula = await matriculasService.obtenerMatriculaPorId(id);

    if (!matricula) {
      return res.status(404).json({
        ok: false,
        message: 'Matrícula no encontrada.'
      });
    }

    const resumen = await matriculasService.obtenerResumenFinanzasMatricula(id);
    const cuotas = await matriculasService.listarCuotasDeMatricula(id);

    res.json({
      ok: true,
      data: {
        resumen,
        cuotas
      }
    });
  } catch (error) {
    console.error('Error al obtener finanzas de matrícula:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al obtener finanzas de matrícula.'
    });
  }
}

module.exports = {
  listar,
  obtenerPorId,
  obtenerDetalle,
  crear,
  cambiarEstado,
  listarMaquinas,
  obtenerFinanzas,
  actualizar,
  obtenerHistorial
};