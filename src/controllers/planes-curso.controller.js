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


async function crearPlanCursoCompleto(data) {

  const client = await pool.connect();


  try {

    await client.query('BEGIN');


    // ==================================
    // 1. CREAR PLAN
    // ==================================

    const planResult = await client.query(
      `
      INSERT INTO planes_curso
      (
        codigo,
        nombre,
        version,
        tipo_curso_id,
        permite_eleccion_personalizada,
        vigente_desde,
        vigente_hasta,
        activo,
        observaciones
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,true,$8)
      RETURNING *
      `,
      [
        data.codigo,
        data.nombre,
        data.version,
        data.tipo_curso_id,
        data.permite_eleccion_personalizada,
        data.vigente_desde,
        data.vigente_hasta,
        data.observaciones
      ]
    );


    const plan = planResult.rows[0];



    // ==================================
    // 2. CONFIGURAR MAQUINAS
    // ==================================

    for(const m of data.maquinas){


      if(!m.seleccionada)
        continue;



      await client.query(
        `
        INSERT INTO plan_maquinas
        (
          plan_curso_id,
          maquina_id,
          obligatoria,
          es_regalo,
          orden
        )
        VALUES
        ($1,$2,$3,$4,$5)
        `,
        [
          plan.id,
          m.id,
          m.obligatoria,
          m.es_regalo,
          m.orden
        ]
      );



      await client.query(
        `
        INSERT INTO plan_horas_practica
        (
          plan_curso_id,
          maquina_id,
          horas,
          sesiones_totales
        )
        VALUES
        ($1,$2,$3,$4)
        `,
        [
          plan.id,
          m.id,
          m.horas,
          m.sesiones_totales
        ]
      );


    }



    await client.query('COMMIT');


    return plan;



  }catch(error){


    await client.query('ROLLBACK');

    throw error;


  }finally{

    client.release();

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
  guardarConfiguracion,
  crearPlanCursoCompleto
};
