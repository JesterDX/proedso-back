const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Conectar con las variables de Render / .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configurar almacenamiento para Fotos de Alumnos
const storageAlumno = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'proedso/alumnos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: (req, file) => {
      const baseName = file.originalname.split('.')[0].replace(/\s+/g, '_');
      return `${Date.now()}_${baseName}`;
    }
  }
});

// Configurar almacenamiento para Pagos y Documentos
const storageDocumentos = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'proedso/documentos',
    // Permitimos pdf además de imágenes
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'], 
    public_id: (req, file) => {
      const baseName = file.originalname.split('.')[0].replace(/\s+/g, '_');
      return `${Date.now()}_${baseName}`;
    }
  }
});

module.exports = {
  cloudinary,
  storageAlumno,
  storageDocumentos
};
