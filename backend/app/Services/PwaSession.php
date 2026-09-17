<?php
namespace App\Services;

class PwaSession
{
    private static function open($token)
    {
        session_name('PWA_AUTH');
        session_id($token);
        // IDs are server-generated bearer secrets, never accepted from cookies or URLs.
        if (!session_start(['use_cookies' => false, 'use_only_cookies' => true, 'use_strict_mode' => false, 'use_trans_sid' => false, 'cache_limiter' => ''])) {
            throw new \RuntimeException('Sesi login tidak dapat disimpan.');
        }
    }

    public static function issue($userId)
    {
        $token = bin2hex(random_bytes(32));
        self::open($token);
        $_SESSION = ['user_id' => (int) $userId, 'expires' => time() + 43200];
        if (!session_write_close()) throw new \RuntimeException('Sesi login tidak dapat disimpan.');
        return $token;
    }

    public static function userId()
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (!preg_match('/^Bearer ([a-f0-9]{64})$/D', $header, $match)) return null;
        self::open($match[1]);
        $id = ($_SESSION['expires'] ?? 0) > time() ? ($_SESSION['user_id'] ?? null) : null;
        session_write_close();
        return $id;
    }
}
