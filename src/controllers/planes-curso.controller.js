const planesCursoService = require('../services/planes-curso.service');

// ============================================================
// LISTAR PLANES DE CURSO
// ============================================================

async function listar(req, res) {

try {


const data =
  await planesCursoService.listarPlanesCurso();

res.json({
  ok: true,
  data
});


} catch (error) {


console.error(
  'Error al listar planes de curso:',
  error
);

res.status(500).json({
  ok: false,
  message: 'Error al listar los planes de curso.'
});


}

}

// ============================================================
// OBTENER DETALLE DE PLAN DE CURSO
// ============================================================

async function obtener(req, res) {

try {


const { id } = req.params;

const data =
  await planesCursoService.obtenerPlanCurso(id);

if (!data) {

  return res.status(404).json({
    ok: false,
    message: 'El plan de curso no existe.'
  });

}

res.json({
  ok: true,
  data
});


} catch (error) {


console.error(
  'Error al obtener plan de curso:',
  error
);

res.status(500).json({
  ok: false,
  message: 'Error al obtener el plan de curso.'
});


}

}

// ============================================================
// CREAR PLAN DE CURSO
// ============================================================

async function crear(req, res) {

try {


const data =
  await planesCursoService.crearPlanCurso(
    req.body
  );

res.status(201).json({
  ok: true,
  message: 'Plan de curso creado correctamente.',
  data
});


} catch (error) {


console.error(
  'Error al crear plan de curso:',
  error
);


// --------------------------------------------------------
// CÓDIGO DUPLICADO
// --------------------------------------------------------

if (error.code === '23505') {

  return res.status(409).json({
    ok: false,
    message:
      'Ya existe un plan de curso con ese código.'
  });

}


// --------------------------------------------------------
// ERROR DE CLAVE FORÁNEA
// --------------------------------------------------------

if (error.code === '23503') {

  return res.status(400).json({
    ok: false,
    message:
      'Uno de los datos relacionados no existe.'
  });

}


// --------------------------------------------------------
// ERROR DE VALIDACIÓN DEL SERVICE
// --------------------------------------------------------

if (
  error.message &&
  (
    error.message.includes(
      'obligatorio'
    ) ||
    error.message.includes(
      'no existe'
    ) ||
    error.message.includes(
      'inactivo'
    ) ||
    error.message.includes(
      'máquina'
    ) ||
    error.message.includes(
      'máquinas'
    ) ||
    error.message.includes(
      'horas'
    ) ||
    error.message.includes(
      'sesiones'
    )
  )
) {

  return res.status(400).json({
    ok: false,
    message: error.message
  });

}


// --------------------------------------------------------
// ERROR GENERAL
// --------------------------------------------------------

res.status(500).json({
  ok: false,
  message:
    'Error al crear el plan de curso.'
});


}

}

// ============================================================
// ACTUALIZAR PLAN DE CURSO
// ============================================================

async function actualizar(req, res) {

try {


const { id } = req.params;

const data =
  await planesCursoService.actualizarPlanCurso(
    id,
    req.body
  );

res.json({
  ok: true,
  message:
    'Plan de curso actualizado correctamente.',
  data
});


} catch (error) {


console.error(
  'Error al actualizar plan de curso:',
  error
);


// --------------------------------------------------------
// CÓDIGO DUPLICADO
// --------------------------------------------------------

if (error.code === '23505') {

  return res.status(409).json({
    ok: false,
    message:
      'Ya existe un plan de curso con ese código.'
  });

}


// --------------------------------------------------------
// ERROR DE CLAVE FORÁNEA
// --------------------------------------------------------

if (error.code === '23503') {

  return res.status(400).json({
    ok: false,
    message:
      'Uno de los datos relacionados no existe.'
  });

}


// --------------------------------------------------------
// ERROR DE VALIDACIÓN
// --------------------------------------------------------

if (
  error.message &&
  (
    error.message.includes(
      'no existe'
    ) ||
    error.message.includes(
      'inactivo'
    ) ||
    error.message.includes(
      'máquina'
    ) ||
    error.message.includes(
      'máquinas'
    ) ||
    error.message.includes(
      'horas'
    ) ||
    error.message.includes(
      'sesiones'
    )
  )
) {

  return res.status(400).json({
    ok: false,
    message: error.message
  });

}


// --------------------------------------------------------
// ERROR GENERAL
// --------------------------------------------------------

res.status(500).json({
  ok: false,
  message:
    'Error al actualizar el plan de curso.'
});


}

}

// ============================================================
// CAMBIAR ESTADO
// ============================================================

async function cambiarEstado(req, res) {

try {


const { id } = req.params;

const { activo } = req.body;


// --------------------------------------------------------
// VALIDAR ACTIVO
// --------------------------------------------------------

if (
  typeof activo !== 'boolean'
) {

  return res.status(400).json({
    ok: false,
    message:
      'El campo activo debe ser verdadero o falso.'
  });

}


const data =
  await planesCursoService.cambiarEstadoPlanCurso(
    id,
    activo
  );


if (!data) {

  return res.status(404).json({
    ok: false,
    message:
      'El plan de curso no existe.'
  });

}


res.json({
  ok: true,
  message:
    activo
      ? 'Plan de curso activado correctamente.'
      : 'Plan de curso desactivado correctamente.',
  data
});


} catch (error) {


console.error(
  'Error al cambiar estado del plan de curso:',
  error
);

res.status(500).json({
  ok: false,
  message:
    'Error al cambiar el estado del plan de curso.'
});


}

}

// ============================================================
// EXPORTAR
// ============================================================

module.exports = {

listar,

obtener,

crear,

actualizar,

cambiarEstado

};
