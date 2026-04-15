<?php

declare(strict_types=1);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método no permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
$username = mb_strtolower(trim((string)($input['username'] ?? '')));
$password = (string)($input['password'] ?? '');

if ($username === '' || trim($password) === '') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'username y password son obligatorios']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, username, password_hash, is_admin, created_at FROM users WHERE username = :username LIMIT 1');
$stmt->execute(['username' => $username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, (string)$user['password_hash'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Credenciales inválidas']);
    exit;
}

echo json_encode([
    'ok' => true,
    'user' => [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'is_admin' => (int)$user['is_admin'],
        'created_at' => $user['created_at'],
    ],
]);
