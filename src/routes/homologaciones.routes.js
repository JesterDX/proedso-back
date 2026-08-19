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


// Obtener una
router.get(
  '/:id',
  controller.obtener
);


// Actualizar directamente desde tabla
router.put(
  '/:id',
  controller.actualizar
);


// ============================================================
// PAGOS
// ============================================================

// Listar pagos de una homologación
router.get(
  '/:id/pagos',
  controller.listarPagos
);


// Registrar pago + información de boleta
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
// GOOGLE SHEETS
// ============================================================

router.post(
  '/importar-sheets',
  controller.importarSheets
);


module.exports = router;
