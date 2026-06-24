const express = require('express');
const controller = require('../controllers/matriculas.controller');

// 1. Importamos tu middleware (verifica que la ruta apunte correctamente a tu archivo)
const authMiddleware = require('../middlewares/auth.middleware'); 

const router = express.Router();

// 2. Inyectamos "authMiddleware" como segundo parámetro en cada ruta

// --- RUTAS DE LECTURA (Protegidas para que solo usuarios con sesión vean datos) ---
router.get('/', authMiddleware, controller.listar);

router.get('/:id/detalle', authMiddleware, controller.obtenerDetalle);
router.get('/:id/maquinas', authMiddleware, controller.listarMaquinas);
router.get('/:id/finanzas', authMiddleware, controller.obtenerFinanzas);
router.get('/:id/historial', authMiddleware, controller.obtenerHistorial); 

router.get('/:id', authMiddleware, controller.obtenerPorId);

// --- RUTAS DE ESCRITURA (¡Las más importantes para arreglar tu historial!) ---
router.post('/', authMiddleware, controller.crear);
router.patch('/:id/estado', authMiddleware, controller.cambiarEstado);
router.put('/:id', authMiddleware, controller.actualizar);

module.exports = router;