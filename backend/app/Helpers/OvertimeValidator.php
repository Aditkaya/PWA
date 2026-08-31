<?php
namespace App\Helpers;

use Database;
use PDO;

class OvertimeValidator {
    public static function checkAndCreateApproval($karyawan_id, $tanggal) {
        try {
            $pdo = Database::getConnection();
            
            // Cari perencanaan lembur untuk karyawan pada tanggal tersebut
            $stmtPlan = $pdo->prepare("SELECT id, jam_mulai, jam_selesai, created_by FROM perencanaan_lemburs WHERE karyawan_id = ? AND tanggal = ? ORDER BY id DESC LIMIT 1");
            $stmtPlan->execute([$karyawan_id, $tanggal]);
            $plan = $stmtPlan->fetch(PDO::FETCH_ASSOC);
            
            if (!$plan) return; // Tidak ada perencanaan, tidak ada yang perlu divalidasi

            // Cari absensi lembur aktual (Lembur Masuk)
            $stmtStart = $pdo->prepare("
                SELECT id, waktu, tipe 
                FROM absensis 
                WHERE karyawan_id = ? 
                  AND DATE(waktu) = ?
                  AND LOWER(REPLACE(tipe, '_', ' ')) IN ('lembur masuk', 'mulai lembur', 'lembur') 
                ORDER BY waktu ASC LIMIT 1
            ");
            $stmtStart->execute([$karyawan_id, $tanggal]);
            $actualStart = $stmtStart->fetch(PDO::FETCH_ASSOC);

            // Cari absensi lembur aktual (Lembur Pulang)
            // Batasi pencarian dari jam 12 siang hari-H sampai jam 12 siang besoknya 
            $startCheck = $tanggal . ' 12:00:00';
            $endCheck = date('Y-m-d H:i:s', strtotime($tanggal . ' +1 day 12:00:00'));

            $stmtActual = $pdo->prepare("
                SELECT id, waktu, tipe 
                FROM absensis 
                WHERE karyawan_id = ? 
                  AND waktu >= ? AND waktu <= ?
                  AND LOWER(REPLACE(tipe, '_', ' ')) IN ('lembur pulang', 'selesai lembur', 'lembur keluar') 
                ORDER BY waktu ASC LIMIT 1
            ");
            $stmtActual->execute([$karyawan_id, $startCheck, $endCheck]);
            $actualEnd = $stmtActual->fetch(PDO::FETCH_ASSOC);

            if (!$actualEnd) return; // Karyawan belum melakukan absen pulang lembur

            // Waktu Rencana
            $plannedStartDateTime = $tanggal . ' ' . $plan['jam_mulai'];
            $plannedEndDateTime = $tanggal . ' ' . $plan['jam_selesai'];
            if (strtotime($plan['jam_selesai']) < strtotime($plan['jam_mulai'])) {
                // Jam selesai lebih kecil dari jam mulai = lembur melewati tengah malam (hari berikutnya)
                $plannedEndDateTime = date('Y-m-d H:i:s', strtotime($plannedEndDateTime . ' +1 day'));
            }
            
            $plannedStartTs = strtotime($plannedStartDateTime);
            $plannedEndTs = strtotime($plannedEndDateTime);
            $actualEndTs = strtotime($actualEnd['waktu']);
            $actualStartTs = $actualStart ? strtotime($actualStart['waktu']) : null;

            // Toleransi 40 Menit (2400 detik)
            $tolerance = 40 * 60; 
            
            $diffStart = $actualStartTs ? abs($actualStartTs - $plannedStartTs) : null;
            $diffEnd = abs($actualEndTs - $plannedEndTs);

            $isStartValid = $actualStartTs && ($diffStart <= $tolerance);
            $isEndValid = ($diffEnd <= $tolerance);

            if ($isStartValid && $isEndValid) {
                // Keduanya sesuai toleransi, tidak perlu persetujuan
                return;
            }

            // Keterangan Pelanggaran
            $keteranganParts = [];
            $plannedStartStr = date('H:i', $plannedStartTs);
            $plannedEndStr = date('H:i', $plannedEndTs);
            $actualEndStr = date('H:i', $actualEndTs);

            if (!$actualStartTs) {
                $keteranganParts[] = "Tidak ada absen Lembur Masuk.";
            } else if (!$isStartValid) {
                $actualStartStr = date('H:i', $actualStartTs);
                $statusStart = $actualStartTs > $plannedStartTs ? "terlambat" : "lebih awal";
                $diffStartMin = round($diffStart / 60);
                $keteranganParts[] = "Mulai $statusStart $diffStartMin mnt (Rencana: $plannedStartStr, Aktual: $actualStartStr).";
            }

            if (!$isEndValid) {
                $statusEnd = $actualEndTs > $plannedEndTs ? "melebihi batas" : "kurang dari batas";
                $diffEndMin = round($diffEnd / 60);
                $keteranganParts[] = "Selesai $statusEnd $diffEndMin mnt (Rencana: $plannedEndStr, Aktual: $actualEndStr).";
            }

            $keterangan = implode(" ", $keteranganParts);

            // Waktu aktual untuk disimpan
            $actualStartTimeDB = $actualStartTs ? date('H:i:s', $actualStartTs) : $plan['jam_mulai'];
            $actualEndTimeDB = date('H:i:s', $actualEndTs);

            // Cek apakah sudah ada di persetujuan_absensi_lemburs untuk tanggal ini agar tidak duplikat
            $stmtCheck = $pdo->prepare("SELECT id, status FROM persetujuan_absensi_lemburs WHERE karyawan_id = ? AND tanggal = ?");
            $stmtCheck->execute([$karyawan_id, $tanggal]);
            $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                // Hanya update jika statusnya masih pending
                if (strtolower($existing['status']) === 'pending') {
                    $stmtUpdate = $pdo->prepare("UPDATE persetujuan_absensi_lemburs SET jam_mulai = ?, jam_selesai = ?, keterangan = ? WHERE id = ?");
                    $stmtUpdate->execute([$actualStartTimeDB, $actualEndTimeDB, $keterangan, $existing['id']]);
                }
            } else {
                // Insert baru
                $stmtInsert = $pdo->prepare("INSERT INTO persetujuan_absensi_lemburs (karyawan_id, tanggal, jam_mulai, jam_selesai, keterangan, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW())");
                $stmtInsert->execute([$karyawan_id, $tanggal, $actualStartTimeDB, $actualEndTimeDB, $keterangan]);
            }

        } catch (\Exception $e) {
            error_log("Error in OvertimeValidator: " . $e->getMessage());
        }
    }

    public static function validateAll($tanggal) {
        try {
            $pdo = Database::getConnection();
            $stmtPlan = $pdo->prepare("SELECT DISTINCT karyawan_id FROM perencanaan_lemburs WHERE tanggal = ?");
            $stmtPlan->execute([$tanggal]);
            $plans = $stmtPlan->fetchAll(PDO::FETCH_ASSOC);

            foreach ($plans as $plan) {
                self::checkAndCreateApproval($plan['karyawan_id'], $tanggal);
            }
        } catch (\Exception $e) {
            error_log("Error in validateAll: " . $e->getMessage());
        }
    }
}
