#!/usr/bin/env node

/**
 * Compare different bundling strategies to show the impact of external dependencies
 * Run with: node scripts/compare-bundle-strategies.mjs
 */

import esbuild from 'esbuild';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';
import { rmSync, mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Test output directories
const testOutputs = {
  withExternals: path.join(projectRoot, 'dist-test-external'),
  withoutExternals: path.join(projectRoot, 'dist-test-bundled'),
  selective: path.join(projectRoot, 'dist-test-selective')
};

// Clean and create test directories
Object.values(testOutputs).forEach(dir => {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
});

// Get a sample entry point
async function getSampleEntryPoint() {
  const httpHandlers = await glob('src/interfaces/http/*.ts', { cwd: projectRoot });
  return httpHandlers[0] || 'src/interfaces/http/create-invoice.ts';
}

// Common build options
const commonOptions = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  treeShaking: true,
  metafile: true,
  logLevel: 'silent'
};

// Helper to format bytes
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Helper to analyze build result
function analyzeBuild(result, strategy) {
  if (!result.metafile) return;
  
  let totalSize = 0;
  let fileCount = 0;
  
  Object.entries(result.metafile.outputs).forEach(([output, info]) => {
    if (!output.endsWith('.map')) {
      totalSize += info.bytes;
      fileCount++;
    }
  });
  
  console.log(`\n📊 ${strategy}:`);
  console.log(`   Files: ${fileCount}`);
  console.log(`   Total Size: ${formatBytes(totalSize)}`);
  
  // Show top included modules
  if (result.metafile.inputs) {
    const modules = Object.entries(result.metafile.inputs)
      .filter(([path]) => path.includes('node_modules'))
      .sort(([, a], [, b]) => b.bytes - a.bytes)
      .slice(0, 5);
    
    if (modules.length > 0) {
      console.log('   Top bundled dependencies:');
      modules.forEach(([modulePath, info]) => {
        const name = modulePath.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/)?.[1] || modulePath;
        console.log(`     - ${name}: ${formatBytes(info.bytes)}`);
      });
    } else {
      console.log('   No dependencies bundled (all external)');
    }
  }
}

async function runComparison() {
  const entryPoint = await getSampleEntryPoint();
  console.log(`🔬 Comparing bundle strategies for: ${entryPoint}\n`);
  
  // Strategy 1: All dependencies external (recommended)
  console.log('1️⃣  Building with all dependencies external...');
  const externalResult = await esbuild.build({
    ...commonOptions,
    entryPoints: [entryPoint],
    outdir: testOutputs.withExternals,
    packages: 'external'
  });
  analyzeBuild(externalResult, 'All External (Recommended)');
  
  // Strategy 2: Bundle everything (not recommended)
  console.log('\n2️⃣  Building with all dependencies bundled...');
  try {
    const bundledResult = await esbuild.build({
      ...commonOptions,
      entryPoints: [entryPoint],
      outdir: testOutputs.withoutExternals,
      // No external packages - bundle everything
    });
    analyzeBuild(bundledResult, 'All Bundled (Not Recommended)');
  } catch (error) {
    console.log('   ❌ Failed to bundle all dependencies');
    console.log('   This often happens with Node.js native modules');
  }
  
  // Strategy 3: Selective bundling (advanced)
  console.log('\n3️⃣  Building with selective bundling...');
  const selectiveResult = await esbuild.build({
    ...commonOptions,
    entryPoints: [entryPoint],
    outdir: testOutputs.selective,
    external: [
      '@aws-sdk/*',     // AWS SDK should always be external in Lambda
      'aws-sdk',        // Legacy AWS SDK
      'uuid',           // Often better as external
      // Add other large dependencies here
    ],
    // Small utilities like tslib could be bundled
  });
  analyzeBuild(selectiveResult, 'Selective External (Advanced)');
  
  // Summary
  console.log('\n📋 Summary:');
  console.log('   ✅ All External: Smallest bundle, fastest builds, best for Lambda');
  console.log('   ❌ All Bundled: Large bundle, may fail with native modules');
  console.log('   🔧 Selective: Fine-grained control, requires maintenance');
  
  console.log('\n💡 Recommendations:');
  console.log('   1. Use "packages: \'external\'" for Lambda functions');
  console.log('   2. Let AWS Lambda layer or runtime provide dependencies');
  console.log('   3. Consider bundling only small, pure JS utilities');
  console.log('   4. Use esbuild-node-externals plugin for more control');
  
  // Cleanup test directories
  console.log('\n🧹 Cleaning up test directories...');
  Object.values(testOutputs).forEach(dir => {
    rmSync(dir, { recursive: true, force: true });
  });
}

// Run comparison
runComparison().catch(console.error);