<?php
// No database, photo files or AI service are accessed by these policy tests.
require_once __DIR__ . '/../app/Services/FaceVerificationService.php';

use App\Services\FaceVerificationException;
use App\Services\FaceMismatchException;
use App\Services\FaceVerificationService;

class OfflineFaceReviewTestService extends FaceVerificationService {
    public $failure;
    public function verifyAttendance($pdo, $userId, $dataUrl) {
        if ($this->failure) throw $this->failure;
    }
}

$service = new OfflineFaceReviewTestService();
$cases = 0;
foreach ([false, true] as $offline) {
    $service->failure = null;
    if ($service->verifyAttendanceForSubmission(null, 1, 'original-photo', $offline) !== null) {
        throw new RuntimeException('A verified face should not require review');
    }
    $cases++;
    foreach ([
        new FaceMismatchException('Wajah tidak cocok dengan foto terdaftar.', 422),
        new FaceVerificationException('Wajah tidak terdeteksi pada foto.', 422),
        new FaceVerificationException('Foto wajah JPEG/PNG diperlukan.', 422),
        new FaceVerificationException('Daftarkan wajah terlebih dahulu sebelum absen.', 422),
        new FaceVerificationException('Layanan validasi wajah tidak tersedia.', 503),
        new FaceMismatchException('Invalid AI response', 503),
    ] as $index => $failure) {
        $service->failure = $failure;
        $shouldReview = $offline && $index < 2;
        try {
            $reason = $service->verifyAttendanceForSubmission(null, 1, 'original-photo', $offline);
            if (!$shouldReview || $reason !== $failure->getMessage()) {
                throw new RuntimeException('Face failure was not preserved for review');
            }
        } catch (FaceVerificationException $e) {
            if ($shouldReview || $e !== $failure) {
                throw new RuntimeException('Unexpected face rejection policy');
            }
        }
        $cases++;
    }
}
echo "$cases offline/online face review checks passed\n";
