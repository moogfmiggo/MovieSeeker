<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## MovieSeeker delivery workflow

For user-requested MovieSeeker implementation or fix tasks, delivery includes
committing and pushing the completed work after the relevant lint, tests, and
production build pass.

- Commit only files related to the requested task.
- Push the current branch to `origin` without force-pushing.
- Never stage unrelated or pre-existing files merely to make the tree clean.
- Stop and report before pushing if there is a merge conflict, a non-fast-forward
  update, or an unexpected overlapping change.
