<?php

namespace App\Http\Controllers;

require_once __DIR__ . "/../../../config/database.php";

use Database;
use PDO;

class GerakVoyageController {

    public function getShips() {
        try {
            $pdo = Database::getConnection();
            $sql = "SELECT DISTINCT nama_kapal FROM (SELECT nama_kapal FROM manifests WHERE nama_kapal IS NOT NULL AND nama_kapal != '' UNION SELECT nama_kapal FROM naik_kapal WHERE nama_kapal IS NOT NULL AND nama_kapal != '') combined ORDER BY nama_kapal ASC";
            $stmt = $pdo->query($sql);
            $ships = $stmt->fetchAll(PDO::FETCH_COLUMN);
            http_response_code(200);
            echo json_encode(["data" => $ships]);
        } catch (\PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Terjadi kesalahan pada server", "error" => $e->getMessage()]);
        }
    }

    public function getVoyages($query) {
        $nama_kapal = $query["nama_kapal"] ?? null;
        if (!$nama_kapal) { 
            http_response_code(400); 
            echo json_encode(["message" => "nama_kapal diperlukan"]); 
            return; 
        }
        try {
            $pdo = Database::getConnection();
            $n = strtoupper(trim(str_replace([".", "  "], ["", " "], $nama_kapal)));
            // Samakan dengan halaman Gerak Voyage AYPsis: voyage bersumber
            // dari manifests, lalu dinormalisasi dan diurutkan berdasarkan
            // dua digit tahun di bagian akhir nomor voyage.
            $sql = "SELECT DISTINCT no_voyage FROM manifests WHERE UPPER(REPLACE(REPLACE(nama_kapal, '.', ''), '  ', ' ')) = ? AND no_voyage IS NOT NULL AND no_voyage != ''";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$n]);
            $voyages = $stmt->fetchAll(PDO::FETCH_COLUMN);

            $normalizedVoyages = [];
            foreach ($voyages as $voyage) {
                $normalized = strtoupper(trim((string) $voyage));
                if ($normalized !== '') {
                    $normalizedVoyages[$normalized] = true;
                }
            }

            $voyages = array_keys($normalizedVoyages);
            $dockItems = [];
            $otherItems = [];
            foreach ($voyages as $voyage) {
                if (strtolower(trim($voyage)) === 'dock') {
                    $dockItems[] = $voyage;
                } else {
                    $otherItems[] = $voyage;
                }
            }

            usort($otherItems, function ($a, $b) {
                preg_match('/(\d{2})$/', trim($a), $matchesA);
                preg_match('/(\d{2})$/', trim($b), $matchesB);
                $yearA = isset($matchesA[1]) ? (int) $matchesA[1] : 0;
                $yearB = isset($matchesB[1]) ? (int) $matchesB[1] : 0;

                if ($yearA !== $yearB) {
                    return $yearB <=> $yearA;
                }

                return strcmp(strtolower(trim($b)), strtolower(trim($a)));
            });

            $voyages = array_merge($otherItems, $dockItems);
            http_response_code(200); 
            echo json_encode(["data" => $voyages]);
        } catch (\PDOException $e) { 
            http_response_code(500); 
            echo json_encode(["message" => "Server error"]); 
        }
    }

    public function getData($query) {
        $nama_kapal = $query["nama_kapal"] ?? null;
        $no_voyage  = $query["no_voyage"]  ?? null;
        if (!$nama_kapal || !$no_voyage) { 
            http_response_code(400); 
            echo json_encode(["message" => "Parameter diperlukan"]); 
            return; 
        }
        try {
            $pdo = Database::getConnection();
            $n = strtoupper(trim(str_replace([".", "  "], ["", " "], $nama_kapal)));
            $v = trim($no_voyage);

            $sql = "SELECT tanggal_mulai_berlayar, tanggal_berlabuh, tanggal_sandar, tanggal_mulai_bongkar, tanggal_selesai_bongkar, tanggal_muat FROM manifests WHERE UPPER(REPLACE(REPLACE(nama_kapal, '.', ''), '  ', ' ')) = ? AND no_voyage = ? LIMIT 1";
            $stmt = $pdo->prepare($sql); 
            $stmt->execute([$n, $v]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            // Ambil auto tanggal muat dari OB Muat
            $autoTanggalMuat = $this->getAutoTanggalMuat($pdo, $nama_kapal, $no_voyage);

            if (!$row) {
                $row = [
                    "tanggal_muat" => $autoTanggalMuat,
                    "tanggal_mulai_berlayar" => null,
                    "tanggal_berlabuh" => null,
                    "tanggal_sandar" => null,
                    "tanggal_mulai_bongkar" => null,
                    "tanggal_selesai_bongkar" => null,
                ];
            } else {
                // Jika tanggal_muat di manifests belum diisi / kosong, isi otomatis dari OB Muat
                if ((empty($row['tanggal_muat']) || $row['tanggal_muat'] === '0000-00-00') && $autoTanggalMuat) {
                    $row['tanggal_muat'] = $autoTanggalMuat;
                }
            }

            http_response_code(200); 
            echo json_encode([
                "data" => $row,
                "auto_ob_muat" => $autoTanggalMuat
            ]);
        } catch (\PDOException $e) { 
            http_response_code(500); 
            echo json_encode(["message" => "Server error"]); 
        }
    }

    private function getAutoTanggalMuat(PDO $pdo, string $namaKapal, string $noVoyage): ?string {
        $n = strtoupper(trim(str_replace([".", "  "], ["", " "], $namaKapal)));
        $v = trim($noVoyage);

        // 1. Cek tanggal_muat di naik_kapal (paling utama saat proses OB Muat)
        try {
            $stmt = $pdo->prepare("SELECT MIN(tanggal_muat) FROM naik_kapal WHERE UPPER(REPLACE(REPLACE(nama_kapal, '.', ''), '  ', ' ')) = ? AND no_voyage = ? AND tanggal_muat IS NOT NULL AND tanggal_muat > '1970-01-01'");
            $stmt->execute([$n, $v]);
            $tgl = $stmt->fetchColumn();
            if ($tgl) return substr((string)$tgl, 0, 10);
        } catch (\Throwable $e) {}

        // 2. Cek tanggal_ob di naik_kapal
        try {
            $stmt = $pdo->prepare("SELECT MIN(tanggal_ob) FROM naik_kapal WHERE UPPER(REPLACE(REPLACE(nama_kapal, '.', ''), '  ', ' ')) = ? AND no_voyage = ? AND tanggal_ob IS NOT NULL AND tanggal_ob > '1970-01-01'");
            $stmt->execute([$n, $v]);
            $tgl = $stmt->fetchColumn();
            if ($tgl) return substr((string)$tgl, 0, 10);
        } catch (\Throwable $e) {}

        // 3. Cek pranota_obs
        try {
            $stmt = $pdo->prepare("SELECT MIN(tanggal_ob) FROM pranota_obs WHERE UPPER(REPLACE(REPLACE(nama_kapal, '.', ''), '  ', ' ')) = ? AND no_voyage = ? AND tanggal_ob IS NOT NULL AND tanggal_ob > '1970-01-01'");
            $stmt->execute([$n, $v]);
            $tgl = $stmt->fetchColumn();
            if ($tgl) return substr((string)$tgl, 0, 10);
        } catch (\Throwable $e) {}

        // 4. Cek prospek
        try {
            $stmt = $pdo->prepare("SELECT MIN(tanggal_muat) FROM prospek WHERE UPPER(REPLACE(REPLACE(nama_kapal, '.', ''), '  ', ' ')) = ? AND no_voyage = ? AND tanggal_muat IS NOT NULL AND tanggal_muat > '1970-01-01'");
            $stmt->execute([$n, $v]);
            $tgl = $stmt->fetchColumn();
            if ($tgl) return substr((string)$tgl, 0, 10);
        } catch (\Throwable $e) {}

        return null;
    }

    public function save($body) {
        $nama_kapal = $body["nama_kapal"] ?? null;
        $no_voyage  = $body["no_voyage"]  ?? null;
        if (!$nama_kapal || !$no_voyage) { 
            http_response_code(400); 
            echo json_encode(["message" => "Parameter diperlukan"]); 
            return; 
        }
        $fields = ["tanggal_mulai_berlayar","tanggal_berlabuh","tanggal_sandar","tanggal_mulai_bongkar","tanggal_selesai_bongkar","tanggal_muat"];
        $updates = [];
        foreach ($fields as $f) { 
            $updates[$f] = isset($body[$f]) && $body[$f] !== "" ? $body[$f] : null; 
        }
        try {
            $pdo = Database::getConnection();
            $n = strtoupper(trim(str_replace([".", "  "], ["", " "], $nama_kapal)));
            $setParts = implode(", ", array_map(fn($k) => "$k = ?", array_keys($updates)));
            $values = array_values($updates); 
            $values[] = $n; 
            $values[] = trim($no_voyage);
            $sql = "UPDATE manifests SET $setParts WHERE UPPER(REPLACE(REPLACE(nama_kapal, '.', ''), '  ', ' ')) = ? AND no_voyage = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($values);
            $count = $stmt->rowCount();
            http_response_code(200); 
            echo json_encode(["message" => "Berhasil disimpan untuk $count manifest.", "updated" => $count]);
        } catch (\PDOException $e) { 
            http_response_code(500); 
            echo json_encode(["message" => "Server error"]); 
        }
    }
}
