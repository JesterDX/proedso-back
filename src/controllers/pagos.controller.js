
const pagosService = require('../services/pagos.service');

// =====================================================
// LISTAR PAGOS
// =====================================================

async function listar(req, res) {
    try {

        const data = await pagosService.listarPagos(req.query);

        res.json(data);

    } catch (error) {

        console.error('❌ listar pagos:', error);

        res.status(500).json({
            error: 'Error al listar pagos'
        });
    }
}


// =====================================================
// RESUMEN
// =====================================================

async function resumen(req, res) {
    try {

        const data = await pagosService.listarResumenPagos();

        res.json(data);

    } catch (error) {

        console.error('❌ resumen pagos:', error);

        res.status(500).json({
            error: 'Error al obtener resumen'
        });
    }
}


// =====================================================
// DETALLE POR MATRÍCULA
// =====================================================

async function listarDetallePorMatricula(req, res) {

    try {

        const { id } = req.params;

        const data = await pagosService.listarPagos({
            matricula_id: id
        });

        res.json(data);

    } catch (error) {

        console.error('❌ detalle pagos:', error);

        res.status(500).json({
            error: 'Error al obtener detalle de pagos'
        });
    }
}


// =====================================================
// HISTORIAL
// =====================================================

async function historial(req, res) {

    try {

        const { id } = req.params;

        const data =
            await pagosService.obtenerHistorialPagos(id);

        res.json(data);

    } catch (error) {

        console.error('❌ historial pagos:', error);

        res.status(500).json({
            error: 'Error al obtener historial'
        });
    }
}


// =====================================================
// REGISTRAR PAGO
// =====================================================

async function registrar(req, res) {

    try {

        const {
            cuota_id,
            monto,
            metodo_pago,
            numero_operacion,
            observaciones
        } = req.body;

        if (!cuota_id || !monto) {

            return res.status(400).json({
                error: 'cuota_id y monto son obligatorios'
            });
        }

        const comprobante_url = req.file
            ? `/uploads/pagos/${req.file.filename}`
            : null;

        const pago =
            await pagosService.registrarPago({

                cuota_id: Number(cuota_id),

                monto: Number(monto),

                metodo_pago,

                numero_operacion,

                comprobante_url,

                observaciones
            });

        res.status(201).json({

            ok: true,

            message: 'Pago registrado correctamente',

            data: pago
        });

    } catch (error) {

        console.error('❌ registrar pago:', error);

        res.status(400).json({

            ok: false,

            error: error.message
        });
    }
}


// =====================================================
// BUSCAR MATRÍCULAS
// =====================================================

async function buscarMatriculas(req, res) {

    try {

        const { search } = req.query;

        if (!search || search.length < 3) {

            return res.json([]);
        }

        const data =
            await pagosService.buscarMatriculasParaPago(search);

        res.json(data);

    } catch (error) {

        console.error('❌ buscar matrículas:', error);

        res.status(500).json({
            error: 'Error al buscar matrículas'
        });
    }
}


// =====================================================
// PREVISUALIZAR CAMBIO DE PLAN
// =====================================================

async function previsualizarCambioPlan(req, res) {

    try {

        const {
            matricula_id,
            nuevo_plan_precio_id,
            fecha_inicio,
            modalidad_pago
        } = req.body;


        if (!matricula_id) {

            return res.status(400).json({
                error: 'matricula_id requerido'
            });
        }


        if (!nuevo_plan_precio_id) {

            return res.status(400).json({
                error: 'nuevo_plan_precio_id requerido'
            });
        }


        const resultado =
            await pagosService.previsualizarCambioPlan({

                matricula_id,

                nuevo_plan_precio_id,

                fecha_inicio,

                modalidad_pago
            });


        res.json({

            ok: true,

            data: resultado
        });


    } catch (error) {

        console.error(
            '❌ previsualizar cambio plan:',
            error
        );


        res.status(400).json({

            ok: false,

            error: error.message
        });
    }
}


// =====================================================
// APLICAR CAMBIO DE PLAN
// =====================================================

async function cambiarPlan(req, res) {

    try {

        const {
            matricula_id,
            nuevo_plan_precio_id,
            fecha_inicio,
            modalidad_pago
        } = req.body;


        if (!matricula_id) {

            return res.status(400).json({
                error: 'matricula_id requerido'
            });
        }


        if (!nuevo_plan_precio_id) {

            return res.status(400).json({
                error: 'nuevo_plan_precio_id requerido'
            });
        }


        const resultado =
            await pagosService.cambiarPlan({

                matricula_id,

                nuevo_plan_precio_id,

                fecha_inicio,

                modalidad_pago
            });


        res.json({

            ok: true,

            message:
                'Cambio de plan aplicado correctamente',

            data: resultado
        });


    } catch (error) {

        console.error(
            '❌ cambiar plan:',
            error
        );


        res.status(400).json({

            ok: false,

            error: error.message
        });
    }
}


// =====================================================
// EDITAR CUOTA
// =====================================================

async function editarCuota(req, res) {

    try {

        const { cuota_id } = req.params;

        const {
            fecha_vencimiento,
            monto_programado
        } = req.body;


        if (!fecha_vencimiento) {

            return res.status(400).json({
                error: 'fecha_vencimiento requerida'
            });
        }


        if (
            monto_programado === undefined ||
            monto_programado === null
        ) {

            return res.status(400).json({
                error: 'monto_programado requerido'
            });
        }


        const result =
            await pagosService.editarCuota({

                cuota_id,

                fecha_vencimiento,

                monto_programado
            });


        res.json({

            ok: true,

            message:
                'Cuota actualizada correctamente',

            data: result
        });


    } catch (error) {

        console.error('❌ editar cuota:', error);

        res.status(400).json({

            ok: false,

            error: error.message
        });
    }
}


// =====================================================
// RECALCULAR PLAN
// =====================================================

async function recalcularPlan(req, res) {

    try {

        const {
            plan_pago_alumno_id,
            tipo,
            fecha_inicio,
            cantidad_cuotas
        } = req.body;


        if (!plan_pago_alumno_id) {

            return res.status(400).json({
                error: 'plan_pago_alumno_id requerido'
            });
        }


        if (
            !['MENSUAL', 'QUINCENAL'].includes(tipo)
        ) {

            return res.status(400).json({
                error: 'Tipo inválido'
            });
        }


        if (!fecha_inicio) {

            return res.status(400).json({
                error: 'fecha_inicio requerida'
            });
        }


        if (
            !cantidad_cuotas ||
            cantidad_cuotas <= 0
        ) {

            return res.status(400).json({
                error: 'cantidad_cuotas inválida'
            });
        }


        const result =
            await pagosService.recalcularPlanPago({

                plan_pago_alumno_id,

                tipo,

                fecha_inicio,

                cantidad_cuotas
            });


        res.json({

            ok: true,

            message:
                'Plan recalculado correctamente',

            data: result
        });


    } catch (error) {

        console.error(
            '❌ recalcular plan:',
            error
        );


        res.status(400).json({

            ok: false,

            error: error.message
        });
    }
}


// =====================================================
// CREAR PLAN MANUAL
// =====================================================

async function crearPlanPagoManual(req, res) {

    try {

        const {
            matricula_id,
            modalidad_pago,
            monto_total,
            monto_matricula,
            monto_certificacion,
            cuotas,
            nota_pago
        } = req.body;


        const result =
            await pagosService.crearPlanPagoManual({

                matricula_id,

                modalidad_pago,

                monto_total,

                monto_matricula,

                monto_certificacion,

                cuotas,

                nota_pago
            });


        res.status(201).json({

            ok: true,

            message:
                'Plan de pago manual creado correctamente',

            data: result
        });


    } catch (error) {

        console.error(
            '❌ crear plan manual:',
            error
        );


        res.status(400).json({

            ok: false,

            message:
                error.message ||
                'Error al crear plan manual'
        });
    }
}


// =====================================================
// ACTUALIZAR FECHAS
// =====================================================

async function actualizarFechas(req, res) {

    try {

        const cuotas = req.body;


        if (!Array.isArray(cuotas)) {

            return res.status(400).json({

                error:
                    'Se esperaba un arreglo de cuotas'
            });
        }


        const result =
            await pagosService.actualizarFechas(cuotas);


        res.json({

            ok: true,

            message:
                'Fechas actualizadas correctamente',

            result
        });


    } catch (error) {

        console.error(
            '❌ actualizar fechas:',
            error
        );


        res.status(400).json({

            ok: false,

            error: error.message
        });
    }
}


// =====================================================
// EDITAR PAGO
// =====================================================

async function editar(req, res) {

    try {

        const comprobante_url =
            req.file
                ? req.file.path
                : req.body.comprobante_url;


        const data =
            await pagosService.editarPago({

                pago_id: req.params.id,

                ...req.body,

                comprobante_url
            });


        res.json({

            ok: true,

            message:
                'Pago actualizado correctamente',

            data
        });


    } catch (error) {

        console.error(
            '❌ editar pago:',
            error
        );


        res.status(400).json({

            ok: false,

            message: error.message
        });
    }
}


// =====================================================
// ELIMINAR PAGO
// =====================================================

async function eliminar(req, res) {

    try {

        const data =
            await pagosService.eliminarPago(
                req.params.id
            );


        res.json({

            ok: true,

            message: data.mensaje
        });


    } catch (error) {

        console.error(
            '❌ eliminar pago:',
            error
        );


        res.status(400).json({

            ok: false,

            message:
                error.message ||
                'Error al eliminar pago'
        });
    }
}


module.exports = {

    listar,

    resumen,

    listarDetallePorMatricula,

    historial,

    registrar,

    buscarMatriculas,

    previsualizarCambioPlan,

    cambiarPlan,

    recalcularPlan,

    editarCuota,

    crearPlanPagoManual,

    actualizarFechas,

    editar,

    eliminar
};

