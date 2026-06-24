const alumnosService = require('../services/alumnos.service');

function validarAlumno(body) {
  const errores = [];

  if (!body.dni || String(body.dni).trim() === '') {
    errores.push('El DNI es obligatorio.');
  }

  if (!body.nombres || String(body.nombres).trim() === '') {
    errores.push('Los nombres son obligatorios.');
  }

  if (!body.apellidos || String(body.apellidos).trim() === '') {
    errores.push('Los apellidos son obligatorios.');
  }

  if (!body.seguro_alumno || String(body.seguro_alumno).trim() === '') {
    errores.push('Debes indicar si el alumno tiene seguro.');
  }

  if (!body.anio_ingreso || String(body.anio_ingreso).trim() === '') {
    errores.push('El año de ingreso es obligatorio.');
  }

  if (!body.mes_ingreso || String(body.mes_ingreso).trim() === '') {
    errores.push('El mes de ingreso es obligatorio.');
  }

  return errores;
}

async function listar(req, res) {
  try {
    const {
      search = '',
      activos = 'true',
      anio = '',
      mes = ''
    } = req.query;

    const data = await alumnosService.listarAlumnos({
      search,
      activos: activos === 'true',
      anio: anio || null,
      mes: mes || null
    });

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error al listar alumnos:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al listar alumnos.'
    });
  }
}

async function obtenerPorId(req, res) {
  try {
    const { id } = req.params;
    const alumno = await alumnosService.obtenerAlumnoPorId(id);

    if (!alumno) {
      return res.status(404).json({
        ok: false,
        message: 'Alumno no encontrado.'
      });
    }

    res.json({
      ok: true,
      data: alumno
    });
  } catch (error) {
    console.error('Error al obtener alumno:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al obtener alumno.'
    });
  }
}

async function crear(req, res) {
  try {
    const errores = validarAlumno(req.body);

    if (errores.length > 0) {
      return res.status(400).json({
        ok: false,
        message: 'Datos inválidos.',
        errores
      });
    }

    let foto_url = null;

    if (req.file) {
      foto_url = `/uploads/alumnos/${req.file.filename}`;
    }

    const nuevo = await alumnosService.crearAlumno({
      ...req.body,
      foto_url
    });

    res.status(201).json({
      ok: true,
      message: 'Alumno creado correctamente.',
      data: nuevo
    });
  } catch (error) {
    console.error('Error al crear alumno:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe un alumno con ese DNI.'
      });
    }

    res.status(500).json({
      ok: false,
      message: error.message || 'Error al crear alumno.'
    });
  }
}

async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const errores = validarAlumno(req.body);

    if (errores.length > 0) {
      return res.status(400).json({
        ok: false,
        message: 'Datos inválidos.',
        errores
      });
    }

    let foto_url = req.body.foto_url || null;

    if (req.file) {
      foto_url = `/uploads/alumnos/${req.file.filename}`;
    }

    const actualizado = await alumnosService.actualizarAlumno(id, {
      ...req.body,
      foto_url
    });

    if (!actualizado) {
      return res.status(404).json({
        ok: false,
        message: 'Alumno no encontrado.'
      });
    }

    res.json({
      ok: true,
      message: 'Alumno actualizado correctamente.',
      data: actualizado
    });
  } catch (error) {
    console.error('Error al actualizar alumno:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe un alumno con ese DNI.'
      });
    }

    res.status(500).json({
      ok: false,
      message: error.message || 'Error al actualizar alumno.'
    });
  }
}

async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const eliminado = await alumnosService.eliminarAlumnoLogico(id);

    if (!eliminado) {
      return res.status(404).json({
        ok: false,
        message: 'Alumno no encontrado.'
      });
    }

    res.json({
      ok: true,
      message: 'Alumno desactivado correctamente.',
      data: eliminado
    });
  } catch (error) {
    console.error('Error al eliminar alumno:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al eliminar alumno.'
    });
  }
}

async function reactivar(req, res) {
  try {
    const { id } = req.params;
    const alumno = await alumnosService.reactivarAlumno(id);

    if (!alumno) {
      return res.status(404).json({
        ok: false,
        message: 'Alumno no encontrado.'
      });
    }

    res.json({
      ok: true,
      message: 'Alumno reactivado correctamente.',
      data: alumno
    });
  } catch (error) {
    console.error('Error al reactivar alumno:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al reactivar alumno.'
    });
  }
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  reactivar
};