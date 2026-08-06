const express = require('express');
const router = express.Router();

const controller = require('../controllers/homologaciones.controller');

router.get('/', controller.listar);

router.post(
    '/importar-sheets',
    controller.importarSheets
);

router.get('/:id', controller.obtener);

router.post('/', controller.crear);

router.put('/:id', controller.actualizar);

router.delete('/:id', controller.eliminar);

module.exports = router;
