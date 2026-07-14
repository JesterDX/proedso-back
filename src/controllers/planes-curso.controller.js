const planesCursoService = require('../services/planes-curso.service');

async function listar(req, res) {
  try {
    const data = await planesCursoService.listarPlanesCurso();

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error al listar planes de curso:', error);

    res.status(500).json({
      ok: false,
      message: 'Error al listar planes de curso.'
    });
  }
}
async function maquinas(req,res){

    try{

        const data = await planesCursoService.obtenerMaquinasPlan(
            req.params.id
        );

        res.json({
            ok:true,
            data
        });

    }catch(error){

        console.error(error);

        res.status(500).json({
            ok:false,
            message:'Error obteniendo máquinas del plan.'
        });

    }

}


async function listarPlanesCursoActivos(req, res) {
  try {
    const data = await planesCursoService.listarPlanesCursoActivos();

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error al listar planes de curso:', error);

    res.status(500).json({
      ok: false,
      message: 'Error al listar planes de curso.'
    });
  }
}

async function actualizar(req,res){

    try{

        const data = await planesCursoService.actualizarPlanCurso(
            req.params.id,
            req.body
        );

        res.json({
            ok:true,
            data
        });

    }catch(err){

        console.error(err);

        res.status(500).json({
            ok:false,
            message:"Error al actualizar."
        });

    }

}

async function cambiarEstado(req,res){

    try{

        const data = await planesCursoService.cambiarEstadoPlanCurso(
            req.params.id
        );

        res.json({
            ok:true,
            data
        });

    }catch(err){

        console.error(err);

        res.status(500).json({
            ok:false,
            message:"Error."
        });

    }

}

async function crear(req,res){

    try{

        const data = await planesCursoService.crearPlanCurso(req.body);

        res.status(201).json({
            ok:true,
            message:"Plan creado correctamente",
            data
        });

    }catch(error){

        console.error(error);

        res.status(500).json({
            ok:false,
            message:"Error al crear plan"
        });

    }

}

async function obtenerPorId(req,res){

  try{

    const data = await planesCursoService.obtenerPlanCursoPorId(
      req.params.id
    );


    res.json({
      ok:true,
      data
    });


  }catch(error){

    console.error(error);


    res.status(500).json({
      ok:false,
      message:"Error al obtener plan"
    });

  }

}
async function guardarConfiguracion(req,res){

  try {


    const id =
      req.params.id;


    const maquinas =
      req.body.maquinas;



    const data =
      await planesCursoService.guardarConfiguracionPlan(
        id,
        maquinas
      );


    res.json({

      ok:true,

      message:
      "Configuración guardada correctamente",

      data

    });


  } catch(error){


    console.error(
      "ERROR GUARDAR CONFIGURACION:",
      error
    );


    res.status(500).json({

      ok:false,

      message:
      "Error guardando configuración"

    });


  }

}

module.exports = {
  listar,
  listarPlanesCursoActivos,
  crear,
  actualizar,
  cambiarEstado,
  obtenerPorId,
  maquinas,
  guardarConfiguracion
};
