const axios = require('axios');
const { parse } = require('csv-parse/sync');
const pool = require('../config/db');
const SHEETS_URL =
'https://docs.google.com/spreadsheets/d/1xd2NGCo5rYryrJrW-BXebbTxPL6DMOWHBCHjjVLXma0/export?format=csv&gid=0';


async function listarHomologaciones() {

    const result = await pool.query(`

        SELECT

            h.id,

            h.fecha_registro,

            h.tipo_homologacion,

            h.curso_equipo,

            h.vendedor,

            h.monto_total,

            h.monto_pagado,

            h.monto_indicado,

            h.saldo_pendiente,

            h.estado_pago,

            h.estado_documento,

            h.fecha_envio,

            h.estado,

            h.observaciones,

            h.observaciones_admin,

            a.id AS alumno_id,

            CONCAT(a.apellidos,' ',a.nombres) AS alumno,

            h.dni,

            h.celular

        FROM homologaciones h

        INNER JOIN alumnos a
            ON a.id = h.alumno_id

        ORDER BY h.fecha_registro DESC,
                 h.id DESC

    `);

    return result.rows;

}



async function obtenerHomologacion(id){

    const result = await pool.query(

        `

        SELECT

            h.*,

            CONCAT(a.apellidos,' ',a.nombres) AS alumno,

            a.nombres,

            a.apellidos,

            h.dni,

            h.celular

        FROM homologaciones h

        INNER JOIN alumnos a
            ON a.id = h.alumno_id

        WHERE h.id=$1

        `,

        [id]

    );

    if(result.rows.length===0){

        throw new Error("Homologación no encontrada.");

    }

    return result.rows[0];

}



async function crearHomologacion(data){

    const result = await pool.query(

        `

        INSERT INTO homologaciones(

            alumno_id,

            tipo_homologacion,

            monto_total,

            monto_pagado,

            monto_indicado,

            saldo_pendiente,

            estado,

            estado_pago,

            estado_documento,

            fecha_envio,

            vendedor,

            curso_equipo,

            observaciones,

            observaciones_admin,

            dni,

            celular

        )

        VALUES(

            $1,$2,$3,$4,$5,$6,

            $7,$8,$9,$10,$11,$12,

            $13,$14,$15,$16

        )

        RETURNING *

        `,

        [

            data.alumnoId,

            data.tipoHomologacion,

            data.montoTotal,

            data.montoPagado,

            data.montoIndicado,

            data.saldoPendiente,

            data.estado,

            data.estadoPago,

            data.estadoDocumento,

            data.fechaEnvio,

            data.vendedor,

            data.cursoEquipo,

            data.observaciones,

            data.observacionesAdmin,

            data.dni,

            data.celular

        ]

    );

    return result.rows[0];

}



async function actualizarEstado(id,data){

    const result = await pool.query(

        `

        UPDATE homologaciones

        SET

            estado=$1,

            estado_pago=$2,

            estado_documento=$3,

            monto_pagado=$4,

            saldo_pendiente=$5,

            fecha_envio=$6,

            observaciones=$7,

            observaciones_admin=$8

        WHERE id=$9

        RETURNING *

        `,

        [

            data.estado,

            data.estadoPago,

            data.estadoDocumento,

            data.montoPagado,

            data.saldoPendiente,

            data.fechaEnvio,

            data.observaciones,

            data.observacionesAdmin,

            id

        ]

    );

    return result.rows[0];

}



async function eliminarHomologacion(id){

    await pool.query(

        `

        DELETE FROM homologaciones

        WHERE id=$1

        `,

        [id]

    );

}

async function importarDesdeSheets(){

    let creados = 0;

    let actualizados = 0;

    let omitidos = 0;

    const errores = [];

    // descargar csv

    const respuesta = await axios.get(SHEETS_URL);

    const filas = parse(

        respuesta.data,

        {

            columns:true,

            skip_empty_lines:true

        }

    );

    console.log(

        'Filas encontradas:',

        filas.length

    );

    return {

        creados,

        actualizados,

        omitidos,

        errores,

        filas

    };

}

module.exports={

    listarHomologaciones,
    importarDesdeSheets,
    

    obtenerHomologacion,

    crearHomologacion,

    actualizarEstado,

    eliminarHomologacion

};
