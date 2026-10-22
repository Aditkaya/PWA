<?php
namespace App\Services;

class AssetPhotoStorage
{
    public const RELATIVE_DIRECTORY = 'uploads/assets/photos';

    public static function directory(): string
    {
        if (defined('ASSET_RECEIPT_PHOTO_DIR')) return ASSET_RECEIPT_PHOTO_DIR;
        $public = defined('AYPSIS_PUBLIC_DIR') ? AYPSIS_PUBLIC_DIR : getenv('AYPSIS_PUBLIC_DIR');
        if (!$public) {
            $local = 'C:/kerjaan/aypsis/aypsis/aypsis/public';
            $public = PHP_OS_FAMILY === 'Windows' ? $local : '/var/www/aypsis/public';
        }
        return rtrim($public, '/\\') . '/' . self::RELATIVE_DIRECTORY;
    }

    public static function legacyDirectory(): string
    {
        return __DIR__ . '/../../private/asset-receipts';
    }

    public static function validName(string $name): bool
    {
        return (bool) preg_match('/^[a-f0-9]{48}\.(jpg|png|webp)$/D', $name);
    }

    public static function path(string $name): ?string
    {
        if (!self::validName($name)) return null;
        foreach ([self::directory(), self::legacyDirectory()] as $directory) {
            $path = $directory . '/' . $name;
            if (is_file($path)) return $path;
        }
        return null;
    }
}
