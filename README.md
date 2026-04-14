# MiSecreto — Expo SDK 54

## Instalación app móvil

Doble clic en `setup.bat` (instala dependencias y levanta Expo).

Manual:
```bash
rmdir /s /q node_modules
del pnpm-lock.yaml
pnpm install
pnpm expo start --clear
```

## Backend PHP + MariaDB (phpMyAdmin)

La app (web + móvil) ya guarda **usuarios y posts en MariaDB** por API PHP (`backend/api.php`).

### 1) Variables de entorno requeridas en el servidor

No dejes credenciales en archivos públicos. Configura estas variables en tu hosting:

- `DB_HOST`
- `DB_PORT` (ej: `3306`)
- `DB_NAME`
- `DB_USER`
- `DB_PASS`
- `APP_KEY` (mínimo 32 caracteres aleatorios)
- `ALLOWED_ORIGINS` (lista separada por coma, ej: `https://app.tudominio.com,https://web.tudominio.com`)
- `TOKEN_TTL_SECONDS` (opcional, por defecto 14 días)

### 1.1) Tablas automáticas (y SQL para importar)

- Al primer request a `backend/api.php`, el backend ejecuta `ensureSchema()` y crea las tablas si no existen.
- Si prefieres importarlas manualmente en phpMyAdmin, usa `backend/schema.sql`.

### 2) Seguridad aplicada

- Contraseñas con `password_hash()` / `password_verify()`.
- Tokens firmados con HMAC SHA-256 + expiración.
- CORS cerrado por allowlist (`ALLOWED_ORIGINS`).
- Headers de endurecimiento (`X-Frame-Options`, `CSP`, `nosniff`, etc.).
- Toda consulta a DB con `PDO` + prepared statements.

### 3) Endpoints

Health:
```http
GET /backend/api.php?action=health
```

Registro:
```http
POST /backend/api.php?action=register
Content-Type: application/json

{"username":"usuario","password":"clave_segura"}
```

Login:
```http
POST /backend/api.php?action=login
Content-Type: application/json

{"username":"usuario","password":"clave_segura"}
```

Crear post:
```http
POST /backend/api.php?action=secrets.create
Authorization: Bearer TU_TOKEN
Content-Type: application/json

{"title":"Secreto","content":"Texto","nsfw":false,"color_idx":2}
```

Listar posts:
```http
GET /backend/api.php?action=secrets.list
Authorization: Bearer TU_TOKEN
```

## Conectar frontend

Define en Expo:

```bash
EXPO_PUBLIC_API_URL=https://tu-dominio.com/backend/api.php
```

También acepta solo el dominio/base (`https://tu-dominio.com`) y la app agregará `/backend/api.php` automáticamente.

Si no la defines en web, intenta usar automáticamente `/<host>/backend/api.php`.
