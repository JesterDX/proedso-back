const express = require('express');
const controller = require('../controllers/maquinas.controller');

const router = express.Router();

router.get('/', controller.listar);
router.get('/todas', controller.listarTodas);

router.post('/', controller.crear);
router.put('/:id', controller.actualizar);
router.patch('/:id/estado', controller.cambiarEstado);
module.exports = router;
