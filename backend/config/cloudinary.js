const cloudinaryRoot = require('cloudinary');
const cloudinary = cloudinaryRoot.v2;
const cloudinaryStorage = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = cloudinaryStorage({
  // multer-storage-cloudinary@2.x internally does `this.cloudinary.v2.uploader...`,
  // so it needs the root module (which has `.v2`), not the unwrapped v2 object.
  cloudinary: cloudinaryRoot,
  folder: 'market_tracker_trades',
  allowedFormats: ['jpeg', 'png', 'jpg'],
  transformation: [{ width: 1200, crop: 'limit' }]
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 3 }, // 10MB per file, max 3 files
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'));
    }
  }
});

module.exports = {
  cloudinary,
  upload
};
