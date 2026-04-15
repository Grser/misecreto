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

function appKey(): string
{
    $key = appConfig()['security']['app_key'] ?? '';
    if (strlen($key) < 32) {
        jsonResponse(['ok' => false, 'error' => 'Configuración insegura: APP_KEY inválida'], 500);
    }

    return $key;
}

function db(): PDO
{
    static $pdo;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $cfg = appConfig()['db'];
    if (($cfg['user'] ?? '') === '' || ($cfg['pass'] ?? '') === '') {
        jsonResponse(['ok' => false, 'error' => 'Configura DB_USER y DB_PASS en el entorno'], 500);
    }

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
            color TINYINT UNSIGNED NOT NULL DEFAULT 0,
            country VARCHAR(4) NOT NULL DEFAULT 'us',
            banned TINYINT(1) NOT NULL DEFAULT 0,
            nsfw_verified TINYINT(1) NOT NULL DEFAULT 0,
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

    ensureColumn($pdo, 'users', 'color', "ALTER TABLE users ADD COLUMN color TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER is_admin");
    ensureColumn($pdo, 'users', 'country', "ALTER TABLE users ADD COLUMN country VARCHAR(4) NOT NULL DEFAULT 'us' AFTER color");
    ensureColumn($pdo, 'users', 'banned', "ALTER TABLE users ADD COLUMN banned TINYINT(1) NOT NULL DEFAULT 0 AFTER country");
    ensureColumn($pdo, 'users', 'nsfw_verified', "ALTER TABLE users ADD COLUMN nsfw_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER banned");
}

function ensureColumn(PDO $pdo, string $table, string $column, string $alterSql): void
{
    $stmt = $pdo->prepare('SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column');
    $stmt->execute(['table' => $table, 'column' => $column]);
    $exists = (int) ($stmt->fetch()['c'] ?? 0) > 0;
    if (!$exists) {
        $pdo->exec($alterSql);
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

function makeToken(int $userId): string
{
    $ttl = max(300, (int) (appConfig()['security']['token_ttl'] ?? 1209600));
    $exp = time() + $ttl;
    $payload = $userId . ':' . $exp;
    $sig = hash_hmac('sha256', $payload, appKey());
    return rtrim(strtr(base64_encode($payload . ':' . $sig), '+/', '-_'), '=');
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

    $decoded = base64_decode(strtr($token, '-_', '+/'), true);
    if (!$decoded) {
        return null;
    }

    $parts = explode(':', $decoded);
    if (count($parts) !== 3) {
        return null;
    }

    [$uid, $exp, $sig] = $parts;
    if (!ctype_digit($uid) || !ctype_digit($exp)) {
        return null;
    }

    if ((int) $exp < time()) {
        return null;
    }

    $expected = hash_hmac('sha256', $uid . ':' . $exp, appKey());
    if (!hash_equals($expected, $sig)) {
        return null;
    }

    return (int) $uid;
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

function securityHeaders(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
}

function cors(): void
{
    securityHeaders();

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = appConfig()['security']['allowed_origins'] ?? [];
    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
