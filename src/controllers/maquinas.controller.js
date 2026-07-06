const maquinasService = require('../services/maquinas.service');

async function listar(req, res) {
  try {
    const data = await maquinasService.listarMaquinas();

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error al listar máquinas:', error);

    res.status(500).json({
      ok: false,
      message: 'Error al listar máquinas.'
    });
  }
}

async function crear(req, res) {
  try {
    const data = await maquinasService.crearMaquina(req.body);

    res.status(201).json({
      ok: true,
      message: 'Máquina creada correctamente.',
      data
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: 'Error al crear máquina.'
    });
  }
}

async function actualizar(req, res) {
  try {
    const data = await maquinasService.actualizarMaquina(
      req.params.id,
      req.body
    );

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: 'Error al actualizar máquina.'
    });
  }
}

async function cambiarEstado(req, res) {
  try {
    const data = await maquinasService.cambiarEstadoMaquina(req.params.id);

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: 'Error al cambiar estado.'
    });
  }
}

module.exports = {
  listar,
  cambiarEstado,
  actualizar,
  crear
};
