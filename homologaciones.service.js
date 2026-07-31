const pool = require('../config/db');

async function listarHomologaciones() {

    const result = await pool.query(

        `
        SELECT

            h.id,

            h.fecha_registro,

            h.tipo_homologacion,

            h.estado,

            h.monto_total,

            h.monto_pagado,

            h.observaciones,

            a.id AS alumno_id,

            a.nombres,

            a.apellidos,

            (
                SELECT STRING_AGG(m.nombre, ', ')
                FROM homologacion_maquinas hm
                INNER JOIN maquinas m
                ON m.id = hm.maquina_id
                WHERE hm.homologacion_id = h.id
            ) AS maquinas

        FROM homologaciones h

        INNER JOIN alumnos a
        ON a.id = h.alumno_id

        ORDER BY h.id DESC
        `
    );

    return result.rows;

}

module.exports = {

    listarHomologaciones

};
