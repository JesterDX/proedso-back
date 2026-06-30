const express = require('express');
const controller = require('../controllers/tipos-curso.controller');

const router = express.Router();

router.get('/', controller.listar);

router.post('/', controller.crear);

router.put('/:id', controller.actualizar);

router.patch('/:id/estado', controller.cambiarEstado);

module.exports = router;
