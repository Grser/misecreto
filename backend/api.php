<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

cors();
$pdo = db();

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($action) {
    case 'health':
        jsonResponse(['ok' => true, 'message' => 'API activa y tablas verificadas']);
        break;

    case 'register':
        if ($method !== 'POST') {
            jsonResponse(['ok' => false, 'error' => 'Metodo no permitido'], 405);
        }

        $input = jsonInput();
        $username = trim((string) ($input['username'] ?? ''));
        $password = (string) ($input['password'] ?? '');

        if (strlen($username) < 3 || strlen($password) < 4) {
            jsonResponse(['ok' => false, 'error' => 'Datos invalidos'], 422);
        }

        $stmt = $pdo->prepare('SELECT id FROM users WHERE username = :username LIMIT 1');
        $stmt->execute(['username' => $username]);
        if ($stmt->fetch()) {
            jsonResponse(['ok' => false, 'error' => 'Usuario ya existe'], 409);
        }

        $ins = $pdo->prepare('INSERT INTO users (username, password_hash) VALUES (:username, :password_hash)');
        $ins->execute([
            'username' => $username,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        ]);

        $id = (int) $pdo->lastInsertId();
        jsonResponse([
            'ok' => true,
            'token' => makeToken($id),
            'user' => ['id' => $id, 'username' => $username, 'is_admin' => 0],
        ], 201);
        break;

    case 'login':
        if ($method !== 'POST') {
            jsonResponse(['ok' => false, 'error' => 'Metodo no permitido'], 405);
        }

        $input = jsonInput();
        $username = trim((string) ($input['username'] ?? ''));
        $password = (string) ($input['password'] ?? '');

        $stmt = $pdo->prepare('SELECT id, username, password_hash, is_admin FROM users WHERE username = :username LIMIT 1');
        $stmt->execute(['username' => $username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            jsonResponse(['ok' => false, 'error' => 'Credenciales invalidas'], 401);
        }

        jsonResponse([
            'ok' => true,
            'token' => makeToken((int) $user['id']),
            'user' => [
                'id' => (int) $user['id'],
                'username' => $user['username'],
                'is_admin' => (int) $user['is_admin'],
            ],
        ]);
        break;

    case 'secrets.list':
        $current = requireAuth($pdo);

        $stmt = $pdo->query(
            'SELECT s.id, s.title, s.content, s.nsfw, s.color_idx, s.created_at, u.username,
                (SELECT COUNT(*) FROM secret_likes sl WHERE sl.secret_id = s.id) AS likes
             FROM secrets s
             INNER JOIN users u ON u.id = s.user_id
             ORDER BY s.created_at DESC
             LIMIT 200'
        );
        $rows = $stmt->fetchAll();

        jsonResponse(['ok' => true, 'user' => $current, 'items' => $rows]);
        break;

    case 'secrets.create':
        if ($method !== 'POST') {
            jsonResponse(['ok' => false, 'error' => 'Metodo no permitido'], 405);
        }

        $current = requireAuth($pdo);
        $input = jsonInput();
        $title = trim((string) ($input['title'] ?? ''));
        $content = trim((string) ($input['content'] ?? ''));
        $nsfw = !empty($input['nsfw']) ? 1 : 0;
        $colorIdx = max(0, min(7, (int) ($input['color_idx'] ?? 0)));

        if ($title === '' || $content === '') {
            jsonResponse(['ok' => false, 'error' => 'Titulo y contenido son obligatorios'], 422);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO secrets (user_id, title, content, nsfw, color_idx)
             VALUES (:user_id, :title, :content, :nsfw, :color_idx)'
        );
        $stmt->execute([
            'user_id' => (int) $current['id'],
            'title' => $title,
            'content' => $content,
            'nsfw' => $nsfw,
            'color_idx' => $colorIdx,
        ]);

        jsonResponse(['ok' => true, 'id' => (int) $pdo->lastInsertId()], 201);
        break;

    default:
        jsonResponse([
            'ok' => false,
            'error' => 'Accion invalida. Usa ?action=health|register|login|secrets.list|secrets.create',
        ], 404);
}
