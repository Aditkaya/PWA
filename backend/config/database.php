<?php

class Database {
    private static $pdo = null;

    public static function getConnection() {
        if (self::$pdo === null) {
            $host = '127.0.0.1';
            $db   = 'aypsis';
            $serverName = $_SERVER['SERVER_NAME'] ?? '';
            $isWindowsCli = (php_sapi_name() === 'cli' && strtoupper(substr(PHP_OS, 0, 3)) === 'WIN');
            $isLocal = ($serverName === 'localhost' || $serverName === '127.0.0.1' || $isWindowsCli);
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
                self::$pdo = new PDO($dsn, $user, $pass, $options);
            } catch (\PDOException $e) {
                http_response_code(500);
                error_log('Database error: ' . $e->getMessage());
                echo json_encode(['message' => 'Terjadi kesalahan pada server']);
                exit();
            }
        }
        return self::$pdo;
    }
}
