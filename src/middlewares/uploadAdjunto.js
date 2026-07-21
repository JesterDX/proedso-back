const multer = require('multer');
const { storageDocumentos } = require('../config/cloudinary');

// Middleware para procesar FormData y subir archivos a Cloudinary
const uploadEvidencias = multer({
  storage: storageDocumentos,
  limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10 MB
});

module.exports = uploadEvidencias;
