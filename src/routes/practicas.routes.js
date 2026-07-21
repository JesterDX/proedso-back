const express = require('express');
const router = express.Router();
const practicasController = require('../controllers/practicas.controller');

// ==========================================
// VALIDACIONES Y MATRÍCULAS
// ==========================================
router.get('/validar/:matriculaId', practicasController.validarPracticas);
router.get('/activas', practicasController.listarMatriculasActivas);
router.get('/ordenadas', practicasController.listarPracticasOrdenadas);
router.get('/alumnos-disponibles', practicasController.listarAlumnosDisponibles);

// ==========================================
// SESIONES GRUPALES (ESTÁTICAS PRIMERO)
// ==========================================
router.get('/sesiones-grupales/historial', practicasController.listarHistorialSesiones);
router.get('/sesion-grupal/ultima-pendiente', practicasController.obtenerUltimaPendiente); // 👈 Puesta antes del :id

router.post('/sesion-grupal', practicasController.crearSesionGrupal);

// ==========================================
// SESIONES GRUPALES (PARÁMETROS DINÁMICOS)
// ==========================================
router.get("/sesion-grupal/:id", practicasController.obtenerSesionGrupal);
router.put("/sesion-grupal/:id", practicasController.guardarDetalleSesionController);
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
