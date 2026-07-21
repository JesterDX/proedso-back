const multer = require('multer');

// Almacena los archivos en la memoria RAM como Buffer
const storage = multer.memoryStorage();

// Filtro opcional para aceptar solo imágenes
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Límite de 5 MB por archivo
  },
  fileFilter: imageFilter
});

module.exports = upload;
