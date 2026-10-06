import { describe, expect, it } from "vitest";

import { metricBarHeight, metricPercentage } from "./metrics";

describe("dashboard metrics", () => {
  it("calculates bounded percentages", () => {
    expect(metricPercentage(3, 4)).toBe(75);
    expect(metricPercentage(5, 4)).toBe(100);
    expect(metricPercentage(0, 0)).toBe(0);
  });

  it("keeps empty and small chart bars visible", () => {
    expect(metricBarHeight(0, 10)).toBe(4);
    expect(metricBarHeight(1, 100)).toBe(10);
    expect(metricBarHeight(50, 100)).toBe(50);
  });
});
