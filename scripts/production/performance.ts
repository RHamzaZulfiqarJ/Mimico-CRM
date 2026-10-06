import { performance } from "node:perf_hooks";

export type BenchmarkResult = {
  name: string;
  samples: number;
  errors: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  thresholdMs: number;
  passed: boolean;
};

export type BenchmarkOptions = {
  concurrency: number;
  iterations: number;
  name: string;
  operation: () => Promise<unknown>;
  thresholdMs: number;
  warmup?: number;
};

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

export function percentile(samples: number[], percentage: number) {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  const rank = Math.max(0, Math.ceil((percentage / 100) * sorted.length) - 1);
  return sorted[Math.min(rank, sorted.length - 1)];
}

export async function runBenchmark(options: BenchmarkOptions): Promise<BenchmarkResult> {
  const warmup = Math.max(0, options.warmup ?? 1);
  for (let index = 0; index < warmup; index += 1) await options.operation();

  const durations: number[] = [];
  let errors = 0;
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(options.concurrency, options.iterations) },
    async () => {
      while (cursor < options.iterations) {
        cursor += 1;
        const startedAt = performance.now();
        try {
          await options.operation();
          durations.push(performance.now() - startedAt);
        } catch {
          errors += 1;
        }
      }
    },
  );
  await Promise.all(workers);
  const p50Ms = rounded(percentile(durations, 50));
  const p95Ms = rounded(percentile(durations, 95));
  const maxMs = rounded(durations.length ? Math.max(...durations) : 0);
  return {
    name: options.name,
    samples: durations.length,
    errors,
    p50Ms,
    p95Ms,
    maxMs,
    thresholdMs: options.thresholdMs,
    passed: errors === 0 && durations.length === options.iterations && p95Ms <= options.thresholdMs,
  };
}

export function summarizeBenchmarks(results: BenchmarkResult[]) {
  return {
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    slowestP95Ms: rounded(Math.max(0, ...results.map((result) => result.p95Ms))),
  };
}
