<?php
namespace App\Services;

class AssetPhotoStorage
{
    public const RELATIVE_DIRECTORY = 'uploads/tanda-terima-assets/photos';

    public static function directory(): string
    {
        if (defined('ASSET_RECEIPT_PHOTO_DIR')) return ASSET_RECEIPT_PHOTO_DIR;
        $public = defined('AYPSIS_PUBLIC_DIR') ? AYPSIS_PUBLIC_DIR : getenv('AYPSIS_PUBLIC_DIR');
        if (!$public) {
            $local = 'C:/kerjaan/aypsis/aypsis/aypsis/public';
            $public = PHP_OS_FAMILY === 'Windows' ? $local : '/var/www/aypsis/public';
        }
        return rtrim(trim($public, " \t\n\r\0\x0B\"'"), '/\\') . '/' . self::RELATIVE_DIRECTORY;
    }

    public static function legacyDirectory(): string
    {
        return __DIR__ . '/../../private/asset-receipts';
    }

    public static function validName(string $name): bool
    {
        // Laravel uses 40 mixed-case characters; PWA uses 48 hexadecimal characters.
        return strlen($name) <= 255 && strpos($name, '..') === false &&
            (bool) preg_match('/^[a-z0-9][a-z0-9._-]*\.(jpe?g|png|webp)$/iD', $name);
    }

    public static function path(string $name): ?string
    {
        if (!self::validName($name)) return null;
        $oldPublicDirectory = dirname(dirname(self::directory())) . '/assets/photos';
        foreach ([self::directory(), $oldPublicDirectory, self::legacyDirectory()] as $directory) {
            $root = realpath($directory);
            $path = realpath($directory . '/' . $name);
            if ($root !== false && $path !== false && dirname($path) === $root &&
                is_file($path) && is_readable($path)) return $path;
        }
        return null;
    }
}
