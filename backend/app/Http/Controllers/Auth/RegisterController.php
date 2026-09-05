<?php

namespace App\Http\Controllers\Auth;

use PDO;
use Exception;

class RegisterController {
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

    public function register($data) {
        $karyawan_id = (int) ($data['karyawan_id'] ?? 0);
        $username    = trim($data['username'] ?? '');
        $password    = trim($data['password'] ?? '');

        // --- Basic validation ---
        if (!$karyawan_id || empty($username) || empty($password)) {
            http_response_code(400);
            echo json_encode(['message' => 'Karyawan, username, dan password wajib diisi.']);
            return;
        }

        if (strlen($password) < 6) {
            http_response_code(400);
            echo json_encode(['message' => 'Password minimal 6 karakter.']);
            return;
        }

        // --- Check karyawan exists ---
        $stmtKar = $this->db->prepare(
            "SELECT id, nik, nama_lengkap, user_id FROM karyawans WHERE id = ?"
        );
        $stmtKar->execute([$karyawan_id]);
        $karyawan = $stmtKar->fetch();

        if (!$karyawan) {
            http_response_code(404);
            echo json_encode(['message' => 'Data karyawan tidak ditemukan.']);
            return;
        }

        // --- Guard: cek tabel users apakah sudah ada akun untuk karyawan ini ---
        $stmtHasUser = $this->db->prepare(
            "SELECT id, username FROM users WHERE karyawan_id = ? LIMIT 1"
        );
        $stmtHasUser->execute([$karyawan_id]);
        $existingUser = $stmtHasUser->fetch();

        // Fallback: cek juga lewat karyawans.user_id
        if (!$existingUser && !empty($karyawan['user_id'])) {
            $existingUser = ['id' => $karyawan['user_id'], 'username' => null];
        }

        if ($existingUser) {
            http_response_code(409);
            echo json_encode([
                'message'     => 'Karyawan ini sudah memiliki akun di sistem. Tidak diperbolehkan membuat akun baru.',
                'has_account' => true,
                'username'    => $existingUser['username'],
            ]);
            return;
        }

        // --- Check username unique ---
        $stmtCheck = $this->db->prepare("SELECT id FROM users WHERE username = ?");
        $stmtCheck->execute([$username]);
        if ($stmtCheck->fetch()) {
            http_response_code(409);
            echo json_encode(['message' => 'Username sudah digunakan. Pilih username lain.']);
            return;
        }

        try {
            $this->db->beginTransaction();

            // 1. Insert user
            $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
            $stmtUser = $this->db->prepare(
                "INSERT INTO users (username, password, role, is_approved, status, karyawan_id, created_at, updated_at)
                 VALUES (?, ?, 'karyawan', 0, 'pending', ?, NOW(), NOW())"
            );
            $stmtUser->execute([$username, $hashedPassword, $karyawan_id]);
            $userId = $this->db->lastInsertId();

            // 2. Link user back to karyawan
            $stmtLink = $this->db->prepare("UPDATE karyawans SET user_id = ? WHERE id = ?");
            $stmtLink->execute([$userId, $karyawan_id]);

            $this->db->commit();

            http_response_code(201);
            echo json_encode([
                'message' => 'Akun berhasil dibuat! Menunggu persetujuan admin.',
                'user_id' => (int) $userId,
            ]);
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log('Registration error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Gagal membuat akun. Silakan coba lagi.']);
        }
    }
}
