# Demo users

For a disposable visitor demo, run `docker compose up -d --build` from the repository root. It sets up the database, app, sample data, and these four accounts. The default password is `demo12345`; set `DEMO_USER_PASSWORD` in a root `.env` file to change it. See [SEED_GUIDE.md](backend/SEED_GUIDE.md#visitor-showcase-setup).

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

## Password fill on the login page

Docker Compose builds the login page with the same password used for the demo accounts, so selecting an account fills the password. This puts the password in the frontend bundle, where every visitor can inspect it. Use this only for disposable demo data and a password that is shared intentionally.

For local frontend development outside Compose, set `NEXT_PUBLIC_DEMO_PASSWORD` in `frontend/.env.local` and restart the development server. Without it, the login page shows a demo password field. The demo accounts must already exist in the database for sign-in to work.

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

Run `docker compose up -d --build`. Compose waits for PostgreSQL, applies migrations, runs the visitor seed, and then starts the app. To change the shared password, set `DEMO_USER_PASSWORD` in a root `.env` file and run the command again. Compose updates the four demo accounts and rebuilds the frontend with the matching password.

## Existing full seed

The separate `npm run seed` command ensures restaurant sample data and eight original accounts, including `admin`, `manager`, `staff`, and `kitchen`, exist. It can be rerun without duplicating them. Use `seed:demo-users` when you only need logins.
