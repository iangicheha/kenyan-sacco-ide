# SQLite to Postgres Migration (Audit Store)

This project currently persists audit records to SQLite by default.
If you want centralized persistence in Postgres, use this minimal migration path.

## 1) Bring up Postgres

Use `docker-compose.yml`:

```bash
docker compose up -d db
```

Default credentials:

- host: `localhost`
- port: `5432`
- db: `meridian`
- user: `meridian`
- password: `meridian`

## 2) Create target schema

Apply `server/audit/schema.sql` to Postgres.

Example:

```bash
psql "postgresql://meridian:meridian@localhost:5432/meridian" -f server/audit/schema.sql
```

## 3) Export current audit rows as SQL inserts

Request SQL export from running app:

```bash
curl -H "Authorization: Bearer <ADMIN_JWT>" "http://localhost:3001/api/audit/export?format=sql" -o audit_dump.sql
```

## 4) Import into Postgres

```bash
psql "postgresql://meridian:meridian@localhost:5432/meridian" -f audit_dump.sql
```

## 5) Switch environment

Set:

```env
DATABASE_URL=postgresql://meridian:meridian@localhost:5432/meridian
```

## Notes

- The SQL export is deterministic and append-only friendly.
- Existing IDs and timestamps are preserved during migration.
- Recommended: perform migration during low traffic window.
