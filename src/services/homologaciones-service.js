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
    const omitidosDetalle = [];

    const respuesta = await axios.get(SHEETS_URL);

    const filas = parse(respuesta.data,{
        columns:true,
        skip_empty_lines:true
    });

    for (const row of filas) {

        try {

            const googleId = Number(row["ID"]);

            const dni = String(row["DNI"] ?? "").trim();

            const alumno = String(
                row["APELLIDOS Y NOMBRES"] ?? ""
            ).trim();

            const curso = String(
                row["Curso/ Equipos "] ??
                row["Curso/ Equipos"] ??
                ""
            ).trim();

            if (!googleId || !dni || !curso) {

                omitidos++;

                omitidosDetalle.push({
                    googleId,
                    dni,
                    curso,
                    motivo: "ID, DNI o Curso vacío"
                });

                console.log(
                    `⏭ Omitido ID ${googleId} - Datos incompletos`
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
                else if (!isNaN(Number(fechaTexto))) {

                    const excelDate = Number(fechaTexto);
                    
                    const ms = (excelDate - 25569) * 86400 * 1000;
                    
                    const date = new Date(ms);
                    
                    fechaRegistro =
                    `${date.getUTCFullYear()}-${
                    String(date.getUTCMonth()+1).padStart(2,"0")
                    }-${
                    String(date.getUTCDate()).padStart(2,"0")
                    }`;

                }

            }

            //=========================
            // MONTOS
            //=========================

            const montoIndicado = Number(
                String(row["MONTO INDICADO"] ?? "0")
                    .replace(/\./g,"")
                    .replace(",",".")
            ) || 0;

            const montoCancelado = Number(
                String(row["MONTO CANCELADO"] ?? "0")
                    .replace(/\./g,"")
                    .replace(",",".")
            ) || 0;

            const saldo = Number(
                String(row["SALDO PENDIENTE"] ?? "0")
                    .replace(/\./g,"")
                    .replace(",",".")
            ) || 0;

            //=========================
            // BUSCAR POR GOOGLE ID
            //=========================

            const existe = await pool.query(

                `
                SELECT id
                FROM homologaciones
                WHERE google_id=$1
                `,

                [googleId]

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
                        observaciones_admin=$12,

                        dni=$13,
                        curso_equipo=$14

                    WHERE google_id=$15
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

                        dni,
                        curso,

                        googleId

                    ]

                );

                actualizados++;

                console.log(`↻ Actualizado GoogleID ${googleId}`);

            }
            else {

                await pool.query(

                    `
                    INSERT INTO homologaciones
                    (

                        google_id,

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

                        $2,

                        NULL,

                        'INDIVIDUAL',

                        $3,

                        $4,

                        $5,

                        'REGISTRADO',

                        $6,

                        $7,

                        $8,

                        $9,

                        $10,

                        $11,

                        $12,

                        $13,

                        $14,

                        NULL,

                        $15

                    )
                    `,

                    [

                        googleId,

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

                console.log(`✓ Creado GoogleID ${googleId}`);

            }

        }
        catch(err){

            errores.push({

                googleId: row["ID"],

                dni: row["DNI"],

                mensaje: err.message

            });

            console.log(
                `❌ Error GoogleID ${row["ID"]}: ${err.message}`
            );

        }

    }

    console.log("");
    console.log("========== IMPORTACIÓN FINAL ==========");
    console.log("Filas:", filas.length);
    console.log("Creados:", creados);
    console.log("Actualizados:", actualizados);
    console.log("Omitidos:", omitidos);
    console.log("Errores:", errores.length);
    console.log("=======================================");

    return {

        ok:true,

        creados,

        actualizados,

        omitidos,

        omitidosDetalle,

        errores,

        totalFilas: filas.length

    };

}




module.exports={

    listarHomologaciones,

    importarDesdeSheets

};
