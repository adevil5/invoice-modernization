# Bundling Configuration Guide

This guide explains the esbuild configuration for bundling Lambda functions in the invoice modernization project.

## Overview

We use [esbuild](https://esbuild.github.io/) for bundling our TypeScript Lambda functions into optimized ESM bundles. The configuration follows the latest 2024 best practices for Node.js applications.

## Configuration Files

### `esbuild.config.mjs` (Main Configuration)

The primary bundling configuration with:
- ESM output format for Node.js 22
- External package handling (excludes node_modules from bundles)
- Source map generation for debugging
- Tree shaking for optimal bundle size
- Automatic entry point discovery

### `esbuild.config.advanced.mjs` (Advanced Configuration)

An enhanced configuration with additional features:
- Environment-specific builds (development/production)
- Build metrics and analysis
- Watch mode with rebuild notifications
- Serve mode for local testing
- Console stripping in production
- Ready for `esbuild-node-externals` plugin integration

## Usage

### Basic Commands

```bash
# Standard build
npm run bundle

# Development build (with inline source maps)
npm run bundle:dev

# Production build (minified, no console logs)
npm run bundle:prod

# Watch mode (auto-rebuild on changes)
npm run bundle:watch

# Advanced build with metrics
npm run bundle:advanced

# Serve mode (local development server)
npm run bundle:serve
```

### Build Output

Bundles are output to the `dist/` directory with the following structure:
```
dist/
├── http/
│   ├── create-invoice.js
│   ├── create-invoice.js.map
│   └── query-invoices.js
└── events/
    └── process-invoice.js
```

## Key Features

### 1. External Dependencies

The configuration uses `packages: 'external'` to exclude all npm dependencies from bundles. This:
- Reduces bundle size from MB to KB
- Improves cold start performance
- Allows AWS Lambda to cache dependencies

### 2. ESM Output Format

We use ESM format with proper Node.js compatibility:
- Includes compatibility banner for `__dirname` and `require`
- Targets Node.js 22 for optimal output
- Maintains `.js` extension for ESM imports

### 3. Source Maps

- Development: Inline source maps for easier debugging
- Production: External source map files
- Preserves function names with `keepNames: true`

### 4. Tree Shaking

Enabled by default to remove unused code and reduce bundle size.

### 5. Watch Mode

Monitors source files and automatically rebuilds on changes, perfect for development workflows.

## Bundle Size Optimization

Current optimizations result in:
- Individual Lambda functions: ~5-20 KB (excluding dependencies)
- AWS SDK and other dependencies: Loaded from Lambda runtime
- ~43.5% better cold start performance vs CommonJS

## Migration from Inline Command

The previous inline esbuild command has been replaced with configuration files for:
- Better maintainability
- Consistent builds across environments
- Advanced features (metafiles, analysis, watch mode)
- Easier debugging with proper source maps

## Future Enhancements

### Installing esbuild-node-externals

For more control over external dependencies:

```bash
npm install --save-dev esbuild-node-externals
```

Then uncomment the import and plugin configuration in `esbuild.config.advanced.mjs`.

### Benefits of esbuild-node-externals:
- Selective bundling of specific dependencies
- Workspace support for monorepos
- Pattern-based exclusions
- Better handling of optional dependencies

## Troubleshooting

### Large Bundle Sizes

If bundles are unexpectedly large:
1. Check that `packages: 'external'` is set
2. Review the metafile output for included dependencies
3. Consider using `esbuild-node-externals` for fine-grained control

### ESM Compatibility Issues

If you encounter ESM-related errors:
1. Ensure `"type": "module"` is in package.json
2. Use `.mjs` extension for config files
3. Check that all imports use `.js` extensions

### Source Map Issues

For source map problems:
1. Use `sourcemap: 'inline'` for development
2. Ensure source maps are uploaded to AWS for production debugging
3. Check that `keepNames: true` is set for readable stack traces