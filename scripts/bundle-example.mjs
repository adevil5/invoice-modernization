#!/usr/bin/env node

/**
 * Example script showing different bundling scenarios
 * Run with: node scripts/bundle-example.mjs
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Helper to run commands
function run(command, options = {}) {
  console.log(`\n🏃 Running: ${command}`);
  try {
    execSync(command, { 
      stdio: 'inherit', 
      cwd: projectRoot,
      ...options 
    });
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    process.exit(1);
  }
}

// Helper to check file sizes
function checkBundleSize(filePath) {
  const fullPath = path.join(projectRoot, filePath);
  if (existsSync(fullPath)) {
    const stats = readFileSync(fullPath);
    const sizeKB = (stats.length / 1024).toFixed(2);
    console.log(`  📦 ${filePath}: ${sizeKB} KB`);
  }
}

console.log('🚀 esbuild Bundle Examples\n');

// Example 1: Development Build
console.log('1️⃣  Development Build (with inline source maps)');
run('npm run bundle:dev');
console.log('\n✅ Development bundles created with debugging support');

// Example 2: Production Build
console.log('\n2️⃣  Production Build (minified, no console logs)');
run('npm run bundle:prod');
console.log('\n✅ Production bundles created and optimized');

// Check some bundle sizes
console.log('\n📊 Bundle Sizes:');
checkBundleSize('dist/http/create-invoice.js');
checkBundleSize('dist/http/query-invoices.js');
checkBundleSize('dist/events/process-invoice.js');

// Example 3: Bundle Analysis
console.log('\n3️⃣  Bundle Analysis');
run('NODE_ENV=production node esbuild.config.advanced.mjs build');

// Example 4: Watch Mode (non-blocking example)
console.log('\n4️⃣  Watch Mode Example');
console.log('To start watch mode, run: npm run bundle:watch');
console.log('This will rebuild automatically when files change');

// Example 5: Custom build with specific options
console.log('\n5️⃣  Custom Build Example');
console.log('You can customize builds by modifying esbuild.config.mjs');
console.log('For example, to change the output format or target:');
console.log(`
// In esbuild.config.mjs
const customOptions = {
  ...commonOptions,
  format: 'cjs',        // Use CommonJS instead of ESM
  target: 'node20',     // Target older Node.js version
  minify: {
    whitespace: true,
    identifiers: false, // Keep variable names
    syntax: true
  }
};
`);

console.log('\n✨ Bundle examples complete!');
console.log('\n📚 Next steps:');
console.log('  - Review dist/ directory for output files');
console.log('  - Check bundle sizes and contents');
console.log('  - Try watch mode for development');
console.log('  - Read docs/bundling.md for more details');