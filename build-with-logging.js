import { execSync } from 'child_process';
import fs from 'fs';

let buildOutput = '';

try {
  console.log('=== Running combiner ===');
  buildOutput += execSync('node combine-chunks.js', { encoding: 'utf8', stdio: 'pipe' });
} catch (err) {
  buildOutput += `Combiner failed: ${err.message}\n${err.stdout || ''}\n${err.stderr || ''}`;
  fs.writeFileSync('build-error.log', buildOutput);
  console.error(buildOutput);
  process.exit(1);
}

try {
  console.log('=== Running vite build ===');
  buildOutput += execSync('npx vite build', { encoding: 'utf8', stdio: 'pipe' });
  console.log(buildOutput);
} catch (err) {
  buildOutput += `Build failed: ${err.message}\n${err.stdout || ''}\n${err.stderr || ''}`;
  fs.writeFileSync('build-error.log', buildOutput);
  console.error(buildOutput);
  process.exit(1);
}
