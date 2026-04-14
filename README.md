# MiSecreto — Expo SDK 54

## IMPORTANTE: Por que fallaba antes
pnpm usa "virtual store" con symlinks que Metro no puede seguir.
La solucion: .npmrc con `node-linker=hoisted` hace que pnpm instale
flat node_modules como npm. Esto ya esta configurado en este proyecto.

## Instalacion

Doble clic en setup.bat — hace todo automatico.

O manual:
```
rmdir /s /q node_modules
del pnpm-lock.yaml
pnpm install
pnpm expo start --clear
```

## Admin
Usuario: admin | Contrasena: admin123
