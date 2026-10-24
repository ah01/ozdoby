import { Alert, Badge, Button, Divider, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { riskLabels, type AnalysisMessage } from '../../analysis/types';
import type { useAnalysis } from '../../app/useAnalysis';

export interface FocusRegion { code: string; zMinMm: number; zMaxMm: number }
interface Props {
  analysis: ReturnType<typeof useAnalysis>; revision: number; showMap: boolean; onMapChange: (value: boolean) => void;
  focused: FocusRegion | null; onFocus: (region: FocusRegion | null) => void;
  detailsOnly?: boolean;
}
const number = (value: number) => value.toLocaleString('cs-CZ', { maximumFractionDigits: 2 });
const percent = (value: number) => `${number(value * 100)} %`;
const color = (severity: AnalysisMessage['severity']) => severity === 'high' ? 'red' : severity === 'warning' ? 'yellow' : 'blue';

export function AnalysisPanel({ analysis, revision, showMap, onMapChange, focused, onFocus, detailsOnly = false }: Props) {
  const report = analysis.report;
  return <Paper withBorder={!detailsOnly} p="lg" radius="lg" className="analysis-panel" aria-label="Tisková analýza">
    <Group justify="space-between" mb="sm"><Title order={2} size="h4">Tisková analýza</Title></Group>
    {!detailsOnly && <div role="status" aria-live="polite" data-testid="analysis-status" data-state={analysis.status} data-input-hash={analysis.inputHash} data-revision={revision}>
      <Badge color={!report ? 'gray' : report.risk === 'high' ? 'red' : report.risk === 'warning' ? 'yellow' : 'pine'} variant="light">
        {report ? riskLabels[report.risk] : analysis.status === 'pending' ? 'Vyhodnocuji · nevyhodnoceno' : 'Nevyhodnoceno'}
      </Badge>
    </div>}
    {analysis.status === 'invalid' && <Text size="xs" c="dimmed" mt="sm">Opravte parametry tvaru a tiskové předpoklady.</Text>}
    {analysis.status === 'failed' && <Alert color="yellow" mt="sm" title="Analýza nedokončena">{analysis.error}</Alert>}
    {showMap && !report && <Text size="xs" c="dimmed" mt="sm">Mapa čeká na aktuální výsledek; staré hodnocení se nezobrazuje.</Text>}
    {report && <>
      <dl className="analysis-metrics"><div><dt>Největší převis od svislice</dt><dd>{number(report.overhang.maxAngleDeg)}°</dd></div>
        <div><dt>Plocha nad limitem převisu</dt><dd>{percent(report.overhang.riskyAreaFraction)}</dd></div>
        <div><dt>Nejmenší opora vyššího obrysu</dt><dd>{percent(report.layers.minUpperOverlap)}</dd></div>
        <div><dt>Zachování nižšího obrysu</dt><dd>{percent(report.layers.minLowerOverlap)}</dd></div></dl>
      <div className="risk-legend" aria-label="Legenda mapy rizik"><span><i className="risk-low" />Nízké</span><span><i className="risk-warning" />Varování</span><span><i className="risk-high" />Vysoké</span></div>
      <Text size="xs" c="dimmed" mt="xs">Úhel: svislá stěna 0°, spodní vodorovná plocha 90°. Podstava na podložce je vyřazená. Barva kombinuje převis, obousměrný posun obrysů a zakončení.</Text>
      <Divider my="md" />
      <Stack gap="sm">{report.messages.map(message => <Alert key={message.code} color={color(message.severity)} title={message.title}>
        <Text size="xs">{message.detail}</Text><Text size="xs" mt={5}>{message.recommendation}</Text>
        {message.code === 'OPEN_TIP' && <Text size="xs" mt={5}>Koncový průměr STL: {number(report.tip.diameterMm)} mm. Skutečný otvor výtisku není změřený.</Text>}
        {message.zMinMm !== undefined && message.zMaxMm !== undefined && <Button size="compact-xs" mt="xs" variant={focused?.code === message.code ? 'filled' : 'subtle'} color={color(message.severity)}
          onClick={() => { onMapChange(true); onFocus(focused?.code === message.code ? null : { code: message.code, zMinMm: message.zMinMm!, zMaxMm: message.zMaxMm! }); }}>
          {focused?.code === message.code ? 'Zrušit zvýraznění' : 'Zvýraznit'} Z {number(message.zMinMm)}–{number(message.zMaxMm)} mm
        </Button>}
      </Alert>)}</Stack>
      <Text size="xs" c="dimmed" mt="md">Revize {revision} · algoritmus {report.algorithmVersion}. Překryv je odhad pásů stejné šířky: 1 − vzdálenost / šířka extruze. Offset a spiralizace sliceru mohou výsledek změnit. Nízké geometrické riziko není záruka tisku.</Text>
    </>}
  </Paper>;
}
