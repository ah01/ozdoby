import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Diagnostic reader for the saved phase-0 PrusaSlicer profile: G90 XY, M83 E,
// linear G0/G1 paths, centred at 100,100. Rejects other extrusion conventions.
const directory = fileURLToPath(new URL('../doc/verification/', import.meta.url));
const manifest = JSON.parse(await readFile(`${directory}/fixtures/manifest.json`, 'utf8')) as { id: string; inputHash: string; stlSha256: string }[];
const results = [];
for (const [id, filename] of [['S01', 'S01.gcode'], ['S02', 'S02.gcode']] as const) {
  const content = await readFile(`${directory}/.scratch/${filename}`, 'utf8');
  let x = 0, y = 0, z = 0, layerZ = 0, layerIndex = 0, relativeE = false, absoluteXY = true;
  let feature = '', infillMaxZ = 0;
  type Segment = { x: number; y: number; z: number; x0: number; y0: number; z0: number; feature: string; extrusionMm: number };
  const layers = new Map<number, Segment[]>(), travelsAboveBottom: { z: number; distanceMm: number }[] = [];
  const layerHeights = new Map<number, number>();
  let risingSegments = 0, fallingSegments = 0, flatSegments = 0;
  for (const line of content.split(/\r?\n/)) {
    if (line === ';LAYER_CHANGE') layerIndex++;
    if (line.startsWith(';Z:')) { layerZ = Number(line.slice(3)); layerHeights.set(layerIndex, layerZ); }
    if (line.startsWith(';TYPE:')) feature = line.slice(6).trim();
    const command = line.split(';')[0]!.trim();
    if (command === 'M83') relativeE = true;
    if (command === 'M82') relativeE = false;
    if (command === 'G90') absoluteXY = true;
    if (command === 'G91') absoluteXY = false;
    if (!/^G[01]\s/.test(command)) continue;
    if (!absoluteXY) throw new Error('Unsupported relative XYZ');
    const words = Object.fromEntries([...command.matchAll(/([XYZEF])(-?\d*\.?\d+)/g)].map(m => [m[1]!, Number(m[2])]));
    const nextX = words.X ?? x, nextY = words.Y ?? y, nextZ = words.Z ?? z;
    const distance = Math.hypot(nextX - x, nextY - y);
    if (words.E !== undefined && !relativeE) throw new Error('Unsupported absolute E');
    if ((words.E ?? 0) > 0 && distance > 0) {
      const list = layers.get(layerIndex) ?? [];
      list.push({ x: nextX, y: nextY, z: nextZ, x0: x, y0: y, z0: z, feature, extrusionMm: words.E! }); layers.set(layerIndex, list);
      if (/infill/i.test(feature)) infillMaxZ = Math.max(infillMaxZ, nextZ);
      if (layerZ > 0.6 + 1e-6) {
        if (nextZ > z + 1e-8) risingSegments++; else if (nextZ < z - 1e-8) fallingSegments++; else flatSegments++;
      }
    } else if (layerZ > 0.8 + 1e-6 && feature !== 'Custom' && distance > 0)
      travelsAboveBottom.push({ z: nextZ, distanceMm: distance });
    x = nextX; y = nextY; z = nextZ;
  }
  const spiral = [...layers].map(([index, segments]) => [layerHeights.get(index)!, segments] as const)
    .filter(([height, segments]) => height > 0.6 + 1e-6 && segments.some(s => s.z > s.z0 + 1e-8));
  const turns = spiral.map(([height, segments]) => ({ z: height,
    turns: Math.abs(segments.reduce((sum, s) => {
      const a = Math.atan2(s.y0 - 100, s.x0 - 100), b = Math.atan2(s.y - 100, s.x - 100);
      return sum + Math.atan2(Math.sin(b - a), Math.cos(b - a));
    }, 0) / (2 * Math.PI)),
  }));
  const first = [...layers.values()][0]!, last = [...layers.values()].at(-1)!;
  const pathBounds = (segments: Segment[]) => ({
    minX: Math.min(...segments.map(s => s.x)), maxX: Math.max(...segments.map(s => s.x)),
    minY: Math.min(...segments.map(s => s.y)), maxY: Math.max(...segments.map(s => s.y)),
    minZ: Math.min(...segments.map(s => s.z)), maxZ: Math.max(...segments.map(s => s.z)),
  });
  const lastBounds = pathBounds(last);
  const interruptedTravels = travelsAboveBottom.filter(t => t.z < lastBounds.maxZ - 1e-6);
  // Distance to segments, not just vertices, for an indicative opening in XY.
  const minRadius = Math.min(...last.map(s => {
    const dx = s.x - s.x0, dy = s.y - s.y0;
    const t = Math.max(0, Math.min(1, ((100 - s.x0) * dx + (100 - s.y0) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(s.x0 + t * dx - 100, s.y0 + t * dy - 100);
  }));
  const fixture = manifest.find(m => m.id.startsWith(id))!;
  results.push({ id, inputHash: fixture.inputHash, stlSha256: fixture.stlSha256,
    gcodeSha256: createHash('sha256').update(content).digest('hex'),
    slicer: content.split(/\r?\n/)[0]!.slice(2), profile: 'phase-0-slicer.ini; generic diagnostic profile, not a production printer profile',
    extrudingLayers: layers.size, firstExtrusionBounds: pathBounds(first), lastExtrusionBounds: lastBounds,
    highestInfillZ: infillMaxZ, spiralLayerCount: spiral.length,
    turnsPerSpiralLayer: { min: Math.min(...turns.map(t => t.turns)), max: Math.max(...turns.map(t => t.turns)) },
    risingSegments, fallingSegments, flatSegments, interruptedTravels,
    terminalNonExtrudingMoves: travelsAboveBottom.filter(t => t.z >= lastBounds.maxZ - 1e-6),
    terminalFlatLoop: { turns: Math.abs(last.reduce((sum, s) => {
      const a = Math.atan2(s.y0 - 100, s.x0 - 100), b = Math.atan2(s.y - 100, s.x - 100);
      return sum + Math.atan2(Math.sin(b - a), Math.cos(b - a));
    }, 0) / (2 * Math.PI)), firstExtrusionMm: last[0]!.extrusionMm, lastPositiveExtrusionMm: last.at(-1)!.extrusionMm,
      extrusionTapersToZero: last.at(-1)!.extrusionMm < last[0]!.extrusionMm * 0.1 },
    lastCenterlineDiameterMm: Math.min(lastBounds.maxX - lastBounds.minX, lastBounds.maxY - lastBounds.minY),
    estimatedTerminalOpeningMm: Math.max(0, 2 * minRadius - 0.45),
    interpretation: 'Otvor odhadnut z poslední dráhy a šířky 0,45 mm; nejde o měření fyzického výtisku.',
  });
  // Fail the diagnostic run if spiralization, bottom placement or single-loop
  // expectation fails; transition layer 4 can be shorter than one complete turn.
  if (infillMaxZ > 0.600001 || fallingSegments > 0 || risingSegments === 0
    || interruptedTravels.length > 0 || turns.slice(1).some(t => t.turns < 0.98 || t.turns > 1.02))
    throw new Error(`${id}: G-code diagnostic criteria failed: ${JSON.stringify(results.at(-1))}`);
}
await writeFile(`${directory}/phase-0-gcode-report.json`, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
