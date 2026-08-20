# Deploy Guide

Este proyecto está documentado para despliegue en Azure App Service con PostgreSQL administrado.

## Variables de entorno

Configurar en el proveedor:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `INGEST_API_KEY`
- `FRONTEND_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE`
- `SMTP_FROM`

Para el deploy con GitHub Actions + Azure Container Registry también configurar:

- `AZURE_REGISTRY_LOGIN_SERVER`
- `AZURE_REGISTRY_USERNAME`
- `AZURE_REGISTRY_PASSWORD`
- `AZURE_BACKEND_APP_NAME`
- `AZURE_FRONTEND_APP_NAME`
- `AZURE_BACKEND_PUBLISH_PROFILE`
- `AZURE_FRONTEND_PUBLISH_PROFILE`

## Azure App Service

1. Crear una base de datos PostgreSQL en Azure Database for PostgreSQL.
2. Crear un App Service para el backend usando la imagen o build del repositorio.
3. Crear un Azure Container Registry y configurar los secretos del workflow.
4. Crear dos App Services de contenedor, uno para backend y otro para frontend.
5. Configurar las variables de entorno anteriores en Application Settings.
6. Configurar `FRONTEND_URL` con la URL pública del frontend.
7. Verificar que el backend ejecuta `prisma migrate deploy` al arrancar.

## Seguridad del endpoint de ingesta

El router TRB245 debe enviar `X-API-Key: <INGEST_API_KEY>` sobre HTTPS al endpoint público `/api/ingest`.
No exponer el valor en el frontend ni reutilizarlo para auth de usuario.

## Checklist de verificación

- El login responde con JWT y refresh cookie.
- `/api/ingest` responde 401 sin API key válida.
- El dashboard carga contra el backend público.
- Las migraciones se aplican automáticamente al iniciar el backend.