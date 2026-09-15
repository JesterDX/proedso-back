const express = require('express');

const controller =
  require('../controllers/planes-curso.controller');

const router =
  express.Router();


// ============================================================
// LISTAR
// ============================================================

router.get(
  '/',
  controller.listar
);


// ============================================================
// OBTENER POR ID
// ============================================================

router.get(
  '/:id',
  controller.obtener
);


// ============================================================
// CREAR
// ============================================================

router.post(
  '/',
  controller.crear
);


// ============================================================
// ACTUALIZAR
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
