<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../Services/PwaSession.php';

use Database;
use PDO;
use Exception;

class AmprahanController {
    
    public function submitRequest($postData) {
        $user_id = $postData['user_id'] ?? null;
        $jenis_amprahan = strtolower(trim((string) ($postData['jenis_amprahan'] ?? 'lainnya')));
        $kapal_id = $postData['kapal_id'] ?? null;
        $mobil_id = $postData['mobil_id'] ?? null;
        $alat_berat_id = $postData['alat_berat_id'] ?? null;
        $tujuan_permintaan = trim((string) ($postData['tujuan_permintaan'] ?? ''));
        $nomor_voyage = $postData['nomor_voyage'] ?? null;
        $keterangan_umum = $postData['keterangan_umum'] ?? null;
        $items = $postData['items'] ?? [];
        $jenisValid = ['kapal', 'kendaraan', 'alat_berat', 'lainnya'];

        if (!$user_id || empty($items)) {
            http_response_code(400);
            echo json_encode(['message' => 'Data tidak lengkap (user_id, items)']);
            return;
        }

        if (!in_array($jenis_amprahan, $jenisValid, true)) {
            http_response_code(400);
            echo json_encode(['message' => 'Jenis amprahan tidak valid']);
            return;
        }

        if ($jenis_amprahan === 'kapal') {
            if (!$kapal_id || !filter_var($kapal_id, FILTER_VALIDATE_INT)) {
                http_response_code(400);
                echo json_encode(['message' => 'Kapal wajib dipilih']);
                return;
            }
        } elseif ($jenis_amprahan === 'kendaraan') {
            if (!$mobil_id || !filter_var($mobil_id, FILTER_VALIDATE_INT)) {
                http_response_code(400);
                echo json_encode(['message' => 'Kendaraan wajib dipilih']);
                return;
            }
            $kapal_id = null;
            $nomor_voyage = null;
        } elseif ($jenis_amprahan === 'alat_berat') {
            if (!$alat_berat_id || !filter_var($alat_berat_id, FILTER_VALIDATE_INT)) {
                http_response_code(400);
                echo json_encode(['message' => 'Alat berat wajib dipilih']);
                return;
            }
            $kapal_id = null;
            $mobil_id = null;
            $nomor_voyage = null;
        } elseif ($jenis_amprahan === 'lainnya') {
            if ($tujuan_permintaan === '') {
                http_response_code(400);
                echo json_encode(['message' => 'Tujuan permintaan wajib diisi']);
                return;
            }
            $kapal_id = null;
            $mobil_id = null;
            $alat_berat_id = null;
            $nomor_voyage = null;
        } else {
            $kapal_id = null;
            $mobil_id = null;
            $alat_berat_id = null;
            $tujuan_permintaan = '';
            $nomor_voyage = null;
        }

        try {
            $pdo = Database::getConnection();

            if ($jenis_amprahan === 'kapal') {
                $kapalStmt = $pdo->prepare("SELECT id FROM master_kapals WHERE id = ? AND status = 'aktif'");
                $kapalStmt->execute([$kapal_id]);
                if (!$kapalStmt->fetch(PDO::FETCH_ASSOC)) {
                    throw new Exception('Kapal tidak ditemukan atau tidak aktif');
                }
            }

            if ($jenis_amprahan === 'kendaraan') {
                $mobilStmt = $pdo->prepare("SELECT id FROM mobils WHERE id = ?");
                $mobilStmt->execute([$mobil_id]);
                if (!$mobilStmt->fetch(PDO::FETCH_ASSOC)) {
                    throw new Exception('Kendaraan tidak ditemukan');
                }
            }

            if ($jenis_amprahan === 'alat_berat') {
                $alatBeratStmt = $pdo->prepare("SELECT id FROM alat_berats WHERE id = ?");
                $alatBeratStmt->execute([$alat_berat_id]);
                if (!$alatBeratStmt->fetch(PDO::FETCH_ASSOC)) {
                    throw new Exception('Alat berat tidak ditemukan');
                }
            }

            $pdo->beginTransaction();

            $stmt = $pdo->prepare("
                INSERT INTO permohonan_amprahans
                    (user_id, jenis_amprahan, kapal_id, mobil_id, alat_berat_id, nomor_voyage, tujuan_permintaan, keterangan_umum, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            ");
            $stmt->execute([$user_id, $jenis_amprahan, $kapal_id, $mobil_id, $alat_berat_id, $nomor_voyage, $tujuan_permintaan !== '' ? $tujuan_permintaan : null, $keterangan_umum]);
            
            $permohonan_id = $pdo->lastInsertId();

            $stmtItem = $pdo->prepare("
                INSERT INTO permohonan_amprahan_items (permohonan_id, nama_barang, link_barang, jumlah, satuan, keterangan)
                VALUES (?, ?, ?, ?, ?, ?)
            ");

            foreach ($items as $item) {
                if (empty($item['nama_barang']) || empty($item['jumlah']) || empty($item['satuan'])) {
                    throw new Exception('Data item tidak valid');
                }

                $linkBarang = trim((string) ($item['link_barang'] ?? ''));
                if ($linkBarang !== '' && (!filter_var($linkBarang, FILTER_VALIDATE_URL) || !preg_match('/^https?:\\/\\//i', $linkBarang))) {
                    throw new Exception('Link barang harus berupa URL http atau https yang valid');
                }
                
                $stmtItem->execute([
                    $permohonan_id,
                    $item['nama_barang'],
                    $linkBarang !== '' ? $linkBarang : null,
                    $item['jumlah'],
                    $item['satuan'],
                    $item['keterangan'] ?? null
                ]);
            }

            $pdo->commit();
            http_response_code(200);
            echo json_encode(['message' => 'Permintaan amprahan berhasil diajukan']);
        } catch (\PDOException $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server database']);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(400);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    public function getMobils() {
        try {
            $pdo = Database::getConnection();

            // Nama kolom KIR dapat berbeda antar database lama/baru.
            $columnsStmt = $pdo->query("SHOW COLUMNS FROM mobils");
            $columns = array_column($columnsStmt->fetchAll(PDO::FETCH_ASSOC), 'Field');
            $kirColumn = null;
            foreach (['nomor_kir', 'no_kir', 'kir'] as $candidate) {
                if (in_array($candidate, $columns, true)) {
                    $kirColumn = $candidate;
                    break;
                }
            }

            $kirSelect = $kirColumn
                ? "`$kirColumn` AS nomor_kir"
                : "NULL AS nomor_kir";
            $kirOrder = $kirColumn ? "`$kirColumn` ASC, " : '';
            $stmt = $pdo->query("SELECT id, kode_no, nomor_polisi, $kirSelect, jenis FROM mobils ORDER BY nomor_polisi ASC, $kirOrder kode_no ASC");
            http_response_code(200);
            echo json_encode(['data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Gagal memuat data kendaraan']);
        }
    }

    public function getAlatBerats() {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query("SELECT * FROM alat_berats ORDER BY id ASC");
            http_response_code(200);
            echo json_encode(['data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Gagal memuat data alat berat']);
        }
    }

    public function getApprovedRequests($requestData) {
        $kapal_id = $requestData['kapal_id'] ?? null;
        $nomor_voyage = $requestData['nomor_voyage'] ?? null;

        if (!$kapal_id || !$nomor_voyage) {
            http_response_code(400);
            echo json_encode(['message' => 'Kapal ID dan Nomor Voyage diperlukan']);
            return;
        }

        try {
            $pdo = Database::getConnection();
            
            // Get all approved requests for this kapal and voyage
            $stmt = $pdo->prepare("
                SELECT p.id, p.user_id, p.status, p.keterangan_umum, p.created_at, 
                       u.username as user_nama
                FROM permohonan_amprahans p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.kapal_id = ? AND p.nomor_voyage = ? AND p.status = 'approved'
                ORDER BY p.created_at DESC
            ");
            $stmt->execute([$kapal_id, $nomor_voyage]);
            $permohonans = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // For each request, get its items
            $permohonanIds = array_column($permohonans, 'id');
            if (!empty($permohonanIds)) {
                $inQuery = implode(',', array_fill(0, count($permohonanIds), '?'));
                $stmtItems = $pdo->prepare("
                    SELECT id, permohonan_id, nama_barang, link_barang, jumlah, satuan, keterangan
                    FROM permohonan_amprahan_items
                    WHERE permohonan_id IN ($inQuery)
                ");
                $stmtItems->execute($permohonanIds);
                $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

                // Group items by permohonan_id
                $itemsGrouped = [];
                foreach ($items as $item) {
                    $itemsGrouped[$item['permohonan_id']][] = $item;
                }

                // Attach items to permohonans
                foreach ($permohonans as &$permohonan) {
                    $permohonan['items'] = $itemsGrouped[$permohonan['id']] ?? [];
                }
            }

            http_response_code(200);
            echo json_encode(['data' => $permohonans]);

        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server database']);
        }
    }

    public function getMyRequests($requestData) {
        $user_id = \App\Services\PwaSession::userId();
        if (!$user_id) {
            http_response_code(401);
            echo json_encode(['message' => 'Silakan masuk kembali']);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                SELECT p.id, p.user_id, p.kapal_id, p.jenis_amprahan, p.status, p.keterangan_umum,
                       p.created_at, p.nomor_voyage, p.tujuan_permintaan,
                       k.nama_kapal
                FROM permohonan_amprahans p
                LEFT JOIN master_kapals k ON p.kapal_id = k.id
                WHERE p.user_id = ?
                ORDER BY p.created_at DESC, p.id DESC
            ");
            $stmt->execute([$user_id]);
            $permohonans = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $ids = array_column($permohonans, 'id');
            if ($ids) {
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                $itemsStmt = $pdo->prepare("
                    SELECT id, permohonan_id, nama_barang, link_barang, jumlah, jumlah_disetujui, satuan, keterangan
                    FROM permohonan_amprahan_items
                    WHERE permohonan_id IN ($placeholders)
                    ORDER BY id ASC
                ");
                $itemsStmt->execute($ids);
                $itemsByRequest = [];
                foreach ($itemsStmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
                    $itemsByRequest[$item['permohonan_id']][] = $item;
                }
                foreach ($permohonans as &$permohonan) {
                    $permohonan['items'] = $itemsByRequest[$permohonan['id']] ?? [];
                }
                unset($permohonan);

                $poStmt = $pdo->prepare("
                    SELECT po.permohonan_amprahan_id, po.nomor_po, po.vendor,
                           poi.id, poi.urutan, poi.masuk_asset, poi.kuantitas, poi.satuan,
                           a.id AS asset_id
                    FROM purchase_orders po
                    JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
                    LEFT JOIN assets a ON a.source_table = 'purchase_order_items'
                        AND a.source_id = poi.id AND a.deleted_at IS NULL
                    WHERE po.permohonan_amprahan_id IN ($placeholders) AND po.status <> 'cancelled'
                    ORDER BY po.permohonan_amprahan_id, poi.urutan
                ");
                $poStmt->execute($ids);
                $poByRequest = [];
                foreach ($poStmt->fetchAll(PDO::FETCH_ASSOC) as $poItem) {
                    $poByRequest[$poItem['permohonan_amprahan_id']][] = $poItem;
                }
                foreach ($permohonans as &$permohonan) {
                    $approvedItems = array_values(array_filter($permohonan['items'],
                        static fn ($item) => (float) $item['jumlah_disetujui'] > 0));
                    foreach ($poByRequest[$permohonan['id']] ?? [] as $index => $poItem) {
                        if (!isset($approvedItems[$index])) continue;
                        foreach ($permohonan['items'] as &$item) {
                            if ($item['id'] != $approvedItems[$index]['id']) continue;
                            $item['po_item_id'] = (int) $poItem['id'];
                            $item['masuk_asset'] = (bool) $poItem['masuk_asset'];
                            $item['asset_id'] = $poItem['asset_id'] ? (int) $poItem['asset_id'] : null;
                            $item['nomor_po'] = $poItem['nomor_po'];
                            $item['vendor'] = $poItem['vendor'];
                            $item['kuantitas_po'] = $poItem['kuantitas'];
                            $item['satuan_po'] = $poItem['satuan'];
                            break;
                        }
                        unset($item);
                    }
                }
                unset($permohonan);
            }

            http_response_code(200);
            echo json_encode(['data' => $permohonans]);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Gagal memuat permohonan amprahan']);
        }
    }

    public function getAssetShips() {
        if (!\App\Services\PwaSession::userId()) {
            http_response_code(401);
            echo json_encode(['message' => 'Silakan masuk kembali']);
            return;
        }
        try {
            $pdo = Database::getConnection();
            $ships = $pdo->query('SELECT id, nama_kapal FROM master_kapals ORDER BY nama_kapal')->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['data' => $ships]);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Gagal memuat daftar kapal']);
        }
    }

    public function submitTandaTerima($postData, array $files = []) {
        $permohonan_id = $postData['permohonan_id'] ?? null;
        $user_id = \App\Services\PwaSession::userId();

        if (!$user_id) {
            http_response_code(401);
            echo json_encode(['message' => 'Silakan masuk kembali']);
            return;
        }
        if (!$permohonan_id || !filter_var($permohonan_id, FILTER_VALIDATE_INT)) {
            http_response_code(400);
            echo json_encode(['message' => 'ID permohonan tidak valid']);
            return;
        }

        $movedFiles = [];
        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();
            $lock = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
            $stmt = $pdo->prepare("SELECT id, user_id, kapal_id, status FROM permohonan_amprahans WHERE id = ?" . $lock);
            $stmt->execute([$permohonan_id]);
            $permohonan = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$permohonan) {
                $pdo->rollBack();
                http_response_code(404);
                echo json_encode(['message' => 'Permohonan tidak ditemukan']);
                return;
            }

            if ((int) $permohonan['user_id'] !== (int) $user_id) {
                $pdo->rollBack();
                http_response_code(403);
                echo json_encode(['message' => 'Permohonan ini bukan milik Anda']);
                return;
            }

            if (!in_array($permohonan['status'], ['approved', 'partially_approved'], true)) {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode(['message' => 'Status permohonan bukan approved (status saat ini: ' . $permohonan['status'] . ')']);
                return;
            }

            $poStmt = $pdo->prepare("
                SELECT poi.id, poi.deskripsi, poi.kuantitas, poi.satuan, poi.jumlah,
                       po.vendor, po.nomor_po, a.id AS asset_id
                FROM purchase_orders po
                JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
                LEFT JOIN assets a ON a.source_table = 'purchase_order_items'
                    AND a.source_id = poi.id AND a.deleted_at IS NULL
                WHERE po.permohonan_amprahan_id = ? AND po.status <> 'cancelled'
                    AND poi.masuk_asset = 1
                ORDER BY poi.urutan
            ");
            $poStmt->execute([$permohonan_id]);
            $poItems = $poStmt->fetchAll(PDO::FETCH_ASSOC);
            $assetForms = $postData['assets'] ?? [];
            if (!is_array($assetForms) || !array_is_list($assetForms)) {
                throw new \InvalidArgumentException('Data aset tidak valid');
            }
            $formsById = [];
            foreach ($assetForms as $form) {
                if (!is_array($form)) throw new \InvalidArgumentException('Data aset tidak valid');
                $id = filter_var($form['po_item_id'] ?? null, FILTER_VALIDATE_INT);
                if (!$id || isset($formsById[$id])) throw new \InvalidArgumentException('Item aset tidak valid atau duplikat');
                $formsById[$id] = $form;
            }

            $categories = ['Elektronik', 'Elektronik & IT', 'Kendaraan', 'Alat Berat',
                'Mesin & Peralatan', 'Furniture & Fixture', 'Bangunan & Properti', 'Lain-lain'];
            $shipCategories = ['Keselamatan', 'Navigasi', 'Buku', 'Perlengkapan', 'Peta'];
            $conditions = ['Baik', 'Rusak Ringan', 'Rusak Berat', 'Afkir'];
            $shipConditions = ['Belum diketahui', 'Bagus', 'Baru', 'Bekas', 'Bekas/Bagus',
                'Expired Batrai', 'Kurang', 'Kurang Bagus', 'Perlu Servis', 'Rusak', 'SPC/Rusak'];
            $allowedLocations = ['Jakarta', 'Batam', 'Di kapal', 'Di bawa oleh karyawan'];
            $allowedStatuses = ['Tersedia', 'Digunakan', 'Dalam Pemeliharaan', 'Dipinjam', 'Dijual', 'Dihapuskan'];
            $shipAssetLocations = ['2 DECK', 'ACOMODATION', 'ANJUNGAN', 'BATH AND AFTER',
                'BRIDGE', 'CABIN', 'CABIN F/P PALKA', 'CO2 ROOM', 'DAPUR', 'DECK',
                'DECK BAWAH', 'DECK KANAN', 'DECK KIRI', 'EMERGENCY ROOM', 'ENGINE ROOM',
                'GALERY KABIN', 'HALUAN', 'KAPAL', 'LAMBUNG KANAN', 'LAMBUNG KIRI',
                'MAIN DECK', 'PETA ROOM', 'RALLING', 'SHIP', 'THIRD DECK', 'TWEEN DECK KIRI'];
            $created = 0;
            foreach ($poItems as $poItem) {
                $id = (int) $poItem['id'];
                if ($poItem['asset_id']) {
                    if (isset($formsById[$id])) throw new \InvalidArgumentException('Aset PO ini sudah terdaftar');
                    continue;
                }
                $form = $formsById[$id] ?? null;
                if (!$form) throw new \InvalidArgumentException('Isi form aset untuk semua barang PO yang dicentang');
                unset($formsById[$id]);
                $nama = trim((string) ($form['nama_asset'] ?? ''));
                $kode = strtoupper(trim((string) ($form['kode_asset'] ?? '')));
                $kategori = trim((string) ($form['kategori'] ?? ''));
                $kondisi = trim((string) ($form['kondisi'] ?? ''));
                $lokasi = trim((string) ($form['lokasi'] ?? ''));
                $status = trim((string) ($form['status'] ?? ''));
                $kapalId = filter_var($form['kapal_id'] ?? null, FILTER_VALIDATE_INT);
                $lokasiAsset = trim((string) ($form['lokasi_asset'] ?? ''));
                $merk = trim((string) ($form['nama_merk'] ?? ''));
                $seri = trim((string) ($form['nomor_seri'] ?? ''));
                $spesifikasi = trim((string) ($form['spesifikasi'] ?? ''));
                $keterangan = trim((string) ($form['keterangan'] ?? ''));
                $tanggalPerolehan = trim((string) ($form['tanggal_perolehan'] ?? ''));
                $tanggalTerima = trim((string) ($form['tanggal_tanda_terima'] ?? ''));
                $tanggalKadaluarsa = trim((string) ($form['tanggal_kadaluarsa'] ?? ''));
                $kuantitas = $form['kuantitas'] ?? null;
                $satuan = trim((string) ($form['satuan'] ?? ''));
                $vendor = trim((string) ($form['vendor'] ?? ''));
                $nomorFaktur = trim((string) ($form['nomor_faktur'] ?? ''));
                $isShip = $lokasi === 'Di kapal';
                if ($nama === '' || strlen($nama) > 255 || $kode === '' || strlen($kode) > 50
                    || !in_array($kategori, $isShip ? $shipCategories : $categories, true)
                    || !in_array($kondisi, $isShip ? $shipConditions : $conditions, true)
                    || !in_array($lokasi, $allowedLocations, true)
                    || !in_array($status, $allowedStatuses, true)
                    || ($lokasiAsset !== '' && !in_array($lokasiAsset,
                        $isShip ? $shipAssetLocations : ['JKT', 'BTM', 'PNG'], true))
                    || strlen($merk) > 150 || strlen($seri) > 100
                    || strlen($spesifikasi) > 2000 || strlen($satuan) > 50
                    || strlen($vendor) > 150 || strlen($nomorFaktur) > 100
                    || strlen($keterangan) > 5000) {
                    throw new \InvalidArgumentException('Lengkapi data aset dengan nilai yang valid');
                }
                $validDate = static function (string $value): bool {
                    if ($value === '') return true;
                    $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);
                    return $date !== false && $date->format('Y-m-d') === $value;
                };
                if (!$validDate($tanggalPerolehan) || !$validDate($tanggalTerima)
                    || !$validDate($tanggalKadaluarsa)
                    || ($isShip && $kuantitas !== null && $kuantitas !== ''
                        && (!is_numeric($kuantitas) || (float) $kuantitas < 0))) {
                    throw new \InvalidArgumentException('Tanggal atau kuantitas aset tidak valid');
                }
                $codeStmt = $pdo->prepare('SELECT id FROM assets WHERE kode_asset = ?');
                $codeStmt->execute([$kode]);
                if ($codeStmt->fetchColumn()) throw new \InvalidArgumentException('Kode aset sudah digunakan: ' . $kode);
                if ($isShip) {
                    if (!$kapalId) throw new \InvalidArgumentException('Pilih kapal untuk lokasi aset');
                    $shipStmt = $pdo->prepare('SELECT id FROM master_kapals WHERE id = ?');
                    $shipStmt->execute([$kapalId]);
                    if (!$shipStmt->fetchColumn()) throw new \InvalidArgumentException('Kapal aset tidak ditemukan');
                }
                $karyawan = null;
                if ($lokasi === 'Di bawa oleh karyawan') {
                    $personStmt = $pdo->prepare('SELECT k.id, k.nama_lengkap, k.nik, k.departemen, k.divisi
                        FROM users u JOIN karyawans k ON k.id = u.karyawan_id WHERE u.id = ?');
                    $personStmt->execute([$user_id]);
                    $karyawan = $personStmt->fetch(PDO::FETCH_ASSOC);
                    if (!$karyawan) throw new \InvalidArgumentException('Akun Anda belum terhubung ke data karyawan');
                }

                $photo = $this->storeAssetFile($files['foto_' . $id] ?? null, 'foto', $movedFiles);
                $attachment = $this->storeAssetFile($files['lampiran_' . $id] ?? null, 'lampiran', $movedFiles);
                $assetStmt = $pdo->prepare("
                    INSERT INTO assets (source_table, source_id, kode_asset, nama_asset, nama_merk,
                        spesifikasi, kategori, nomor_seri, lokasi, lokasi_asset, kapal_id,
                        tanggal_perolehan, tanggal_tanda_terima, tanggal_kadaluarsa,
                        kuantitas, satuan, kondisi, status, karyawan_id,
                        vendor, nomor_faktur, foto, lampiran, keterangan, created_by, created_at, updated_at)
                    VALUES ('purchase_order_items', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ");
                $assetStmt->execute([$id, $kode, $nama, $merk ?: null, $spesifikasi ?: null,
                    $kategori, $seri ?: null, $lokasi, $lokasiAsset ?: null,
                    $isShip ? $kapalId : null,
                    $tanggalPerolehan ?: null, $tanggalTerima ?: null,
                    $isShip ? ($tanggalKadaluarsa ?: null) : null,
                    $isShip ? ($kuantitas === '' ? null : $kuantitas) : null,
                    $isShip ? ($satuan ?: null) : null, $kondisi,
                    $status, $karyawan['id'] ?? null, $vendor ?: null,
                    $nomorFaktur ?: null, $photo, $attachment, $keterangan ?: null, $user_id]);
                $assetId = $pdo->lastInsertId();

                // PDO tidak memicu observer Laravel; salin data tanda terima seperti AssetObserver.
                $receiptStmt = $pdo->prepare("
                    INSERT INTO tanda_terima_asset (asset_id, karyawan_id, kode_asset, nama_asset,
                        nama_merk, kategori, nomor_seri, kondisi, status, lokasi, nama_pemegang,
                        nik_pemegang, departemen_pemegang, tanggal_tanda_terima, keterangan,
                        created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ");
                $receiptStmt->execute([$assetId, $karyawan['id'] ?? null, $kode, $nama,
                    $merk ?: null, $kategori, $seri ?: null, $kondisi,
                    $status, $lokasi,
                    $karyawan['nama_lengkap'] ?? null, $karyawan['nik'] ?? null,
                    $karyawan['departemen'] ?? $karyawan['divisi'] ?? null,
                    $tanggalTerima ?: null, $keterangan ?: null, $user_id]);
                $created++;
            }
            if ($formsById) throw new \InvalidArgumentException('Form aset tidak sesuai dengan PO');

            $stmtUpdate = $pdo->prepare("
                UPDATE permohonan_amprahans 
                SET status = 'received', tanggal_diterima = CURRENT_TIMESTAMP
                WHERE id = ? AND status IN ('approved', 'partially_approved')
            ");
            $stmtUpdate->execute([$permohonan_id]);

            $pdo->commit();

            http_response_code(200);
            echo json_encode(['message' => 'Tanda terima berhasil dikonfirmasi', 'assets_created' => $created]);

        } catch (\InvalidArgumentException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            foreach ($movedFiles as $file) @unlink($file);
            http_response_code(422);
            echo json_encode(['message' => $e->getMessage()]);
        } catch (\PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            foreach ($movedFiles as $file) @unlink($file);
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server database']);
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            foreach ($movedFiles as $file) @unlink($file);
            http_response_code(500);
            error_log('Amprahan receive error: ' . $e->getMessage());
            echo json_encode(['message' => 'Gagal menyimpan tanda terima dan aset']);
        }
    }

    private function storeAssetFile(?array $file, string $kind, array &$movedFiles): ?string {
        if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
        if (($file['error'] ?? null) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'] ?? '')) {
            throw new \InvalidArgumentException('Unggahan file aset gagal');
        }
        $isPhoto = $kind === 'foto';
        $limit = $isPhoto ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
        if (($file['size'] ?? 0) < 1 || $file['size'] > $limit) {
            throw new \InvalidArgumentException($isPhoto ? 'Foto maksimal 5 MB' : 'Lampiran maksimal 10 MB');
        }
        $extension = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        $allowed = $isPhoto
            ? ['jpg' => ['image/jpeg'], 'jpeg' => ['image/jpeg'], 'png' => ['image/png'], 'webp' => ['image/webp']]
            : ['pdf' => ['application/pdf'], 'doc' => ['application/msword', 'application/octet-stream'],
                'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
                'jpg' => ['image/jpeg'], 'jpeg' => ['image/jpeg'], 'png' => ['image/png'],
                'zip' => ['application/zip', 'application/x-zip-compressed'],
                'rar' => ['application/vnd.rar', 'application/x-rar-compressed']];
        if (!isset($allowed[$extension]) || !in_array($mime, $allowed[$extension], true)) {
            throw new \InvalidArgumentException('Format file aset tidak didukung');
        }
        $relativeDir = $isPhoto ? 'uploads/assets/photos' : 'uploads/assets/documents';
        $directory = rtrim(AYPSIS_PUBLIC_DIR, '/\\') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativeDir);
        if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
            throw new \RuntimeException('Direktori unggahan aset tidak dapat dibuat');
        }
        $name = time() . '_asset_' . bin2hex(random_bytes(8)) . '.' . $extension;
        $destination = $directory . DIRECTORY_SEPARATOR . $name;
        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            throw new \RuntimeException('File aset tidak dapat disimpan');
        }
        $movedFiles[] = $destination;
        return $relativeDir . '/' . $name;
    }
}
