const express = require('express');
const router = express.Router();
const controller = require('../controllers/auditoria.controller');

// 🔥 auditoría global (panel PRO)
router.get('/', controller.listarGlobal);

// 🔥 auditoría por matrícula
router.get('/matricula/:id', controller.porMatricula);

module.exports = router;