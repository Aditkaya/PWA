<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

use Database;
use PDO;

class FeaturePermissionController
{
    /** Daftar semua feature_key yang valid */
    public const VALID_FEATURES = [
        'izin_sakit',
        'izin_setengah_hari',
        'cuti_tahunan',
        'lupa_absen',
        'perencanaan_lembur',
        'approval_karyawan',
        'stowage_plan',
        'denah_gudang',
        'amprahan',
        'gerak_voyage',
        'perbarui_wajah',
    ];

    /** Fitur standar (default) untuk karyawan biasa */
    public const DEFAULT_FEATURES = [
        'izin_sakit',
        'izin_setengah_hari',
        'cuti_tahunan',
        'lupa_absen',
    ];

    /**
     * GET /api/it/users
     * Ambil semua user beserta izin fitur mereka (hanya IT)
     */
    public function getUsers(array $params): void
    {
        $requesterId = $params['requester_id'] ?? $params['user_id'] ?? null;
        if (!$this->isIT($requesterId)) {
            http_response_code(403);
            echo json_encode(['message' => 'Akses ditolak. Hanya IT yang dapat mengakses menu ini.']);
            return;
        }

        try {
            $pdo = Database::getConnection();

            $search = isset($params['search']) ? trim($params['search']) : '';
            $cabangFilter = isset($params['cabang']) && trim($params['cabang']) !== '' ? trim($params['cabang']) : null;
            $isAllCabang = ($cabangFilter === null || strtoupper($cabangFilter) === 'ALL');

            if ($isAllCabang && $search === '') {
                // Pada Semua Cabang: tampilkan 50 karyawan saja (25 Jakarta + 25 Batam)
                $sql = "
                    (
                        SELECT
                            u.id AS user_id,
                            u.username,
                            k.nama_lengkap,
                            k.nik,
                            k.pekerjaan,
                            k.divisi,
                            k.cabang
                        FROM users u
                        LEFT JOIN karyawans k ON u.karyawan_id = k.id
                        WHERE UPPER(TRIM(k.cabang)) = 'JAKARTA'
                        ORDER BY k.nama_lengkap ASC
                        LIMIT 25
                    )
                    UNION ALL
                    (
                        SELECT
                            u.id AS user_id,
                            u.username,
                            k.nama_lengkap,
                            k.nik,
                            k.pekerjaan,
                            k.divisi,
                            k.cabang
                        FROM users u
                        LEFT JOIN karyawans k ON u.karyawan_id = k.id
                        WHERE UPPER(TRIM(k.cabang)) = 'BATAM'
                        ORDER BY k.nama_lengkap ASC
                        LIMIT 25
                    )
                ";
                $stmt = $pdo->query($sql);
                $users = $stmt->fetchAll();
            } else {
                $searchPattern = '%' . $search . '%';
                $sql = "
                    SELECT
                        u.id AS user_id,
                        u.username,
                        k.nama_lengkap,
                        k.nik,
                        k.pekerjaan,
                        k.divisi,
                        k.cabang
                    FROM users u
                    LEFT JOIN karyawans k ON u.karyawan_id = k.id
                    WHERE (k.nama_lengkap LIKE ? OR k.nik LIKE ? OR u.username LIKE ?)
                ";
                $sqlParams = [$searchPattern, $searchPattern, $searchPattern];

                if ($cabangFilter !== null && strtoupper($cabangFilter) !== 'ALL') {
                    if (strtoupper($cabangFilter) === 'LAINNYA' || strtoupper($cabangFilter) === 'NONE') {
                        $sql .= " AND (k.cabang IS NULL OR TRIM(k.cabang) = '')";
                    } else {
                        $sql .= " AND UPPER(TRIM(k.cabang)) = UPPER(TRIM(?))";
                        $sqlParams[] = $cabangFilter;
                    }
                }

                $limit = 500;
                if ($search === '') {
                    if (strtoupper((string)$cabangFilter) === 'JAKARTA') {
                        $limit = 30;
                    }
                }

                $sql .= " ORDER BY k.nama_lengkap ASC LIMIT " . (int)$limit;
                $stmt = $pdo->prepare($sql);
                $stmt->execute($sqlParams);
                $users = $stmt->fetchAll();
            }

            // Ambil daftar semua cabang unik dari user
            $cabangStmt = $pdo->query("
                SELECT DISTINCT UPPER(TRIM(k.cabang)) AS cabang 
                FROM users u 
                LEFT JOIN karyawans k ON u.karyawan_id = k.id 
                WHERE k.cabang IS NOT NULL AND TRIM(k.cabang) != '' 
                ORDER BY cabang ASC
            ");
            $cabangs = $cabangStmt->fetchAll(PDO::FETCH_COLUMN);

            $totalUsersCount = (int)$pdo->query("SELECT count(*) FROM users")->fetchColumn();

            // Ambil semua permissions sekaligus
            $permStmt = $pdo->query("SELECT user_id, feature_key, is_enabled FROM user_feature_permissions");
            $permsRaw = $permStmt->fetchAll();

            // Kelompokkan per user_id
            $permsMap = [];
            foreach ($permsRaw as $p) {
                $permsMap[$p['user_id']][$p['feature_key']] = (bool)$p['is_enabled'];
            }

            foreach ($users as &$u) {
                $uid = $u['user_id'];
                $features = [];
                foreach (self::VALID_FEATURES as $fk) {
                    // Default: perbarui_wajah harus dibuka izinnya oleh IT (default false), lainnya aktif
                    $defaultVal = ($fk === 'perbarui_wajah') ? false : true;
                    $features[$fk] = isset($permsMap[$uid][$fk]) ? (bool)$permsMap[$uid][$fk] : $defaultVal;
                }
                $u['feature_permissions'] = $features;
                $u['active_feature_count'] = count(array_filter($features));
            }

            // Hitung statistik global user di database
            $allUsersRows = $pdo->query("
                SELECT u.id, UPPER(TRIM(k.cabang)) as cabang 
                FROM users u 
                LEFT JOIN karyawans k ON u.karyawan_id = k.id
            ")->fetchAll();

            $globalTotal = 0;
            $globalFull = 0;
            $globalStandard = 0;
            $totalFeaturesCount = count(self::VALID_FEATURES);
            $defaultFeaturesCount = count(self::DEFAULT_FEATURES);

            foreach ($allUsersRows as $row) {
                $uid = $row['id'];
                $uCabang = $row['cabang'] ?? '';

                if (!$isAllCabang && $cabangFilter !== null) {
                    if (strtoupper($cabangFilter) === 'LAINNYA' || strtoupper($cabangFilter) === 'NONE') {
                        if ($uCabang !== '') continue;
                    } else {
                        if (strtoupper($uCabang) !== strtoupper($cabangFilter)) continue;
                    }
                }

                $globalTotal++;
                $activeCount = 0;
                $userPerms = $permsMap[$uid] ?? [];
                foreach (self::VALID_FEATURES as $fk) {
                    $defaultVal = ($fk === 'perbarui_wajah') ? false : true;
                    $val = isset($userPerms[$fk]) ? (bool)$userPerms[$fk] : $defaultVal;
                    if ($val) $activeCount++;
                }

                if ($activeCount === $totalFeaturesCount) {
                    $globalFull++;
                } elseif ($activeCount === $defaultFeaturesCount) {
                    $globalStandard++;
                }
            }

            echo json_encode([
                'success' => true,
                'data' => $users,
                'cabangs' => $cabangs,
                'total_users' => $totalUsersCount,
                'stats' => [
                    'total' => $globalTotal,
                    'full_count' => $globalFull,
                    'standard_count' => $globalStandard,
                ],
            ]);
        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }

    /**
     * PUT /api/it/feature-permissions
     * Update satu izin fitur untuk satu user
     * Body: { user_id, feature_key, is_enabled, requester_id }
     */
    public function updatePermission(array $body): void
    {
        $requesterId = $body['requester_id'] ?? $body['user_id'] ?? null;
        if (!$this->isIT($requesterId)) {
            http_response_code(403);
            echo json_encode(['message' => 'Akses ditolak. Hanya IT yang dapat mengubah izin fitur.']);
            return;
        }

        $userId     = $body['user_id'] ?? null;
        $featureKey = $body['feature_key'] ?? null;
        $isEnabled  = isset($body['is_enabled']) ? (int)(bool)$body['is_enabled'] : null;

        if (!$userId || !$featureKey || $isEnabled === null) {
            http_response_code(400);
            echo json_encode(['message' => 'Parameter user_id, feature_key, dan is_enabled diperlukan.']);
            return;
        }

        if (!in_array($featureKey, self::VALID_FEATURES, true)) {
            http_response_code(400);
            echo json_encode(['message' => "Feature '{$featureKey}' tidak dikenal."]);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                INSERT INTO user_feature_permissions (user_id, feature_key, is_enabled, updated_by)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), updated_by = VALUES(updated_by)
            ");
            $stmt->execute([$userId, $featureKey, $isEnabled, $requesterId]);

            echo json_encode(['success' => true, 'message' => 'Izin fitur berhasil diperbarui.']);
        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }

    /**
     * PUT /api/it/feature-permissions/bulk
     * Update semua fitur untuk satu user sekaligus
     * Body: { user_id, permissions: { feature_key: bool, ... }, requester_id }
     */
    public function bulkUpdatePermissions(array $body): void
    {
        $requesterId = $body['requester_id'] ?? $body['user_id'] ?? null;
        if (!$this->isIT($requesterId)) {
            http_response_code(403);
            echo json_encode(['message' => 'Akses ditolak.']);
            return;
        }

        $userId      = $body['user_id'] ?? null;
        $permissions = $body['permissions'] ?? null;

        if (!$userId || !is_array($permissions)) {
            http_response_code(400);
            echo json_encode(['message' => 'Parameter user_id dan permissions diperlukan.']);
            return;
        }

        try {
            $pdo = Database::getConnection();
            foreach ($permissions as $featureKey => $isEnabled) {
                if (!in_array($featureKey, self::VALID_FEATURES, true)) continue;
                $stmt = $pdo->prepare("
                    INSERT INTO user_feature_permissions (user_id, feature_key, is_enabled, updated_by)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), updated_by = VALUES(updated_by)
                ");
                $stmt->execute([$userId, $featureKey, (int)(bool)$isEnabled, $requesterId]);
            }
            echo json_encode(['success' => true, 'message' => 'Izin fitur berhasil diperbarui.']);
        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }

    /**
     * POST|PUT /api/it/feature-permissions/all
     * Memberikan izin fitur secara massal ke SEMUA karyawan (atau cabang tertentu)
     * Body: { requester_id, cabang: 'ALL'|string, action: 'grant_all'|'set_default'|'disable_all' }
     */
    public function bulkUpdateAllUsers(array $body): void
    {
        $requesterId = $body['requester_id'] ?? $body['user_id'] ?? null;
        if (!$this->isIT($requesterId)) {
            http_response_code(403);
            echo json_encode(['message' => 'Akses ditolak. Hanya IT yang dapat mengubah izin fitur massal.']);
            return;
        }

        $cabang = isset($body['cabang']) ? trim((string)$body['cabang']) : 'ALL';
        $action = $body['action'] ?? 'grant_all';

        try {
            $pdo = Database::getConnection();

            if (strtoupper($cabang) === 'ALL' || $cabang === '') {
                $stmt = $pdo->query("SELECT id FROM users");
                $userIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
            } else {
                if (strtoupper($cabang) === 'LAINNYA' || strtoupper($cabang) === 'NONE') {
                    $stmt = $pdo->query("
                        SELECT u.id FROM users u
                        LEFT JOIN karyawans k ON u.karyawan_id = k.id
                        WHERE (k.cabang IS NULL OR TRIM(k.cabang) = '')
                    ");
                    $userIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
                } else {
                    $stmt = $pdo->prepare("
                        SELECT u.id FROM users u
                        LEFT JOIN karyawans k ON u.karyawan_id = k.id
                        WHERE UPPER(TRIM(k.cabang)) = UPPER(TRIM(?))
                    ");
                    $stmt->execute([$cabang]);
                    $userIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
                }
            }

            if (empty($userIds)) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Tidak ada karyawan yang ditemukan untuk filter ini.',
                    'affected_users' => 0,
                ]);
                return;
            }

            $pdo->beginTransaction();

            $chunkSize = 100;
            $chunks = array_chunk($userIds, $chunkSize);

            foreach ($chunks as $chunk) {
                $values = [];
                $placeholders = [];
                foreach ($chunk as $uid) {
                    foreach (self::VALID_FEATURES as $fk) {
                        $isEnabled = 1;
                        if ($action === 'set_default') {
                            $isEnabled = in_array($fk, self::DEFAULT_FEATURES, true) ? 1 : 0;
                        } elseif ($action === 'disable_all') {
                            $isEnabled = 0;
                        }

                        $placeholders[] = "(?, ?, ?, ?)";
                        $values[] = $uid;
                        $values[] = $fk;
                        $values[] = $isEnabled;
                        $values[] = $requesterId;
                    }
                }

                if (!empty($placeholders)) {
                    $sql = "INSERT INTO user_feature_permissions (user_id, feature_key, is_enabled, updated_by)
                            VALUES " . implode(', ', $placeholders) . "
                            ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), updated_by = VALUES(updated_by)";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($values);
                }
            }

            $pdo->commit();

            $actionText = 'Full Akses';
            if ($action === 'set_default') $actionText = 'Fitur Standar';
            if ($action === 'disable_all') $actionText = 'Nonaktifkan Akses';

            $targetText = (strtoupper($cabang) === 'ALL' || $cabang === '') ? 'seluruh karyawan' : "karyawan cabang {$cabang}";

            echo json_encode([
                'success' => true,
                'message' => "Berhasil menerapkan {$actionText} untuk {$targetText} (" . count($userIds) . " karyawan).",
                'affected_users' => count($userIds),
            ]);
        } catch (\Exception $e) {
            if (isset($pdo) && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['message' => 'Terjadi kesalahan pada server: ' . $e->getMessage()]);
        }
    }

    /**
     * Ambil permissions untuk satu user (dipanggil dari ProfileController)
     */
    public static function getPermissionsForUser(PDO $pdo, int $userId): array
    {
        try {
            $stmt = $pdo->prepare("SELECT feature_key, is_enabled FROM user_feature_permissions WHERE user_id = ?");
            $stmt->execute([$userId]);
            $rows = $stmt->fetchAll();

            $result = [];
            foreach (self::VALID_FEATURES as $fk) {
                $result[$fk] = ($fk === 'perbarui_wajah') ? false : true;
            }
            foreach ($rows as $row) {
                $result[$row['feature_key']] = (bool)$row['is_enabled'];
            }
            return $result;
        } catch (\Throwable $e) {
            // Fallback aman jika tabel belum dimigrasi di server
            $result = [];
            foreach (self::VALID_FEATURES as $fk) {
                $result[$fk] = ($fk === 'perbarui_wajah') ? false : true;
            }
            return $result;
        }
    }

    /** Cek apakah requester adalah IT */
    private function isIT(?string $requesterId): bool
    {
        if (!$requesterId) return false;
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("
                SELECT k.pekerjaan FROM users u
                LEFT JOIN karyawans k ON u.karyawan_id = k.id
                WHERE u.id = ?
            ");
            $stmt->execute([$requesterId]);
            $row = $stmt->fetch();
            return $row && strtoupper(trim($row['pekerjaan'])) === 'IT';
        } catch (\Exception $e) {
            return false;
        }
    }
}
