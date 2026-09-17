<?php

namespace App\Helpers;

/** Resolve overtime by session while preserving the actual clock timestamp. */
class AttendanceWorkDate
{
    public static function sql(string $driver = 'mysql', string $table = 'absensis', int $regularOffset = 6): string
    {
        $starts = "'lembur masuk', 'mulai lembur', 'lembur'";
        $ends = "'lembur pulang', 'selesai lembur', 'lembur keluar'";
        $type = "LOWER(REPLACE($table.tipe, '_', ' '))";
        $regular = $driver === 'sqlite'
            ? "DATE($table.waktu, '-$regularOffset hours')"
            : "DATE(DATE_SUB($table.waktu, INTERVAL $regularOffset HOUR))";
        $earliest = $driver === 'sqlite'
            ? "DATETIME($table.waktu, '-24 hours')"
            : "DATE_SUB($table.waktu, INTERVAL 24 HOUR)";

        // NIK also covers machine logs with a missing karyawan_id.
        $employee = "(s.nik = $table.nik OR (s.karyawan_id IS NOT NULL AND s.karyawan_id = $table.karyawan_id))";

        return "CASE
            WHEN $type IN ($starts) THEN DATE($table.waktu)
            WHEN $type IN ($ends) THEN COALESCE((
                SELECT DATE(s.waktu) FROM absensis s
                WHERE $employee
                  AND LOWER(REPLACE(s.tipe, '_', ' ')) IN ($starts)
                  AND s.waktu >= $earliest AND s.waktu <= $table.waktu
                  AND NOT EXISTS (
                      SELECT 1 FROM absensis e
                      WHERE (e.nik = s.nik OR (e.karyawan_id IS NOT NULL AND e.karyawan_id = s.karyawan_id))
                        AND LOWER(REPLACE(e.tipe, '_', ' ')) IN ($ends)
                        AND e.waktu >= s.waktu AND e.waktu < $table.waktu
                  )
                ORDER BY s.waktu DESC, s.id DESC LIMIT 1
            ), DATE($table.waktu))
            ELSE $regular END";
    }
}
