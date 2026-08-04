const express = require('express');

const router = express.Router();

const controller =
require('../controllers/homologacion-pagos.controller');

router.get(

    '/:id',

    controller.listar

);

router.post(

    '/:id',

    controller.crear

);

module.exports=router;
