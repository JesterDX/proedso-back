const practicasService = require('../services/practicas.service');



// ==========================================
// VALIDAR SI EL ALUMNO PUEDE HACER PRÁCTICAS
// ==========================================


async function listarAlumnosDisponibles(req, res) {

  try {

    const alumnos =
      await practicasService.listarAlumnosDisponibles(req.query);

    return res.json({
      ok: true,
      data: alumnos
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      ok: false,
      error: error.message
    });

  }

}


// ==========================================
// CREAR SESIÓN GRUPAL
// ==========================================
async function crearSesionGrupal(req, res) {

  try {

    const data =
      await practicasService.crearSesionGrupal(req.body);

    return res.json({

      ok: true,

      data

    });

  }

  catch(error){

    console.error(error);

    return res.status(500).json({

      ok:false,

      error:error.message

    });

  }

}


async function obtenerSesionGrupal(req,res){

  try{

    const data=

      await practicasService.obtenerSesionGrupal(

        req.params.id

      );

    return res.json({

      ok:true,

      data

    });

  }

  catch(error){

    console.error(error);

    return res.status(500).json({

      ok:false,

      error:error.message

    });

  }

}
async function validarPracticas(req, res) {

  try {

    const { matriculaId } = req.params;

    const data =
      await practicasService
        .validarPracticas(matriculaId);

    return res.json({
      ok: true,
      data
    });

  } catch (error) {

    console.error(
      '❌ validarPracticas:',
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error.message ||
        'Error interno del servidor'
    });

  }

}

// ==========================================
// LISTAR MATRÍCULAS ACTIVAS
// ==========================================
async function listarMatriculasActivas(req, res) {

  try {

    const data =
      await practicasService
        .listarMatriculasActivas();

    return res.json({
      ok: true,
      data
    });

  } catch (error) {

    console.error(
      '❌ listarMatriculasActivas:',
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error.message ||
        'Error interno'
    });

  }

}

// ==========================================
// LISTAR PRÁCTICAS ORDENADAS
// ==========================================
async function listarPracticasOrdenadas(req, res) {

  try {

    const {
      mes,
      anio,
      tipoCurso
    } = req.query;

    const data =
      await practicasService
        .listarPracticasOrdenadas({
          mes,
          anio,
          tipoCurso
        });

    return res.json({
      ok: true,
      data
    });

  } catch (error) {

    console.error(
      '❌ listarPracticasOrdenadas:',
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error.message ||
        'Error interno'
    });

  }

}

// ==========================================
// CREAR ASIGNACIÓN
// ==========================================
async function crearAsignacionPracticas(req, res) {

  try {

    const { matriculaId } = req.body;

    const data =
      await practicasService
        .crearAsignacionPracticas(matriculaId);

    return res.json({
      ok: true,
      data
    });

  } catch (error) {

    console.error(
      '❌ crearAsignacionPracticas:',
      error
    );

    return res.status(500).json({
      ok: false,
      error: error.message
    });

  }

}

// ==========================================
// LISTAR ASIGNACIONES
// ==========================================
async function listarAsignaciones(req, res) {

  try {

    const data =
      await practicasService
        .listarAsignaciones();

    return res.json({
      ok: true,
      data
    });

  } catch (error) {

    console.error(
      '❌ listarAsignaciones:',
      error
    );

    return res.status(500).json({
      ok: false,
      error: error.message
    });

  }

}

// ==========================================
// LISTAR SESIONES
// ==========================================
async function listarSesiones(req, res) {

  try {

    const { asignacionId } = req.params;

    const data =
      await practicasService
        .listarSesiones(asignacionId);

    return res.json({
      ok: true,
      data
    });

  } catch (error) {

    console.error(
      '❌ listarSesiones:',
      error
    );

    return res.status(500).json({
      ok: false,
      error: error.message
    });

  }

}

// ==========================================
// REGISTRAR ASISTENCIA
// ==========================================
async function registrarAsistencia(req, res) {

  try {

    const { sesionId } = req.params;

    const data =
      await practicasService
        .registrarAsistencia(
          sesionId,
          req.body
        );

    return res.json({
      ok: true,
      data
    });

  } catch (error) {

    console.error(
      '❌ registrarAsistencia:',
      error
    );

    return res.status(500).json({
      ok: false,
      error: error.message
    });

  }

}
async function obtenerDetallePracticas(
  req,
  res
) {

  try {

    const { matriculaId } =
      req.params;

    const data =
      await practicasService
        .obtenerDetallePracticas(
          matriculaId
        );

    return res.json({
      ok: true,
      data
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      ok: false,
      error: error.message
    });

  }

}


module.exports = {
  listarAlumnosDisponibles,
  crearSesionGrupal,
  obtenerSesionGrupal,



  
  validarPracticas,
  listarMatriculasActivas,
  listarPracticasOrdenadas,
  obtenerDetallePracticas,
  crearAsignacionPracticas,
  listarAsignaciones,
  listarSesiones,
  registrarAsistencia
};
