const estadosAlumnoService = require('../services/estados-alumno.service');

async function listar(req, res) {
  try {
    const data = await estadosAlumnoService.listarEstadosAlumno();

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error al listar estados de alumno:', error);

    res.status(500).json({
      ok: false,
      message: 'Error al listar estados de alumno.'
    });
  }
}

module.exports = {
  listar
};