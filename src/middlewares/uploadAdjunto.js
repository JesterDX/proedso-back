const multer = require('multer');
const path = require('path');
const fs = require('fs');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const modulo = String(req.body.modulo || 'general').trim().toLowerCase();
    const uploadDir = path.join(__dirname, '../../uploads/documentos', modulo);

    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);

    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const baseName = path
      .basename(originalName, ext)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^\w\-]/g, '');

    cb(null, `${Date.now()}_${baseName}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  cb(null, true);
};

const uploadAdjunto = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

module.exports = uploadAdjunto;