const pool =
require('../config/db');

//==========================================
// LISTAR MAQUINAS
//==========================================
async function listarMaquinas(homologacionId){

    const result = await pool.query(

        `

        SELECT

            hm.id,

            hm.maquina_id,

            m.nombre

        FROM homologacion_maquinas hm

        INNER JOIN maquinas m

        ON m.id=hm.maquina_id

        WHERE hm.homologacion_id=$1

        ORDER BY m.nombre

        `,

        [

            homologacionId

        ]

    );

    return result.rows;

}

//==========================================
// REGISTRAR MAQUINA
//==========================================
async function agregarMaquina(

    homologacionId,

    maquinaId

){

    const result = await pool.query(

        `

        INSERT INTO homologacion_maquinas(

            homologacion_id,

            maquina_id

        )

        VALUES(

            $1,

            $2

        )

        RETURNING *

        `,

        [

            homologacionId,

            maquinaId

        ]

    );

    return result.rows[0];

}

//==========================================
// ELIMINAR
//==========================================
async function eliminarMaquina(id){

    await pool.query(

        `

        DELETE

        FROM homologacion_maquinas

        WHERE id=$1

        `,

        [

            id

        ]

    );

}

module.exports={

    listarMaquinas,

    agregarMaquina,

    eliminarMaquina

};
