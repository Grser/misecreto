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

## Estado actual de datos

Se eliminó la capa de API para la app móvil/web.

- **Autenticación y posts**: ahora funcionan en almacenamiento local (`AsyncStorage`).
- **Backend PHP**: `backend/api.php` quedó como verificación mínima de conexión a DB (ping básico con PDO).

## Verificar conexión básica a DB

```http
GET /backend/api.php
```

Respuesta esperada:

```json
{
  "ok": true,
  "message": "Conexión básica a DB activa",
  "db": {
    "connected": true,
    "ping": true
  }
}
```

## Variables de entorno para DB (backend PHP)

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`

> Nota: si el backend no necesita exponer errores detallados en producción, ajusta el manejo de excepciones antes de desplegar.
