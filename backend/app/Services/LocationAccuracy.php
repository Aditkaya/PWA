<?php

namespace App\Services;

class LocationAccuracy {
    public static function limit(?array $location): float {
        $value = $location['max_accuracy'] ?? null;
        return is_numeric($value) && is_finite((float)$value) && (float)$value > 0
            ? (float)$value : 50.0;
    }
}
