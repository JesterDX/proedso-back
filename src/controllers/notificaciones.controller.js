const {
  obtenerNotificacionesPagos
} = require('../services/notificaciones.service');


/**
 * =========================================================
 * GET /api/notificaciones/pagos
 * =========================================================
 */
async function listarNotificacionesPagos(req, res) {

  try {

    const data =
      await obtenerNotificacionesPagos();

    return res.status(200).json({

      ok: true,

      data

    });

  } catch (error) {

    console.error(
      'Error obteniendo notificaciones de pagos:',
      error
    );

    return res.status(500).json({

      ok: false,

      mensaje:
        'No se pudieron obtener las notificaciones de pagos.',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined

    });

  }

}


module.exports = {
  listarNotificacionesPagos
};
