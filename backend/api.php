<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

cors();

$pdo = db();
$action = (string) ($_GET['action'] ?? 'health');
$input = jsonInput();

$userOut = static fn(array $u): array => [
    'id' => (int) $u['id'],
    'username' => (string) $u['username'],
    'is_admin' => (int) ($u['is_admin'] ?? 0),
    'color' => (int) ($u['color'] ?? 0),
    'country' => (string) ($u['country'] ?? 'us'),
    'nsfwVerified' => (int) ($u['nsfw_verified'] ?? 0) === 1,
];

if ($action === 'health') {
    $row = $pdo->query('SELECT 1 AS ok')->fetch();
    jsonResponse(['ok' => true, 'message' => 'Conexión básica a DB activa', 'db' => ['connected' => true, 'ping' => (int)($row['ok'] ?? 0) === 1]]);
}

if ($action === 'auth.register') {
    $username = strtolower(trim((string) ($input['username'] ?? '')));
    $password = (string) ($input['password'] ?? '');
    $color = max(0, min(7, (int) ($input['color'] ?? 0)));
    $country = strtolower(substr((string) ($input['country'] ?? 'us'), 0, 4));

    if (strlen($username) < 3 || strlen($password) < 4) jsonResponse(['ok' => false, 'error' => 'Datos inválidos'], 422);

    $exists = $pdo->prepare('SELECT id FROM users WHERE username = :u LIMIT 1');
    $exists->execute(['u' => $username]);
    if ($exists->fetch()) jsonResponse(['ok' => false, 'error' => 'Usuario ya existe'], 409);

    $stmt = $pdo->prepare('INSERT INTO users (username, password_hash, is_admin, color, country, banned, nsfw_verified) VALUES (:u,:p,0,:c,:country,0,0)');
    $stmt->execute(['u' => $username, 'p' => password_hash($password, PASSWORD_DEFAULT), 'c' => $color, 'country' => $country ?: 'us']);

    $id = (int) $pdo->lastInsertId();
    $user = ['id' => $id, 'username' => $username, 'is_admin' => 0, 'color' => $color, 'country' => $country ?: 'us', 'nsfw_verified' => 0];
    jsonResponse(['ok' => true, 'token' => makeToken($id), 'user' => $userOut($user)]);
}

if ($action === 'auth.login') {
    $username = strtolower(trim((string) ($input['username'] ?? '')));
    $password = (string) ($input['password'] ?? '');

    $stmt = $pdo->prepare('SELECT id, username, password_hash, is_admin, color, country, banned, nsfw_verified FROM users WHERE username = :u LIMIT 1');
    $stmt->execute(['u' => $username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, (string) $user['password_hash'])) jsonResponse(['ok' => false, 'error' => 'Credenciales inválidas'], 401);
    if ((int) $user['banned'] === 1) jsonResponse(['ok' => false, 'error' => 'Tu cuenta está suspendida'], 403);

    jsonResponse(['ok' => true, 'token' => makeToken((int) $user['id']), 'user' => $userOut($user)]);
}

if ($action === 'auth.claim_admin') {
    $user = requireAuth($pdo);
    $code = trim((string) ($input['code'] ?? ''));
    $expected = (string) (appConfig()['security']['admin_claim_code'] ?? '');
    if ($expected === '' || $code === '' || !hash_equals($expected, $code)) {
        jsonResponse(['ok' => false, 'error' => 'Código inválido'], 403);
    }

    $stmt = $pdo->prepare('UPDATE users SET is_admin = 1 WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => (int) $user['id']]);
    jsonResponse(['ok' => true]);
}

if ($action === 'secrets.list') {
    $viewer = requireAuth($pdo);

    $sql = 'SELECT s.id, s.title, s.content, s.nsfw, s.color_idx, s.created_at, u.username,
              (SELECT COUNT(*) FROM secret_likes sl WHERE sl.secret_id = s.id) AS likes
            FROM secrets s
            INNER JOIN users u ON u.id = s.user_id
            ORDER BY s.created_at DESC
            LIMIT 500';
    $items = $pdo->query($sql)->fetchAll();
    jsonResponse(['ok' => true, 'user' => $userOut($viewer), 'items' => $items]);
}

if ($action === 'secrets.create') {
    $user = requireAuth($pdo);
    $content = trim((string) ($input['content'] ?? ''));
    $title = trim((string) ($input['title'] ?? 'Secreto')) ?: 'Secreto';
    $nsfw = (int) (!empty($input['nsfw']));
    $color = max(0, min(7, (int) ($input['color_idx'] ?? 0)));

    if ($content === '') jsonResponse(['ok' => false, 'error' => 'Título y contenido son obligatorios'], 422);

    $stmt = $pdo->prepare('INSERT INTO secrets (user_id, title, content, nsfw, color_idx) VALUES (:uid,:title,:content,:nsfw,:color)');
    $stmt->execute(['uid' => (int) $user['id'], 'title' => $title, 'content' => $content, 'nsfw' => $nsfw, 'color' => $color]);
    jsonResponse(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
}

if (str_starts_with($action, 'admin.')) {
    $actor = requireAuth($pdo);
    if ((int) ($actor['is_admin'] ?? 0) !== 1) jsonResponse(['ok' => false, 'error' => 'No autorizado'], 403);

    if ($action === 'admin.set_user_ban') {
        $username = strtolower(trim((string) ($input['username'] ?? '')));
        $banned = !empty($input['banned']) ? 1 : 0;
        $stmt = $pdo->prepare('UPDATE users SET banned = :b WHERE username = :u LIMIT 1');
        $stmt->execute(['b' => $banned, 'u' => $username]);
        jsonResponse(['ok' => true]);
    }

    if ($action === 'admin.set_user_admin') {
        $username = strtolower(trim((string) ($input['username'] ?? '')));
        $isAdmin = !empty($input['is_admin']) ? 1 : 0;
        $stmt = $pdo->prepare('UPDATE users SET is_admin = :a WHERE username = :u LIMIT 1');
        $stmt->execute(['a' => $isAdmin, 'u' => $username]);
        jsonResponse(['ok' => true]);
    }

    if ($action === 'admin.delete_secret') {
        $id = (int) ($input['id'] ?? 0);
        if ($id <= 0) jsonResponse(['ok' => false, 'error' => 'ID inválido'], 422);
        $stmt = $pdo->prepare('DELETE FROM secrets WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        jsonResponse(['ok' => true]);
    }

    if ($action === 'admin.snapshot') {
        $users = $pdo->query('SELECT id, username, is_admin, color, country, banned, nsfw_verified, UNIX_TIMESTAMP(created_at) * 1000 AS createdAt FROM users ORDER BY created_at DESC')->fetchAll();
        $items = $pdo->query('SELECT s.id, s.title, s.content, s.nsfw, s.color_idx, s.created_at, u.username,
            (SELECT COUNT(*) FROM secret_likes sl WHERE sl.secret_id = s.id) AS likes
            FROM secrets s INNER JOIN users u ON u.id = s.user_id
            ORDER BY s.created_at DESC LIMIT 1000')->fetchAll();

        $usersByName = [];
        foreach ($users as $u) {
            $usersByName[$u['username']] = [
                'id' => (int) $u['id'],
                'username' => $u['username'],
                'isAdmin' => (int) $u['is_admin'] === 1,
                'color' => (int) $u['color'],
                'country' => $u['country'] ?: 'us',
                'banned' => (int) $u['banned'] === 1,
                'nsfwVerified' => (int) $u['nsfw_verified'] === 1,
                'createdAt' => (int) $u['createdAt'],
            ];
        }

        jsonResponse(['ok' => true, 'users' => $usersByName, 'items' => $items]);
    }
}

jsonResponse(['ok' => false, 'error' => 'Ruta no encontrada'], 404);
