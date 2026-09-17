<?php
require_once __DIR__.'/../app/Services/PwaSession.php';
use App\Services\PwaSession;

$directory = sys_get_temp_dir().DIRECTORY_SEPARATOR.'pwa-session-test-'.bin2hex(random_bytes(8));
mkdir($directory, 0700);
session_save_path($directory);
$token = null;
try {
    if (PwaSession::userId() !== null) throw new RuntimeException('Missing token accepted');
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer invalid';
    if (PwaSession::userId() !== null) throw new RuntimeException('Malformed token accepted');
    $token = PwaSession::issue(123);
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer '.$token;
    if (PwaSession::userId() !== 123) throw new RuntimeException('Issued token rejected');
    session_id($token);
    session_start(['use_cookies' => false, 'cache_limiter' => '']);
    $_SESSION['expires'] = time() - 1;
    session_write_close();
    if (PwaSession::userId() !== null) throw new RuntimeException('Expired token accepted');
    echo "4 session checks passed.\n";
} finally {
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    if ($token && is_file($directory.DIRECTORY_SEPARATOR.'sess_'.$token)) unlink($directory.DIRECTORY_SEPARATOR.'sess_'.$token);
    rmdir($directory);
}
