<?php

namespace App\Services;

class FaceVerificationException extends \RuntimeException {}

class FaceVerificationService {
    private function request($endpoint, $payload) {
        $filename = __DIR__ . '/../../config/face-ai.local.json';
        $config = is_file($filename) ? json_decode(file_get_contents($filename), true) : [];
        $token = getenv('FACE_AI_TOKEN') ?: ($config['token'] ?? '');
        $url = getenv('FACE_AI_URL') ?: ($config['url'] ?? 'http://127.0.0.1:8001');
        if (!$token || !function_exists('curl_init')) {
            throw new FaceVerificationException('Layanan validasi wajah belum dikonfigurasi. Hubungi administrator.', 503);
        }
        $curl = curl_init(rtrim($url, '/') . $endpoint);
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $token],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 25,
        ]);
        $body = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        $data = is_string($body) ? json_decode($body, true) : null;
        if ($status === 422) {
            throw new FaceVerificationException($data['message'] ?? 'Foto wajah tidak valid.', 422);
        }
        if ($status !== 200 || !is_array($data)) {
            throw new FaceVerificationException('Server validasi wajah tidak tersedia atau sedang sibuk. Silakan coba lagi.', 503);
        }
        return $data;
    }

    // Normalize existing JPEG/PNG registration photos and bound decoding costs.
    private function jpeg($bytes) {
        if (!is_string($bytes) || strlen($bytes) > 2 * 1024 * 1024) {
            throw new FaceVerificationException('Ukuran foto maksimal 2 MB.', 422);
        }
        $info = @getimagesizefromstring($bytes);
        if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true) ||
            $info[0] * $info[1] > 2000000) {
            throw new FaceVerificationException('Gunakan foto JPEG/PNG maksimal 2 megapiksel.', 422);
        }
        if (!function_exists('imagecreatefromstring')) {
            throw new FaceVerificationException('Ekstensi GD untuk validasi wajah belum tersedia.', 503);
        }
        $image = @imagecreatefromstring($bytes);
        if (!$image) throw new FaceVerificationException('Foto tidak dapat dibaca.', 422);
        try {
            $scale = min(1, 640 / max($info[0], $info[1]));
            if ($scale < 1) {
                $resized = imagescale($image, max(1, (int) round($info[0] * $scale)), max(1, (int) round($info[1] * $scale)));
                if (!$resized) throw new FaceVerificationException('Foto tidak dapat diproses.', 422);
                imagedestroy($image);
                $image = $resized;
            }
            ob_start();
            imagejpeg($image, null, 90);
            return ob_get_clean();
        } finally {
            imagedestroy($image);
        }
    }

    public function decodePhoto($dataUrl) {
        if (!is_string($dataUrl) || strlen($dataUrl) > 2800000 ||
            !preg_match('#^data:image/(?:jpeg|png);base64,([A-Za-z0-9+/=]+)$#D', $dataUrl, $matches)) {
            throw new FaceVerificationException('Foto wajah JPEG/PNG diperlukan.', 422);
        }
        $bytes = base64_decode($matches[1], true);
        return $this->jpeg($bytes);
    }

    public function validateRegistration($dataUrl) {
        $jpeg = $this->decodePhoto($dataUrl);
        $result = $this->request('/validate', ['image' => base64_encode($jpeg)]);
        if (($result['valid'] ?? false) !== true) throw new FaceVerificationException('Wajah tidak terdeteksi pada foto.', 422);
        return $jpeg;
    }

    public function verifyAttendance($pdo, $userId, $dataUrl) {
        $jpeg = $this->decodePhoto($dataUrl);
        $statement = $pdo->prepare('SELECT face_photo_path, face_verified_at FROM users WHERE id = ?');
        $statement->execute([$userId]);
        $user = $statement->fetch();
        if (!$user || !$user['face_verified_at'] || !$user['face_photo_path']) {
            throw new FaceVerificationException('Daftarkan wajah terlebih dahulu sebelum absen.', 422);
        }
        $reference = null;
        foreach ([UPLOAD_BASE_DIR, defined('AYPSIS_PUBLIC_DIR') ? AYPSIS_PUBLIC_DIR : UPLOAD_BASE_DIR] as $base) {
            $root = realpath($base . '/uploads/face_verifications');
            $file = realpath($base . '/' . ltrim($user['face_photo_path'], '/'));
            if ($root && $file && is_file($file) && strpos($file, $root . DIRECTORY_SEPARATOR) === 0) {
                $reference = $file;
                break;
            }
        }
        if (!$reference || filesize($reference) > 2 * 1024 * 1024) {
            throw new FaceVerificationException('Foto wajah terdaftar tidak dapat dibaca. Silakan daftar ulang.', 422);
        }
        $result = $this->request('/verify', [
            'image' => base64_encode($jpeg),
            'reference' => base64_encode($this->jpeg(file_get_contents($reference))),
        ]);
        if (($result['matched'] ?? false) !== true) {
            throw new FaceVerificationException('Wajah tidak cocok dengan foto terdaftar. Silakan ambil foto ulang.', 422);
        }
    }
}
