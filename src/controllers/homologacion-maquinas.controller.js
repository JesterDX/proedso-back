const service =
require('../services/homologacion-maquinas.service');

//==========================================

async function listar(req,res){

    try{

        const data=

        await service.listarMaquinas(

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

        await service.agregarMaquina(

            req.params.id,

            req.body.maquinaId

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

async function eliminar(req,res){

    try{

        await service.eliminarMaquina(

            req.params.id

        );

        res.json({

            ok:true

        });

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

    crear,

    eliminar

};
