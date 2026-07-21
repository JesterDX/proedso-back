const dashboardService = require('../services/dashboard.service');

// Renombramos a getDashboard y llamamos a getDashboardData()
exports.getDashboard = async (req, res) => {
  try {
    const data = await dashboardService.getDashboardData();
    
    return res.status(200).json({
      status: 'success',
      data: data
    });
  } catch (error) {
    console.error('Error crítico al generar dashboard:', error);
    
    return res.status(500).json({
      status: 'error',
      data: {
        kpis: { 
          totalAlumnos: 0, 
          porcentajeAlumnosActivos: 0, 
          porcentajeInactivos: 0, 
          totalMaquinas: 0, 
          porcentajeOperatividadFlota: 0 
        },
        graficos: { 
          distribucionEstados: [], 
          demandaMaquinas: [] 
        }
      }
    });
  }
};

// Mantenemos obtenerDashboard por compatibilidad por si otra ruta lo usa
exports.obtenerDashboard = exports.getDashboard;
