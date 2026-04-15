<?php

declare(strict_types=1);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $sql = 'SELECT s.id, s.user_id, s.title, s.content, s.nsfw, s.color_idx, s.created_at, u.username,
              (SELECT COUNT(*) FROM secret_likes sl WHERE sl.secret_id = s.id) AS likes
            FROM secrets s
            INNER JOIN users u ON u.id = s.user_id
            ORDER BY s.created_at DESC';
    $stmt = $pdo->query($sql);
    echo json_encode(['ok' => true, 'secrets' => $stmt->fetchAll()]);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input') ?: '{}', true);
    $userId = (int)($input['user_id'] ?? 0);
    $title = trim((string)($input['title'] ?? ''));
    $content = trim((string)($input['content'] ?? ''));
    $nsfw = (int)($input['nsfw'] ?? 0);
    $colorIdx = (int)($input['color_idx'] ?? 0);

    if ($userId <= 0) { http_response_code(422); echo json_encode(['ok' => false, 'error' => 'user_id obligatorio']); exit; }
    if ($title === '' || mb_strlen($title) > 180) { http_response_code(422); echo json_encode(['ok' => false, 'error' => 'title inválido']); exit; }
    if ($content === '' || mb_strlen($content) > 3000) { http_response_code(422); echo json_encode(['ok' => false, 'error' => 'content inválido']); exit; }
    if (!in_array($nsfw, [0, 1], true)) { http_response_code(422); echo json_encode(['ok' => false, 'error' => 'nsfw inválido']); exit; }
    if ($colorIdx < 0 || $colorIdx > 100) { http_response_code(422); echo json_encode(['ok' => false, 'error' => 'color_idx inválido']); exit; }

    $u = $pdo->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
    $u->execute(['id' => $userId]);
    if (!$u->fetch()) { http_response_code(404); echo json_encode(['ok' => false, 'error' => 'user_id no existe']); exit; }

    $ins = $pdo->prepare('INSERT INTO secrets (user_id, title, content, nsfw, color_idx) VALUES (:user_id, :title, :content, :nsfw, :color_idx)');
    $ins->execute([
      'user_id' => $userId,
      'title' => $title,
      'content' => $content,
      'nsfw' => $nsfw,
      'color_idx' => $colorIdx,
    ]);

    $id = (int)$pdo->lastInsertId();
    $q = $pdo->prepare('SELECT s.id, s.user_id, s.title, s.content, s.nsfw, s.color_idx, s.created_at, u.username
                        FROM secrets s INNER JOIN users u ON u.id = s.user_id
                        WHERE s.id = :id LIMIT 1');
    $q->execute(['id' => $id]);

    echo json_encode(['ok' => true, 'secret' => $q->fetch()]);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Método no permitido']);
