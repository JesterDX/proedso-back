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

async function actualizar(req, res) {

  try {

    const data = await tiposCursoService.actualizarTipoCurso(
      req.params.id,
      req.body
    );

    res.json({
      ok: true,
      message: 'Tipo de curso actualizado correctamente.',
      data
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      ok: false,
      message: 'Error al actualizar el tipo de curso.'
    });

  }

}

async function cambiarEstado(req, res) {

  try {

    const data = await tiposCursoService.cambiarEstado(
      req.params.id,
      req.body.activo
    );

    res.json({
      ok: true,
      message: 'Estado actualizado correctamente.',
      data
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      ok: false,
      message: 'Error al cambiar el estado.'
    });

  }

}

module.exports = {
  listar,
  crear,
  actualizar,
  cambiarEstado
};
