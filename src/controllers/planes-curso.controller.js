const planesCursoService = require('../services/planes-curso.service');

async function listar(req, res) {
  try {
    const data = await planesCursoService.listarPlanesCurso();

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error al listar planes de curso:', error);

    res.status(500).json({
      ok: false,
      message: 'Error al listar planes de curso.'
    });
  }
}

module.exports = {
  listar
};