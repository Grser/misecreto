<?php

declare(strict_types=1);

if (!function_exists('env_or_default')) {
    function env_or_default(string $name, string $default): string
    {
        $value = getenv($name);
        if ($value === false || $value === '') {
            return $default;
        }
        return $value;
    }
}

$DB_HOST = env_or_default('DB_HOST', 'db.clawn.net');
$DB_PORT = env_or_default('DB_PORT', '3306');
$DB_NAME = env_or_default('DB_NAME', 'misecreto');
$DB_USER = env_or_default('DB_USER', 'TU_USUARIO');
$DB_PASS = env_or_default('DB_PASS', 'TU_PASSWORD');

$dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";

try {
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'No se pudo conectar a MySQL']);
    exit;
}
