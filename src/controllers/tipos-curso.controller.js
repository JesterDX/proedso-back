const tiposCursoService = require('../services/tipos-curso.service');

async function listar(req, res) {
  try {

    const data = await tiposCursoService.listarTiposCurso();

    res.json({
      ok: true,
      data
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      ok: false,
      message: 'Error al listar los tipos de curso.'
    });

  }
}

async function crear(req, res) {
  try {

    const data = await tiposCursoService.crearTipoCurso(req.body);

    res.status(201).json({
      ok: true,
      message: 'Tipo de curso creado correctamente.',
      data
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      ok: false,
      message: 'Error al crear el tipo de curso.'
    });

  }
}

module.exports = {
  listar,
  crear
};
