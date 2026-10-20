import fs from 'node:fs/promises';
import path from 'node:path';
import { root, compile } from './compiler.mjs';

// This command has no signing, packaging, networking or deployment step.
const outputs = await compile();
await fs.mkdir(path.join(root, 'dist'), { recursive: true });
await fs.cp(path.join(root, 'src/public'), path.join(root, 'dist'), { recursive: true });
for (const [file, code] of Object.entries(outputs)) {
  await fs.writeFile(path.join(root, 'dist', file), code);
  console.log(`${file}: ${Buffer.byteLength(code)} bytes`);
}
