const pagosService = require('../services/pagos.service');

async function listar(req, res) {
    try {
        const data = await pagosService.listarPagos(req.query);
        res.json(data);
    } catch (error) {
        console.error('❌ listar pagos:', error);
        res.status(500).json({ error: 'Error al listar pagos' });
    }
}

async function recalcularPlan(req, res) {
    try {
        const {
            plan_pago_alumno_id,
            tipo,
            fecha_inicio,
            cantidad_cuotas
        } = req.body;

        // 🔒 Validaciones
        if (!plan_pago_alumno_id) {
            return res.status(400).json({ error: 'plan_pago_alumno_id requerido' });
        }

        if (!['MENSUAL', 'QUINCENAL'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo inválido' });
        }

        if (!fecha_inicio) {
            return res.status(400).json({ error: 'fecha_inicio requerida' });
        }

        if (!cantidad_cuotas || cantidad_cuotas <= 0) {
            return res.status(400).json({ error: 'cantidad_cuotas inválida' });
        }

        const result = await pagosService.recalcularPlanPago({
            plan_pago_alumno_id,
            tipo,
            fecha_inicio,
            cantidad_cuotas
        });

        res.json(result);

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: err.message || 'Error al recalcular plan'
        });
    }
}
async function editarCuota(req, res) {

    try {

        const { cuota_id } = req.params;

        const {
            fecha_vencimiento,
            monto_programado
        } = req.body;

        const result = await pagosService.editarCuota({
            cuota_id,
            fecha_vencimiento,
            monto_programado
        });

        res.json(result);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message || 'Error al editar cuota'
        });
    }
}
async function resumen(req, res) {
    try {
        const data = await pagosService.listarResumenPagos();
        res.json(data);
    } catch (error) {
        console.error('❌ resumen pagos:', error);
        res.status(500).json({ error: 'Error al obtener resumen' });
    }
}

async function listarDetallePorMatricula(req, res) {
    try {
        const { id } = req.params;

        const data = await pagosService.listarPagos({
            matricula_id: id
        });

        res.json(data);
    } catch (error) {
        console.error('❌ detalle pagos:', error);
        res.status(500).json({ error: 'Error al obtener detalle de pagos' });
    }
}

async function historial(req, res) {
    try {
        const { id } = req.params;

        const data = await pagosService.obtenerHistorialPagos(id);
        res.json(data);

    } catch (error) {
        console.error('❌ historial pagos:', error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
}

async function registrar(req, res) {
    try {
        console.log('BODY:', req.body);
        console.log('FILE:', req.file);

        const { cuota_id, monto, metodo_pago } = req.body;

        if (!cuota_id || !monto) {
            return res.status(400).json({
                error: 'cuota_id y monto son obligatorios'
            });
        }

        const comprobante_url = req.file
            ? `/uploads/pagos/${req.file.filename}`
            : null;

        const pago = await pagosService.registrarPago({
            cuota_id: Number(cuota_id),
            monto: Number(monto),
            metodo_pago,
            comprobante_url
        });

        res.json(pago);

    } catch (err) {
        console.error('❌ registrar pago:', err);
        res.status(400).json({ error: err.message });
    }
}
async function generarPlan(req, res) {

    try {

        const {
            matricula_id,
            modalidad_pago
        } = req.body;

        if (!matricula_id) {
            return res.status(400).json({
                error: 'matricula_id requerido'
            });
        }

        const result = await pagosService.generarPlanPagoManual({
            matricula_id,
            modalidad_pago
        });

        res.json(result);

    } catch (err) {

        console.error('❌ generar plan:', err);

        res.status(500).json({
            error: err.message || 'Error al generar plan de pagos'
        });
    }
}

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

        const result = await pagosService.crearPlanPagoManual({
            matricula_id,
            modalidad_pago,
            monto_total,
            monto_matricula,
            monto_certificacion,
            cuotas,
            nota_pago
        });

        return res.status(201).json({
            ok: true,
            mensaje: 'Plan de pago manual creado correctamente',
            data: result
        });

    } catch (error) {

        console.error(error);

        return res.status(400).json({
            ok: false,
            mensaje: error.message || 'Error al crear plan manual'
        });

    }

}

async function actualizarFechas(req, res) {
    try {
        const cuotas = req.body; // Esto es el array que viene de Angular

        if (!Array.isArray(cuotas)) {
            return res.status(400).json({ error: 'Se esperaba un arreglo de cuotas' });
        }

        // Llamada al servicio
        const result = await pagosService.actualizarFechas(cuotas);

        res.json({
            ok: true,
            message: 'Fechas actualizadas correctamente',
            result
        });
    } catch (err) {
        console.error('❌ Error en controller actualizarFechas:', err);
        res.status(500).json({ error: err.message });
    }
}
const buscarMatriculas = async (req, res) => {
    try {
        const { search } = req.query;

        // Si no hay búsqueda o es muy corta, devolvemos un array vacío
        if (!search || search.length < 3) {
            return res.json([]);
        }

        // Llamamos a la función que YA tienes en tu pagos.service.js
        const data = await pagosService.buscarMatriculasParaPago(search);

        return res.json(data);

    } catch (error) {
        console.error('Error en buscarMatriculas:', error);
        return res.status(500).json({ error: 'Error al buscar matrículas' });
    }
};

module.exports = {
    listar,
    resumen,
    listarDetallePorMatricula,
    historial,
    registrar,
    recalcularPlan,
    editarCuota,
    generarPlan,
    crearPlanPagoManual,
    actualizarFechas,
    buscarMatriculas
};