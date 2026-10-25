# Demo users

Use the dedicated seed command to create four sign-in accounts without adding menu, table, or order data. Run database migrations first. The command creates missing roles and users; running it again skips existing accounts and keeps their current passwords.

| Username | Role | First screen | Use for |
| --- | --- | --- | --- |
| `demo_owner` | OWNER | Dashboard | Reports and all management screens |
| `demo_manager` | MANAGER | POS | Operations and menu management |
| `demo_staff` | STAFF | POS | Tables and orders |
| `demo_kitchen` | KITCHEN | Kitchen display | Preparing orders |

All four accounts use the password you set in `DEMO_USER_PASSWORD`. It must be at least eight characters. The script does not print the password and, by default, does not replace passwords on existing accounts.

If the accounts already exist and you need to set a new shared demo password, run the same seed command with `DEMO_RESET_PASSWORDS=true`. This updates only the four named demo accounts, restores their demo roles, and activates them.

The login page loads its demo account choices from `GET /auth/demo-users`. Only active demo accounts already in the database appear there; the endpoint returns usernames and roles, never passwords. If no accounts appear, run the seed command and rebuild both backend and frontend after updating the application code.

## Optional password fill on the login page

For a public demo environment, you can let the login page fill the demo password when a visitor selects an account. This puts the password in the frontend bundle, where every visitor can inspect it. Use this only for disposable demo data and a password that is shared intentionally.

Set `DEMO_LOGIN_PASSWORD` to the **same password used when creating the demo accounts**, then rebuild the frontend. In PowerShell:

```powershell
$env:DEMO_LOGIN_PASSWORD = Read-Host 'Demo login password'
docker compose up -d --build --force-recreate frontend
```

Without `DEMO_LOGIN_PASSWORD`, the login page shows a demo password field. Enter the password once, then selecting any demo account fills both sign-in fields. This value stays only in the current page state. For local frontend development with automatic fill from the build, set `NEXT_PUBLIC_DEMO_PASSWORD` in `frontend/.env.local` and restart the development server. The demo accounts must already exist in the database for sign-in to work.

## Local setup

In `backend/.env`, set a working `DATABASE_URL` and add `DEMO_USER_PASSWORD` with your chosen password. Then run from the repository root:

```bash
cd backend
npm install
npx prisma migrate deploy
npm run seed:demo-users
```

Start the backend and frontend as described in [README.md](README.md), open `http://localhost:3001/login` with Docker Compose or the port used by your local frontend, and sign in with one of the usernames above.

On Windows PowerShell, use `npm.cmd` and `npx.cmd` in place of `npm` and `npx` if script execution is disabled.

## Docker Compose setup

Rebuild the backend image so it includes the new script, apply migrations, then create the accounts. Set the password in your shell first; for example, in PowerShell:

```powershell
$env:DEMO_USER_PASSWORD = Read-Host 'Demo password'
docker compose up -d --build postgres backend
docker compose exec backend npx prisma migrate deploy
docker compose exec -e DEMO_USER_PASSWORD=$env:DEMO_USER_PASSWORD backend npm run seed:demo-users
```

To reset passwords on existing demo accounts in PowerShell:

```powershell
$env:DEMO_USER_PASSWORD = Read-Host 'New demo password (8+ characters)'
docker compose exec -e "DEMO_USER_PASSWORD=$env:DEMO_USER_PASSWORD" -e DEMO_RESET_PASSWORDS=true backend npm run seed:demo-users
```

The backend container receives `DATABASE_URL` from `docker-compose.yml`. If your database is already migrated, you can skip the migration command.

If Prisma reports `P2022` while creating a user, rebuild the backend image and run `npx prisma migrate deploy` again. The `20261025000000_add_display_numbers` migration adds the display-number columns expected by the current Prisma schema; an older image can say "No pending migrations" because it does not contain that migration yet.

## Existing full seed

The separate `npm run seed` command creates restaurant sample data and eight original accounts, including `admin`, `manager`, `staff`, and `kitchen`, with the password listed in [backend/SEED_GUIDE.md](backend/SEED_GUIDE.md). That full seed is intended for a fresh database. Use `seed:demo-users` when you only need logins or when the full seed has already run.
