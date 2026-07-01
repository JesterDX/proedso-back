const dashboardService = require('../services/dashboard.service');

exports.getDashboard = async (req, res) => {
  try {

    const data = await dashboardService.obtenerDashboard();

    return res.status(200).json({
      success: true,
      message: 'Dashboard obtenido correctamente',
      data
    });

  } catch (error) {

    console.error('Error Dashboard:', error);

    return res.status(500).json({
      success: false,
      message: 'Error obteniendo dashboard'
    });

  }
};
