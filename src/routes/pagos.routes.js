const express = require('express');
const router = express.Router();

const pagosController = require('../controllers/pagos.controller');
const uploadPago = require('../middlewares/upload-pagos.middleware');

router.get('/', pagosController.listar);
router.get('/resumen', pagosController.resumen);

router.get('/buscar-matriculas', pagosController.buscarMatriculas);

router.get('/:id/historial', pagosController.historial);
router.get('/:id', pagosController.listarDetallePorMatricula);

router.post('/', uploadPago.single('comprobante'), pagosController.registrar);
router.post('/recalcular-plan', pagosController.recalcularPlan);
router.post('/manual', pagosController.crearPlanPagoManual);
router.put('/cuotas/:cuota_id', pagosController.editarCuota);
router.put('/actualizar-fechas', pagosController.actualizarFechas);

module.exports = router;