const express = require('express');

const {
  listarNotificacionesPagos
} = require('../controllers/notificaciones.controller');

const router = express.Router();


/**
 * =========================================================
 * NOTIFICACIONES DE PAGOS
 * =========================================================
 *
 * GET /api/notificaciones/pagos
 *
 */
router.get(
  '/pagos',
  listarNotificacionesPagos
);


module.exports = router;
