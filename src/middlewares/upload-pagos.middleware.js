const multer = require('multer');
const { storageDocumentos } = require('../config/cloudinary');

const uploadPago = multer({
  storage: storageDocumentos, // 👈 Ahora usa Cloudinary
  limits: { fileSize: 10 * 1024 * 1024 }
});

module.exports = uploadPago;
