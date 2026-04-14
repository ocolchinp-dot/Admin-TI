# Supplier Contacts: PostgreSQL + Metabase

This project loads a supplier/contact directory CSV into PostgreSQL and exposes it through Metabase for filtering, dashboards, and basic analytics. Orchestration is defined in [`compose.yml`](compose.yml).

## Dataset

- Source file on host: [`data/Listado-de-proveedores-y-contactos.csv`](data/Listado-de-proveedores-y-contactos.csv)
- Imported database: `supplier_contacts`
- Main table: `public.suppliers`

The CSV contains:

- supplier ID
- supplier name
- commercial contact
- email
- phone
- outstanding balance
- last purchase date

## How import works

When PostgreSQL starts with an empty `pg_data` volume, it runs [`db/init.sql`](db/init.sql). That script:

1. Creates the `supplier_contacts` database.
2. Loads the CSV into a raw staging table.
3. Trims text values and converts balances such as `4,250.00 EUR` into `NUMERIC(12,2)` and dates such as `04/09/2018` into `DATE`.
4. Drops the staging table and leaves a clean `suppliers` table.

The source CSV has a trailing empty column caused by a final comma on each row. The staging table absorbs that extra field so the import does not fail.

## Quick start

```bash
docker compose up -d
```

Metabase is available at [http://localhost:3000](http://localhost:3000).

If PostgreSQL was already initialized with the previous dataset, re-create the volumes so the new import script runs again:

```bash
docker compose down -v
docker compose up -d
```

## Add the database in Metabase

After the first-run wizard:

1. Open **Admin** -> **Databases** -> **Add database**.
2. Choose **PostgreSQL**.
3. Use `postgres` as host.
4. Use `5432` as port.
5. Use `supplier_contacts` as database name.
6. Use `metabase` / `metabase123` as credentials.

The main table is `public.suppliers`.

## Optional query from the host

```bash
docker exec -it supplier-contacts-postgres psql -U metabase -d supplier_contacts -c "SELECT COUNT(*) FROM suppliers;"
```

## Project layout

| Path | Purpose |
|------|---------|
| [`compose.yml`](compose.yml) | Services, volumes, mounts, and healthchecks |
| [`db/init.sql`](db/init.sql) | Creates `supplier_contacts` and imports the CSV |
| [`data/Listado-de-proveedores-y-contactos.csv`](data/Listado-de-proveedores-y-contactos.csv) | Source data mounted into PostgreSQL |
