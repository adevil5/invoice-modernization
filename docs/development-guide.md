# Development Guide

This guide provides detailed commands and workflows for developing the invoice modernization project.

## Initial Setup

### Node.js Installation

```bash
# Install Node.js 22 LTS (uses .nvmrc if nvm is installed)
nvm install
# Or install latest LTS
nvm install --lts

# Verify Node version
node --version  # Should show v22.12.0 or higher
```

### TypeScript Project Initialization

```bash
# Initialize TypeScript project with ESM support
npm init -y
npm install -D typescript
npx tsc --init --target es2022 --module es2022 --moduleResolution bundler --strict

# Set ESM module type in package.json
npm pkg set type="module"
```

### Dependency Installation

```bash
# Install core AWS SDK dependencies
npm i @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-eventbridge @aws-sdk/client-s3

# Install development dependencies
npm i -D @types/aws-lambda jest @types/jest ts-jest esbuild
npm i -D @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint prettier
```

## Testing Commands

### Unit Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests matching a pattern
npm test -- --testNamePattern="should calculate tax"
```

### Integration Tests

```bash
# Start LocalStack for integration tests
docker-compose up -d

# Run integration tests
npm run test:integration

# Stop LocalStack
docker-compose down
```

### Test Debugging

```bash
# Debug a specific test
node --inspect-brk node_modules/.bin/jest --runInBand path/to/test.ts

# Run tests with verbose output
npm test -- --verbose
```

## Building and Bundling

### Development Build

```bash
# Build TypeScript (ES modules)
npm run build

# Build in watch mode
npm run build:watch

# Type checking only
npm run typecheck
```

### Production Build

```bash
# Bundle Lambda functions with esbuild for ESM
npm run bundle

# Bundle with source maps for debugging
npm run bundle:debug

# Analyze bundle size
npm run bundle:analyze
```

## Code Quality

### Linting

```bash
# Run ESLint
npm run lint

# Fix ESLint issues automatically
npm run lint:fix

# Lint specific files
npm run lint -- src/domain/**/*.ts

# Show ESLint configuration
npx eslint --print-config src/index.ts
```

### Formatting

```bash
# Format all files with Prettier
npm run format

# Check formatting without changing files
npm run format:check

# Format specific files
npx prettier --write "src/**/*.{ts,js,json}"
```

## Development Workflow

### Pre-commit Checklist

Always run these commands before committing:

```bash
# 1. Format code
npm run format

# 2. Fix linting issues
npm run lint:fix

# 3. Type check
npm run typecheck

# 4. Run tests
npm test

# 5. Build to ensure no compilation errors
npm run build
```

### Branch Management

```bash
# Create feature branch
git checkout -b feature/invoice-processing

# Keep branch updated with main
git fetch origin
git rebase origin/main

# Push branch
git push -u origin feature/invoice-processing
```

### Debugging

```bash
# Run Node with debugging
node --inspect dist/index.js

# Debug Lambda function locally
sam local invoke InvoiceProcessor --event events/test-event.json --debug

# View logs
npm run logs:dev
npm run logs:prod
```

## Performance Profiling

```bash
# Profile application startup
node --prof dist/index.js
node --prof-process isolate-*.log > profile.txt

# Memory profiling
node --expose-gc --trace-gc dist/index.js

# CPU profiling with Chrome DevTools
node --inspect dist/index.js
# Open chrome://inspect in Chrome
```

## Troubleshooting

### Common Issues

#### ESM Import Errors
- Always use `.js` extensions in imports
- Ensure `"type": "module"` in package.json
- Check tsconfig.json has `"module": "es2022"`

#### Test Failures
- Clear Jest cache: `npm test -- --clearCache`
- Check for async/await issues in tests
- Ensure mocks are properly reset between tests

#### Build Errors
- Delete node_modules and package-lock.json, then reinstall
- Check for circular dependencies: `npx madge --circular src`
- Verify TypeScript version compatibility

### Useful Commands

```bash
# Check for outdated dependencies
npm outdated

# Update dependencies safely
npm update

# Audit for security vulnerabilities
npm audit

# Fix vulnerabilities automatically
npm audit fix

# Clean all build artifacts
npm run clean

# Reset project
npm run reset
```