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
        if (!$nama_kapal) { http_response_code(400); echo json_encode(["message" => "nama_kapal diperlukan"]); return; }
        try {
            $pdo = Database::getConnection();
            $n = strtoupper(trim(str_replace([".", "  "], ["", " "], $nama_kapal)));
            $sql = "SELECT DISTINCT no_voyage FROM manifests WHERE UPPER(REPLACE(REPLACE(nama_kapal, '.', ''), '  ', ' ')) = ? AND no_voyage IS NOT NULL AND no_voyage != '' ORDER BY no_voyage DESC";
            $stmt = $pdo->prepare($sql); $stmt->execute([$n]);
            $voyages = $stmt->fetchAll(PDO::FETCH_COLUMN);
            if (empty($voyages)) {
                $sql2 = "SELECT DISTINCT no_voyage FROM naik_kapal WHERE UPPER(REPLACE(REPLACE(nama_kapal, '.', ''), '  ', ' ')) = ? AND no_voyage IS NOT NULL AND no_voyage != '' ORDER BY no_voyage DESC";
                $s2 = $pdo->prepare($sql2); $s2->execute([$n]);
                $voyages = $s2->fetchAll(PDO::FETCH_COLUMN);
            }
            http_response_code(200); echo json_encode(["data" => $voyages]);
        } catch (\PDOException $e) { http_response_code(500); echo json_encode(["message" => "Server error"]); }
    }

    public function getData($query) {
        $nama_kapal = $query["nama_kapal"] ?? null;
        $no_voyage  = $query["no_voyage"]  ?? null;
        if (!$nama_kapal || !$no_voyage) { http_response_code(400); echo json_encode(["message" => "Parameter diperlukan"]); return; }
        try {
            $pdo = Database::getConnection();
            $n = strtoupper(trim(str_replace([".", "  "], ["", " "], $nama_kapal)));
            $sql = "SELECT tanggal_mulai_berlayar, tanggal_berlabuh, tanggal_sandar, tanggal_mulai_bongkar, tanggal_selesai_bongkar, tanggal_muat FROM manifests WHERE UPPER(REPLACE(REPLACE(nama_kapal, '.', ''), '  ', ' ')) = ? AND no_voyage = ? LIMIT 1";
            $stmt = $pdo->prepare($sql); $stmt->execute([$n, trim($no_voyage)]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            http_response_code(200); echo json_encode(["data" => $row ?: null]);
        } catch (\PDOException $e) { http_response_code(500); echo json_encode(["message" => "Server error"]); }
    }

    public function save($body) {
        $nama_kapal = $body["nama_kapal"] ?? null;
        $no_voyage  = $body["no_voyage"]  ?? null;
        if (!$nama_kapal || !$no_voyage) { http_response_code(400); echo json_encode(["message" => "Parameter diperlukan"]); return; }
        $fields = ["tanggal_mulai_berlayar","tanggal_berlabuh","tanggal_sandar","tanggal_mulai_bongkar","tanggal_selesai_bongkar","tanggal_muat"];
        $updates = [];
        foreach ($fields as $f) { $updates[$f] = isset($body[$f]) && $body[$f] !== "" ? $body[$f] : null; }
        try {
            $pdo = Database::getConnection();
            $n = strtoupper(trim(str_replace([".", "  "], ["", " "], $nama_kapal)));
            $setParts = implode(", ", array_map(fn($k) => "$k = ?", array_keys($updates)));
            $values = array_values($updates); $values[] = $n; $values[] = trim($no_voyage);
            $sql = "UPDATE manifests SET $setParts WHERE UPPER(REPLACE(REPLACE(nama_kapal, '.', ''), '  ', ' ')) = ? AND no_voyage = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($values);
            $count = $stmt->rowCount();
            http_response_code(200); echo json_encode(["message" => "Berhasil disimpan untuk $count manifest.", "updated" => $count]);
        } catch (\PDOException $e) { http_response_code(500); echo json_encode(["message" => "Server error"]); }
    }
}
