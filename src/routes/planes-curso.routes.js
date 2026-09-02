const express = require('express');
const controller = require('../controllers/planes-curso.controller');

const router = express.Router();

// ============================================================
// LISTAR PLANES DE CURSO
// ============================================================

router.get(
'/',
controller.listar
);

// ============================================================
// OBTENER PLAN DE CURSO POR ID
// ============================================================

router.get(
'/:id',
controller.obtener
);

// ============================================================
// CREAR PLAN DE CURSO
// ============================================================

router.post(
'/',
controller.crear
);

// ============================================================
// ACTUALIZAR PLAN DE CURSO
// ============================================================

router.put(
'/:id',
controller.actualizar
);

// ============================================================
// CAMBIAR ESTADO
// ============================================================

router.patch(
'/:id/estado',
controller.cambiarEstado
);

module.exports = router;
