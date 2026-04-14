# Supplier Contacts en una VPS de Azure

Este proyecto levanta dos contenedores con Docker:

- `postgres`: guarda la base interna de Metabase y también la base `supplier_contacts`.
- `metabase`: expone la interfaz web para consultar y visualizar el dataset.

El archivo principal es [`compose.yml`](compose.yml). La configuración sensible vive en [`.env.example`](.env.example) y debe copiarse a `.env` antes de iniciar el stack.

## Qué carga el proyecto

Cuando PostgreSQL arranca con el volumen vacío:

1. Crea la base `supplier_contacts`.
2. Importa [`data/Listado-de-proveedores-y-contactos.csv`](data/Listado-de-proveedores-y-contactos.csv).
3. Limpia balances y fechas desde [`db/init.sql`](db/init.sql).
4. Deja la tabla final `public.suppliers`.

Importante: ese proceso solo corre la primera vez que se crea el volumen `pg_data`.

## Requisitos en Azure

- Una VM Linux en Azure, idealmente Ubuntu 22.04 o 24.04.
- IP pública asignada.
- Puerto `22` abierto para SSH.
- Puerto `3000` abierto en el NSG de Azure para entrar a Metabase.

Si más adelante pones un dominio y proxy inverso, entonces abre `80` y `443` en lugar de publicar `3000` directamente.

## Subir el proyecto a la VPS

Puedes hacerlo de cualquiera de estas dos formas:

### Opción 1: clonar el repositorio en la VPS

```bash
git clone <URL_DEL_REPO> supplier-contacts
cd supplier-contacts
```

### Opción 2: copiar la carpeta actual por SSH

Desde tu máquina local:

```bash
scp -r ./week-8 <usuario>@<IP_PUBLICA_DE_LA_VM>:/home/<usuario>/supplier-contacts
```

Luego entra a la VPS:

```bash
ssh <usuario>@<IP_PUBLICA_DE_LA_VM>
cd /home/<usuario>/supplier-contacts
```

## Preparar Docker en la VPS

Dentro de la VM, ejecuta:

```bash
bash scripts/bootstrap-ubuntu.sh
```

Ese script instala:

- Docker Engine
- Docker Compose plugin
- el servicio `docker` habilitado al reiniciar

Después cierra la sesión SSH y vuelve a entrar para que tu usuario tome el grupo `docker`.

## Configurar variables

En la VPS:

```bash
cp .env.example .env
nano .env
```

Valores mínimos que debes revisar:

- `POSTGRES_PASSWORD`: cambia este valor por una contraseña fuerte.
- `MB_SITE_URL`: usa `http://IP_PUBLICA:3000`
- `METABASE_PORT`: deja `3000` salvo que quieras otro puerto.
- `TZ`: cambia la zona horaria si aplica.

Ejemplo:

```env
POSTGRES_PASSWORD=UnaClaveFuerte_2026
MB_SITE_URL=http://20.84.10.55:3000
METABASE_PORT=3000
TZ=America/Guatemala
```

## Levantar Metabase y PostgreSQL

En la VPS:

```bash
bash scripts/deploy-on-vps.sh
```

Eso hace:

- `docker compose pull`
- `docker compose up -d`
- `docker compose ps`

Si todo quedó bien, abre:

```text
http://IP_PUBLICA:3000
```

## Conectar la base `supplier_contacts` en Metabase

Metabase usa la base `metabase` para su propia aplicación, pero tus datos quedan en `supplier_contacts`. Después del wizard inicial:

1. Entra a **Admin**.
2. Ve a **Databases**.
3. Selecciona **Add database**.
4. Elige **PostgreSQL**.
5. Usa estos valores:

```text
Host: postgres
Port: 5432
Database name: supplier_contacts
Username: el valor de POSTGRES_USER
Password: el valor de POSTGRES_PASSWORD
```

La tabla principal será `public.suppliers`.

## Reiniciar o recrear la carga

Si cambias el CSV o quieres volver a importar desde cero:

```bash
docker compose --env-file .env down -v
bash scripts/deploy-on-vps.sh
```

## Comandos útiles en la VPS

Ver estado:

```bash
docker compose --env-file .env ps
```

Ver logs de Metabase:

```bash
docker compose --env-file .env logs -f metabase
```

Ver logs de PostgreSQL:

```bash
docker compose --env-file .env logs -f postgres
```

Validar que se importó la tabla:

```bash
docker compose --env-file .env exec postgres \
  sh -lc 'psql -U "$POSTGRES_USER" -d supplier_contacts -c "SELECT COUNT(*) FROM suppliers;"'
```

## Estructura del proyecto

- [`compose.yml`](compose.yml): servicios y volúmenes.
- [`.env.example`](.env.example): variables para la VPS.
- [`scripts/bootstrap-ubuntu.sh`](scripts/bootstrap-ubuntu.sh): instala Docker en Ubuntu.
- [`scripts/deploy-on-vps.sh`](scripts/deploy-on-vps.sh): levanta el stack en la VM.
- [`db/init.sql`](db/init.sql): crea e importa `supplier_contacts`.
- [`data/Listado-de-proveedores-y-contactos.csv`](data/Listado-de-proveedores-y-contactos.csv): dataset fuente.
