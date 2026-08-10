
const matriculasService = require('../services/matriculas.service');

const {
  previsualizarPlanPago
} = require('../services/matriculas.service');


// ==========================================================
// VALIDAR MATRÍCULA
// ==========================================================

function validarMatricula(body) {

  const errores = [];

  if (!body.alumno_id) {
    errores.push(
      'El alumno es obligatorio.'
    );
  }

  if (!body.plan_curso_id) {
    errores.push(
      'El plan de curso es obligatorio.'
    );
  }

  if (!body.estado_alumno_id) {
    errores.push(
      'El estado del alumno es obligatorio.'
    );
  }

  if (!body.fecha_matricula) {
    errores.push(
      'La fecha de matrícula es obligatoria.'
    );
  }

  return errores;
}


// ==========================================================
// OBTENER NOMBRE USUARIO
// ==========================================================

function obtenerNombreUsuario(req) {

  return req.user
    ? `${req.user.nombres || ''} ${req.user.apellidos || ''}`.trim()
    : 'sistema';

}


// ==========================================================
// ACTUALIZAR MATRÍCULA
// ==========================================================
async function actualizar(req, res) {

  try {

    const { id } = req.params;

    const errores =
      validarMatricula(req.body);

    if (errores.length > 0) {

      return res.status(400).json({
        ok: false,
        message: 'Datos inválidos.',
        errores
      });

    }

    const existente =
      await matriculasService.obtenerMatriculaPorId(id);

    if (!existente) {

      return res.status(404).json({
        ok: false,
        message: 'Matrícula no encontrada.'
      });

    }

    const actualizada =
      await matriculasService.actualizarMatricula(
        id,
        req.body,
        req.user
      );

    res.json({
      ok: true,
      message: 'Matrícula actualizada correctamente.',
      data: actualizada
    });

  } catch (error) {

    console.error(
      'Error al actualizar matrícula:',
      error
    );

    res.status(500).json({
      ok: false,
      message: error.message ||
        'Error al actualizar matrícula.'
    });

  }

}


// ==========================================================
// HISTORIAL
// ==========================================================

async function obtenerHistorial(req, res) {

  try {

    const { id } = req.params;

    const data =
      await matriculasService.obtenerHistorial(id);

    res.json({
      ok: true,
      data
    });

  } catch (error) {

    console.error(
      'Error al obtener historial:',
      error
    );

    res.status(500).json({
      ok: false,
      message: 'Error al obtener historial.'
    });

  }

}


// ==========================================================
// LISTAR MATRÍCULAS
// ==========================================================

async function listar(req, res) {

  try {

    const {
      estado,
      search,
      anio,
      mes
    } = req.query;

    const data =
      await matriculasService.listarMatriculas({
        estado:
          estado || null,

        search:
          search || '',

        anio:
          anio || null,

        mes:
          mes || null
      });

    res.json({
      ok: true,
      data
    });

  } catch (error) {

    console.error(
      'Error al listar matrículas:',
      error
    );

    res.status(500).json({
      ok: false,
      message: 'Error al listar matrículas.'
    });

  }

}


// ==========================================================
// OBTENER MATRÍCULA
// ==========================================================

async function obtenerPorId(req, res) {

  try {

    const { id } = req.params;

    const matricula =
      await matriculasService.obtenerMatriculaPorId(id);

    if (!matricula) {

      return res.status(404).json({
        ok: false,
        message: 'Matrícula no encontrada.'
      });

    }

    res.json({
      ok: true,
      data: matricula
    });

  } catch (error) {

    console.error(
      'Error al obtener matrícula:',
      error
    );

    res.status(500).json({
      ok: false,
      message: 'Error al obtener matrícula.'
    });

  }

}


// ==========================================================
// OBTENER DETALLE
// ==========================================================

async function obtenerDetalle(req, res) {

  try {

    const { id } = req.params;

    const detalle =
      await matriculasService.obtenerDetalleMatricula(id);

    if (!detalle) {

      return res.status(404).json({
        ok: false,
        message: 'Detalle de matrícula no encontrado.'
      });

    }

    res.json({
      ok: true,
      data: detalle
    });

  } catch (error) {

    console.error(
      'Error al obtener detalle de matrícula:',
      error
    );

    res.status(500).json({
      ok: false,
      message: 'Error al obtener detalle de matrícula.'
    });

  }

}


// ==========================================================
// CREAR MATRÍCULA
// ==========================================================

async function crear(req, res) {

  try {

    const errores =
      validarMatricula(req.body);

    if (errores.length > 0) {

      return res.status(400).json({
        ok: false,
        message: 'Datos inválidos.',
        errores
      });

    }

    /*
     * IMPORTANTE:
     *
     * req.body ahora puede incluir:
     *
     * cuotas_personalizadas
     *
     * El service será responsable de:
     *
     * 1. Crear matrícula.
     * 2. Crear máquinas.
     * 3. Crear cuotas.
     * 4. Crear certificación.
     * 5. Registrar historial.
     *
     * Todo dentro de una transacción.
     */

    const nueva =
      await matriculasService.crearMatricula(
        req.body,
        req.user
      );

    res.status(201).json({

      ok: true,

      message:
        'Matrícula creada correctamente.',

      data:
        nueva

    });

  } catch (error) {

    console.error(
      'Error al crear matrícula:',
      error
    );

    res.status(500).json({

      ok: false,

      message:
        error.message ||
        'Error al crear matrícula.'

    });

  }

}


// ==========================================================
// CAMBIAR ESTADO
// ==========================================================

async function cambiarEstado(req, res) {

  try {

    const { id } =
      req.params;

    const { codigo_estado } =
      req.body;

    if (
      !codigo_estado ||
      String(codigo_estado).trim() === ''
    ) {

      return res.status(400).json({

        ok: false,

        message:
          'El código de estado es obligatorio.'

      });

    }


    // ------------------------------------------------------
    // VERIFICAR MATRÍCULA
    // ------------------------------------------------------

    const matricula =
      await matriculasService.obtenerMatriculaPorId(
        id
      );

    if (!matricula) {

      return res.status(404).json({

        ok: false,

        message:
          'Matrícula no encontrada.'

      });

    }


    // ------------------------------------------------------
    // OBTENER ESTADO
    // ------------------------------------------------------

    const estado =
      await matriculasService.obtenerEstadoPorCodigo(
        codigo_estado
      );

    if (!estado) {

      return res.status(404).json({

        ok: false,

        message:
          'Estado no encontrado.'

      });

    }


    // ------------------------------------------------------
    // CAMBIAR ESTADO
    // ------------------------------------------------------

    const actualizada =
      await matriculasService.actualizarEstadoMatricula(
        id,
        estado.id,
        req.user
      );

    res.json({

      ok: true,

      message:
        `La matrícula ahora está en estado ${estado.nombre}.`,

      data:
        actualizada

    });

  } catch (error) {

    console.error(
      'Error al cambiar estado de matrícula:',
      error
    );

    res.status(500).json({

      ok: false,

      message:
        'Error al cambiar estado de matrícula.'

    });

  }

}


// ==========================================================
// LISTAR MÁQUINAS
// ==========================================================

async function listarMaquinas(req, res) {

  try {

    const { id } =
      req.params;

    const data =
      await matriculasService.listarMaquinasDeMatricula(
        id
      );

    res.json({

      ok: true,

      data

    });

  } catch (error) {

    console.error(
      'Error al listar máquinas de la matrícula:',
      error
    );

    res.status(500).json({

      ok: false,

      message:
        'Error al listar máquinas de la matrícula.'

    });

  }

}


// ==========================================================
// FINANZAS
// ==========================================================

async function obtenerFinanzas(req, res) {

  try {

    const { id } =
      req.params;

    const matricula =
      await matriculasService.obtenerMatriculaPorId(
        id
      );

    if (!matricula) {

      return res.status(404).json({

        ok: false,

        message:
          'Matrícula no encontrada.'

      });

    }

    const resumen =
      await matriculasService.obtenerResumenFinanzasMatricula(
        id
      );

    const cuotas =
      await matriculasService.listarCuotasDeMatricula(
        id
      );

    res.json({

      ok: true,

      data: {

        resumen,

        cuotas

      }

    });

  } catch (error) {

    console.error(
      'Error al obtener finanzas de matrícula:',
      error
    );

    res.status(500).json({

      ok: false,

      message:
        'Error al obtener finanzas de matrícula.'

    });

  }

}


// ==========================================================
// PREVISUALIZAR PLAN DE PAGOS
// ==========================================================

async function previsualizarPlanPagoController(
  req,
  res
) {

  try {

    /*
     * ------------------------------------------------------
     * VALIDACIÓN BÁSICA
     * ------------------------------------------------------
     */

    const {
      plan_curso_id,
      fecha_matricula
    } = req.body;


    if (!plan_curso_id) {

      return res.status(400).json({

        ok: false,

        message:
          'El plan de curso es obligatorio.'

      });

    }


    if (!fecha_matricula) {

      return res.status(400).json({

        ok: false,

        message:
          'La fecha de matrícula es obligatoria.'

      });

    }


    /*
     * ------------------------------------------------------
     * VALIDAR CUOTAS PERSONALIZADAS
     * ------------------------------------------------------
     *
     * Si vienen cuotas_personalizadas,
     * verificamos que tengan la estructura mínima.
     */
    console.log(
  '🟡 BODY PREVISUALIZACIÓN:',
  JSON.stringify(req.body, null, 2)
);

console.log(
  '🟡 cuotas_personalizadas:',
  req.body.cuotas_personalizadas
);

console.log(
  '🟡 tipo:',
  typeof req.body.cuotas_personalizadas
);

console.log(
  '🟡 esArray:',
  Array.isArray(req.body.cuotas_personalizadas)
);

    if (
      req.body.cuotas_personalizadas !== undefined
    ) {

      if (
        !Array.isArray(
          req.body.cuotas_personalizadas
        )
      ) {

        return res.status(400).json({

          ok: false,

          message:
            'cuotas_personalizadas debe ser un arreglo.'

        });

      }


      for (
        const cuota
        of req.body.cuotas_personalizadas
      ) {

        if (
          cuota.numero_cuota === undefined
        ) {

          return res.status(400).json({

            ok: false,

            message:
              'Cada cuota debe tener numero_cuota.'

          });

        }


        if (
          !cuota.fecha_vencimiento
        ) {

          return res.status(400).json({

            ok: false,

            message:
              `La cuota ${cuota.numero_cuota} debe tener fecha de vencimiento.`

          });

        }


        if (
          cuota.monto === undefined ||
          cuota.monto === null ||
          Number.isNaN(
            Number(cuota.monto)
          )
        ) {

          return res.status(400).json({

            ok: false,

            message:
              `La cuota ${cuota.numero_cuota} debe tener un monto válido.`

          });

        }


        if (
          Number(cuota.monto) < 0
        ) {

          return res.status(400).json({

            ok: false,

            message:
              `El monto de la cuota ${cuota.numero_cuota} no puede ser negativo.`

          });

        }

      }

    }


    /*
     * ------------------------------------------------------
     * PREVISUALIZAR
     * ------------------------------------------------------
     */

    const preview =
      await previsualizarPlanPago(
        req.body
      );


    return res.json({

      ok: true,

      data:
        preview

    });

  } catch (error) {

    console.error(
      'Error al previsualizar plan de pagos:',
      error
    );

    return res.status(400).json({

      ok: false,

      message:
        error.message ||
        'No se pudo calcular la previsualización del plan de pagos.'

    });

  }

}


// ==========================================================
// EXPORTS
// ==========================================================

module.exports = {

  listar,

  obtenerPorId,

  obtenerDetalle,

  crear,

  cambiarEstado,

  listarMaquinas,

  obtenerFinanzas,

  actualizar,

  obtenerHistorial,

  previsualizarPlanPagoController

};

