# esbuild-Only Migration Plan - 2025

## Executive Summary

This document outlines a streamlined approach to resolve TypeScript `.js` extension requirements and Jest compatibility issues using esbuild exclusively. This approach leverages the fact that the project already uses esbuild for production builds, extending it to all environments for consistency and simplicity.

**Key Benefits:**
- ✅ Single tool for all environments (dev, test, prod)
- ✅ 10-100x faster than current TypeScript compilation
- ✅ No `.js` extensions required in imports
- ✅ Simpler configuration and maintenance
- ✅ Proven Lambda performance improvements

## Current State Analysis

### What's Working
- Production builds already use esbuild successfully
- Bundle command: `esbuild src/interfaces/http/*.ts src/interfaces/events/*.ts --bundle --platform=node --target=node22 --format=esm --outdir=dist`
- ESM output format for better Lambda performance

### What's Broken
1. **Developer Experience**
   - Must use `.js` extensions in TypeScript imports
   - IDE auto-imports add wrong extensions
   - Confusing for developers

2. **Testing Issues**
   - Jest can't resolve `tslib` module
   - Complex ESM configuration required
   - Tests won't run with AWS SDK v3

3. **Development Workflow**
   - No watch mode for development
   - Manual rebuilds required
   - No source maps in development

## Solution: Extend esbuild to All Environments

### Why esbuild-Only?

1. **Already Proven**: Working in production
2. **AWS Recommended**: Official AWS Lambda best practice
3. **Simplicity**: One tool, one configuration
4. **Performance**: Fastest available bundler
5. **Sufficient Features**: Has everything needed for Lambda

### What We're NOT Doing
- ❌ Adding Webpack (outdated, slow)
- ❌ Adding Vite (unnecessary for Lambda)
- ❌ Using Rollup (slower, browser-focused)
- ❌ Keeping native ESM in development

## Detailed Migration Plan

### Phase 1: TypeScript Configuration (30 minutes)

#### 1.1 Update tsconfig.json

Change `moduleResolution` from "bundler" to "node" and add `isolatedModules`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",  // ← Change this
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "isolatedModules": true,  // ← Add this (required for esbuild)
    "baseUrl": ".",
    "paths": {
      "@domain/*": ["src/domain/*"],
      "@application/*": ["src/application/*"],
      "@infrastructure/*": ["src/infrastructure/*"],
      "@interfaces/*": ["src/interfaces/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Phase 2: Create esbuild Configuration (1 hour)

#### 2.1 Install Dependencies

```bash
npm install --save-dev glob
```

#### 2.2 Create esbuild.config.mjs

This replaces the inline bundle command with a proper configuration:

```javascript
import * as esbuild from 'esbuild';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Find all Lambda handler entry points
const entryPoints = glob.sync('src/interfaces/**/*-handler.ts');

// Plugin to handle .js extensions in imports
const removeJsExtensionPlugin = {
  name: 'remove-js-extension',
  setup(build) {
    // Handle relative imports with .js
    build.onResolve({ filter: /^\..*\.js$/ }, args => {
      return {
        path: path.join(args.resolveDir, args.path.slice(0, -3)),
        external: false
      };
    });
    
    // Handle path alias imports with .js
    build.onResolve({ filter: /^@(domain|application|infrastructure|interfaces).*\.js$/ }, args => {
      const pathAlias = args.path.slice(0, -3);
      const [, module, ...rest] = pathAlias.split('/');
      return {
        path: path.join(__dirname, 'src', module, ...rest),
        external: false
      };
    });
  }
};

const baseConfig = {
  entryPoints,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outdir: 'dist',
  sourcemap: true,
  plugins: [removeJsExtensionPlugin],
  // Define path aliases
  alias: {
    '@domain': path.resolve(__dirname, 'src/domain'),
    '@application': path.resolve(__dirname, 'src/application'),
    '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
    '@interfaces': path.resolve(__dirname, 'src/interfaces'),
  },
  // Preserve file structure
  outbase: 'src/interfaces',
};

// Development configuration
export const devConfig = {
  ...baseConfig,
  sourcemap: 'inline',
  minify: false,
  // Log build information
  logLevel: 'info',
};

// Production configuration
export const prodConfig = {
  ...baseConfig,
  minify: true,
  treeShaking: true,
  // Keep function names for stack traces
  keepNames: true,
  // Generate metafile for bundle analysis
  metafile: true,
  // Log only warnings and errors
  logLevel: 'warning',
};

// Watch mode for development
export async function watch() {
  const ctx = await esbuild.context({
    ...devConfig,
    banner: {
      js: '// Development build - ' + new Date().toISOString(),
    },
  });
  
  await ctx.watch();
  console.log('⚡ Watching for changes...');
  
  // Initial build
  await ctx.rebuild();
  console.log('✅ Initial build complete');
}

// Production build
export async function build() {
  const result = await esbuild.build(prodConfig);
  
  if (result.metafile) {
    // Save metafile for analysis
    const fs = await import('fs/promises');
    await fs.writeFile('dist/metafile.json', JSON.stringify(result.metafile));
  }
  
  console.log('✅ Production build complete');
  return result;
}

// Clean build directory
export async function clean() {
  const fs = await import('fs/promises');
  await fs.rm('dist', { recursive: true, force: true });
  console.log('🧹 Cleaned dist directory');
}
```

### Phase 3: Remove .js Extensions (1 hour)

#### 3.1 Create Migration Script

**scripts/remove-js-extensions.mjs**
```javascript
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

const stats = {
  filesProcessed: 0,
  filesModified: 0,
  importsFixed: 0,
};

async function removeJsExtensions(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  let modified = content;
  let changeCount = 0;
  
  // Remove .js from relative imports
  modified = modified.replace(
    /from\s+['"](\.\.?\/[^'"]+)\.js['"]/g,
    (match, importPath) => {
      changeCount++;
      return `from '${importPath}'`;
    }
  );
  
  // Remove .js from path alias imports
  modified = modified.replace(
    /from\s+['"](@(?:domain|application|infrastructure|interfaces)\/[^'"]+)\.js['"]/g,
    (match, importPath) => {
      changeCount++;
      return `from '${importPath}'`;
    }
  );
  
  stats.filesProcessed++;
  
  if (content !== modified) {
    await fs.writeFile(filePath, modified);
    stats.filesModified++;
    stats.importsFixed += changeCount;
    console.log(`✏️  Updated ${filePath} (${changeCount} imports fixed)`);
  }
}

console.log('🔄 Removing .js extensions from imports...\n');

// Process all TypeScript files
const srcFiles = await glob('src/**/*.ts');
const testFiles = await glob('tests/**/*.ts');
const allFiles = [...srcFiles, ...testFiles];

for (const file of allFiles) {
  await removeJsExtensions(file);
}

console.log('\n📊 Migration Summary:');
console.log(`   Files processed: ${stats.filesProcessed}`);
console.log(`   Files modified: ${stats.filesModified}`);
console.log(`   Imports fixed: ${stats.importsFixed}`);
console.log('\n✅ Migration complete!');
```

#### 3.2 Run the Migration

```bash
node scripts/remove-js-extensions.mjs
```

### Phase 4: Update Jest Configuration (30 minutes)

#### 4.1 Simplify jest.config.js

Remove all ESM-specific configuration:

```javascript
/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.ts'],
  
  // Force CommonJS for Jest
  extensionsToTreatAsEsm: [],
  globals: {
    'ts-jest': {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
      },
    },
  },
  
  // Simple path mappings without .js
  moduleNameMapper: {
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@interfaces/(.*)$': '<rootDir>/src/interfaces/$1',
  },
  
  // Much simpler transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!uuid)'
  ],
  
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

### Phase 5: Update Build Scripts (30 minutes)

#### 5.1 Update package.json

Replace existing scripts with esbuild-based ones:

```json
{
  "scripts": {
    "clean": "node -e \"import('./esbuild.config.mjs').then(m => m.clean())\"",
    "dev": "node -e \"import('./esbuild.config.mjs').then(m => m.watch())\"",
    "build": "node -e \"import('./esbuild.config.mjs').then(m => m.build())\"",
    "build:analyze": "npm run build && esbuild-visualizer --metadata ./dist/metafile.json --open",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest --testMatch='**/tests/integration/**/*.test.ts'",
    "test:e2e": "jest --testMatch='**/tests/e2e/**/*.test.ts'",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix",
    "format": "prettier --write 'src/**/*.ts' 'tests/**/*.ts'",
    "format:check": "prettier --check 'src/**/*.ts' 'tests/**/*.ts'",
    "prepare": "husky install",
    "semantic-release": "semantic-release",
    "local:api": "sam local start-api --build-dir dist",
    "local:invoke": "sam local invoke --build-dir dist"
  }
}
```

#### 5.2 Add Bundle Analysis (Optional)

```bash
npm install --save-dev esbuild-visualizer
```

### Phase 6: Local Development Testing (30 minutes)

#### 6.1 Create Local Testing Script

**scripts/test-local.mjs**
```javascript
#!/usr/bin/env node
import { spawn } from 'child_process';
import { watch } from 'fs/promises';

console.log('🚀 Starting local development environment...\n');

// Start esbuild in watch mode
const esbuild = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

// Wait a moment for initial build
setTimeout(() => {
  // Start SAM local API
  const sam = spawn('sam', ['local', 'start-api', '--build-dir', 'dist'], {
    stdio: 'inherit',
    shell: true
  });
  
  console.log('\n✅ Local API available at http://localhost:3000');
  console.log('📝 Watching for file changes...\n');
  
  // Handle exit
  process.on('SIGINT', () => {
    esbuild.kill();
    sam.kill();
    process.exit();
  });
}, 2000);
```

Make it executable:
```bash
chmod +x scripts/test-local.mjs
```

### Phase 7: Migration Execution Steps

#### Day 1: Preparation (2 hours)
1. Create feature branch: `git checkout -b esbuild-migration`
2. Document current state:
   ```bash
   # Record current build time
   time npm run build
   
   # Record current bundle sizes
   du -sh dist/*
   
   # Save test results
   npm test > tests-before.log
   ```

#### Day 2: Core Implementation (3 hours)
1. Update `tsconfig.json`
2. Create `esbuild.config.mjs`
3. Run `.js` extension removal script
4. Update `jest.config.js`
5. Update `package.json` scripts

#### Day 3: Testing & Validation (2 hours)
1. Run all tests:
   ```bash
   npm run clean
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

2. Test local development:
   ```bash
   npm run dev
   # In another terminal
   npm run local:api
   ```

3. Compare bundle sizes and performance

#### Day 4: Documentation & Cleanup (1 hour)
1. Update README.md with new commands
2. Remove old build scripts
3. Update CI/CD configuration
4. Create PR and request review

## Verification Checklist

### Build System
- [ ] `npm run dev` starts watch mode
- [ ] `npm run build` creates production bundles
- [ ] Source maps are generated
- [ ] Bundle sizes are reasonable (< 5MB per function)

### Development Experience
- [ ] No `.js` extensions in any imports
- [ ] IDE auto-imports work correctly
- [ ] TypeScript errors shown during development
- [ ] File changes trigger rebuilds < 1 second

### Testing
- [ ] All unit tests pass
- [ ] Integration tests run successfully
- [ ] No tslib or module resolution errors
- [ ] Coverage reports generated correctly

### Local Testing
- [ ] SAM local works with built files
- [ ] Can invoke functions locally
- [ ] API endpoints respond correctly

## Rollback Plan

If issues occur:

1. **Immediate Rollback** (< 2 minutes):
   ```bash
   git checkout main
   git branch -D esbuild-migration
   ```

2. **Partial Rollback**:
   - Keep esbuild for production only
   - Restore `.js` extensions with reverse script
   - Use current setup until issues resolved

## Expected Outcomes

### Performance Improvements
- **Build Speed**: 10-100x faster (30s → <1s)
- **Development Feedback**: Near-instant rebuilds
- **CI/CD Time**: Reduced by 80%

### Developer Experience
- **No `.js` extensions**: Natural TypeScript imports
- **Faster Iteration**: Sub-second rebuilds
- **Simpler Config**: One tool, one config file

### Maintenance Benefits
- **Single Tool**: Only esbuild to maintain
- **AWS Aligned**: Following AWS best practices
- **Future Proof**: Easy to adapt when needed

## FAQ

**Q: Why not use Vite like other frameworks?**
A: Lambda functions don't benefit from Vite's browser-focused features. esbuild alone provides everything needed with less complexity.

**Q: What about tree-shaking?**
A: esbuild's tree-shaking is sufficient for Node.js applications. The marginal improvements from Rollup don't justify the added complexity.

**Q: Will this work with future AWS features?**
A: Yes, AWS officially recommends esbuild for Lambda. This approach aligns with AWS's direction.

**Q: Can we add Vite later if needed?**
A: Yes, the esbuild configuration is compatible with adding Vite as a dev server later if requirements change.

## Conclusion

This esbuild-only approach provides the optimal balance of:
- **Simplicity**: One tool for all environments
- **Performance**: Fastest available bundler
- **Compatibility**: Works with existing code
- **Maintainability**: Minimal configuration

The migration can be completed in 2-3 days with minimal risk and immediate benefits.