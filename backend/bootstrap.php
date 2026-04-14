<?php

declare(strict_types=1);

function appConfig(): array
{
    static $cfg;

    if ($cfg === null) {
        $cfg = require __DIR__ . '/config.php';
    }

    return $cfg;
}

function db(): PDO
{
    static $pdo;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $cfg = appConfig()['db'];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $cfg['host'],
        $cfg['port'],
        $cfg['name'],
        $cfg['charset']
    );

    $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    ensureSchema($pdo);

    return $pdo;
}

function ensureSchema(PDO $pdo): void
{
    $queries = [
        "CREATE TABLE IF NOT EXISTS users (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(80) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            is_admin TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS secrets (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            title VARCHAR(180) NOT NULL,
            content TEXT NOT NULL,
            nsfw TINYINT(1) NOT NULL DEFAULT 0,
            color_idx TINYINT UNSIGNED NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_secrets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_secrets_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS secret_likes (
            secret_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (secret_id, user_id),
            CONSTRAINT fk_secret_likes_secret FOREIGN KEY (secret_id) REFERENCES secrets(id) ON DELETE CASCADE,
            CONSTRAINT fk_secret_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS comments (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            secret_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            parent_id BIGINT UNSIGNED NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_comments_secret FOREIGN KEY (secret_id) REFERENCES secrets(id) ON DELETE CASCADE,
            CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
            INDEX idx_comments_secret (secret_id),
            INDEX idx_comments_parent (parent_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        "CREATE TABLE IF NOT EXISTS comment_likes (
            comment_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (comment_id, user_id),
            CONSTRAINT fk_comment_likes_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
            CONSTRAINT fk_comment_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    ];

    foreach ($queries as $sql) {
        $pdo->exec($sql);
    }

    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = :username LIMIT 1');
    $stmt->execute(['username' => 'admin']);
    if (!$stmt->fetch()) {
        $insert = $pdo->prepare(
            'INSERT INTO users (username, password_hash, is_admin) VALUES (:username, :password_hash, 1)'
        );
        $insert->execute([
            'username' => 'admin',
            'password_hash' => password_hash('admin123', PASSWORD_DEFAULT),
        ]);
    }
}

function jsonInput(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $payload = json_decode($raw, true);
    return is_array($payload) ? $payload : [];
}

function jsonResponse(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function bearerUserId(): ?int
{
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($auth, 'Bearer ')) {
        return null;
    }

    $token = trim(substr($auth, 7));
    if ($token === '') {
        return null;
    }

    $parts = explode(':', base64_decode($token) ?: '');
    if (count($parts) !== 2 || $parts[0] !== 'uid') {
        return null;
    }

    return ctype_digit($parts[1]) ? (int) $parts[1] : null;
}

function makeToken(int $userId): string
{
    return base64_encode('uid:' . $userId);
}

function requireAuth(PDO $pdo): array
{
    $uid = bearerUserId();
    if (!$uid) {
        jsonResponse(['ok' => false, 'error' => 'No autorizado'], 401);
    }

    $stmt = $pdo->prepare('SELECT id, username, is_admin FROM users WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $uid]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(['ok' => false, 'error' => 'Usuario invalido'], 401);
    }

    return $user;
}

function cors(): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
