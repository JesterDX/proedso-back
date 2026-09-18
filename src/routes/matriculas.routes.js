const express = require('express');
const controller = require('../controllers/matriculas.controller');

// Middleware de autenticación
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

// ======================================================
// RUTAS DE LECTURA
// ======================================================

router.get(
  '/',
  authMiddleware,
  controller.listar
);

router.post(
  '/previsualizar-cuotas',
  authMiddleware,
  controller.previsualizarPlanPagoController
);

router.get(
  '/:id/detalle',
  authMiddleware,
  controller.obtenerDetalle
);

router.get(
  '/:id/maquinas',
  authMiddleware,
  controller.listarMaquinas
);

router.get(
  '/:id/finanzas',
  authMiddleware,
  controller.obtenerFinanzas
);

router.get(
  '/:id/historial',
  authMiddleware,
  controller.obtenerHistorial
);

// ======================================================
// ELIMINAR MATRÍCULA COMPLETA
// ======================================================

router.delete(
  '/:id/completa',
  authMiddleware,
  controller.eliminarMatriculaCompleta
);

router.get(
  '/:id',
  authMiddleware,
  controller.obtenerPorId
);

// ======================================================
// RUTAS DE ESCRITURA
// ======================================================

router.post(
  '/',
  authMiddleware,
  controller.crear
);

router.patch(
  '/:id/estado',
  authMiddleware,
  controller.cambiarEstado
);

router.put(
  '/:id',
  authMiddleware,
  controller.actualizar
);

module.exports = router;
