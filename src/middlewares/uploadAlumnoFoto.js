const multer = require('multer');
const { storageAlumno } = require('../config/cloudinary'); // Asegúrate de poner la ruta correcta a tu config

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP.'));
  }
  cb(null, true);
};

const uploadAlumnoFoto = multer({
  storage: storageAlumno, // 👈 Ahora usa Cloudinary
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }
});

module.exports = uploadAlumnoFoto;
