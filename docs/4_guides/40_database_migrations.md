# Database Migrations

Database migrations are managed using Prisma Migrate.

## Applying Migrations

In a production environment, you should always use the `migrate deploy` command. This command will run all pending migrations.

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy --schema=prisma/schema.prisma
```

## Recovering from a Failed Migration

If a migration fails, you will need to manually intervene.

1.  **Check the migration status:**
    ```bash
    docker compose -f docker-compose.prod.yml exec api npx prisma migrate status --schema=prisma/schema.prisma
    ```
2.  **Mark the migration as rolled back:**
    ```bash
    docker compose -f docker-compose.prod.yml exec api npx prisma migrate resolve --rolled-back "MIGRATION_NAME" --schema=prisma/schema.prisma
    ```
3.  **Fix the migration SQL** in the migration file located in `apps/api/prisma/migrations/`.
4.  **Re-deploy the migrations.**

If the database is in an inconsistent state, you may need to restore from a backup.

## Pre-Migration Checklist

1.  Take a backup of the database.
2.  Review the SQL in the new migration files.
3.  Run `prisma migrate deploy`.
4.  Verify the migration status.
5.  Test the application.
