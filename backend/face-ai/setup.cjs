const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const filename = path.resolve(__dirname, '../config/face-ai.local.json');
if (!fs.existsSync(filename)) {
  fs.writeFileSync(filename, JSON.stringify({
    url: 'http://127.0.0.1:8001',
    token: crypto.randomBytes(32).toString('hex'),
  }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('Konfigurasi layanan AI dibuat di backend/config/face-ai.local.json.');
} else {
  console.log('Konfigurasi layanan AI sudah tersedia; tidak diubah.');
}
