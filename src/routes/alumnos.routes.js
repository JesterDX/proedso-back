const express = require('express');
const controller = require('../controllers/alumnos.controller');
const uploadAlumnoFoto = require('../middlewares/uploadAlumnoFoto');

const router = express.Router();

router.get('/', controller.listar);
router.get('/:id', controller.obtenerPorId);
router.post('/', uploadAlumnoFoto.single('foto'), controller.crear);
router.put('/:id', uploadAlumnoFoto.single('foto'), controller.actualizar);
router.patch('/:id/reactivar', controller.reactivar);
router.delete('/:id', controller.eliminar);

module.exports = router;