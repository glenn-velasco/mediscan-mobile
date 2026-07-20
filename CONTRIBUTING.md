# Contributing Guide

## Branch Naming

Branch names follow this pattern:

```
<type>/<short-description>
```

Examples:

```
feature/scan-result-screen
fix/dev-client-crash-on-launch
chore/upgrade-expo-sdk
```

Always branch off `main`. Keep branches focused on a single concern.

## Commit Messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature or screen |
| `fix` | Bug fix |
| `chore` | Tooling, config, dependencies, cleanup |
| `refactor` | Code restructure with no behavior change |
| `test` | Adding or updating tests |
| `docs` | Documentation only |

### Scopes

Use a scope that matches the area you changed:

| Scope | Area |
|---|---|
| `app` | Screens and layouts under `src/app` |
| `native` | Native config affecting `android/`/`ios/` (`app.json`, plugins) |
| `eas` | `eas.json`, build profiles, credentials |
| `deps` | Dependency upgrades |
| `config` | `tsconfig.json`, lint config, project-level config |
| `cleanup` | Removing scaffold or dead code |

### Examples

```
feat(app): add scan result screen
fix(native): correct Android package name
chore(deps): upgrade to Expo SDK 57
chore(eas): add preview build profile
```

### Rules

- Use the imperative mood — "add", not "added" or "adds"
- Keep the subject line under 72 characters
- One logical change per commit — don't bundle unrelated changes

## Workflow

### First-Time Setup

See [DEVELOPMENT.md](DEVELOPMENT.md) for prerequisites and environment setup, then:

```
git clone <repo-url>
cd mediscan-mobile
npm install
```

### Starting New Work

```
git checkout main
git pull origin main
git checkout -b feature/<your-feature>
```

### During Development

Commit often in small, logical units:

```
git add <specific files>
git commit -m "feat(scope): description"
```

Avoid `git add .` — stage files explicitly to prevent committing generated native folders or local config.

### Opening a Pull Request

1. Push your branch: `git push -u origin <branch-name>`
2. Open a PR against `main` on GitHub
3. Fill in the PR description — what changed and why
4. Request a review from at least one teammate
5. Do not force-push after requesting review

### Code Review

- Reviewers: focus on correctness, security, and intent — not style (the linter handles that)
- Authors: respond to all comments before merging; don't resolve threads yourself
- Approved PRs are merged by the author using Squash and Merge unless the branch history is intentionally granular

### After Merging

```
git branch -d feature/<your-feature>
git push origin --delete feature/<your-feature>
```

## Local Development Commands

### Starting the Dev Environment

```
npx expo start --dev-client
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for connecting a device or emulator first.

### Rebuilding the Native App

Only needed when native config changes (`app.json`, plugins, native dependencies):

```
npm run build:android
npm run build:ios
```

### Code Quality

```
npm run lint          # ESLint via `expo lint`
npx tsc --noEmit      # TypeScript check
```

Run both before opening a PR.

### Splitting Large Changes into Multiple Commits

When you have a large feature or refactor with multiple logical components, split them into separate commits following this pattern:

#### Principles
- **One logical change per commit** — don't bundle unrelated changes
- **Dependency order** — commit dependencies before code that uses them
- **Atomic commits** — each commit should work independently
- **Clear messages** — each commit message clearly describes what it does

#### Example: UI Refactoring with Multiple Components

If you're adding a new feature that touches:
- Data model (schema, migration, types)
- Business logic (hooks, services)
- UI components (new screens, dialogs)
- Integration (update existing screens to use new components)

Split into commits like:
1. **Data model** — schema and migrations (no behavior change yet)
2. **Business logic** — hooks and services (no UI change yet)
3. **UI components** — new screens and dialogs
4. **Integration** — update existing screens (brings it all together)

This makes review easier and history clearer. If a commit needs to be reverted, the others still work.

#### Staging files for a commit

Stage only the files that belong to one logical change:

```bash
git add src/db/schema.ts src/db/migrations/010_feature.ts
git commit -m "feat(db): add feature data model"

git add src/features/useFeature.ts src/services/feature.service.ts
git commit -m "feat(services): implement feature logic"
```

Avoid `git add .` — stage files explicitly so you commit exactly what belongs in each logical unit.

### Running Tests

No test suite is configured yet. If you add one, document the command here.

## What Not to Commit

- `.env` files or any credentials
- `node_modules/`
- `android/`, `ios/` — generated native projects, already gitignored
- `.expo/` — local Expo cache, already gitignored
- Anything under `*.jks`, `*.p8`, `*.p12`, `*.key`, `*.mobileprovision` — signing credentials, already gitignored
