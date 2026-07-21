const dashboardService = require('../services/dashboard.service'); // Ajusta la ruta si es necesario

exports.obtenerDashboard = async (req, res) => {
  try {
    const data = await dashboardService.getDashboardData();
    
    return res.status(200).json({
      status: 'success',
      data: data
    });
  } catch (error) {
    console.error('Error crítico al generar dashboard:', error);
    
    // Devolvemos un 500 pero con estructura válida para que Angular no colapse
    return res.status(500).json({
      status: 'error',
      data: {
        kpis: { totalAlumnos: 0, porcentajeAlumnosActivos: 0, porcentajeInactivos: 0, totalMaquinas: 0, porcentajeOperatividadFlota: 0 },
        graficos: { distribucionEstados: [], demandaMaquinas: [] }
      }
    });
  }
};
