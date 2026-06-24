const express = require('express');
const controller = require('../controllers/maquinas.controller');

const router = express.Router();

router.get('/', controller.listar);

module.exports = router;