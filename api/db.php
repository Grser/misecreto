<?php

declare(strict_types=1);

$dbHost = 'db.clawn.net';
$dbName = 'misecreto';
$dbUser = 'TU_USUARIO';
$dbPass = 'TU_PASSWORD';
$dbCharset = 'utf8mb4';

$dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', $dbHost, $dbName, $dbCharset);

try {
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'No se pudo conectar a MySQL']);
    exit;
}
