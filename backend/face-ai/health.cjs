const fs = require('node:fs');
const path = require('node:path');
const filename = path.resolve(__dirname, '../config/face-ai.local.json');
const config = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : {};
fetch(`${process.env.FACE_AI_URL || config.url || 'http://127.0.0.1:8001'}/health`, {
  headers: { Authorization: `Bearer ${process.env.FACE_AI_TOKEN || config.token || ''}` },
  signal: AbortSignal.timeout(5000),
}).then(async response => {
  console.log(await response.text());
  if (!response.ok) process.exitCode = 1;
}).catch(() => {
  console.error('Layanan AI belum dapat dihubungi.');
  process.exitCode = 1;
});
