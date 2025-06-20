import esbuild from 'esbuild';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';
// Uncomment when installing esbuild-node-externals
// import { nodeExternalsPlugin } from 'esbuild-node-externals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Development vs Production configuration
const isDev = process.env.NODE_ENV !== 'production';

// Common build options
const commonOptions = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: isDev ? 'inline' : 'external',
  treeShaking: true,
  outbase: 'src',
  outdir: 'dist',
  metafile: true,
  keepNames: true,
  logLevel: isDev ? 'info' : 'warning',
  
  // Environment variables
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    'process.env.AWS_REGION': JSON.stringify(process.env.AWS_REGION || 'us-east-1')
  },
  
  // Loaders for different file types
  loader: {
    '.json': 'json',
    '.node': 'file'
  },
  
  // ESM compatibility banner
  banner: {
    js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`.trim()
  },
  
  // Plugins
  plugins: [
    // When ready to use esbuild-node-externals:
    // nodeExternalsPlugin({
    //   allowlist: ['tslib'], // Bundle specific dependencies if needed
    //   devDependencies: false // Don't mark devDependencies as external
    // })
  ]
};

// Production-specific options
const productionOptions = {
  minify: true,
  drop: ['console', 'debugger'],
  legalComments: 'none',
  pure: ['console.log', 'console.debug']
};

// Get entry points with better organization
async function getEntryPoints() {
  const handlers = {
    http: await glob('src/interfaces/http/*.ts'),
    events: await glob('src/interfaces/events/*.ts')
  };
  
  const entryPoints = {};
  
  // Create named entry points for better output organization
  for (const [type, files] of Object.entries(handlers)) {
    for (const file of files) {
      const name = path.basename(file, '.ts');
      entryPoints[`${type}/${name}`] = file;
    }
  }
  
  return entryPoints;
}

// Build function with enhanced error handling
async function build() {
  const entryPoints = await getEntryPoints();
  
  console.log(`🔨 Building for ${isDev ? 'development' : 'production'}...`);
  console.log('📦 Entry points:', Object.keys(entryPoints));
  
  const startTime = Date.now();
  
  try {
    const result = await esbuild.build({
      ...commonOptions,
      ...(isDev ? {} : productionOptions),
      entryPoints,
      // For now, use packages: 'external' until esbuild-node-externals is installed
      packages: 'external'
    });
    
    const buildTime = Date.now() - startTime;
    
    // Output detailed build information
    if (result.metafile) {
      console.log('\n✅ Build complete in', buildTime, 'ms\n');
      console.log('📊 Output files:');
      
      let totalSize = 0;
      const outputs = Object.entries(result.metafile.outputs)
        .sort(([a], [b]) => a.localeCompare(b));
      
      for (const [output, info] of outputs) {
        if (!output.endsWith('.map')) {
          const size = info.bytes;
          totalSize += size;
          const sizeStr = size < 1024 
            ? `${size} B` 
            : `${(size / 1024).toFixed(2)} KB`;
          console.log(`   ${output}: ${sizeStr}`);
        }
      }
      
      console.log(`\n📏 Total size: ${(totalSize / 1024).toFixed(2)} KB`);
      
      // Save metafile for analysis
      await esbuild.analyzeMetafile(result.metafile, {
        verbose: false
      }).then(console.log);
    }
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Enhanced watch mode with rebuild notifications
async function watch() {
  const entryPoints = await getEntryPoints();
  
  console.log('👀 Starting watch mode...');
  console.log('📦 Watching entry points:', Object.keys(entryPoints));
  
  const context = await esbuild.context({
    ...commonOptions,
    entryPoints,
    // For now, use packages: 'external'
    packages: 'external',
    plugins: [
      ...commonOptions.plugins,
      {
        name: 'rebuild-notify',
        setup(build) {
          build.onEnd(result => {
            if (result.errors.length > 0) {
              console.error(`❌ Build failed with ${result.errors.length} errors`);
            } else {
              const time = new Date().toLocaleTimeString();
              console.log(`✅ [${time}] Rebuild complete`);
            }
          });
        }
      }
    ]
  });
  
  await context.watch();
  console.log('🚀 Watching for changes... (Ctrl+C to stop)');
  
  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping watch mode...');
    context.dispose();
    process.exit(0);
  });
}

// Serve mode for local development (useful for testing)
async function serve() {
  const entryPoints = await getEntryPoints();
  
  const context = await esbuild.context({
    ...commonOptions,
    entryPoints,
    packages: 'external'
  });
  
  const { host, port } = await context.serve({
    servedir: 'dist',
    port: 8000
  });
  
  console.log(`🌐 Serving at http://${host}:${port}`);
  console.log('📁 Serving directory: dist/');
  console.log('🚀 Watching for changes... (Ctrl+C to stop)');
}

// CLI handling
const command = process.argv[2];

switch (command) {
  case 'watch':
    watch();
    break;
  case 'serve':
    serve();
    break;
  case 'build':
  default:
    build();
    break;
}