const service =
require('../services/homologacion-pagos.service');

//==========================================

async function listar(req,res){

    try{

        const data=

        await service.listarPagos(

            req.params.id

        );

        res.json({

            ok:true,

            data

        });

    }

    catch(error){

        res.status(500).json({

            ok:false,

            message:error.message

        });

    }

}

//==========================================

async function crear(req,res){

    try{

        const data=

        await service.registrarPago(

            req.params.id,

            req.body

        );

        res.json(data);

    }

    catch(error){

        res.status(500).json({

            ok:false,

            message:error.message

        });

    }

}

module.exports={

    listar,

    crear

};
