<?php

declare(strict_types=1);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $secretId = (int)($_GET['secret_id'] ?? 0);
    if ($secretId <= 0) { http_response_code(422); echo json_encode(['ok' => false, 'error' => 'secret_id obligatorio']); exit; }

    $stmt = $pdo->prepare('SELECT c.id, c.secret_id, c.user_id, c.parent_id, c.content, c.created_at, u.username
                           FROM comments c
                           INNER JOIN users u ON u.id = c.user_id
                           WHERE c.secret_id = :secret_id
                           ORDER BY c.created_at ASC');
    $stmt->execute(['secret_id' => $secretId]);

    echo json_encode(['ok' => true, 'comments' => $stmt->fetchAll()]);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input') ?: '{}', true);
    $secretId = (int)($input['secret_id'] ?? 0);
    $userId = (int)($input['user_id'] ?? 0);
    $parentId = array_key_exists('parent_id', $input) && $input['parent_id'] !== null ? (int)$input['parent_id'] : null;
    $content = trim((string)($input['content'] ?? ''));

    if ($secretId <= 0) { http_response_code(422); echo json_encode(['ok' => false, 'error' => 'secret_id obligatorio']); exit; }
    if ($userId <= 0) { http_response_code(422); echo json_encode(['ok' => false, 'error' => 'user_id obligatorio']); exit; }
    if ($content === '' || mb_strlen($content) > 1200) { http_response_code(422); echo json_encode(['ok' => false, 'error' => 'content inválido']); exit; }

    $secret = $pdo->prepare('SELECT id FROM secrets WHERE id = :id LIMIT 1');
    $secret->execute(['id' => $secretId]);
    if (!$secret->fetch()) { http_response_code(404); echo json_encode(['ok' => false, 'error' => 'secret_id no existe']); exit; }

    $user = $pdo->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
    $user->execute(['id' => $userId]);
    if (!$user->fetch()) { http_response_code(404); echo json_encode(['ok' => false, 'error' => 'user_id no existe']); exit; }

    if ($parentId !== null) {
      $parent = $pdo->prepare('SELECT id, secret_id FROM comments WHERE id = :id LIMIT 1');
      $parent->execute(['id' => $parentId]);
      $parentRow = $parent->fetch();
      if (!$parentRow || (int)$parentRow['secret_id'] !== $secretId) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'parent_id inválido']);
        exit;
      }
    }

    $ins = $pdo->prepare('INSERT INTO comments (secret_id, user_id, parent_id, content) VALUES (:secret_id, :user_id, :parent_id, :content)');
    $ins->bindValue(':secret_id', $secretId, PDO::PARAM_INT);
    $ins->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $ins->bindValue(':parent_id', $parentId, $parentId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    $ins->bindValue(':content', $content, PDO::PARAM_STR);
    $ins->execute();

    $id = (int)$pdo->lastInsertId();
    $q = $pdo->prepare('SELECT c.id, c.secret_id, c.user_id, c.parent_id, c.content, c.created_at, u.username
                        FROM comments c
                        INNER JOIN users u ON u.id = c.user_id
                        WHERE c.id = :id LIMIT 1');
    $q->execute(['id' => $id]);

    echo json_encode(['ok' => true, 'comment' => $q->fetch()]);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Método no permitido']);
