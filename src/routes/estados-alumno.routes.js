const express = require('express');
const controller = require('../controllers/estados-alumno.controller');

const router = express.Router();

router.get('/', controller.listar);

module.exports = router;