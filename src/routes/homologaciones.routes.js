const express = require('express');

const router = express.Router();

const controller =
  require('../controllers/homologaciones.controller');


// ============================================================
// HOMOLOGACIONES
// ============================================================

// Listar
router.get(
  '/',
  controller.listar
);


// ============================================================
// GOOGLE SHEETS
// ============================================================

router.post(
  '/importar-sheets',
  controller.importarSheets
);


// ============================================================
// PAGOS
// ============================================================

// Listar pagos
router.get(
  '/:id/pagos',
  controller.listarPagos
);


// Registrar pago
router.post(
  '/:id/pagos',
  controller.registrarPago
);


// Eliminar pago
router.delete(
  '/pagos/:pagoId',
  controller.eliminarPago
);


// ============================================================
// HOMOLOGACIÓN INDIVIDUAL
// ============================================================

// Obtener
router.get(
  '/:id',
  controller.obtener
);


// Actualizar
router.put(
  '/:id',
  controller.actualizar
);


module.exports = router;
