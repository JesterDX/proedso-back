const multer = require('multer');
const { storageDocumentos } = require('../config/cloudinary');

// Configuración de Multer usando el storage de Cloudinary
const uploadEvidencias = multer({
  storage: storageDocumentos,
  limits: {
    fileSize: 10 * 1024 * 1024 // Límite máximo de 10 MB por archivo
  },
  fileFilter: (req, file, cb) => {
    // Permite imágenes y documentos PDF/Word
    if (
      file.mimetype.startsWith('image/') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/msword' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Sube una imagen o documento.'), false);
    }
  }
});

// Exportación compatible: exporta la instancia por defecto y también como propiedad
module.exports = uploadEvidencias;
module.exports.uploadEvidencias = uploadEvidencias;
module.exports.uploadPago = uploadEvidencias;
