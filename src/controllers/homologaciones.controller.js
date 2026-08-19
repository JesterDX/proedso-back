const service =
  require('../services/homologaciones-service');


// ============================================================
// IMPORTAR DESDE GOOGLE SHEETS
// POST /api/homologaciones/importar-sheets
// ============================================================

async function importarSheets(req, res) {

  try {

    const data =
      await service.importarDesdeSheets();


    res.json({

      ok: true,

      ...data

    });

  }
  catch (error) {

    console.error(
      'Error importando homologaciones:',
      error
    );


    res.status(500).json({

      ok: false,

      message:
        error.message ||
        'Error al importar homologaciones.'

    });

  }

}


// ============================================================
// LISTAR HOMOLOGACIONES
// GET /api/homologaciones
// ============================================================

async function listar(req, res) {

  try {

    const data =
      await service.listarHomologaciones();


    res.json({

      ok: true,

      data

    });

  }
  catch (error) {

    console.error(
      'Error listando homologaciones:',
      error
    );


    res.status(500).json({

      ok: false,

      message:
        error.message ||
        'Error al listar homologaciones.'

    });

  }

}


// ============================================================
// OBTENER HOMOLOGACIÓN
// GET /api/homologaciones/:id
// ============================================================

async function obtener(req, res) {

  try {

    const id =
      Number(req.params.id);


    if (!Number.isInteger(id) || id <= 0) {

      return res.status(400).json({

        ok: false,

        message:
          'El ID de la homologación no es válido.'

      });

    }


    const data =
      await service.obtenerHomologacion(
        id
      );


    return res.json({

      ok: true,

      data

    });

  }
  catch (error) {

    console.error(
      'Error obteniendo homologación:',
      error
    );


    const status =
      error.message ===
      'Homologación no encontrada.'
        ? 404
        : 500;


    return res.status(status).json({

      ok: false,

      message:
        error.message ||
        'Error al obtener homologación.'

    });

  }

}


// ============================================================
// ACTUALIZAR HOMOLOGACIÓN
// PUT /api/homologaciones/:id
// ============================================================

async function actualizar(req, res) {

  try {

    const id =
      Number(req.params.id);


    if (!Number.isInteger(id) || id <= 0) {

      return res.status(400).json({

        ok: false,

        message:
          'El ID de la homologación no es válido.'

      });

    }


    if (
      !req.body ||
      typeof req.body !== 'object'
    ) {

      return res.status(400).json({

        ok: false,

        message:
          'No se recibieron datos para actualizar.'

      });

    }


    const data =
      await service.actualizarHomologacion(

        id,

        req.body

      );


    return res.json({

      ok: true,

      message:
        'Homologación actualizada correctamente.',

      data

    });

  }
  catch (error) {

    console.error(
      'Error actualizando homologación:',
      error
    );


    const status =
      error.message ===
      'Homologación no encontrada.'
        ? 404
        : 400;


    return res.status(status).json({

      ok: false,

      message:
        error.message ||
        'Error al actualizar homologación.'

    });

  }

}


// ============================================================
// REGISTRAR PAGO
// POST /api/homologaciones/:id/pagos
// ============================================================

async function registrarPago(req, res) {

  try {

    const homologacionId =
      Number(req.params.id);


    if (
      !Number.isInteger(homologacionId) ||
      homologacionId <= 0
    ) {

      return res.status(400).json({

        ok: false,

        message:
          'El ID de la homologación no es válido.'

      });

    }


    if (
      !req.body ||
      typeof req.body !== 'object'
    ) {

      return res.status(400).json({

        ok: false,

        message:
          'No se recibieron los datos del pago.'

      });

    }


    const data =
      await service.registrarPago(

        homologacionId,

        req.body

      );


    return res.status(201).json({

      ok: true,

      message:
        'Pago registrado correctamente.',

      data

    });

  }
  catch (error) {

    console.error(
      'Error registrando pago:',
      error
    );


    const mensaje =
      error.message ||
      'Error al registrar el pago.';


    let status = 400;


    if (
      mensaje ===
      'Homologación no encontrada.'
    ) {

      status = 404;

    }


    return res.status(status).json({

      ok: false,

      message: mensaje

    });

  }

}


// ============================================================
// LISTAR PAGOS
// GET /api/homologaciones/:id/pagos
// ============================================================

async function listarPagos(req, res) {

  try {

    const homologacionId =
      Number(req.params.id);


    if (
      !Number.isInteger(homologacionId) ||
      homologacionId <= 0
    ) {

      return res.status(400).json({

        ok: false,

        message:
          'El ID de la homologación no es válido.'

      });

    }


    const data =
      await service.listarPagos(

        homologacionId

      );


    return res.json({

      ok: true,

      data

    });

  }
  catch (error) {

    console.error(
      'Error listando pagos:',
      error
    );


    return res.status(500).json({

      ok: false,

      message:
        error.message ||
        'Error al listar pagos.'

    });

  }

}


// ============================================================
// ELIMINAR PAGO
// DELETE /api/homologaciones/pagos/:pagoId
// ============================================================

async function eliminarPago(req, res) {

  try {

    const pagoId =
      Number(req.params.pagoId);


    if (
      !Number.isInteger(pagoId) ||
      pagoId <= 0
    ) {

      return res.status(400).json({

        ok: false,

        message:
          'El ID del pago no es válido.'

      });

    }


    await service.eliminarPago(

      pagoId

    );


    return res.json({

      ok: true,

      message:
        'Pago eliminado correctamente.'

    });

  }
  catch (error) {

    console.error(
      'Error eliminando pago:',
      error
    );


    const status =
      error.message ===
      'Pago no encontrado.'
        ? 404
        : 400;


    return res.status(status).json({

      ok: false,

      message:
        error.message ||
        'Error al eliminar pago.'

    });

  }

}


// ============================================================
// EXPORTAR CONTROLLER
// ============================================================

module.exports = {

  importarSheets,

  listar,

  obtener,

  actualizar,

  registrarPago,

  listarPagos,

  eliminarPago

};
