const express = require('express');

const router = express.Router();

const practicasController =
  require('../controllers/practicas.controller');

// ==========================================
// VALIDACIONES
// ==========================================
router.get(
  '/validar/:matriculaId',
  practicasController.validarPracticas
);

// ==========================================
// MATRÍCULAS
// ==========================================
router.get(
  '/activas',
  practicasController.listarMatriculasActivas
);

router.get(
  '/ordenadas',
  practicasController.listarPracticasOrdenadas
);

// ==========================================
// ASIGNACIONES
// ==========================================
router.post(
  '/asignaciones',
  practicasController.crearAsignacionPracticas
);

router.get(
  '/asignaciones',
  practicasController.listarAsignaciones
);
router.get(
  '/detalle/:matriculaId',
  practicasController.obtenerDetallePracticas
);

// ==========================================
// SESIONES
// ==========================================
router.get(
  '/sesiones/:asignacionId',
  practicasController.listarSesiones
);

router.put(
  '/sesiones/:sesionId/asistencia',
  practicasController.registrarAsistencia
);

module.exports = router;