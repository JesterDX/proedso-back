const express = require('express');

const router = express.Router();

const controller =
require('../controllers/homologaciones.controller');

// ==========================================
// LISTAR HOMOLOGACIONES
// ==========================================
router.get(

    '/',

    controller.listar

);

// ==========================================
// OBTENER POR ID
// ==========================================
router.get(

    '/:id',

    controller.obtener

);

// ==========================================
// CREAR
// ==========================================
router.post(

    '/',

    controller.crear

);

// ==========================================
// ACTUALIZAR
// ==========================================
router.put(

    '/:id',

    controller.actualizar

);

// ==========================================
// ELIMINAR
// ==========================================
router.delete(

    '/:id',

    controller.eliminar

);

module.exports = router;
