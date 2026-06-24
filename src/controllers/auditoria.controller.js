const auditoriaService = require('../services/auditoria.service');

const listarGlobal = async (req, res) => {
  try {
    const data = await auditoriaService.listarAuditoriaGlobal(req.query);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener auditoría' });
  }
};

const porMatricula = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await auditoriaService.obtenerAuditoriaPorMatricula(id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener historial' });
  }
};

module.exports = {
  listarGlobal,
  porMatricula
};