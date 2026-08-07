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
            h.alumno,
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

            h.dni,
            h.celular

        FROM homologaciones h

        ORDER BY 
            h.fecha_registro DESC,
            h.id DESC

    `);

    return result.rows;

}





async function importarDesdeSheets() {


    let creados = 0;
    let actualizados = 0;
    let omitidos = 0;

    const errores = [];


    const respuesta = await axios.get(SHEETS_URL);



    const filas = parse(respuesta.data,{
        columns:true,
        skip_empty_lines:true
    });





const omitidosDetalle = [];

for (const row of filas) {

    try {

        const dni = String(row["DNI"] ?? "").trim();

        const alumno = String(
            row["APELLIDOS Y NOMBRES"] ?? ""
        ).trim();

        const curso = String(
            row["Curso/ Equipos "] ??
            row["Curso/ Equipos"] ??
            ""
        ).trim();

        if (!dni || !curso) {

            omitidos++;

            omitidosDetalle.push({
                dni,
                curso,
                motivo: "DNI o Curso vacío"
            });

            console.log(
                `⏭ Omitido ${dni} - DNI o Curso vacío`
            );

            continue;

        }

        //=========================
        // FECHA
        //=========================

        let fechaRegistro = null;

        const fechaTexto = String(
            row["FECHA "] ??
            row["FECHA"] ??
            ""
        ).trim();

        if (fechaTexto) {

            if (fechaTexto.includes("/")) {

                const partes = fechaTexto.split("/");

                if (partes.length === 3) {

                    fechaRegistro =
                        `${partes[2]}-${partes[1]}-${partes[0]}`;

                }

            }

        }

        //=========================
        // MONTOS
        //=========================

        const montoIndicado = Number(
            String(row["MONTO INDICADO"] ?? "0")
                .replace(/\./g, "")
                .replace(",", ".")
        ) || 0;

        const montoCancelado = Number(
            String(row["MONTO CANCELADO"] ?? "0")
                .replace(/\./g, "")
                .replace(",", ".")
        ) || 0;

        const saldo = Number(
            String(row["SALDO PENDIENTE"] ?? "0")
                .replace(/\./g, "")
                .replace(",", ".")
        ) || 0;

        const existe = await pool.query(
            `
            SELECT id
            FROM homologaciones
            WHERE dni=$1
            AND curso_equipo=$2
            `,
            [dni, curso]
        );

        if (existe.rows.length > 0) {

            await pool.query(
                `
                UPDATE homologaciones
                SET
                    alumno=$1,
                    fecha_registro=$2,
                    vendedor=$3,
                    celular=$4,
                    monto_total=$5,
                    monto_pagado=$6,
                    monto_indicado=$7,
                    saldo_pendiente=$8,
                    estado_pago=$9,
                    estado_documento=$10,
                    observaciones=$11,
                    observaciones_admin=$12
                WHERE id=$13
                `,
                [
                    alumno,
                    fechaRegistro,
                    row["Vendedor"] || "",
                    row["CELULAR"] || "",
                    montoIndicado,
                    montoCancelado,
                    montoIndicado,
                    saldo,
                    row["ESTADO DE PAGO"] || "",
                    row["ESTADO DEL DOCUMENTO"] || "",
                    row["OBSERVACIONES"] || "",
                    row["OBSERVACIONES ADMIN"] || "",
                    existe.rows[0].id
                ]
            );

            actualizados++;

            console.log(`↻ Actualizado ${dni}`);

        } else {

            await pool.query(
                `
                INSERT INTO homologaciones
                (
                    alumno,
                    alumno_id,
                    tipo_homologacion,
                    monto_total,
                    monto_pagado,
                    fecha_registro,
                    estado,
                    observaciones,
                    dni,
                    celular,
                    vendedor,
                    curso_equipo,
                    monto_indicado,
                    saldo_pendiente,
                    estado_pago,
                    estado_documento,
                    fecha_envio,
                    observaciones_admin
                )
                VALUES
                (
                    $1,
                    NULL,
                    'INDIVIDUAL',
                    $2,
                    $3,
                    $4,
                    'REGISTRADO',
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11,
                    $12,
                    $13,
                    NULL,
                    $14
                )
                `,
                [
                    alumno,
                    montoIndicado,
                    montoCancelado,
                    fechaRegistro,
                    row["OBSERVACIONES"] || "",
                    dni,
                    row["CELULAR"] || "",
                    row["Vendedor"] || "",
                    curso,
                    montoIndicado,
                    saldo,
                    row["ESTADO DE PAGO"] || "",
                    row["ESTADO DEL DOCUMENTO"] || "",
                    row["OBSERVACIONES ADMIN"] || ""
                ]
            );

            creados++;

            console.log(`✓ Creado ${dni}`);

        }

    } catch (err) {

        errores.push({
            dni: row["DNI"],
            mensaje: err.message
        });

        console.log(
            `❌ Error ${row["DNI"]}: ${err.message}`
        );

    }

}


return {

    ok: true,

    creados,

    actualizados,

    omitidos,

    omitidosDetalle,

    errores

};


}






module.exports={

    listarHomologaciones,

    importarDesdeSheets

};
