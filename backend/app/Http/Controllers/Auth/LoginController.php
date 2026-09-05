<?php

namespace App\Http\Controllers\Auth;

use PDO;
use Exception;

class LoginController {
    private $db;

    public function __construct() {
        $host = '127.0.0.1';
        $db   = 'aypsis';
        $isLocal = ($_SERVER['SERVER_NAME'] === 'localhost' || $_SERVER['SERVER_NAME'] === '127.0.0.1');
        $user = $isLocal ? 'root' : 'aypsis_web';
        $pass = $isLocal ? '' : 'WebPass2025#!';
        $charset = 'utf8mb4';

        $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
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

    public function login($requestData) {
        $username = $requestData['username'] ?? '';
        $password = $requestData['password'] ?? '';

        if (empty($username) || empty($password)) {
            http_response_code(400);
            echo json_encode(['message' => 'Username dan password wajib diisi.']);
            return;
        }

        $stmt = $this->db->prepare("SELECT id, username, password, is_approved, status FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user) {
            $isValid = false;
            
            if (password_verify($password, $user['password'])) {
                $isValid = true;
            } elseif (md5($password) === $user['password']) {
                $isValid = true;
            } elseif ($password === $user['password']) {
                $isValid = true;
            }

            if ($isValid) {
                // --- Cek status persetujuan admin ---
                // Sistem approval menggunakan kolom 'status':
                //   'approved'  = disetujui → boleh login
                //   'pending'   = belum disetujui → tolak
                //   'rejected'  = ditolak → tolak
                $status = $user['status'] ?? 'pending';

                if ($status === 'rejected') {
                    http_response_code(403);
                    echo json_encode([
                        'message' => 'Akun Anda telah ditolak oleh admin. Silakan hubungi HRD untuk informasi lebih lanjut.',
                        'status'  => 'rejected',
                    ]);
                    return;
                }

                if ($status !== 'approved') {
                    http_response_code(403);
                    echo json_encode([
                        'message' => 'Akun Anda belum disetujui oleh admin. Silakan hubungi HRD untuk konfirmasi persetujuan akun.',
                        'status'  => 'pending',
                    ]);
                    return;
                }

                $token = bin2hex(random_bytes(32)); 
                
                http_response_code(200);
                echo json_encode([
                    'message' => 'Login berhasil',
                    'token' => $token,
                    'user' => [
                        'id' => $user['id'],
                        'username' => $user['username']
                    ]
                ]);
                return;
            }
        }

        http_response_code(401);
        echo json_encode(['message' => 'Username atau password salah.']);
    }
}
