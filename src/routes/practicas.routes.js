const express = require('express');
const router = express.Router();
const practicasController = require('../controllers/practicas.controller');

// 1. IMPORTAR EL MIDDLEWARE DE NUBE / ARCHIVOS
const uploadEvidencias = require('../middlewares/upload.middleware');

// ==========================================
// VALIDACIONES Y MATRÍCULAS
// ==========================================
router.get('/validar/:matriculaId', practicasController.validarPracticas);
router.get('/activas', practicasController.listarMatriculasActivas);
router.get('/ordenadas', practicasController.listarPracticasOrdenadas);
router.get('/alumnos-disponibles', practicasController.listarAlumnosDisponibles);
router.get(
  "/lugares-practica",
  practicasController.obtenerLugaresPractica
);
// ==========================================
// SESIONES GRUPALES (ESTÁTICAS PRIMERO)
// ==========================================
router.get('/sesiones-grupales/historial', practicasController.listarHistorialSesiones);
router.get('/sesion-grupal/ultima-pendiente', practicasController.obtenerUltimaPendiente);

router.post('/sesion-grupal', practicasController.crearSesionGrupal);

// ==========================================
// SESIONES GRUPALES (PARÁMETROS DINÁMICOS)
// ==========================================
router.get("/sesion-grupal/:id", practicasController.obtenerSesionGrupal);

// 2. AGREGAR uploadEvidencias.any() AQUÍ PARA PROCESAR EL FormData Y FOTOS
router.put(
  "/sesion-grupal/:id", 
  uploadEvidencias.any(), 
  practicasController.guardarDetalleSesionController
);

router.put("/sesiones-grupales/:id/cronograma", practicasController.guardarCronograma);

// ==========================================
// ASIGNACIONES Y DETALLES
// ==========================================
router.post('/asignaciones', practicasController.crearAsignacionPracticas);
router.get('/asignaciones', practicasController.listarAsignaciones);
router.get('/detalle/:matriculaId', practicasController.obtenerDetallePracticas);

// ==========================================
// SESIONES INDIVIDUALES / ASISTENCIA
// ==========================================
router.get('/sesiones/:asignacionId', practicasController.listarSesiones);
router.put('/sesiones/:sesionId/asistencia', practicasController.registrarAsistencia);

module.exports = router;
