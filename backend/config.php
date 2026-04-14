<?php

$env = static function (string $key, ?string $default = null): ?string {
    $v = getenv($key);
    return $v === false ? $default : $v;
};

return [
    'db' => [
        'host' => $env('DB_HOST', '127.0.0.1'),
        'port' => (int) $env('DB_PORT', '3306'),
        'name' => (string) $env('DB_NAME', 'misecreto'),
        'user' => (string) $env('DB_USER', ''),
        'pass' => (string) $env('DB_PASS', ''),
        'charset' => 'utf8mb4',
    ],
    'security' => [
        'app_key' => (string) $env('APP_KEY', ''),
        'token_ttl' => (int) $env('TOKEN_TTL_SECONDS', '1209600'),
        'allowed_origins' => array_filter(array_map('trim', explode(',', (string) $env('ALLOWED_ORIGINS', '')))),
    ],
];
