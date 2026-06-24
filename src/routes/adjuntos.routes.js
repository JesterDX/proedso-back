const express = require('express');
const controller = require('../controllers/adjuntos.controller');
const uploadAdjunto = require('../middlewares/uploadAdjunto');

const router = express.Router();

router.get('/', controller.listar);
router.post('/', uploadAdjunto.single('archivo'), controller.subir);
router.delete('/:id', controller.eliminar);

module.exports = router;