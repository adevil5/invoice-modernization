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