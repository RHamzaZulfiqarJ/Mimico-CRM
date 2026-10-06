export function metricPercentage(part: number, total: number) {
  if (total <= 0 || part <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

export function metricBarHeight(value: number, maximum: number) {
  if (value <= 0 || maximum <= 0) return 4;
  return Math.max(10, Math.round((value / maximum) * 100));
}
