# Contributing

## Workflow

1. Create a branch from `main`.
2. Make your change in the right module (`src/lib/<module>` for logic, `src/app` for routes and UI).
3. Before opening a PR, run:
   ```bash
   npm run typecheck && npm run lint && npm test && npm run build
   ```
4. Update `MASTER_TODO.md` and `CHANGELOG.md`, and add an entry to `DECISIONS.md` if you made a design choice.

## Rules

- Use strict TypeScript. Don't use `any` unless you document why.
- Validate every input with Zod at the server boundary (server actions and route handlers).
- Check permissions on the server with `requireSession(permission)`. RLS must agree with the check.
- Never use `NEXT_PUBLIC_` for secrets or Supabase settings, and never import `lib/supabase/admin.ts` into client code.
- **Database changes** go in a new file in `supabase/migrations/` (`npx supabase migration new <name>`). Never edit an applied migration. Add constraint and RLS tests to `tests/db.test.ts`.
- **Public UI** reads data only through `src/lib/articles/queries.ts`, so a redesign never has to touch the backend.
- Don't commit credentials. `.env*` is git-ignored, except `.env.example`.
