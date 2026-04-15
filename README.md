# MiSecreto — Expo SDK 54 + PHP API

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto (puedes copiar `.env.example`):

```env
EXPO_PUBLIC_API_BASE_URL=https://MI-DOMINIO/api
DB_HOST=db.clawn.net
DB_PORT=3306
DB_NAME=misecreto
DB_USER=TU_USUARIO
DB_PASS=TU_PASSWORD
```

> `DB_*` son usadas por el backend PHP. El DSN en `api/db.php` incluye explícitamente `host + port`.

## Backend API (PHP)

Archivos en `/api`:

- `cors.php`
- `db.php`
- `register.php`
- `login.php`
- `secrets.php`
- `comments.php`
- `admin-status.php`

Endpoints:

- `POST /register.php` → crea usuario real en `users` con `password_hash`.
- `POST /login.php` → valida con `password_verify`.
- `GET /secrets.php` → lista secretos con owner (`user_id`, `username`).
- `POST /secrets.php` → crea secreto exigiendo `user_id` válido.
- `GET /comments.php?secret_id={id}` → lista comentarios de un secreto.
- `POST /comments.php` → crea comentario con `secret_id` y `user_id` válidos.
- `GET /admin-status.php?user_id={id}` → health check solo para admins.

## Frontend (Expo web/móvil)

- La autenticación ahora consume `/register.php` y `/login.php`.
- El feed consume `/secrets.php`.
- Los comentarios consumen `/comments.php`.
- AsyncStorage se usa solo para sesión local (`currentUser`), no como fuente de usuarios/posts/comentarios.
- El badge de estado DB solo aparece para usuarios admin.

## Desarrollo

```bash
pnpm install
pnpm expo start --clear
```

## Verificación rápida sugerida

1. Registrar usuario normal.
2. Registrar usuario admin usando `admin_code = KGjmwQh2R9`.
3. Login con ambos usuarios.
4. Crear secreto y verificar que se guarde con `user_id` correcto.
5. Crear comentario y verificar asociación por `secret_id` + `user_id`.
6. Verificar badge DB: solo visible para admin.
