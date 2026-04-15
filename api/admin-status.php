<?php

declare(strict_types=1);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método no permitido']);
    exit;
}

$userId = (int)($_GET['user_id'] ?? 0);
if ($userId <= 0) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'user_id obligatorio']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, username, is_admin FROM users WHERE id = :id LIMIT 1');
$stmt->execute(['id' => $userId]);
$user = $stmt->fetch();
if (!$user) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Usuario no existe']);
    exit;
}

if ((int)$user['is_admin'] !== 1) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Solo administradores']);
    exit;
}

$ping = (int)$pdo->query('SELECT 1')->fetchColumn() === 1;
echo json_encode([
    'ok' => true,
    'db_connected' => $ping,
    'user' => [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'is_admin' => (int)$user['is_admin'],
    ],
]);
