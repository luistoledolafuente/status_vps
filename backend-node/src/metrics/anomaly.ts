interface HistoryLike {
  cpu_percent?: number;
  memory_percent?: number;
  load_one_min?: number | null;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function pstdev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / n;
  return Math.sqrt(variance);
}

function zScore(value: number, baseline: number[]): number {
  if (baseline.length < 2) return 0;
  const avg = mean(baseline);
  const deviation = pstdev(baseline);
  if (deviation < 1e-9) return 0;
  return Math.max(0, (value - avg) / deviation);
}

function clampToHundred(value: number): number {
  return Math.max(0, Math.min(100, value / 4 * 100));
}

function level(score: number): string {
  if (score < 40) return 'normal';
  if (score < 60) return 'elevated';
  if (score < 80) return 'high';
  return 'critical';
}

export class AnomalyScorer {
  constructor(
    private readonly windowMinutes: number = 120,
    private readonly critical: number = 80,
  ) {}

  score(
    cpuPercent: number,
    memoryPercent: number,
    loadOneMin: number | null,
    historyPoints: HistoryLike[],
  ): { score: number; level: string; critical_threshold: number; metrics: Record<string, number> } {
    const cpuBaseline = historyPoints.map((p) => p.cpu_percent ?? 0);
    const memBaseline = historyPoints.map((p) => p.memory_percent ?? 0);
    const loadBaseline = historyPoints
      .map((p) => p.load_one_min)
      .filter((v): v is number => v != null);

    const metrics: Record<string, number> = {
      cpu: clampToHundred(zScore(cpuPercent, cpuBaseline)),
      memory: clampToHundred(zScore(memoryPercent, memBaseline)),
    };
    if (loadOneMin != null && loadBaseline.length > 0) {
      metrics['load'] = clampToHundred(zScore(loadOneMin, loadBaseline));
    }

    const weights: Record<string, number> = { cpu: 0.4, memory: 0.3, load: 0.3 };
    const weightSum = Object.keys(metrics).reduce(
      (sum, key) => sum + (weights[key] ?? 0),
      0,
    );
    const score =
      weightSum > 0
        ? Object.keys(metrics).reduce(
            (sum, key) => sum + (weights[key] ?? 0) * metrics[key],
            0,
          ) / weightSum
        : 0;

    const roundedMetrics: Record<string, number> = {};
    for (const key of Object.keys(metrics)) {
      roundedMetrics[key] = Math.round(metrics[key] * 10) / 10;
    }

    return {
      score: Math.round(score * 10) / 10,
      level: level(score),
      critical_threshold: this.critical,
      metrics: roundedMetrics,
    };
  }
}