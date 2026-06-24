const adjuntosService = require('../services/adjuntos.service');

async function listar(req, res) {
    try {
        const { modulo, registro_id } = req.query;

        if (!modulo || !registro_id) {
            return res.status(400).json({
                ok: false,
                message: 'modulo y registro_id son obligatorios.'
            });
        }

        const data = await adjuntosService.listarAdjuntos({
            modulo,
            registro_id: Number(registro_id)
        });

        res.json({
            ok: true,
            data
        });
    } catch (error) {
        console.error('Error al listar adjuntos:', error);
        res.status(500).json({
            ok: false,
            message: 'Error al listar adjuntos.'
        });
    }
}

async function eliminar(req, res) {
    try {
        const { id } = req.params;

        const eliminado = await adjuntosService.eliminarAdjunto(id);

        if (!eliminado) {
            return res.status(404).json({
                ok: false,
                message: 'Archivo no encontrado.'
            });
        }

        res.json({
            ok: true,
            message: 'Archivo eliminado correctamente.'
        });
    } catch (error) {
        console.error('Error al eliminar adjunto:', error);
        res.status(500).json({
            ok: false,
            message: 'Error al eliminar archivo.'
        });
    }
}

async function subir(req, res) {
    try {
        const { modulo, registro_id, tipo_archivo, observaciones } = req.body;

        if (!modulo || String(modulo).trim() === '') {
            return res.status(400).json({
                ok: false,
                message: 'El módulo es obligatorio.'
            });
        }

        if (!registro_id) {
            return res.status(400).json({
                ok: false,
                message: 'El registro_id es obligatorio.'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                ok: false,
                message: 'Debes adjuntar un archivo.'
            });
        }

        const nombreArchivoCorregido = Buffer
            .from(req.file.originalname, 'latin1')
            .toString('utf8');

        const url_archivo = `/uploads/documentos/${String(modulo).trim().toLowerCase()}/${req.file.filename}`;

        const nuevo = await adjuntosService.crearAdjunto({
            modulo: String(modulo).trim().toLowerCase(),
            registro_id: Number(registro_id),
            tipo_archivo,
            nombre_archivo: nombreArchivoCorregido,
            url_archivo,
            observaciones
        });

        res.status(201).json({
            ok: true,
            message: 'Archivo subido correctamente.',
            data: nuevo
        });
    } catch (error) {
        console.error('Error al subir adjunto:', error);
        res.status(500).json({
            ok: false,
            message: 'Error al subir adjunto.'
        });
    }
}

module.exports = {
    listar,
    subir,
    eliminar
};