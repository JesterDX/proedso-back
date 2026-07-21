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

router.get(
   '/alumnos-disponibles',
   practicasController.listarAlumnosDisponibles
);

router.post(
  '/sesion-grupal',
  practicasController.crearSesionGrupal
);
router.get('/sesion-grupal/ultima-pendiente', obtenerUltimaPendiente);
router.get(

  "/sesion-grupal/:id",

  practicasController.obtenerSesionGrupal

);

router.put(
  "/sesion-grupal/:id",
  practicasController.guardarDetalleSesionController
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
router.put(
    "/sesiones-grupales/:id/cronograma",
    practicasController.guardarCronograma
);
module.exports = router;
