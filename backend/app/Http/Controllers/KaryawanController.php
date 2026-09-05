<?php

namespace App\Http\Controllers;

use PDO;
use Exception;

class KaryawanController {
    private $db;

    public function __construct() {
        $host    = '127.0.0.1';
        $dbname  = 'aypsis';
        $isLocal = ($_SERVER['SERVER_NAME'] === 'localhost' || $_SERVER['SERVER_NAME'] === '127.0.0.1');
        $user    = $isLocal ? 'root' : 'aypsis_web';
        $pass    = $isLocal ? '' : 'WebPass2025#!';
        $charset = 'utf8mb4';

        $dsn     = "mysql:host=$host;dbname=$dbname;charset=$charset";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        try {
            $this->db = new PDO($dsn, $user, $pass, $options);
        } catch (Exception $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
            exit();
        }
    }

    /**
     * Search karyawans by name or NIK.
     * Returns karyawan data along with whether they already have a user account.
     */
    public function search($params) {
        $q      = trim($params['q'] ?? '');
        $limit  = min((int)($params['limit'] ?? 15), 50);

        if (strlen($q) < 2) {
            http_response_code(400);
            echo json_encode(['message' => 'Kata kunci pencarian minimal 2 karakter.']);
            return;
        }

        $like = "%{$q}%";

        // Cek kepemilikan akun dari tabel users (via users.karyawan_id)
        // dan sebagai fallback juga cek karyawans.user_id
        $stmt = $this->db->prepare("
            SELECT
                k.id,
                k.nik,
                k.nama_lengkap,
                k.status,
                k.user_id             AS karyawan_user_id,
                u.id                  AS user_id_from_users,
                u.username,
                u.is_approved
            FROM karyawans k
            LEFT JOIN users u ON u.karyawan_id = k.id
            WHERE (k.status = 'aktif' OR k.status = 'active')
              AND (k.nama_lengkap LIKE ? OR k.nik LIKE ?)
            ORDER BY k.nama_lengkap ASC
            LIMIT $limit
        ");
        $stmt->execute([$like, $like]);
        $rows = $stmt->fetchAll();

        $data = array_map(function ($r) {
            // has_account = true jika ada record di tabel users dengan karyawan_id ini
            // (cek dari kedua arah untuk keamanan)
            $hasAccount = !empty($r['user_id_from_users']) || !empty($r['karyawan_user_id']);
            return [
                'id'            => (int) $r['id'],
                'nik'           => $r['nik'],
                'nama_lengkap'  => $r['nama_lengkap'],
                'has_account'   => $hasAccount,
                'username'      => $r['username'] ?? null,
                'is_approved'   => isset($r['is_approved']) ? (bool) $r['is_approved'] : null,
            ];
        }, $rows);

        http_response_code(200);
        echo json_encode(['data' => $data]);
    }
}
