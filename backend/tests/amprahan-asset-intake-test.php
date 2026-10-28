<?php

require_once __DIR__ . '/../app/Http/Controllers/AmprahanController.php';

use App\Http\Controllers\AmprahanController;
use App\Services\PwaSession;

function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$schema = [
    'CREATE TABLE users (id INTEGER PRIMARY KEY, karyawan_id INTEGER)',
    'CREATE TABLE karyawans (id INTEGER PRIMARY KEY, nama_lengkap TEXT, nik TEXT, departemen TEXT, divisi TEXT)',
    'CREATE TABLE master_kapals (id INTEGER PRIMARY KEY, nama_kapal TEXT)',
    'CREATE TABLE permohonan_amprahans (id INTEGER PRIMARY KEY, user_id INTEGER, kapal_id INTEGER, jenis_amprahan TEXT, status TEXT, keterangan_umum TEXT, created_at TEXT, nomor_voyage TEXT, tujuan_permintaan TEXT, tanggal_diterima TEXT)',
    'CREATE TABLE permohonan_amprahan_items (id INTEGER PRIMARY KEY, permohonan_id INTEGER, nama_barang TEXT, link_barang TEXT, jumlah REAL, jumlah_disetujui REAL, satuan TEXT, keterangan TEXT)',
    'CREATE TABLE purchase_orders (id INTEGER PRIMARY KEY, permohonan_amprahan_id INTEGER, nomor_po TEXT, vendor TEXT, status TEXT)',
    'CREATE TABLE purchase_order_items (id INTEGER PRIMARY KEY, purchase_order_id INTEGER, urutan INTEGER, deskripsi TEXT, kuantitas REAL, satuan TEXT, jumlah REAL, masuk_asset INTEGER)',
    'CREATE TABLE assets (id INTEGER PRIMARY KEY, source_table TEXT, source_id INTEGER, kode_asset TEXT UNIQUE, nama_asset TEXT, nama_merk TEXT, spesifikasi TEXT, kategori TEXT, nomor_seri TEXT, lokasi TEXT, lokasi_asset TEXT, kapal_id INTEGER, tanggal_perolehan TEXT, tanggal_tanda_terima TEXT, tanggal_kadaluarsa TEXT, kuantitas REAL, satuan TEXT, kondisi TEXT, status TEXT, karyawan_id INTEGER, vendor TEXT, nomor_faktur TEXT, foto TEXT, lampiran TEXT, keterangan TEXT, created_by INTEGER, created_at TEXT, updated_at TEXT, deleted_at TEXT)',
    'CREATE UNIQUE INDEX asset_source ON assets(source_table, source_id)',
    'CREATE TABLE tanda_terima_asset (id INTEGER PRIMARY KEY, asset_id INTEGER UNIQUE, karyawan_id INTEGER, kode_asset TEXT, nama_asset TEXT, nama_merk TEXT, kategori TEXT, nomor_seri TEXT, kondisi TEXT, status TEXT, lokasi TEXT, nama_pemegang TEXT, nik_pemegang TEXT, departemen_pemegang TEXT, tanggal_tanda_terima TEXT, keterangan TEXT, created_by INTEGER, created_at TEXT, updated_at TEXT)',
];
foreach ($schema as $sql) $pdo->exec($sql);
$pdo->exec("INSERT INTO users VALUES (1, 10), (2, 20)");
$pdo->exec("INSERT INTO karyawans VALUES (10, 'Ani', '001', 'Teknik', 'Teknik'), (20, 'Budi', '002', 'Operasi', 'Operasi')");
$pdo->exec("INSERT INTO master_kapals VALUES (1, 'KM Contoh')");
$pdo->exec("INSERT INTO permohonan_amprahans (id,user_id,kapal_id,jenis_amprahan,status) VALUES (1,1,1,'kapal','approved'), (2,2,1,'kapal','approved'), (3,1,1,'kapal','approved')");
$pdo->exec("INSERT INTO permohonan_amprahan_items (id,permohonan_id,nama_barang,jumlah,jumlah_disetujui,satuan) VALUES (11,1,'Kasur',1,1,'pcs'), (12,1,'Oli',2,2,'liter')");
$pdo->exec("INSERT INTO purchase_orders VALUES (1,1,'PO-001','Vendor A','issued')");
$pdo->exec("INSERT INTO purchase_order_items VALUES (101,1,1,'Kasur',1,'pcs',500000,1), (102,1,2,'Oli',2,'liter',100000,0)");

$database = new ReflectionProperty(Database::class, 'pdo');
$database->setValue(null, $pdo);
$token = PwaSession::issue(1);
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
$controller = new AmprahanController();

function callController(callable $call): array {
    http_response_code(200);
    ob_start();
    $call();
    $body = json_decode(ob_get_clean(), true);
    return [http_response_code(), $body];
}

[$code, $list] = callController(fn () => $controller->getMyRequests([]));
check($code === 200 && count($list['data']) === 2, 'Daftar harus dibatasi ke pemilik');
[$code, $ships] = callController(fn () => $controller->getAssetShips());
check($code === 200 && $ships['data'][0]['nama_kapal'] === 'KM Contoh', 'Daftar kapal aset harus tersedia');
$request = current(array_filter($list['data'], static fn ($row) => $row['id'] == 1));
check($request['items'][0]['masuk_asset'] === true, 'Centang PO harus terhubung ke barang pertama');
check(!isset($request['items'][1]['masuk_asset']) || $request['items'][1]['masuk_asset'] === false, 'Barang kedua tidak masuk aset');

[$code] = callController(fn () => $controller->submitTandaTerima(['permohonan_id' => 1, 'assets' => []]));
check($code === 422, 'Form aset wajib untuk barang yang dicentang');
check($pdo->query('SELECT status FROM permohonan_amprahans WHERE id=1')->fetchColumn() === 'approved', 'Penerimaan gagal harus rollback');

$form = ['po_item_id' => 101, 'kode_asset' => 'AST-PO-101', 'nama_asset' => 'Kasur', 'kategori' => 'Perlengkapan',
    'kondisi' => 'Baru', 'status' => 'Tersedia', 'lokasi' => 'Di kapal', 'lokasi_asset' => 'CABIN', 'kapal_id' => '1',
    'nama_merk' => 'Merk A', 'nomor_seri' => 'S-001', 'spesifikasi' => 'Ukuran besar',
    'tanggal_perolehan' => '2026-10-28', 'tanggal_tanda_terima' => '2026-10-28',
    'tanggal_kadaluarsa' => '', 'kuantitas' => '1', 'satuan' => 'pcs', 'vendor' => 'Vendor A',
    'nomor_faktur' => 'PO-001', 'keterangan' => 'Dari PO'];
[$code, $result] = callController(fn () => $controller->submitTandaTerima(['permohonan_id' => 1, 'assets' => [$form]]));
check($code === 200 && $result['assets_created'] === 1, 'Aset harus dibuat ketika diterima');
check($pdo->query('SELECT status FROM permohonan_amprahans WHERE id=1')->fetchColumn() === 'received', 'Permohonan harus diterima');
check($pdo->query('SELECT COUNT(*) FROM assets WHERE source_id=101')->fetchColumn() == 1, 'Aset PO dibuat sekali');
check($pdo->query('SELECT COUNT(*) FROM tanda_terima_asset')->fetchColumn() == 1, 'Tanda terima aset ikut dibuat');
$saved = $pdo->query('SELECT kode_asset, status, lokasi, kapal_id, spesifikasi, kuantitas, satuan, nomor_faktur FROM assets WHERE source_id=101')->fetch();
check($saved['kode_asset'] === 'AST-PO-101' && $saved['status'] === 'Tersedia'
    && $saved['lokasi'] === 'Di kapal' && $saved['kapal_id'] == 1
    && $saved['spesifikasi'] === 'Ukuran besar' && $saved['kuantitas'] == 1
    && $saved['satuan'] === 'pcs' && $saved['nomor_faktur'] === 'PO-001',
    'Field kapal dan pengadaan harus tersimpan pada asset AYPSIS');
[$code, $list] = callController(fn () => $controller->getMyRequests([]));
check($code === 200 && $list['data'][1]['items'][0]['asset_id'] > 0, 'Daftar harus menandai aset yang sudah tersimpan');

[$code, $result] = callController(fn () => $controller->submitTandaTerima(['permohonan_id' => 3, 'assets' => []]));
check($code === 200 && $result['assets_created'] === 0, 'Permohonan tanpa aset tetap bisa diterima');

[$code] = callController(fn () => $controller->submitTandaTerima(['permohonan_id' => 2, 'assets' => []]));
check($code === 403, 'Pengguna lain tidak boleh menerima permohonan');

echo "Amprahan asset intake OK\n";
