const fs = require('fs');
const path = require('path');
const multer = require('multer');

const ensureDirectory = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const createUploadMiddleware = (folderName) => {
  const uploadRoot = path.join(__dirname, '..', 'uploads', folderName);
  ensureDirectory(uploadRoot);

  const storage = multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, uploadRoot);
    },
    filename: (_req, file, callback) => {
      const safeBaseName = file.originalname
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'upload';
      const extension = path.extname(file.originalname);
      callback(null, `${Date.now()}-${safeBaseName}${extension}`);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });
};

module.exports = {
  createUploadMiddleware,
};
