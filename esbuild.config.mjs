import * as esbuild from 'esbuild';
import fastGlob from 'fast-glob';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Find all Lambda handler entry points
const entryPoints = await fastGlob('src/interfaces/**/*-handler.ts');

// Plugin to handle .js extensions in imports
const removeJsExtensionPlugin = {
  name: 'remove-js-extension',
  setup(build) {
    // Handle relative imports with .js
    build.onResolve({ filter: /^\\..*\\.js$/ }, args => {
      return {
        path: path.join(args.resolveDir, args.path.slice(0, -3)),
        external: false
      };
    });
    
    // Handle path alias imports with .js
    build.onResolve({ filter: /^@(domain|application|infrastructure|interfaces).*\\.js$/ }, args => {
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
  // External packages to reduce bundle size (Lambda provides AWS SDK)
  external: ['@aws-sdk/*'],
  // Enable tree shaking
  treeShaking: true,
  // Keep function names for stack traces
  keepNames: true,
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
    console.log('📊 Bundle analysis saved to dist/metafile.json');
    console.log('   View at: https://esbuild.github.io/analyze/');
  }
  
  console.log('✅ Production build complete');
  return result;
}

// Development build
export async function buildDev() {
  await esbuild.build(devConfig);
  console.log('✅ Development build complete');
}

// Clean build directory
export async function clean() {
  const fs = await import('fs/promises');
  await fs.rm('dist', { recursive: true, force: true });
  console.log('🧹 Cleaned dist directory');
}

// CLI handling
if (process.argv[2]) {
  const command = process.argv[2];
  switch (command) {
    case 'build':
      await build();
      break;
    case 'dev':
      await buildDev();
      break;
    case 'watch':
      await watch();
      break;
    case 'clean':
      await clean();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log('Available commands: build, dev, watch, clean');
      process.exit(1);
  }
}