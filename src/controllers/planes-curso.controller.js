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

module.exports = {
  listar,
  listarPlanesCursoActivos,
  crear,
  actualizar,
  cambiarEstado
};
