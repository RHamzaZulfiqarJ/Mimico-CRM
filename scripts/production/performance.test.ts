import { describe, expect, it } from "vitest";

import { percentile, runBenchmark, summarizeBenchmarks } from "./performance";

describe("production performance benchmark", () => {
  it("uses a nearest-rank percentile", () => {
    expect(percentile([50, 10, 30, 20, 40], 50)).toBe(30);
    expect(percentile([1, 2, 3, 4, 5], 95)).toBe(5);
    expect(percentile([], 95)).toBe(0);
  });

  it("runs the requested total sample count across bounded workers", async () => {
    let calls = 0;
    const result = await runBenchmark({
      name: "fast",
      iterations: 8,
      concurrency: 3,
      thresholdMs: 1_000,
      warmup: 2,
      operation: async () => { calls += 1; },
    });
    expect(calls).toBe(10);
    expect(result).toMatchObject({ name: "fast", timingBasis: "wall_clock", samples: 8, errors: 0, errorKinds: {}, passed: true });
  });

  it("uses an operation-provided server execution time", async () => {
    const result = await runBenchmark({
      name: "server",
      iterations: 3,
      concurrency: 1,
      thresholdMs: 5,
      timingBasis: "server_execution",
      warmup: 0,
      operation: async () => 2.5,
    });
    expect(result).toMatchObject({ timingBasis: "server_execution", p50Ms: 2.5, p95Ms: 2.5, passed: true });
  });

  it("fails a benchmark when an operation errors", async () => {
    const result = await runBenchmark({
      name: "broken",
      iterations: 3,
      concurrency: 1,
      thresholdMs: 1_000,
      warmup: 0,
      operation: async () => { throw new Error("failure"); },
    });
    expect(result).toMatchObject({ samples: 0, errors: 3, errorKinds: { Error: 3 }, passed: false });
    expect(summarizeBenchmarks([result])).toMatchObject({ passed: 0, failed: 1 });
  });
});
