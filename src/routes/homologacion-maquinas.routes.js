const express = require('express');

const router = express.Router();

const controller =
require('../controllers/homologacion-maquinas.controller');

router.get(

    '/:id',

    controller.listar

);

router.post(

    '/:id',

    controller.crear

);

router.delete(

    '/:id',

    controller.eliminar

);

module.exports = router;
