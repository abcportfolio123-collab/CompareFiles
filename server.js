const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const app = express();
app.use(cors()); // allow the HTML tool (hosted anywhere, or opened as a local file) to call this API

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB — keep conversions light on a 512MB instance
});

const ALLOWED_EXT = new Set(['docx', 'pptx', 'xlsx', 'xls', 'doc', 'ppt']);

// Simple in-memory queue: LibreOffice conversion is memory-heavy, and a free
// 512MB instance can't run more than one conversion at a time without risking
// an OOM crash. Requests are processed strictly one-by-one.
let queue = Promise.resolve();
function runExclusive(fn){
  const result = queue.then(fn, fn);
  queue = result.catch(() => {}); // don't let one failure jam the queue
  return result;
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'diffchecker-convert-server' });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/convert', upload.single('file'), async (req, res) => {
  if(!req.file){
    return res.status(400).json({ error: 'No file uploaded (expected multipart field "file").' });
  }

  const originalName = req.file.originalname || 'upload';
  const ext = (originalName.split('.').pop() || '').toLowerCase();
  if(!ALLOWED_EXT.has(ext)){
    return res.status(400).json({ error: `Unsupported file type ".${ext}". Allowed: docx, pptx, xlsx, xls, doc, ppt.` });
  }

  const jobId = crypto.randomBytes(8).toString('hex');
  const workDir = path.join(os.tmpdir(), 'convert-' + jobId);
  const inputPath = path.join(workDir, 'input.' + ext);
  const expectedOutputPath = path.join(workDir, 'input.pdf');

  try{
    await fs.promises.mkdir(workDir, { recursive: true });
    await fs.promises.writeFile(inputPath, req.file.buffer);

    await runExclusive(() => convertWithLibreOffice(inputPath, workDir));

    const pdfBuffer = await fs.promises.readFile(expectedOutputPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch(err){
    console.error('Conversion error:', err);
    res.status(500).json({ error: 'Conversion failed: ' + err.message });
  } finally{
    fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
});

function convertWithLibreOffice(inputPath, outDir){
  return new Promise((resolve, reject) => {
    const args = [
      '--headless',
      '--norestore',
      '--convert-to', 'pdf',
      '--outdir', outDir,
      inputPath
    ];
    // Each conversion gets its own user profile dir — LibreOffice headless
    // instances can corrupt a shared profile lock under concurrent access,
    // which is the most common cause of hung/failed headless conversions.
    const profileDir = outDir + '-profile';
    const env = Object.assign({}, process.env, {
      HOME: outDir // isolate LO's config lookup per-job too
    });

    const child = execFile('soffice', [
      `-env:UserInstallation=file://${profileDir}`,
      ...args
    ], { timeout: 60000, env }, (err, stdout, stderr) => {
      fs.promises.rm(profileDir, { recursive: true, force: true }).catch(() => {});
      if(err){
        reject(new Error((stderr || stdout || err.message || 'soffice failed').toString().slice(0, 500)));
        return;
      }
      resolve();
    });
    child.on('error', (e) => reject(e));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DiffChecker convert server listening on port ${PORT}`);
});
