const homologacionesService =
require('../services/homologaciones.service');

async function listar(req,res){

    try{

        const data =
        await homologacionesService.listarHomologaciones();

        res.json({

            ok:true,

            data

        });

    }

    catch(error){

        console.log(error);

        res.status(500).json({

            ok:false,

            message:error.message

        });

    }

}

module.exports={

    listar

};
