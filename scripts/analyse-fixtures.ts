import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defaultPrint } from '../src/domain/parameters';
import { createPreset } from '../src/domain/presets';
import { generateMesh } from '../src/geometry/mesh';
import { analyse } from '../src/analysis/report';
import { analysisHash } from '../src/workers/analysisProtocol';

const wide = createPreset('round'); wide.body.baseDiameterMm = 90; wide.body.heightMm = 35;
const ribs = createPreset(); ribs.surface.amplitudeMm = 1;
const twisted = structuredClone(ribs); twisted.surface.twistDeg = 120;
const cases = [
  { id: 'S01', parameters: createPreset(), print: defaultPrint }, { id: 'S02', parameters: wide, print: defaultPrint },
  { id: 'S04', parameters: ribs, print: defaultPrint }, { id: 'S05', parameters: twisted, print: defaultPrint },
  { id: 'S07-layer-010', parameters: createPreset(), print: { ...defaultPrint, layerHeightMm: 0.1 } },
  { id: 'S07-layer-025', parameters: createPreset(), print: { ...defaultPrint, layerHeightMm: 0.25 } },
];
const records = cases.map(({ id, parameters, print }) => {
  const started = performance.now();
  const report = analyse(parameters, print, generateMesh(parameters, 'preview'));
  const { anglesDeg: _angles, ...normalMetrics } = report.overhang;
  const { bands: _bands, ...layerMetrics } = report.layers;
  console.log(`${id}: ${report.risk}, ${normalMetrics.maxAngleDeg.toFixed(2)} deg, support ${(layerMetrics.minUpperOverlap * 100).toFixed(1)}%, ${(performance.now() - started).toFixed(0)} ms (one diagnostic run, not p95)`);
  return { id, inputHash: analysisHash(parameters, print), algorithmVersion: report.algorithmVersion, parameters, print,
    risk: report.risk, overhang: normalMetrics, layers: layerMetrics, tip: report.tip, messages: report.messages };
});
await writeFile(fileURLToPath(new URL('../doc/verification/phase-3-report.json', import.meta.url)), JSON.stringify(records, null, 2) + '\n');
