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

            // Cari absensi lembur aktual (Lembur_Pulang)
            $stmtActual = $pdo->prepare("SELECT id, waktu, tipe FROM absensis WHERE karyawan_id = ? AND DATE(waktu) = ? AND LOWER(REPLACE(tipe, '_', ' ')) IN ('lembur pulang', 'selesai lembur', 'lembur keluar') ORDER BY waktu DESC LIMIT 1");
            $stmtActual->execute([$karyawan_id, $tanggal]);
            $actual = $stmtActual->fetch(PDO::FETCH_ASSOC);

            if (!$actual) return; // Karyawan belum melakukan absen pulang lembur

            // Parse jam selesai
            $plannedEndTime = date('H:i', strtotime($plan['jam_selesai']));
            $actualEndTime = date('H:i', strtotime($actual['waktu']));
            
            if ($actualEndTime === $plannedEndTime) {
                // Sesuai tepat waktu, tidak perlu persetujuan
                return;
            }

            $keterangan = "";
            if (strtotime($actualEndTime) > strtotime($plannedEndTime)) {
                $keterangan = "Jam lembur melewati batas (Rencana Selesai: $plannedEndTime, Aktual Selesai: $actualEndTime)";
            } else {
                $keterangan = "Jam lembur kurang dari batas (Rencana Selesai: $plannedEndTime, Aktual Selesai: $actualEndTime)";
            }

            // Cek apakah sudah ada di persetujuan_absensi_lemburs untuk tanggal ini agar tidak duplikat
            $stmtCheck = $pdo->prepare("SELECT id, status FROM persetujuan_absensi_lemburs WHERE karyawan_id = ? AND tanggal = ?");
            $stmtCheck->execute([$karyawan_id, $tanggal]);
            $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                // Hanya update jika statusnya masih pending, atau mungkin kita biarkan saja jika sudah approved/rejected?
                if (strtolower($existing['status']) === 'pending' || strtolower($existing['status']) === 'pending hrd' || strtolower($existing['status']) === 'pending spv') {
                    $stmtUpdate = $pdo->prepare("UPDATE persetujuan_absensi_lemburs SET jam_mulai = ?, jam_selesai = ?, keterangan = ? WHERE id = ?");
                    $stmtUpdate->execute([$plan['jam_mulai'], $actualEndTime, $keterangan, $existing['id']]);
                }
            } else {
                // Insert baru
                $stmtInsert = $pdo->prepare("INSERT INTO persetujuan_absensi_lemburs (karyawan_id, tanggal, jam_mulai, jam_selesai, keterangan, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW())");
                $stmtInsert->execute([$karyawan_id, $tanggal, $plan['jam_mulai'], $actualEndTime, $keterangan]);
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
