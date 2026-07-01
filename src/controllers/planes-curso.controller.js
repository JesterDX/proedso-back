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


async function listarCompletos(req, res) {
  try {
    const data = await planesCursoService.listarPlanesCursoCompletos();

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
  listarCompletos,
  crear
};
