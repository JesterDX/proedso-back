const service=require('../services/homologaciones.service');

async function listar(req,res){

    try{

        const data=await service.listarHomologaciones();

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
async function obtener(req,res){

    try{

        const data=await service.obtenerHomologacion(

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

async function crear(req,res){

    try{

        const data=await service.crearHomologacion(

            req.body

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

async function actualizar(req,res){

    try{

        const data=await service.actualizarEstado(

            req.params.id,

            req.body

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
async function eliminar(req,res){

    try{

        await service.eliminarHomologacion(

            req.params.id

        );

        res.json({

            ok:true,

            message:"Registro eliminado."

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

    obtener,

    crear,

    actualizar,

    eliminar

};
