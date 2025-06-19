# Semantic Release Setup Guide

## Required GitHub Secrets

To enable automated releases with semantic-release, you need to configure the following secrets in your GitHub repository:

### 1. GITHUB_TOKEN

The `GITHUB_TOKEN` is automatically provided by GitHub Actions and has permissions to:
- Create releases
- Push commits and tags
- Comment on issues and PRs

No additional setup is required for `GITHUB_TOKEN` in most cases.

### 2. NPM_TOKEN (Optional)

If you plan to publish packages to npm registry in the future:

1. Log in to npm: `npm login`
2. Generate an access token: `npm token create`
3. Copy the generated token
4. Go to your GitHub repository → Settings → Secrets and variables → Actions
5. Click "New repository secret"
6. Name: `NPM_TOKEN`
7. Value: Paste your npm token

## Setting Up Repository Secrets

1. Navigate to your GitHub repository
2. Go to Settings → Secrets and variables → Actions
3. Add the following secrets if needed:
   - `NPM_TOKEN` - Only if publishing to npm

## Verifying Setup

After setting up secrets, the release workflow will:
1. Analyze commits since the last release
2. Determine the next version based on conventional commits
3. Generate release notes and CHANGELOG.md
4. Create a GitHub release
5. Update version in package.json
6. Commit changes back to the repository

## Conventional Commit Format

The project follows [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features (triggers minor version bump)
- `fix:` - Bug fixes (triggers patch version bump)
- `BREAKING CHANGE:` - Breaking changes (triggers major version bump)
- `chore:` - Maintenance tasks (no version bump)
- `docs:` - Documentation changes (no version bump)
- `style:` - Code style changes (no version bump)
- `refactor:` - Code refactoring (no version bump)
- `test:` - Test additions/changes (no version bump)
- `perf:` - Performance improvements (triggers patch version bump)

## Example Commits

```bash
# Patch release (1.0.0 → 1.0.1)
git commit -m "fix: correct tax calculation for edge case"

# Minor release (1.0.1 → 1.1.0)
git commit -m "feat: add CSV export functionality"

# Major release (1.1.0 → 2.0.0)
git commit -m "feat!: change API response format

BREAKING CHANGE: API responses now use camelCase instead of snake_case"
```