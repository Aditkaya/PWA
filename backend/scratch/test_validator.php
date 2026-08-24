<?php
$_SERVER['SERVER_NAME']='localhost';
require 'config/database.php';
require 'app/Helpers/OvertimeValidator.php';
\App\Helpers\OvertimeValidator::checkAndCreateApproval(154, '2026-08-24');
echo "Done.\n";
