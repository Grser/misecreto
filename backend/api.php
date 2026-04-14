<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

cors();

try {
    $pdo = db();
    $stmt = $pdo->query('SELECT 1 AS ok');
    $row = $stmt->fetch();

    jsonResponse([
        'ok' => true,
        'message' => 'Conexión básica a DB activa',
        'db' => [
            'connected' => true,
            'ping' => (int) ($row['ok'] ?? 0) === 1,
        ],
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'ok' => false,
        'message' => 'No se pudo conectar a la DB',
        'error' => $e->getMessage(),
    ], 500);
}
