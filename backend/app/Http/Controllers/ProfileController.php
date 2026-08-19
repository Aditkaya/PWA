<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

use Database;
use PDO;
use Exception;

class ProfileController {
    
    public function getProfile($requestData) {
        $user_id = $requestData['user_id'] ?? null;
        if (!$user_id) {
            http_response_code(400);
            echo json_encode(['message' => 'User ID diperlukan']);
            return;
        }
        try {
            $pdo = Database::getConnection();
            // Combine data from users and karyawans
            $stmt = $pdo->prepare("
                SELECT u.id as user_id, u.username, k.*, k.id as karyawan_id 
                FROM users u 
                LEFT JOIN karyawans k ON u.karyawan_id = k.id 
                WHERE u.id = ?
            ");
            $stmt->execute([$user_id]);
            $profile = $stmt->fetch();
            
            if ($profile) {
                // Setup avatar url
                $avatar_path = "/uploads/avatars/avatar_{$user_id}.jpg";
                if (file_exists(UPLOAD_BASE_DIR . $avatar_path)) {
                    $profile['avatar_url'] = $avatar_path . '?v=' . time();
                } else {
                    $profile['avatar_url'] = null;
                }

                // Check full day leave
                $profile['has_full_day_leave'] = false;
                if ($profile['karyawan_id']) {
                    $today = date('Y-m-d');
                    
                    // Cek Izin Tidak Masuk / Sakit (Status Disetujui)
                    $stmtLeave = $pdo->prepare("SELECT id FROM permohonan_izins WHERE karyawan_id = ? AND (jenis_izin = 'Tidak Masuk' OR jenis_izin = 'Sakit') AND LOWER(status) = 'disetujui' AND ? BETWEEN tanggal_mulai AND tanggal_selesai LIMIT 1");
                    $stmtLeave->execute([$profile['karyawan_id'], $today]);
                    if ($stmtLeave->fetch()) {
                        $profile['has_full_day_leave'] = true;
                    }
                    
                    // Cek Cuti (Status Disetujui/Approved)
                    $stmtCutiLeave = $pdo->prepare("SELECT id FROM cutis WHERE karyawan_id = ? AND (LOWER(status) = 'approved' OR LOWER(status) = 'disetujui') AND ? BETWEEN tanggal_mulai AND tanggal_selesai LIMIT 1");
                    $stmtCutiLeave->execute([$profile['karyawan_id'], $today]);
                    if ($stmtCutiLeave->fetch()) {
                        $profile['has_full_day_leave'] = true;
                    }
                    
                    // Fetch Saldo Cuti
                    $currentYear = date('Y');
                    $stmtCuti = $pdo->prepare("SELECT total_cuti, cuti_terpakai, sisa_cuti FROM saldo_cutis WHERE karyawan_id = ? ORDER BY tahun DESC LIMIT 1");
                    $stmtCuti->execute([$profile['karyawan_id']]);
                    $saldoCuti = $stmtCuti->fetch(PDO::FETCH_ASSOC);
                    
                    if ($saldoCuti) {
                        $profile['total_cuti'] = (int)$saldoCuti['total_cuti'];
                        $profile['cuti_terpakai'] = (int)$saldoCuti['cuti_terpakai'];
                        $profile['sisa_cuti'] = (int)$saldoCuti['sisa_cuti'];
                    } else {
                        $profile['total_cuti'] = 0;
                        $profile['cuti_terpakai'] = 0;
                        $profile['sisa_cuti'] = 0;
                    }
                }
                
                // To ensure compatibility with frontend components that expect 'id' to be user_id or karyawan_id,
                // we will explicitly return id as user_id to fix IzinModal passing wrong user_id
                $profile['id'] = $profile['user_id'];

                http_response_code(200);
                echo json_encode(['data' => $profile]);
            } else {
                http_response_code(404);
                echo json_encode(['message' => 'User tidak ditemukan']);
            }
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }

    public function uploadAvatar($postData, $filesData) {
        $user_id = $postData['user_id'] ?? null;
        
        if (!$user_id || !isset($filesData['avatar'])) {
            http_response_code(400);
            echo json_encode(['message' => 'User ID dan file gambar diperlukan']);
            return;
        }

        $upload_dir = UPLOAD_BASE_DIR . '/uploads/avatars/';
        if (!is_dir($upload_dir)) {
            mkdir($upload_dir, 0777, true);
        }
        
        $file = $filesData['avatar'];
        // Simple validation (can be expanded)
        $allowed_types = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!in_array($file['type'], $allowed_types)) {
            http_response_code(400);
            echo json_encode(['message' => 'Format file tidak didukung']);
            return;
        }
        
        // Save image with user id pattern
        $filename = 'avatar_' . $user_id . '.jpg';
        $target_path = $upload_dir . $filename;
        
        if (move_uploaded_file($file['tmp_name'], $target_path)) {
            http_response_code(200);
            echo json_encode([
                'message' => 'Berhasil mengunggah foto',
                'avatar_url' => '/uploads/avatars/' . $filename . '?v=' . time()
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['message' => 'Gagal menyimpan foto']);
        }
    }

    public function updateProfile($requestData) {
        $user_id     = $requestData['user_id'] ?? null;
        $nama_lengkap = $requestData['nama_lengkap'] ?? null;
        $email       = $requestData['email'] ?? null;
        $no_hp       = $requestData['no_hp'] ?? null;

        if (!$user_id) {
            http_response_code(400);
            echo json_encode(['message' => 'User ID diperlukan']);
            return;
        }
        try {
            $pdo = Database::getConnection();
            // Get karyawan_id from user
            $stmt = $pdo->prepare("SELECT karyawan_id FROM users WHERE id = ?");
            $stmt->execute([$user_id]);
            $userData = $stmt->fetch();

            if (!$userData || !$userData['karyawan_id']) {
                http_response_code(404);
                echo json_encode(['message' => 'Data karyawan tidak ditemukan']);
                return;
            }

            $karyawan_id = $userData['karyawan_id'];
            $stmt = $pdo->prepare("UPDATE karyawans SET nama_lengkap = ?, email = ?, no_hp = ? WHERE id = ?");
            $stmt->execute([$nama_lengkap, $email, $no_hp, $karyawan_id]);

            http_response_code(200);
            echo json_encode(['message' => 'Profil berhasil diperbarui']);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }

    public function changePassword($requestData) {
        $user_id      = $requestData['user_id'] ?? null;
        $old_password = $requestData['old_password'] ?? null;
        $new_password = $requestData['new_password'] ?? null;

        if (!$user_id || !$old_password || !$new_password) {
            http_response_code(400);
            echo json_encode(['message' => 'Semua field wajib diisi']);
            return;
        }
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT password FROM users WHERE id = ?");
            $stmt->execute([$user_id]);
            $userData = $stmt->fetch();

            if (!$userData) {
                http_response_code(404);
                echo json_encode(['message' => 'User tidak ditemukan']);
                return;
            }

            // Verify old password (supports bcrypt, md5, and plain)
            $isValid = false;
            if (password_verify($old_password, $userData['password'])) {
                $isValid = true;
            } elseif (md5($old_password) === $userData['password']) {
                $isValid = true;
            } elseif ($old_password === $userData['password']) {
                $isValid = true;
            }

            if (!$isValid) {
                http_response_code(401);
                echo json_encode(['message' => 'Password lama tidak sesuai']);
                return;
            }

            $hashed = password_hash($new_password, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare("UPDATE users SET password = ? WHERE id = ?");
            $stmt->execute([$hashed, $user_id]);

            http_response_code(200);
            echo json_encode(['message' => 'Password berhasil diperbarui']);
        } catch (\PDOException $e) {
            http_response_code(500);
            error_log('Database error: ' . $e->getMessage());
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }
}
