# AGENTS.md

GitHub Action that comments on a pull request with a markdown table of the dependency version
changes in every `uv.lock` the PR touches. See `README.md` and `docs/image.png`.

## Layout

- `src/index.ts` — entry point: reads the PR, walks its changed files, matches filenames against
  `lockFileMap`, and posts/updates one summary comment.
- `src/github.ts` — fetches file contents from `raw.githubusercontent.com` and upserts the comment,
  which is identified by the `magicComment` HTML marker.
- `src/uv.ts` — parses `uv.lock` (TOML) into `name -> version` and renders the table.
- `action.yml` — `runs.using: node24`, entry point `dist/index.js`.
- `dist/index.js` — esbuild bundle shipped to consumers. Gitignored on `master`; produced by CI and
  by the deploy workflow.

## Behavior worth knowing

- Old and new lockfile contents come from `raw.githubusercontent.com` at the commits `pulls.get`
  reports: old at `base.sha` from `base.repo`, new at `head.sha` from `head.repo` (two different
  repositories for a fork PR). The old side is the base branch tip, not the merge base, so a stale
  branch shows base-branch changes that the PR page's three-dot diff hides.
- The action is written for `pull_request_target` (see `README.md`). The guard in `src/index.ts`
  accepts `pull_request` and `pull_request_target` and returns early for any other event; a fork PR
  under plain `pull_request` gets a read-only token, so the comment cannot be posted.
- When no lockfile matches, no comment is created.

## Commands

- `pnpm i`
- `pnpm run lint`, `pnpm run format:check`, `pnpm run format`
- `pnpm run build` — bundles `src/index.ts` into `dist/index.js` with esbuild; it does not type
  check, and CI (`.github/workflows/ci.yaml`) only runs format check, lint and build.
- There are no tests. A pre-commit hook runs `prettier -w` and `pnpm run lint`, so keep the tree
  formatted before committing.

## Release

Consumers pin a tag, e.g. `trim21/action-uv-lock-diff-viewer@v0.0.3`. Pushing a `src/v*` tag
(`.github/workflows/deploy.yaml`) builds the bundle, publishes `dist/index.js` and `action.yml` to
the `dist/v0` branch, tags that commit with `v<version>` taken from `package.json`, and creates a
GitHub release. So releasing means: bump `version` in `package.json`, commit, push the `src/vX.Y.Z`
tag. A change only reaches consumers once such a tag exists and they bump their pinned version.
