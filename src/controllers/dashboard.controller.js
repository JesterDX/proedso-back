const dashboardService = require('../services/dashboard.service');

exports.getDashboard = async (req, res) => {
  try {
    const data = await dashboardService.obtenerDashboard();

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: 'Error obteniendo dashboard'
    });
  }
};
