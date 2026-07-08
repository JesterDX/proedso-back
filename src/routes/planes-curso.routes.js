const express = require('express');
const controller = require('../controllers/planes-curso.controller');

const router = express.Router();
router.get('/', controller.listar);
router.get('/activos', controller.listarPlanesCursoActivos);
router.get('/:id', controller.obtenerPorId);

router.post('/', controller.crear);
router.put('/:id', controller.actualizar);
router.patch('/:id/estado', controller.cambiarEstado);

module.exports = router;
