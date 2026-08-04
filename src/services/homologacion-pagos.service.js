const pool = require('../config/db');

// ==========================================
// LISTAR PAGOS
// ==========================================
async function listarPagos(homologacionId){

    const result = await pool.query(

        `

        SELECT

            id,

            monto,

            fecha,

            metodo_pago,

            observacion

        FROM homologacion_pagos

        WHERE homologacion_id=$1

        ORDER BY fecha ASC,id ASC

        `,

        [

            homologacionId

        ]

    );

    return result.rows;

}

// ==========================================
// REGISTRAR PAGO
// ==========================================
async function registrarPago(

    homologacionId,

    data

){

    const client = await pool.connect();

    try{

        await client.query("BEGIN");

        //------------------------------------------------

        await client.query(

            `

            INSERT INTO homologacion_pagos(

                homologacion_id,

                monto,

                metodo_pago,

                observacion

            )

            VALUES(

                $1,$2,$3,$4

            )

            `,

            [

                homologacionId,

                data.monto,

                data.metodoPago,

                data.observacion

            ]

        );

        //------------------------------------------------
        // actualizar monto_pagado
        //------------------------------------------------

        await client.query(

            `

            UPDATE homologaciones

            SET

                monto_pagado=

                (

                    SELECT

                    COALESCE(

                        SUM(monto),

                        0

                    )

                    FROM homologacion_pagos

                    WHERE homologacion_id=$1

                )

            WHERE id=$1

            `,

            [

                homologacionId

            ]

        );

        //------------------------------------------------
        // cambiar estado automáticamente
        //------------------------------------------------

        await client.query(

            `

            UPDATE homologaciones

            SET estado=

            CASE

                WHEN monto_pagado>=monto_total

                THEN 'PAGO_COMPLETO'

                ELSE 'PAGO_PARCIAL'

            END

            WHERE id=$1

            `,

            [

                homologacionId

            ]

        );

        await client.query("COMMIT");

        return{

            ok:true

        };

    }

    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }

    finally{

        client.release();

    }

}

module.exports={

    listarPagos,

    registrarPago

};
