<?php

namespace App\Services;

require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../../../config/database.php';

use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;
use Database;
use PDO;

class PushNotificationService {
    
    private $webPush;

    public function __construct() {
        $pushConfig = require __DIR__ . '/../../config/push.php';
        $auth = [
            'VAPID' => [
                'subject' => $pushConfig['vapid']['subject'],
                'publicKey' => $pushConfig['vapid']['publicKey'],
                'privateKey' => $pushConfig['vapid']['privateKey'],
            ],
        ];
        
        $this->webPush = new WebPush($auth);
    }

    public function sendToUser($user_id, $title, $body, $url = '/') {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT * FROM push_subscriptions WHERE user_id = ?");
            $stmt->execute([$user_id]);
            $subscriptions = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($subscriptions)) {
                return false;
            }

            $payload = json_encode([
                'title' => $title,
                'body' => $body,
                'url' => $url,
                'icon' => '/logo-kotak.png'
            ]);

            foreach ($subscriptions as $sub) {
                $subscription = Subscription::create([
                    'endpoint' => $sub['endpoint'],
                    'keys' => [
                        'p256dh' => $sub['p256dh'],
                        'auth' => $sub['auth']
                    ],
                ]);

                $this->webPush->queueNotification($subscription, $payload);
            }

            $reports = [];
            foreach ($this->webPush->flush() as $report) {
                $reports[] = $report;
                
                // Jika gagal mengirim push notification, catat alasannya
                if (!$report->isSuccess()) {
                    error_log("Push failed to endpoint {$report->getRequest()->getUri()->__toString()}: " . $report->getReason() . " (Status: " . $report->getResponse()->getStatusCode() . ")");
                    
                    // Jika subscription sudah expired atau endpoint tidak valid, hapus dari database
                    if (in_array($report->getResponse()->getStatusCode(), [404, 410])) {
                        $endpoint = $report->getRequest()->getUri()->__toString();
                        $delStmt = $pdo->prepare("DELETE FROM push_subscriptions WHERE endpoint = ?");
                        $delStmt->execute([$endpoint]);
                    }
                }
            }
            return true;

        } catch (\Exception $e) {
            error_log("Push Notification Error: " . $e->getMessage());
            return false;
        }
    }
}
