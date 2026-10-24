import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defaultPrint } from '../src/domain/parameters';
import { createPreset } from '../src/domain/presets';
import { generateMesh } from '../src/geometry/mesh';
import { smoothShoulderAngle } from '../src/geometry/profile';
import { validateMesh } from '../src/geometry/validate';
import { encodeStl } from '../src/io/stl';
import { GENERATOR_VERSION, hashInput, serializeSettings } from '../src/io/preset';
import { readStl } from '../tests/helpers/read-stl';

const output = fileURLToPath(new URL('../doc/verification/fixtures/', import.meta.url));
await mkdir(output, { recursive: true });
const wide = createPreset('round'); wide.body.baseDiameterMm = 90; wide.body.heightMm = 35;
const cases = [{ id: 'S01-elongated-smooth', parameters: createPreset() }, { id: 'S02-short-wide-risk', parameters: wide }];
const records = [];
for (const { id, parameters } of cases) {
  const settings = { schemaVersion: 1 as const, generatorVersion: GENERATOR_VERSION, parameters, print: defaultPrint };
  const mesh = generateMesh(parameters), validation = validateMesh(mesh);
  if (!validation.valid) throw new Error(`${id}: invalid canonical mesh`);
  const stl = encodeStl(mesh), decoded = validateMesh(readStl(stl));
  if (!decoded.valid) throw new Error(`${id}: invalid STL round-trip`);
  await writeFile(`${output}/${id}.json`, serializeSettings(settings));
  await writeFile(`${output}/${id}.stl`, new Uint8Array(stl));
  const shoulderAngle = smoothShoulderAngle(parameters);
  const record = {
    id, generatorVersion: GENERATOR_VERSION, inputHash: hashInput(settings),
    stlSha256: createHash('sha256').update(new Uint8Array(stl)).digest('hex'),
    stlBytes: stl.byteLength, validation, stlRoundTrip: decoded,
    sampling: { ...mesh.sampling, heights: mesh.sampling.heights.length },
    phase0Estimate: { smoothShoulderAngleDeg: shoulderAngle,
      exceedsNormalLimit: shoulderAngle > defaultPrint.maxOverhangFromVerticalDeg,
      maxRadialStepMm: Math.tan(shoulderAngle * Math.PI / 180) * defaultPrint.layerHeightMm,
      terminalDiameterMm: 2 * parameters.body.tipRadiusMm,
      note: 'Analytický hladký profil; úplná vrstvová analýza a mapa rizik patří do fáze 3.' },
  };
  records.push(record);
  console.log(`${id}: ${validation.triangles} triangles, ${validation.bounds.size.map(v => v.toFixed(2)).join(' × ')} mm, shoulder ${shoulderAngle.toFixed(2)}°`);
}
await writeFile(`${output}/manifest.json`, JSON.stringify(records, null, 2) + '\n');
