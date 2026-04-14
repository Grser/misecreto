# MiSecreto — Expo SDK 54

## IMPORTANTE: Por que fallaba antes
pnpm usa "virtual store" con symlinks que Metro no puede seguir.
La solucion: .npmrc con `node-linker=hoisted` hace que pnpm instale
flat node_modules como npm. Esto ya esta configurado en este proyecto.

## Instalacion app movil

Doble clic en setup.bat — hace todo automatico.

O manual:
```
rmdir /s /q node_modules
del pnpm-lock.yaml
pnpm install
pnpm expo start --clear
```

## Admin (modo local actual)
Usuario: admin | Contrasena: admin123

---

## Backend PHP + MySQL (phpMyAdmin) listo para usar

Te deje una API PHP en `backend/` para que solo tengas que editar la conexion y subirla a tu servidor.

### 1) Que debes crear en tu servidor
1. Crea una base de datos vacia en phpMyAdmin (ejemplo: `misecreto`).
2. Sube toda la carpeta `backend/` a tu hosting (por ejemplo en `public_html/misecreto-api/`).
3. Edita **solo** `backend/config.php` con tus datos reales:
   - `host`
   - `port`
   - `name`
   - `user`
   - `pass`

### 2) Creacion automatica de tablas
No tienes que crear tablas a mano.

Cada vez que entre una peticion a `backend/api.php`, el sistema revisa y crea automaticamente (si no existen):
- `users`
- `secrets`
- `secret_likes`
- `comments`
- `comment_likes`

Tambien crea automaticamente el admin inicial si no existe:
- usuario: `admin`
- password: `admin123`

### 3) Probar rapido desde navegador/Postman
Health check:
```
GET /backend/api.php?action=health
```

Login admin:
```
POST /backend/api.php?action=login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

Crear secreto (requiere token Bearer del login):
```
POST /backend/api.php?action=secrets.create
Authorization: Bearer TU_TOKEN
Content-Type: application/json

{
  "title": "Mi secreto",
  "content": "Contenido",
  "nsfw": false,
  "color_idx": 2
}
```

Listar secretos:
```
GET /backend/api.php?action=secrets.list
Authorization: Bearer TU_TOKEN
```

### 4) Nota para conectar la app movil
Hoy la app usa almacenamiento local (`AsyncStorage`).
Si quieres, en el siguiente paso te dejo conectadas las pantallas de login/feed/admin para usar esta API PHP en lugar de local storage.
