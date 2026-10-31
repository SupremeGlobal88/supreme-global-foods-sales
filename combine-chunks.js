import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function combineChunks(prefix, outputFile) {
  const libDir = path.join(__dirname, 'src', 'lib');
  try {
    const files = await fs.readdir(libDir);
    const chunks = files
      .filter(f => f.startsWith(`${prefix}_chunk_`) && f.endsWith('.ts'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/_chunk_(\d+)/)?.[1] || '0');
        const numB = parseInt(b.match(/_chunk_(\d+)/)?.[1] || '0');
        return numA - numB;
      });
    if (chunks.length === 0) {
      console.log(`No chunks found for ${prefix}, skipping.`);
      return;
    }
    let combined = '';
    for (const chunk of chunks) {
      combined += await fs.readFile(path.join(libDir, chunk), 'utf8');
    }
    await fs.writeFile(path.join(libDir, outputFile), combined);
    console.log(`Combined ${chunks.length} chunks into ${outputFile} (${combined.length} chars)`);
  } catch (err) {
    console.error(`Error combining ${prefix}:`, err.message);
    process.exit(1);
  }
}

await combineChunks('dataService', 'dataService.ts');
await combineChunks('localLink', 'localLink.ts');
