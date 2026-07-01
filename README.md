# Hospital Management System Server

## Run
1. Copy `.env.example` to `.env`
2. Install dependencies: `npm install`
3. Create a local MySQL database and load the schema: `mysql -u root -p hms < sql/schema.sql`
4. Start dev server: `npm run dev`

## Default Auth
- `AUTH_MODE=demo` in `.env` for quick testing without a database.
- `AUTH_MODE=db` to authenticate against the local MySQL database (see `sql/schema.sql` for seeded demo accounts, all password `password`).
- Login page: `/login`
- All database connections are MySQL on localhost only — see `src/config/database.js` and `DB_*` vars in `.env.example`.

## Notes
- This is phase 1 + 2 baseline (setup + auth/rbac).
- Full module implementation follows project brief in `Hospital Management System.txt`.
