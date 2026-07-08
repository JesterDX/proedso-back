const express = require('express');
const router = express.Router();

const pagosController = require('../controllers/pagos.controller');
const uploadPago = require('../middlewares/upload-pagos.middleware');


// ===============================
// RUTAS ESPECÍFICAS
// ===============================

router.get('/resumen', pagosController.resumen);

router.get('/buscar-matriculas', pagosController.buscarMatriculas);

router.post('/recalcular-plan', pagosController.recalcularPlan);

router.post('/manual', pagosController.crearPlanPagoManual);

router.put('/actualizar-fechas', pagosController.actualizarFechas);


// ===============================
// CUOTAS
// ===============================

router.put(
  '/cuotas/:cuota_id',
  pagosController.editarCuota
);


// ===============================
// PAGOS
// ===============================

router.get('/', pagosController.listar);

router.post(
  '/',
  uploadPago.single('comprobante'),
  pagosController.registrar
);


// ===============================
// HISTORIAL / DETALLE
// ===============================

router.get(
  '/:id/historial',
  pagosController.historial
);

router.get(
  '/:id',
  pagosController.listarDetallePorMatricula
);


// ===============================
// EDITAR / ELIMINAR PAGO
// ===============================

router.put(
  '/:id',
  pagosController.editar
);

router.delete(
  '/:id',
  pagosController.eliminar
);


module.exports = router;
