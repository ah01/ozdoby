import { readFile } from 'node:fs/promises';
import { readStl } from '../tests/helpers/read-stl';
import { validateMesh } from '../src/geometry/validate';

const filename = process.argv[2];
if (!filename) throw new Error('Usage: npx tsx scripts/validate-stl.ts path/to/file.stl');
const bytes = await readFile(filename);
const buffer = new Uint8Array(bytes).buffer;
const report = validateMesh(readStl(buffer));
console.log(JSON.stringify(report, null, 2));
if (!report.valid) process.exitCode = 1;
