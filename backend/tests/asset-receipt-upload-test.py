"""Exercise real multipart uploads and protected reads using an isolated PHP server."""
import base64
from contextlib import closing
import json
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

root = Path(__file__).resolve().parents[2]
php = shutil.which('php')
with tempfile.TemporaryDirectory(prefix='asset-upload-', dir=root / 'scratch') as temporary:
    work = Path(temporary)
    database = work / 'fixture.sqlite'
    with closing(sqlite3.connect(database)) as db:
        db.executescript('''
            CREATE TABLE users (id INTEGER PRIMARY KEY, karyawan_id INTEGER);
            INSERT INTO users VALUES (1,1752),(2,1753);
            CREATE TABLE karyawans (id INTEGER PRIMARY KEY, nik TEXT, nama_lengkap TEXT);
            INSERT INTO karyawans VALUES (1752,'1595','ADIT'),(1753,'1596','BUDI');
            CREATE TABLE user_feature_permissions (user_id INTEGER, feature_key TEXT, is_enabled INTEGER);
            CREATE TABLE assets (id INTEGER PRIMARY KEY, karyawan_id INTEGER, foto TEXT, updated_by INTEGER, updated_at TEXT, deleted_at TEXT);
            INSERT INTO assets (id,karyawan_id) VALUES (1,1752),(2,1753);
            CREATE TABLE tanda_terima_asset (id INTEGER PRIMARY KEY, asset_id INTEGER, karyawan_id INTEGER,
                kode_asset TEXT, nama_asset TEXT, nama_merk TEXT, kategori TEXT, nomor_seri TEXT, kondisi TEXT,
                status TEXT, lokasi TEXT, nama_pemegang TEXT, nik_pemegang TEXT, departemen_pemegang TEXT,
                tanggal_tanda_terima TEXT, keterangan TEXT, foto TEXT, updated_at TEXT);
            INSERT INTO tanda_terima_asset (id,asset_id,karyawan_id,kode_asset,nama_asset,nik_pemegang,nama_pemegang)
                VALUES (1,1,1752,'AST-1','Laptop','1595','ADIT'),(2,2,1753,'AST-2','Monitor','1596','BUDI');
            CREATE TABLE tanda_terima_asset_fotos (id INTEGER PRIMARY KEY, tanda_terima_asset_id INTEGER,
                karyawan_id INTEGER, nik_pemegang TEXT, nama_pemegang TEXT, uploaded_by INTEGER,
                file_name TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        ''')

    # No credentials or production database connections are used by this router.
    router = work / 'router.php'
    router.write_text("<?php\n" +
        "require_once " + repr((root / 'backend/config/database.php').as_posix()) + ";\n" +
        "$pdo = new PDO('sqlite:' . __DIR__ . '/fixture.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);\n" +
        "$property = new ReflectionProperty(Database::class, 'pdo'); $property->setAccessible(true); $property->setValue(null, $pdo);\n" +
        "define('ASSET_RECEIPT_PHOTO_DIR', __DIR__ . '/photos');\n" +
        "require " + repr((root / 'backend/routes/api.php').as_posix()) + ";\n", encoding='utf-8')
    session_class = (root / 'backend/app/Services/PwaSession.php').as_posix()
    tokens = [subprocess.check_output([php, '-d', f'session.save_path={work}', '-r',
        f"require '{session_class}'; echo \\App\\Services\\PwaSession::issue({user});"], text=True).strip() for user in (1, 2)]
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    log = (work / 'server.log').open('w')
    server = subprocess.Popen([php, '-d', f'session.save_path={work}', '-d', f'upload_tmp_dir={work}',
        '-d', 'upload_max_filesize=8M', '-d', 'post_max_size=10M', '-S', f'127.0.0.1:{port}', str(router)],
        cwd=root, stdout=log, stderr=log, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))

    def request(path, token=tokens[0], photo=None, expected=200):
        headers = {'Authorization': f'Bearer {token}'} if token else {}
        body = None
        if photo is not None:
            boundary = 'asset-receipt-test-boundary'
            headers['Content-Type'] = f'multipart/form-data; boundary={boundary}'
            body = (f'--{boundary}\r\nContent-Disposition: form-data; name="foto"; filename="asset.png"\r\n'
                    'Content-Type: image/png\r\n\r\n').encode() + photo + f'\r\n--{boundary}--\r\n'.encode()
        req = urllib.request.Request(f'http://127.0.0.1:{port}/api/tanda-terima-asset{path}', data=body, headers=headers)
        try:
            response = urllib.request.urlopen(req, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        content = response.read()
        assert response.code == expected, (response.code, expected, content[:200])
        return content

    try:
        for attempt in range(50):
            try:
                with socket.create_connection(('127.0.0.1', port), timeout=.2):
                    break
            except OSError:
                time.sleep(.1)
        image = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9V0AAAAASUVORK5CYII=')
        request('/1/foto', token=None, photo=image, expected=401)
        request('/2/foto', photo=image, expected=404)
        request('/1/surat', expected=409)
        request('/1/foto', photo=b'not an image', expected=422)
        request('/1/foto', photo=image + bytes(5 * 1024 * 1024), expected=422)
        # A filesystem failure must not mark the receipt as complete.
        (work / 'photos').write_text('blocked directory')
        request('/1/foto', photo=image, expected=500)
        (work / 'photos').unlink()
        # A database failure after the file move must clean up the new file.
        with closing(sqlite3.connect(database)) as db:
            db.execute("CREATE TRIGGER reject_photo BEFORE UPDATE OF foto ON tanda_terima_asset BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END")
            db.commit()
        request('/1/foto', photo=image, expected=500)
        assert not list((work / 'photos').iterdir())
        with closing(sqlite3.connect(database)) as db:
            assert db.execute('SELECT COUNT(*) FROM tanda_terima_asset_fotos').fetchone()[0] == 0
            assert db.execute('SELECT foto FROM tanda_terima_asset WHERE id=1').fetchone()[0] is None
            db.execute('DROP TRIGGER reject_photo')
            db.commit()
        request('/1/foto', photo=image)
        with closing(sqlite3.connect(database)) as db:
            stored_path = db.execute('SELECT foto FROM tanda_terima_asset WHERE id=1').fetchone()[0]
            assert '/' not in stored_path and stored_path.endswith('.png')
            assert (work / 'photos' / stored_path).read_bytes() == image
            assert db.execute('SELECT file_name FROM tanda_terima_asset_fotos').fetchone()[0] == stored_path
            assert db.execute('SELECT foto FROM assets WHERE id=1').fetchone()[0] is None
            assert db.execute('SELECT foto FROM assets WHERE id=2').fetchone()[0] is None
        assert request('/1/foto') == image
        assert json.loads(request(''))['data'][0]['has_foto'] is True
        assert b'SURAT PERNYATAAN' in request('/1/surat')
        # AYPSIS/Laravel uploads have mixed-case names and no PWA upload history.
        external_name = 'AbCdEfGhIj' * 4 + '.jpeg'
        (work / 'photos' / external_name).write_bytes(image)
        with closing(sqlite3.connect(database)) as db:
            db.execute('UPDATE tanda_terima_asset SET foto=? WHERE id=2', (external_name,))
            db.commit()
        assert request('/2/foto', token=tokens[1]) == image
        assert json.loads(request('', token=tokens[1]))['data'][0]['has_foto'] is True
        assert b'SURAT PERNYATAAN' in request('/2/surat', token=tokens[1])
        request('/2/foto', expected=404)
        # An external replacement must take precedence over older PWA history.
        with closing(sqlite3.connect(database)) as db:
            db.execute('UPDATE tanda_terima_asset SET foto=? WHERE id=1', (external_name,))
            db.commit()
        assert request('/1/foto') == image
        (work / 'photos' / external_name).unlink()
        request('/1/foto', expected=404)  # Do not silently serve an outdated PWA photo.
        for invalid_name in ('../fixture.sqlite', '../photos/' + stored_path, 'https://example.com/photo.jpg'):
            with closing(sqlite3.connect(database)) as db:
                db.execute('UPDATE tanda_terima_asset SET foto=? WHERE id=2', (invalid_name,))
                db.commit()
            request('/2/foto', token=tokens[1], expected=404)
            assert json.loads(request('', token=tokens[1]))['data'][0]['has_foto'] is False
        with closing(sqlite3.connect(database)) as db:
            db.execute('UPDATE tanda_terima_asset SET foto=NULL WHERE id=2')
            db.commit()
        # Backfill links historical uploads to the receipt and preserves existing photos.
        sync_code = (
            "require " + repr((root / 'backend/config/database.php').as_posix()) + ";"
            "$pdo = new PDO('sqlite:' . " + repr(database.as_posix()) + ", null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);"
            "$property = new ReflectionProperty(Database::class, 'pdo'); $property->setValue(null, $pdo);"
            "define('ASSET_RECEIPT_PHOTO_DIR', " + repr((work / 'photos').as_posix()) + ");"
            "require " + repr((root / 'backend/sync_asset_receipt_photos.php').as_posix()) + ";"
        )
        with closing(sqlite3.connect(database)) as db:
            db.execute('UPDATE tanda_terima_asset SET foto=NULL WHERE id=1')
            db.commit()
        subprocess.run([php, '-r', sync_code], check=True, capture_output=True)
        with closing(sqlite3.connect(database)) as db:
            assert db.execute('SELECT foto FROM tanda_terima_asset WHERE id=1').fetchone()[0] == stored_path
            db.execute("UPDATE tanda_terima_asset SET foto='existing.jpg' WHERE id=1")
            db.commit()
        subprocess.run([php, '-r', sync_code], check=True, capture_output=True)
        with closing(sqlite3.connect(database)) as db:
            assert db.execute('SELECT foto FROM tanda_terima_asset WHERE id=1').fetchone()[0] == 'existing.jpg'
            db.execute('UPDATE tanda_terima_asset SET foto=? WHERE id=1', (stored_path,))
            db.commit()
        request('/1/foto', token=tokens[1], expected=404)
        request('/1/surat', token=tokens[1], expected=404)
        # A new holder cannot inherit the previous holder's photo or completion status.
        with closing(sqlite3.connect(database)) as db:
            db.execute("UPDATE tanda_terima_asset SET karyawan_id=1753, nik_pemegang='1596', nama_pemegang='BUDI' WHERE id=1")
            db.commit()
        request('/1/foto', expected=404)
        request('/1/foto', token=tokens[1], expected=404)
        request('/1/surat', token=tokens[1], expected=409)
        assert not any(row['has_foto'] for row in json.loads(request('', token=tokens[1]))['data'])
        request('/1/foto', token=tokens[1], photo=image, expected=409)
        with closing(sqlite3.connect(database)) as db:
            assert db.execute('SELECT foto FROM tanda_terima_asset WHERE id=1').fetchone()[0] == stored_path
            assert db.execute('SELECT COUNT(*) FROM tanda_terima_asset_fotos').fetchone()[0] == 1
    finally:
        server.terminate()
        server.wait(timeout=10)
        log.close()
print('Multipart upload, receipt persistence, filesystem/database rollback, and ownership checks passed.')
