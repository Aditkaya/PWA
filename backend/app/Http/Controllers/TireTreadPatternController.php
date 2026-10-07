<?php

namespace App\Http\Controllers;

use PDO;
use Database;

require_once __DIR__ . '/../../../config/database.php';

class TireTreadPatternController {
    /**
     * Mengambil daftar kendaraan atau alat berat berdasarkan kategori:
     * - tractor-head: dari tabel mobils dengan jenis TRACTOR HEAD / TRACKTOR HEAD
     * - chassis-container: dari tabel mobils dengan jenis BUNTUT (20 FEET / 40 FEET)
     * - forklift: dari tabel alat_berats dengan jenis FORKLIFT
     */
    public function getUnits($params = []) {
        $category = strtolower(trim($params['category'] ?? ''));

        if (!$category) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Parameter category diperlukan (tractor-head, chassis-container, atau forklift)'
            ]);
            return;
        }

        try {
            $pdo = Database::getConnection();

            if ($category === 'tractor-head' || $category === 'tractor') {
                $sql = "SELECT id, kode_no, nomor_polisi, no_kir, no_kir AS nomor_kir, pajak_kir, nickname, merek, jenis, roda, tahun_pembuatan, lokasi 
                        FROM mobils 
                        WHERE UPPER(jenis) LIKE '%TRACTOR HEAD%' OR UPPER(jenis) LIKE '%TRACKTOR HEAD%'
                        ORDER BY nomor_polisi ASC, kode_no ASC";
                $stmt = $pdo->query($sql);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                http_response_code(200);
                echo json_encode([
                    'status' => 'success',
                    'category' => 'tractor-head',
                    'category_label' => 'Tracktor Head',
                    'source_table' => 'mobils',
                    'total' => count($rows),
                    'data' => $rows
                ]);
                return;
            }

            if ($category === 'chassis-container' || $category === 'chassis' || $category === 'buntut') {
                $sql = "SELECT id, kode_no, nomor_polisi, no_kir, no_kir AS nomor_kir, pajak_kir, nickname, merek, jenis, roda, tahun_pembuatan, lokasi 
                        FROM mobils 
                        WHERE UPPER(jenis) LIKE '%BUNTUT%'
                        ORDER BY kode_no ASC, nomor_polisi ASC";
                $stmt = $pdo->query($sql);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                http_response_code(200);
                echo json_encode([
                    'status' => 'success',
                    'category' => 'chassis-container',
                    'category_label' => 'Chassis Kontainer',
                    'source_table' => 'mobils',
                    'total' => count($rows),
                    'data' => $rows
                ]);
                return;
            }

            if ($category === 'forklift') {
                $sql = "SELECT id, kode_alat, nama, nickname, merk, jenis, kapasitas, tipe, lokasi, status 
                        FROM alat_berats 
                        WHERE UPPER(jenis) LIKE '%FORKLIFT%'
                        ORDER BY kode_alat ASC, nama ASC";
                $stmt = $pdo->query($sql);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                http_response_code(200);
                echo json_encode([
                    'status' => 'success',
                    'category' => 'forklift',
                    'category_label' => 'Forklift',
                    'source_table' => 'alat_berats',
                    'total' => count($rows),
                    'data' => $rows
                ]);
                return;
            }

            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => "Kategori '$category' tidak dikenal. Pilihan: tractor-head, chassis-container, forklift"
            ]);

        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('TireTreadPatternController error: ' . $e->getMessage());
            echo json_encode([
                'status' => 'error',
                'message' => 'Gagal mengambil data dari database: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Mengambil daftar ban terpakai (status = 'Terpakai') dari tabel stock_bans
     * berdasarkan mobil_id atau alat_berat_id.
     */
    public function getTires($params = []) {
        $mobilId = isset($params['mobil_id']) && $params['mobil_id'] !== '' ? (int)$params['mobil_id'] : null;
        $alatBeratId = isset($params['alat_berat_id']) && $params['alat_berat_id'] !== '' ? (int)$params['alat_berat_id'] : null;

        if (!$mobilId && !$alatBeratId) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Parameter mobil_id atau alat_berat_id diperlukan'
            ]);
            return;
        }

        try {
            $pdo = Database::getConnection();

            if ($mobilId) {
                $sql = "SELECT id, nama_stock_ban_id, nomor_seri, nomor_faktur, nomor_bukti, 
                               merk, ukuran, kondisi, status, status_masak, jumlah_masak, 
                               harga_beli, tanggal_masuk, tanggal_keluar, tanggal_digunakan, 
                               tanggal_kembali, lokasi, keterangan, status_ban_luar, 
                               mobil_id, alat_berat_id
                        FROM stock_bans 
                        WHERE mobil_id = :mobil_id AND status = 'Terpakai'
                        ORDER BY id ASC";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':mobil_id' => $mobilId]);
            } else {
                $sql = "SELECT id, nama_stock_ban_id, nomor_seri, nomor_faktur, nomor_bukti, 
                               merk, ukuran, kondisi, status, status_masak, jumlah_masak, 
                               harga_beli, tanggal_masuk, tanggal_keluar, tanggal_digunakan, 
                               tanggal_kembali, lokasi, keterangan, status_ban_luar, 
                               mobil_id, alat_berat_id
                        FROM stock_bans 
                        WHERE alat_berat_id = :alat_berat_id AND status = 'Terpakai'
                        ORDER BY id ASC";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':alat_berat_id' => $alatBeratId]);
            }

            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'mobil_id' => $mobilId,
                'alat_berat_id' => $alatBeratId,
                'total' => count($rows),
                'data' => $rows
            ]);

        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('TireTreadPatternController getTires error: ' . $e->getMessage());
            echo json_encode([
                'status' => 'error',
                'message' => 'Gagal mengambil data ban dari database: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Mengambil daftar ban terpasang pada roda unit saat ini dari tabel tire_wheel_installations.
     */
    public function getInstallations($params = []) {
        $mobilId = isset($params['mobil_id']) && $params['mobil_id'] !== '' ? (int)$params['mobil_id'] : null;
        $alatBeratId = isset($params['alat_berat_id']) && $params['alat_berat_id'] !== '' ? (int)$params['alat_berat_id'] : null;

        if (!$mobilId && !$alatBeratId) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Parameter mobil_id atau alat_berat_id diperlukan'
            ]);
            return;
        }

        try {
            $pdo = Database::getConnection();

            $sql = "SELECT id, mobil_id, alat_berat_id, category, wheel_id, wheel_code, wheel_name, 
                           stock_ban_id, nomor_seri, merk, ukuran, kondisi, is_borrowed, 
                           donor_unit_id, donor_unit_name, donor_category, borrowed_at, installed_at
                    FROM tire_wheel_installations 
                    WHERE " . ($mobilId ? "mobil_id = :unit_id" : "alat_berat_id = :unit_id") . "
                    ORDER BY wheel_id ASC";

            $stmt = $pdo->prepare($sql);
            $stmt->execute([':unit_id' => $mobilId ?: $alatBeratId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Buat mapping dictionary: wheel_id => stock_ban_id
            $assignments = [];
            $borrowedList = [];

            foreach ($rows as $r) {
                $wId = $r['wheel_id'];
                $bId = (int)$r['stock_ban_id'];
                $assignments[$wId] = $bId;

                if ((int)$r['is_borrowed'] === 1) {
                    $borrowedList[] = [
                        'id' => $bId,
                        'nomor_seri' => $r['nomor_seri'] ?? '',
                        'merk' => $r['merk'] ?? '',
                        'ukuran' => $r['ukuran'] ?? '',
                        'kondisi' => $r['kondisi'] ?? '',
                        'status' => 'Terpakai',
                        'isBorrowed' => true,
                        'borrowedMeta' => [
                            'donorUnitId' => $r['donor_unit_id'],
                            'donorUnitName' => $r['donor_unit_name'] ?? 'Unit Lain',
                            'donorCategory' => $r['donor_category'] ?? '',
                            'borrowedAt' => $r['borrowed_at']
                        ]
                    ];
                }
            }

            http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'data' => [
                    'assignments' => $assignments,
                    'borrowed' => $borrowedList,
                    'installations' => $rows,
                    'total_installed' => count($rows)
                ]
            ]);

        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('TireTreadPatternController getInstallations error: ' . $e->getMessage());
            echo json_encode([
                'status' => 'error',
                'message' => 'Gagal mengambil data ban terpasang: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Memasang ban ke posisi roda tertentu dan menyimpannya ke tabel tire_wheel_installations.
     */
    public function assignTire($data = []) {
        $mobilId = !empty($data['mobil_id']) ? (int)$data['mobil_id'] : null;
        $alatBeratId = !empty($data['alat_berat_id']) ? (int)$data['alat_berat_id'] : null;
        $wheelId = trim($data['wheel_id'] ?? '');
        $stockBanId = !empty($data['stock_ban_id']) ? (int)$data['stock_ban_id'] : null;

        if ((!$mobilId && !$alatBeratId) || !$wheelId || !$stockBanId) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Field mobil_id/alat_berat_id, wheel_id, dan stock_ban_id wajib diisi'
            ]);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            $category = $data['category'] ?? null;
            $wheelCode = $data['wheel_code'] ?? strtoupper($wheelId);
            $wheelName = $data['wheel_name'] ?? null;
            $nomorSeri = $data['nomor_seri'] ?? null;
            $merk = $data['merk'] ?? null;
            $ukuran = $data['ukuran'] ?? null;
            $kondisi = $data['kondisi'] ?? null;
            $isBorrowed = !empty($data['is_borrowed']) ? 1 : 0;
            $donorUnitId = !empty($data['donor_unit_id']) ? (int)$data['donor_unit_id'] : null;
            $donorUnitName = $data['donor_unit_name'] ?? null;
            $donorCategory = $data['donor_category'] ?? null;
            $borrowedAt = !empty($data['borrowed_at']) ? date('Y-m-d H:i:s', strtotime($data['borrowed_at'])) : null;

            // Jika atribut ban belum lengkap, ambil dari tabel stock_bans
            if (!$nomorSeri || !$merk) {
                $qSb = $pdo->prepare("SELECT nomor_seri, merk, ukuran, kondisi FROM stock_bans WHERE id = ?");
                $qSb->execute([$stockBanId]);
                $sb = $qSb->fetch(PDO::FETCH_ASSOC);
                if ($sb) {
                    $nomorSeri = $nomorSeri ?: $sb['nomor_seri'];
                    $merk = $merk ?: $sb['merk'];
                    $ukuran = $ukuran ?: $sb['ukuran'];
                    $kondisi = $kondisi ?: $sb['kondisi'];
                }
            }

            // 1. Hapus jika ban ini sebelumnya terpasang di posisi roda lain pada unit ini (pindah roda)
            $delOld = $pdo->prepare("
                DELETE FROM tire_wheel_installations 
                WHERE stock_ban_id = :stock_ban_id 
                   AND (" . ($mobilId ? "mobil_id = :m_id" : "alat_berat_id = :a_id") . ")
            ");
            $delOld->execute([
                ':stock_ban_id' => $stockBanId,
                ($mobilId ? ':m_id' : ':a_id') => ($mobilId ?: $alatBeratId)
            ]);

            // 2. Insert or Update ke tire_wheel_installations
            $insSql = "
                INSERT INTO tire_wheel_installations 
                    (mobil_id, alat_berat_id, category, wheel_id, wheel_code, wheel_name, 
                     stock_ban_id, nomor_seri, merk, ukuran, kondisi, is_borrowed, 
                     donor_unit_id, donor_unit_name, donor_category, borrowed_at, installed_at)
                VALUES 
                    (:mobil_id, :alat_berat_id, :category, :wheel_id, :wheel_code, :wheel_name, 
                     :stock_ban_id, :nomor_seri, :merk, :ukuran, :kondisi, :is_borrowed, 
                     :donor_unit_id, :donor_unit_name, :donor_category, :borrowed_at, NOW())
                ON DUPLICATE KEY UPDATE
                    stock_ban_id = VALUES(stock_ban_id),
                    category = VALUES(category),
                    wheel_code = VALUES(wheel_code),
                    wheel_name = VALUES(wheel_name),
                    nomor_seri = VALUES(nomor_seri),
                    merk = VALUES(merk),
                    ukuran = VALUES(ukuran),
                    kondisi = VALUES(kondisi),
                    is_borrowed = VALUES(is_borrowed),
                    donor_unit_id = VALUES(donor_unit_id),
                    donor_unit_name = VALUES(donor_unit_name),
                    donor_category = VALUES(donor_category),
                    borrowed_at = VALUES(borrowed_at),
                    installed_at = NOW(),
                    updated_at = NOW()
            ";
            $stmtIns = $pdo->prepare($insSql);
            $stmtIns->execute([
                ':mobil_id' => $mobilId,
                ':alat_berat_id' => $alatBeratId,
                ':category' => $category,
                ':wheel_id' => $wheelId,
                ':wheel_code' => $wheelCode,
                ':wheel_name' => $wheelName,
                ':stock_ban_id' => $stockBanId,
                ':nomor_seri' => $nomorSeri,
                ':merk' => $merk,
                ':ukuran' => $ukuran,
                ':kondisi' => $kondisi,
                ':is_borrowed' => $isBorrowed,
                ':donor_unit_id' => $donorUnitId,
                ':donor_unit_name' => $donorUnitName,
                ':donor_category' => $donorCategory,
                ':borrowed_at' => $borrowedAt
            ]);

            // 3. Catat ke tabel audit log
            $stmtLog = $pdo->prepare("
                INSERT INTO tire_installation_logs 
                    (mobil_id, alat_berat_id, category, wheel_id, wheel_code, stock_ban_id, nomor_seri, action, is_borrowed, donor_unit_id, donor_unit_name, notes)
                VALUES 
                    (:mobil_id, :alat_berat_id, :category, :wheel_id, :wheel_code, :stock_ban_id, :nomor_seri, 'pasang', :is_borrowed, :donor_unit_id, :donor_unit_name, :notes)
            ");
            $stmtLog->execute([
                ':mobil_id' => $mobilId,
                ':alat_berat_id' => $alatBeratId,
                ':category' => $category,
                ':wheel_id' => $wheelId,
                ':wheel_code' => $wheelCode,
                ':stock_ban_id' => $stockBanId,
                ':nomor_seri' => $nomorSeri,
                ':is_borrowed' => $isBorrowed,
                ':donor_unit_id' => $donorUnitId,
                ':donor_unit_name' => $donorUnitName,
                ':notes' => "Pasang ban #$nomorSeri ($merk) ke posisi roda [$wheelCode]" . ($isBorrowed ? " (Pinjaman dari $donorUnitName)" : "")
            ]);

            $pdo->commit();

            http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'message' => "Ban #$nomorSeri berhasil disimpan ke posisi roda [$wheelCode] di database",
                'data' => [
                    'wheel_id' => $wheelId,
                    'stock_ban_id' => $stockBanId,
                    'wheel_code' => $wheelCode,
                    'nomor_seri' => $nomorSeri
                ]
            ]);

        } catch (\PDOException $e) {
            if ($pdo && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            error_log('TireTreadPatternController assignTire error: ' . $e->getMessage());
            echo json_encode([
                'status' => 'error',
                'message' => 'Gagal menyimpan pemasangan ban ke database: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Mencopot ban dari posisi roda dan menghapus record dari tire_wheel_installations.
     */
    public function removeTire($data = []) {
        $mobilId = !empty($data['mobil_id']) ? (int)$data['mobil_id'] : null;
        $alatBeratId = !empty($data['alat_berat_id']) ? (int)$data['alat_berat_id'] : null;
        $wheelId = trim($data['wheel_id'] ?? '');

        if ((!$mobilId && !$alatBeratId) || !$wheelId) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Field mobil_id/alat_berat_id dan wheel_id wajib diisi'
            ]);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            // Ambil record sebelum dihapus untuk logging
            $findSql = "SELECT * FROM tire_wheel_installations 
                        WHERE wheel_id = :wheel_id 
                          AND (" . ($mobilId ? "mobil_id = :m_id" : "alat_berat_id = :a_id") . ")";
            $stmtFind = $pdo->prepare($findSql);
            $stmtFind->execute([
                ':wheel_id' => $wheelId,
                ($mobilId ? ':m_id' : ':a_id') => ($mobilId ?: $alatBeratId)
            ]);
            $existing = $stmtFind->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                // Catat ke audit log
                $stmtLog = $pdo->prepare("
                    INSERT INTO tire_installation_logs 
                        (mobil_id, alat_berat_id, category, wheel_id, wheel_code, stock_ban_id, nomor_seri, action, is_borrowed, donor_unit_id, donor_unit_name, notes)
                    VALUES 
                        (:mobil_id, :alat_berat_id, :category, :wheel_id, :wheel_code, :stock_ban_id, :nomor_seri, 'copot', :is_borrowed, :donor_unit_id, :donor_unit_name, :notes)
                ");
                $stmtLog->execute([
                    ':mobil_id' => $existing['mobil_id'],
                    ':alat_berat_id' => $existing['alat_berat_id'],
                    ':category' => $existing['category'],
                    ':wheel_id' => $existing['wheel_id'],
                    ':wheel_code' => $existing['wheel_code'],
                    ':stock_ban_id' => $existing['stock_ban_id'],
                    ':nomor_seri' => $existing['nomor_seri'],
                    ':is_borrowed' => $existing['is_borrowed'],
                    ':donor_unit_id' => $existing['donor_unit_id'],
                    ':donor_unit_name' => $existing['donor_unit_name'],
                    ':notes' => "Copot ban #{$existing['nomor_seri']} dari posisi roda [{$existing['wheel_code']}]"
                ]);

                // Hapus dari active installations
                $stmtDel = $pdo->prepare("DELETE FROM tire_wheel_installations WHERE id = ?");
                $stmtDel->execute([$existing['id']]);
            }

            $pdo->commit();

            http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'message' => "Ban pada roda [$wheelId] berhasil dicopot dari database",
                'data' => ['wheel_id' => $wheelId]
            ]);

        } catch (\PDOException $e) {
            if ($pdo && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            error_log('TireTreadPatternController removeTire error: ' . $e->getMessage());
            echo json_encode([
                'status' => 'error',
                'message' => 'Gagal mencopot ban dari database: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Mengosongkan / melepas semua ban dari seluruh posisi roda pada unit.
     */
    public function resetTires($data = []) {
        $mobilId = !empty($data['mobil_id']) ? (int)$data['mobil_id'] : null;
        $alatBeratId = !empty($data['alat_berat_id']) ? (int)$data['alat_berat_id'] : null;

        if (!$mobilId && !$alatBeratId) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Field mobil_id atau alat_berat_id wajib diisi'
            ]);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            // Catat log pelepasan semua roda
            $qRows = $pdo->prepare("SELECT * FROM tire_wheel_installations WHERE " . ($mobilId ? "mobil_id = ?" : "alat_berat_id = ?"));
            $qRows->execute([$mobilId ?: $alatBeratId]);
            $allRows = $qRows->fetchAll(PDO::FETCH_ASSOC);

            foreach ($allRows as $r) {
                $stmtLog = $pdo->prepare("
                    INSERT INTO tire_installation_logs 
                        (mobil_id, alat_berat_id, category, wheel_id, wheel_code, stock_ban_id, nomor_seri, action, is_borrowed, donor_unit_id, donor_unit_name, notes)
                    VALUES 
                        (?, ?, ?, ?, ?, ?, ?, 'lepas_semua', ?, ?, ?, 'Lepas semua ban dari unit')
                ");
                $stmtLog->execute([
                    $r['mobil_id'], $r['alat_berat_id'], $r['category'], $r['wheel_id'],
                    $r['wheel_code'], $r['stock_ban_id'], $r['nomor_seri'], $r['is_borrowed'],
                    $r['donor_unit_id'], $r['donor_unit_name']
                ]);
            }

            // Hapus seluruh baris unit ini dari tire_wheel_installations
            $delStmt = $pdo->prepare("DELETE FROM tire_wheel_installations WHERE " . ($mobilId ? "mobil_id = ?" : "alat_berat_id = ?"));
            $delStmt->execute([$mobilId ?: $alatBeratId]);

            $pdo->commit();

            http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'message' => 'Seluruh posisi ban unit ini berhasil dikosongkan di database',
                'data' => ['deleted_count' => count($allRows)]
            ]);

        } catch (\PDOException $e) {
            if ($pdo && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            error_log('TireTreadPatternController resetTires error: ' . $e->getMessage());
            echo json_encode([
                'status' => 'error',
                'message' => 'Gagal mengosongkan ban dari database: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Batch save / Sinkronisasi seluruh posisi ban unit sekaligus dalam satu transaksi database.
     */
    public function saveAllInstallations($data = []) {
        $mobilId = !empty($data['mobil_id']) ? (int)$data['mobil_id'] : null;
        $alatBeratId = !empty($data['alat_berat_id']) ? (int)$data['alat_berat_id'] : null;
        $category = $data['category'] ?? null;
        $installations = isset($data['installations']) && is_array($data['installations']) ? $data['installations'] : [];

        if (!$mobilId && !$alatBeratId) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Field mobil_id atau alat_berat_id wajib diisi'
            ]);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            // 1. Hapus instalasi lama unit ini
            $delStmt = $pdo->prepare("DELETE FROM tire_wheel_installations WHERE " . ($mobilId ? "mobil_id = ?" : "alat_berat_id = ?"));
            $delStmt->execute([$mobilId ?: $alatBeratId]);

            // 2. Insert instalasi baru
            $insSql = "
                INSERT INTO tire_wheel_installations 
                    (mobil_id, alat_berat_id, category, wheel_id, wheel_code, wheel_name, 
                     stock_ban_id, nomor_seri, merk, ukuran, kondisi, is_borrowed, 
                     donor_unit_id, donor_unit_name, donor_category, borrowed_at, installed_at)
                VALUES 
                    (:mobil_id, :alat_berat_id, :category, :wheel_id, :wheel_code, :wheel_name, 
                     :stock_ban_id, :nomor_seri, :merk, :ukuran, :kondisi, :is_borrowed, 
                     :donor_unit_id, :donor_unit_name, :donor_category, :borrowed_at, NOW())
            ";
            $stmtIns = $pdo->prepare($insSql);

            foreach ($installations as $item) {
                if (empty($item['wheel_id']) || empty($item['stock_ban_id'])) continue;

                $stmtIns->execute([
                    ':mobil_id' => $mobilId,
                    ':alat_berat_id' => $alatBeratId,
                    ':category' => $category,
                    ':wheel_id' => $item['wheel_id'],
                    ':wheel_code' => $item['wheel_code'] ?? strtoupper($item['wheel_id']),
                    ':wheel_name' => $item['wheel_name'] ?? null,
                    ':stock_ban_id' => (int)$item['stock_ban_id'],
                    ':nomor_seri' => $item['nomor_seri'] ?? null,
                    ':merk' => $item['merk'] ?? null,
                    ':ukuran' => $item['ukuran'] ?? null,
                    ':kondisi' => $item['kondisi'] ?? null,
                    ':is_borrowed' => !empty($item['is_borrowed']) ? 1 : 0,
                    ':donor_unit_id' => !empty($item['donor_unit_id']) ? (int)$item['donor_unit_id'] : null,
                    ':donor_unit_name' => $item['donor_unit_name'] ?? null,
                    ':donor_category' => $item['donor_category'] ?? null,
                    ':borrowed_at' => !empty($item['borrowed_at']) ? date('Y-m-d H:i:s', strtotime($item['borrowed_at'])) : null
                ]);
            }

            $pdo->commit();

            http_response_code(200);
            echo json_encode([
                'status' => 'success',
                'message' => 'Seluruh posisi ban unit berhasil disimpan ke database',
                'data' => ['total_saved' => count($installations)]
            ]);

        } catch (\PDOException $e) {
            if ($pdo && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            error_log('TireTreadPatternController saveAllInstallations error: ' . $e->getMessage());
            echo json_encode([
                'status' => 'error',
                'message' => 'Gagal menyimpan seluruh posisi ban ke database: ' . $e->getMessage()
            ]);
        }
    }
}


