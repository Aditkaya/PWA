<?php
require 'vendor/autoload.php';
use Minishlink\WebPush\VAPID;

$vapid = VAPID::createVapidKeys();
echo "Public Key:\n" . $vapid['publicKey'] . "\n\n";
echo "Private Key:\n" . $vapid['privateKey'] . "\n\n";
