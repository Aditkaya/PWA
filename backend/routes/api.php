<?php

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: OPTIONS,GET,POST,PUT,DELETE");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
$requestData = json_decode(file_get_contents('php://input'), true);

if ($uri === '/api/login' && $method === 'POST') {
    require_once __DIR__ . '/../app/Http/Controllers/Auth/LoginController.php';
    $controller = new \App\Http\Controllers\Auth\LoginController();
    $controller->login($requestData);
    exit();
}

http_response_code(404);
echo json_encode(['message' => 'Endpoint tidak ditemukan']);
