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
$adminCode = trim((string)($input['admin_code'] ?? ''));

if ($username === '') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'username obligatorio']);
    exit;
}
if (mb_strlen($username) < 3 || mb_strlen($username) > 32) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'username debe tener entre 3 y 32 caracteres']);
    exit;
}
if (!preg_match('/^[a-z0-9_]+$/', $username)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'username solo permite letras, números y _']);
    exit;
}
if (trim($password) === '' || mb_strlen($password) < 6) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'password inválida, mínimo 6 caracteres']);
    exit;
}

$exists = $pdo->prepare('SELECT id FROM users WHERE username = :username LIMIT 1');
$exists->execute(['username' => $username]);
if ($exists->fetch()) {
    http_response_code(409);
    echo json_encode(['ok' => false, 'error' => 'username ya registrado']);
    exit;
}

$isAdmin = $adminCode === 'KGjmwQh2R9' ? 1 : 0;
$passwordHash = password_hash($password, PASSWORD_DEFAULT);

$insert = $pdo->prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (:username, :password_hash, :is_admin)');
$insert->execute([
    'username' => $username,
    'password_hash' => $passwordHash,
    'is_admin' => $isAdmin,
]);

$id = (int)$pdo->lastInsertId();
$userQuery = $pdo->prepare('SELECT id, username, is_admin, created_at FROM users WHERE id = :id LIMIT 1');
$userQuery->execute(['id' => $id]);
$user = $userQuery->fetch();

echo json_encode(['ok' => true, 'user' => $user]);
