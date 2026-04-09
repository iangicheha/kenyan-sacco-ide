export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

export function average(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

export function movingAverage(values: number[], period: number): number[] {
  if (period <= 0) return [];
  const out: number[] = [];
  for (let i = period - 1; i < values.length; i += 1) {
    out.push(average(values.slice(i - period + 1, i + 1)));
  }
  return out;
}

export function npv(rate: number, cashflows: number[]): number {
  return cashflows.reduce((acc, c, i) => acc + c / (1 + rate) ** i, 0);
}

export function irr(cashflows: number[], guess = 0.1): number {
  let rate = guess;
  for (let i = 0; i < 100; i += 1) {
    const f = cashflows.reduce((acc, c, t) => acc + c / (1 + rate) ** t, 0);
    const fPrime = cashflows.reduce(
      (acc, c, t) => acc - (t * c) / (1 + rate) ** (t + 1),
      0
    );
    if (Math.abs(fPrime) < 1e-12) break;
    const next = rate - f / fPrime;
    if (Math.abs(next - rate) < 1e-10) return next;
    rate = next;
  }
  return rate;
}

export function exponentialSmoothing(
  values: number[],
  alpha = 0.3,
  horizon = 1
): { smoothed: number[]; forecast: number[] } {
  if (values.length === 0) return { smoothed: [], forecast: [] };
  const a = Math.min(0.999, Math.max(0.001, alpha));
  const smoothed: number[] = [values[0]];
  for (let i = 1; i < values.length; i += 1) {
    smoothed.push(a * values[i] + (1 - a) * smoothed[i - 1]);
  }
  const last = smoothed[smoothed.length - 1];
  return { smoothed, forecast: Array.from({ length: horizon }, () => last) };
}

export function linearRegressionForecast(
  values: number[],
  horizon = 1
): { slope: number; intercept: number; forecast: number[] } {
  if (values.length === 0) return { slope: 0, intercept: 0, forecast: [] };
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = average(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  const forecast = Array.from({ length: horizon }, (_, idx) => intercept + slope * (n + idx));
  return { slope, intercept, forecast };
}

export function holtWintersForecast(
  values: number[],
  seasonLength = 4,
  horizon = 1,
  alpha = 0.3,
  beta = 0.1,
  gamma = 0.1
): { forecast: number[] } {
  if (values.length === 0) return { forecast: [] };
  if (values.length < seasonLength * 2) {
    return linearRegressionForecast(values, horizon);
  }
  const a = Math.min(0.999, Math.max(0.001, alpha));
  const b = Math.min(0.999, Math.max(0.001, beta));
  const g = Math.min(0.999, Math.max(0.001, gamma));

  let level = average(values.slice(0, seasonLength));
  let trend = (average(values.slice(seasonLength, seasonLength * 2)) - level) / seasonLength;
  const seasonals = Array.from({ length: seasonLength }, (_, i) => values[i] - level);

  for (let i = 0; i < values.length; i += 1) {
    const seasonal = seasonals[i % seasonLength];
    const prevLevel = level;
    level = a * (values[i] - seasonal) + (1 - a) * (level + trend);
    trend = b * (level - prevLevel) + (1 - b) * trend;
    seasonals[i % seasonLength] = g * (values[i] - level) + (1 - g) * seasonal;
  }
  const forecast = Array.from({ length: horizon }, (_, m) => {
    const step = m + 1;
    return level + step * trend + seasonals[(values.length + m) % seasonLength];
  });
  return { forecast };
}

export function arimaForecast(
  values: number[],
  p = 1,
  d = 1,
  q = 0,
  horizon = 1
): { forecast: number[]; params: { p: number; d: number; q: number } } {
  if (values.length === 0) return { forecast: [], params: { p, d, q } };
  if (d <= 0) {
    return { forecast: Array.from({ length: horizon }, () => values[values.length - 1]), params: { p, d: 0, q } };
  }
  const diff: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    diff.push(values[i] - values[i - 1]);
  }
  const meanDiff = average(diff);
  let base = values[values.length - 1];
  const forecast = Array.from({ length: horizon }, () => {
    base += meanDiff;
    return base;
  });
  return { forecast, params: { p, d, q } };
}
