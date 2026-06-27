const express = require('express');
const controller = require('../controllers/tipos-curso.controller');

const router = express.Router();

router.get('/', controller.listar);
router.post('/', controller.crear);

module.exports = router;
