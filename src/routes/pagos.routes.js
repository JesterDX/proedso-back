
const express = require('express');

const router = express.Router();

const pagosController =
    require('../controllers/pagos.controller');

const uploadPago =
    require('../middlewares/upload-pagos.middleware');


// =====================================================
// RUTAS ESPECÍFICAS
// =====================================================

// Resumen general
router.get(
    '/resumen',
    pagosController.resumen
);


// Buscar matrículas
router.get(
    '/buscar-matriculas',
    pagosController.buscarMatriculas
);


// =====================================================
// CAMBIO DE PLAN
// =====================================================

// Previsualizar cambio SIN modificar BD
router.post(
    '/previsualizar-cambio-plan',
    pagosController.previsualizarCambioPlan
);


// Aplicar cambio definitivamente
router.post(
    '/cambiar-plan',
    pagosController.cambiarPlan
);


// =====================================================
// RECALCULAR PLAN EXISTENTE
// =====================================================

router.post(
    '/recalcular-plan',
    pagosController.recalcularPlan
);


// =====================================================
// CREAR PLAN MANUAL
// =====================================================

router.post(
    '/manual',
    pagosController.crearPlanPagoManual
);


// =====================================================
// ACTUALIZAR FECHAS
// =====================================================

router.put(
    '/actualizar-fechas',
    pagosController.actualizarFechas
);


// =====================================================
// CUOTAS
// =====================================================

router.put(
    '/cuotas/:cuota_id',
    pagosController.editarCuota
);


// =====================================================
// PAGOS
// =====================================================

// Listar pagos
router.get(
    '/',
    pagosController.listar
);


// Registrar pago
router.post(
    '/',
    uploadPago.single('comprobante'),
    pagosController.registrar
);


// =====================================================
// HISTORIAL / DETALLE
// =====================================================

// Historial de pagos de una matrícula
router.get(
    '/:id/historial',
    pagosController.historial
);


// Detalle de cuotas de una matrícula
router.get(
    '/:id',
    pagosController.listarDetallePorMatricula
);


// =====================================================
// EDITAR / ELIMINAR PAGO
// =====================================================

router.put(
    '/:id',
    uploadPago.single('comprobante'),
    pagosController.editar
);


router.delete(
    '/:id',
    pagosController.eliminar
);


module.exports = router;

