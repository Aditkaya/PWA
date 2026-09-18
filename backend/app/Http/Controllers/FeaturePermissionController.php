<?php

namespace App\Http\Controllers;

require_once __DIR__ . '/../../../config/database.php';

use Database;
use PDO;

class FeaturePermissionController
{
    /** Daftar semua feature_key yang valid */
    private const VALID_FEATURES = [
        'izin_sakit',
        'izin_setengah_hari',
        'cuti_tahunan',
        'lupa_absen',
        'perencanaan_lembur',
        'approval_karyawan',
        'stowage_plan',
        'denah_gudang',
        'amprahan',
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
                    // Default: aktif jika belum pernah diset
                    $features[$fk] = isset($permsMap[$uid][$fk]) ? $permsMap[$uid][$fk] : true;
                }
                $u['feature_permissions'] = $features;
                $u['active_feature_count'] = count(array_filter($features));
            }
            echo json_encode([
                'success' => true,
                'data' => $users,
                'cabangs' => $cabangs,
                'total_users' => $totalUsersCount,
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
                $stmt->execute([$userId, $featureKey, (int)(bool)$isEnabled, $body['requester_id']]);
            }
            echo json_encode(['success' => true, 'message' => 'Izin fitur berhasil diperbarui.']);
        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['message' => 'Terjadi kesalahan pada server']);
        }
    }

    /**
     * Ambil permissions untuk satu user (dipanggil dari ProfileController)
     */
    public static function getPermissionsForUser(PDO $pdo, int $userId): array
    {
        $stmt = $pdo->prepare("SELECT feature_key, is_enabled FROM user_feature_permissions WHERE user_id = ?");
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll();

        $result = [];
        foreach (self::VALID_FEATURES as $fk) {
            $result[$fk] = true; // default aktif
        }
        foreach ($rows as $row) {
            $result[$row['feature_key']] = (bool)$row['is_enabled'];
        }
        return $result;
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
