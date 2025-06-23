const fs = require('fs');
const path = require('path');
const multer = require('multer');
const unzipper = require('unzipper');
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');

const downloadsPath = './downloads';
const uploadsPath = './uploads';

const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN, fetch });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsPath),
  filename: (req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.zip') {
      return cb(new Error('Only ZIP files are allowed'));
    }
    cb(null, true);
  },
});

async function extractZipFile(zipFilePath, extractToPath) {
    return new Promise((resolve, reject) => {
      fs.createReadStream(zipFilePath)
        .pipe(unzipper.Parse())
        .on('entry', function (entry) {
          // Replace invalid Windows characters in path
          const sanitizedPath = entry.path.replace(/[:*?"<>|]/g, '_');
          const fullPath = path.join(extractToPath, sanitizedPath);
  
          // Ensure directory structure exists
          const dir = path.dirname(fullPath);
          fs.mkdirSync(dir, { recursive: true });
  
          if (entry.type === 'File') {
            const writeStream = fs.createWriteStream(fullPath);
            entry.pipe(writeStream);
          } else {
            entry.autodrain();
          }
        })
        .on('error', reject)
        .on('close', resolve);
    });
  }

async function downloadFilesFromDropbox() {
  try {
    const folderPath = '/Apps/ContentAI';
    const listResponse = await dbx.filesListFolder({ path: folderPath });

    for (const entry of listResponse.result.entries) {
      if (entry[".tag"] === "file") {
        const fileName = entry.name;
        const dropboxFilePath = entry.path_lower;
        const localFilePath = path.join(downloadsPath, fileName);

        if (!fs.existsSync(localFilePath)) {
          console.log(`Downloading new file: ${fileName}`);
          const fileDownload = await dbx.filesDownload({ path: dropboxFilePath });
          fs.writeFileSync(localFilePath, fileDownload.result.fileBinary, 'binary');
          console.log(`Downloaded: ${fileName}`);
        } else {
          console.log(`File already exists: ${fileName}`);
        }
      }
    }
  } catch (error) {
    console.error('Error downloading files:', error);
  }
}

function setupRoutes(app) {
  app.post('/api/upload-zip', upload.single('zipFile'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No ZIP file uploaded' });
    }

    const zipFilePath = path.join(uploadsPath, req.file.filename);
    const extractToPath = path.join(uploadsPath, path.parse(req.file.filename).name);

    try {
      if (!fs.existsSync(extractToPath)) {
        fs.mkdirSync(extractToPath, { recursive: true });
      }

      await extractZipFile(zipFilePath, extractToPath);

      res.status(200).json({
        message: 'ZIP file uploaded and extracted successfully',
        extractedTo: extractToPath,
      });
    } catch (err) {
      console.error('Unzip error:', err);
      res.status(500).json({ error: 'Failed to extract ZIP file', details: err.message });
    }
  });

  app.get('/api/files', (req, res) => {
    console.log('GET /api/files called');
    fs.readdir(downloadsPath, (err, files) => {
      if (err) {
        console.error('Error reading the directory:', err);
        return res.status(500).json({ error: 'Failed to list files', details: err });
      }
      res.json(files);
    });
  });

  // Run Dropbox sync every 2 minutes
  setInterval(downloadFilesFromDropbox, 2 * 60 * 1000);
}

module.exports = { setupRoutes };
