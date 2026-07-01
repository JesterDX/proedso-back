const express = require('express');
const controller = require('../controllers/planes-curso.controller');

const router = express.Router();

router.get('/', controller.listar);
router.get('/activos', controller.listarPlanesCursoActivos);
router.post('/', controller.crear);

module.exports = router;
