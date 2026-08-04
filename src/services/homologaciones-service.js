const pool = require('../config/db');

async function listarHomologaciones() {

    const result = await pool.query(`

        SELECT

            h.id,

            h.fecha_registro,

            h.tipo_homologacion,

            h.monto_total,

            h.monto_pagado,

            (h.monto_total-h.monto_pagado) saldo,

            h.estado,

            h.observaciones,

            a.id alumno_id,

            a.nombres,

            a.apellidos,

            a.dni,

            a.celular

        FROM homologaciones h

        INNER JOIN alumnos a

        ON a.id=h.alumno_id

        ORDER BY h.id DESC

    `);

    return result.rows;

}


async function obtenerHomologacion(id){

    const result = await pool.query(

        `

        SELECT

            h.*,

            a.nombres,

            a.apellidos,

            a.dni,

            a.celular

        FROM homologaciones h

        INNER JOIN alumnos a

        ON a.id=h.alumno_id

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

            estado,

            observaciones

        )

        VALUES(

            $1,$2,$3,$4,$5,$6

        )

        RETURNING *

        `,

        [

            data.alumnoId,

            data.tipoHomologacion,

            data.montoTotal,

            data.montoPagado,

            data.estado,

            data.observaciones

        ]

    );

    return result.rows[0];

}

async function actualizarEstado(id,data){

    const result=await pool.query(

        `

        UPDATE homologaciones

        SET

            estado=$1,

            observaciones=$2

        WHERE id=$3

        RETURNING *

        `,

        [

            data.estado,

            data.observaciones,

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

module.exports={

    listarHomologaciones,

    obtenerHomologacion,

    crearHomologacion,

    actualizarEstado,

    eliminarHomologacion

};
