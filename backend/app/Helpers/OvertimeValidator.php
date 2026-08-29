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
            // Batasi pencarian dari jam 12 siang hari-H sampai jam 12 siang besoknya 
            // agar bisa mendeteksi lembur yang melewati tengah malam tanpa mengambil lembur di hari berikutnya.
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
            $actual = $stmtActual->fetch(PDO::FETCH_ASSOC);

            if (!$actual) return; // Karyawan belum melakukan absen pulang lembur

            // Bentuk waktu datetime utuh untuk perbandingan akurat
            $plannedEndDateTime = $tanggal . ' ' . $plan['jam_selesai'];
            if (strtotime($plan['jam_selesai']) < strtotime($plan['jam_mulai'])) {
                // Jam selesai lebih kecil dari jam mulai = lembur melewati tengah malam (hari berikutnya)
                $plannedEndDateTime = date('Y-m-d H:i:s', strtotime($plannedEndDateTime . ' +1 day'));
            }
            $actualEndDateTime = $actual['waktu'];
            
            $plannedTs = strtotime($plannedEndDateTime);
            $actualTs = strtotime($actualEndDateTime);

            // Hilangkan detik untuk komparasi sama persis (menit)
            $plannedHm = date('Y-m-d H:i', $plannedTs);
            $actualHm = date('Y-m-d H:i', $actualTs);
            
            if ($actualHm === $plannedHm) {
                // Sesuai tepat waktu, tidak perlu persetujuan
                return;
            }

            $plannedEndStr = date('d M Y H:i', $plannedTs);
            $actualEndStr = date('d M Y H:i', $actualTs);

            $keterangan = "";
            if ($actualTs > $plannedTs) {
                $keterangan = "Jam lembur melewati batas (Rencana Selesai: $plannedEndStr, Aktual Selesai: $actualEndStr)";
            } else {
                $keterangan = "Jam lembur kurang dari batas (Rencana Selesai: $plannedEndStr, Aktual Selesai: $actualEndStr)";
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
