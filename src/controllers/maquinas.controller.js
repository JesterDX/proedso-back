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

module.exports = {
  listar
};