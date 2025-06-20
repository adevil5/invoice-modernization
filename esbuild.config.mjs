import esbuild from 'esbuild';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Common build options
const commonOptions = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  treeShaking: true,
  // Use packages: 'external' to exclude all dependencies
  packages: 'external',
  // Preserve original file structure
  outbase: 'src',
  outdir: 'dist',
  // Enable metafile for bundle analysis
  metafile: true,
  // Define Node.js globals
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  // Banner for ESM compatibility if needed
  banner: {
    js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`.trim()
  }
};

// Get all entry points
async function getEntryPoints() {
  const httpHandlers = await glob('src/interfaces/http/*.ts');
  const eventHandlers = await glob('src/interfaces/events/*.ts');
  return [...httpHandlers, ...eventHandlers];
}

// Build function
async function build() {
  const entryPoints = await getEntryPoints();
  
  console.log('Building with esbuild...');
  console.log('Entry points:', entryPoints);
  
  if (entryPoints.length === 0) {
    console.log('\n⚠️  No entry points found!');
    console.log('Looking for TypeScript files in:');
    console.log('  - src/interfaces/http/*.ts');
    console.log('  - src/interfaces/events/*.ts');
    console.log('\nPlease create Lambda handler files in these directories.');
    return;
  }
  
  try {
    const result = await esbuild.build({
      ...commonOptions,
      entryPoints,
      minify: process.env.NODE_ENV === 'production',
      // Keep function names for better stack traces in Lambda
      keepNames: true,
      // Output individual files for each Lambda function
      splitting: false,
      // Add loader for JSON files
      loader: {
        '.json': 'json'
      }
    });
    
    // Output build metadata
    if (result.metafile) {
      console.log('\nBuild complete! Bundle analysis:');
      const outputs = Object.keys(result.metafile.outputs);
      for (const output of outputs) {
        const info = result.metafile.outputs[output];
        const size = (info.bytes / 1024).toFixed(2);
        console.log(`  ${output}: ${size} KB`);
      }
    }
    
    console.log('\nBuild successful!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Watch mode for development
async function watch() {
  const entryPoints = await getEntryPoints();
  
  if (entryPoints.length === 0) {
    console.log('\n⚠️  No entry points found!');
    console.log('Looking for TypeScript files in:');
    console.log('  - src/interfaces/http/*.ts');
    console.log('  - src/interfaces/events/*.ts');
    console.log('\nPlease create Lambda handler files in these directories.');
    return;
  }
  
  console.log('Starting watch mode...');
  
  const context = await esbuild.context({
    ...commonOptions,
    entryPoints,
    minify: false,
    logLevel: 'info'
  });
  
  await context.watch();
  console.log('Watching for changes...');
}

// Run build or watch based on arguments
if (process.argv.includes('--watch')) {
  watch();
} else {
  build();
}