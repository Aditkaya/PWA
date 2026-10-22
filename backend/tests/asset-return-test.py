"""Real authenticated HTTP requests against isolated SQLite fixtures; no production writes."""
from contextlib import closing
from io import BytesIO
import json
import os
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from xml.etree import ElementTree as ET
from zipfile import ZipFile

root = Path(__file__).resolve().parents[2]
php = shutil.which('php')
with tempfile.TemporaryDirectory(prefix='asset-return-', dir=root / 'scratch') as temporary:
    work = Path(temporary)
    database = work / 'fixture.sqlite'
    with closing(sqlite3.connect(database)) as db:
        db.executescript('''
            CREATE TABLE users (id INTEGER PRIMARY KEY, karyawan_id INTEGER);
            INSERT INTO users VALUES (1,1752),(2,1753),(3,NULL);
            CREATE TABLE karyawans (id INTEGER PRIMARY KEY, nik TEXT, nama_lengkap TEXT);
            INSERT INTO karyawans VALUES (1752,'1595','ADIT & <QA>'),(1753,'1596','BUDI');
            CREATE TABLE user_feature_permissions (user_id INTEGER, feature_key TEXT, is_enabled INTEGER);
            CREATE TABLE assets (id INTEGER PRIMARY KEY, karyawan_id INTEGER, deleted_at TEXT);
            INSERT INTO assets VALUES (1,1752,NULL),(2,1752,NULL),(3,1753,NULL),(4,1752,NULL);
            CREATE TABLE tanda_terima_asset (id INTEGER PRIMARY KEY, asset_id INTEGER, karyawan_id INTEGER,
                kode_asset TEXT, nama_asset TEXT, nama_merk TEXT, nomor_seri TEXT, kondisi TEXT,
                nama_pemegang TEXT, nik_pemegang TEXT, departemen_pemegang TEXT);
            INSERT INTO tanda_terima_asset VALUES
                (1,1,1752,'AST-1','Laptop','Lenovo','SN-1','Baik','ADIT & <QA>','1595','IT'),
                (2,2,1752,'AST-2','Smartphone','Samsung','SN-2','Baik','ADIT & <QA>','1595','IT'),
                (3,3,1753,'AST-3','Monitor','Dell','SN-3','Baik','BUDI','1596','HRD'),
                (4,4,1752,'AST-4','ID Card',NULL,NULL,'Baik','ADIT & <QA>','1595','IT');
        ''')
    router = work / 'router.php'
    router.write_text("<?php\nrequire_once " + repr((root / 'backend/config/database.php').as_posix()) + ";\n"
        "$pdo = new PDO('sqlite:' . __DIR__ . '/fixture.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);\n"
        "$property = new ReflectionProperty(Database::class, 'pdo'); $property->setValue(null, $pdo);\n"
        "require_once " + repr((root / 'backend/app/Services/AssetReturnSchema.php').as_posix()) + ";\n"
        "\\App\\Services\\AssetReturnSchema::ensure($pdo);\n"
        "require " + repr((root / 'backend/routes/api.php').as_posix()) + ";\n", encoding='utf-8')
    session_class = (root / 'backend/app/Services/PwaSession.php').as_posix()
    tokens = [subprocess.check_output([php, '-d', f'session.save_path={work}', '-r',
        f"require '{session_class}'; echo \\App\\Services\\PwaSession::issue({user});"], text=True).strip() for user in (1, 2, 3)]
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    log = (work / 'server.log').open('w')
    server = subprocess.Popen([php, '-d', f'session.save_path={work}', '-d', f'sys_temp_dir={work}',
        '-S', f'127.0.0.1:{port}', str(router)], cwd=root, stdout=log, stderr=log,
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    def request(path='', token=tokens[0], data=None, expected=200, method=None):
        headers = {'Authorization': f'Bearer {token}'} if token else {}
        if data is not None:
            headers['Content-Type'] = 'application/json'
        req = urllib.request.Request(f'http://127.0.0.1:{port}/api/tanda-terima-asset/pengembalian{path}',
            data=json.dumps(data).encode() if data is not None else None, headers=headers, method=method)
        try:
            response = urllib.request.urlopen(req, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        body = response.read()
        assert response.code == expected, (path, response.code, expected, body[:400])
        return body if path.endswith('/dokumen') and expected == 200 else json.loads(body)
    def form(ids=(1, 2)):
        return {'tanggal_pengembalian': '2026-10-22', 'alasan': 'Mutasi', 'catatan': 'Charger & kabel <lengkap>',
            'nama_pic': 'PIC TEST', 'nama_hrd': 'HRD TEST',
            'nama_karyawan': 'FAKE NAME', 'karyawan_id': 1753,
            'items': [{'id': id, 'kondisi': 'Baik', 'kelengkapan': 'Lengkap', 'keterangan': 'Termasuk charger'} for id in ids]}
    try:
        for attempt in range(50):
            try:
                with socket.create_connection(('127.0.0.1', port), timeout=.2): break
            except OSError: time.sleep(.1)
        request(token=None, expected=401)
        assert request()['data'] == []
        assert len(request('/options')['data']) == 3
        assert request('/options', token=tokens[2])['data'] == []
        request(data=form((3,)), expected=404)
        request(data=form((1, 3)), expected=404)
        assert request()['data'] == []  # A mixed-owner batch rolls back entirely.
        request(data=form((1, 1)), expected=422)
        request(data={**form(), 'tanggal_pengembalian': '2026-02-30'}, expected=422)
        request(data={**form(), 'alasan': 'Lainnya'}, expected=422)
        request(data={**form(), 'items': []}, expected=422)
        request(data={**form(), 'catatan': 'x' * 601}, expected=422)
        saved = request(data=form(), expected=201)
        id = saved['id']
        request(data=form((1,)), expected=409)
        records = request()['data']
        assert len(records) == 1 and records[0]['status'] == 'menunggu_admin'
        assert records[0]['form']['nama_karyawan'] == 'ADIT & <QA>'
        assert len(request('/options')['data']) == 1
        assert request(token=tokens[1])['data'] == []
        request(f'/{id}/dokumen', token=tokens[1], expected=404)
        request(f'/{id}/dokumen', method='POST', expected=405)
        document = request(f'/{id}/dokumen')
        with ZipFile(BytesIO(document)) as generated, ZipFile(root / 'backend/templates/pengembalian-asset.docx') as source:
            assert generated.namelist() == source.namelist()
            for name in source.namelist():
                if name != 'word/document.xml': assert generated.read(name) == source.read(name), name
            xml = ET.fromstring(generated.read('word/document.xml'))
            text = ''.join(xml.itertext())
            assert 'ADIT & <QA>' in text and 'FAKE NAME' not in text
            assert 'Charger & kabel <lengkap>' in text and 'Lenovo' in text and 'SN-2' in text
            assert '[Nama Karyawan]' not in text and '[Aset Lainnya]' not in text
            assert 'FORMULIR PENGEMBALIAN ASET KARYAWAN' in text
        if os.environ.get('ASSET_RETURN_QA_DOCX'):
            Path(os.environ['ASSET_RETURN_QA_DOCX']).write_bytes(document)
        with closing(sqlite3.connect(database)) as db:
            assert db.execute('SELECT karyawan_id FROM assets WHERE id=1').fetchone()[0] == 1752
            assert db.execute('SELECT karyawan_id FROM tanda_terima_asset WHERE id=1').fetchone()[0] == 1752
            db.execute('UPDATE assets SET karyawan_id=NULL WHERE id=1')
            db.execute('DELETE FROM tanda_terima_asset WHERE id=1')
            db.commit()
        record = request()['data'][0]
        assert record['status'] == 'menunggu_admin' and record['items'][0]['released_at']
        assert record['items'][1]['released_at'] is None
        with ZipFile(BytesIO(request(f'/{id}/dokumen'))) as archived, ZipFile(BytesIO(document)) as original:
            assert archived.read('word/document.xml') == original.read('word/document.xml')  # Snapshot survives admin release.
        with closing(sqlite3.connect(database)) as db:
            db.execute('UPDATE assets SET karyawan_id=1753 WHERE id=2')
            db.commit()
        assert request()['data'][0]['status'] == 'dikembalikan'
        with closing(sqlite3.connect(database)) as db:
            db.execute('UPDATE assets SET karyawan_id=1752 WHERE id=2')
            db.execute("INSERT INTO user_feature_permissions VALUES (1,'tanda_terima_asset',0)")
            db.commit()
        request(expected=403)
        request('/options', expected=403)
        request(f'/{id}/dokumen', expected=403)
        request(data=form((4,)), expected=403)
        assert not list(work.glob('asset-return-*'))  # Generated download files are removed.
    finally:
        server.terminate()
        server.wait(timeout=10)
        log.close()
print('Asset return HTTP, validation, owner access, duplicate prevention, admin release, snapshot, and DOCX fidelity checks passed.')
