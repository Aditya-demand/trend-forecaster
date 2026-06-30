// Pure client-side predictive modelling utilities:
// data cleaning, linear regression, Holt's double exponential smoothing,
// accuracy metrics, and forecast generation with hold-out evaluation.

export type RawPoint = { t: string; y: number | null };
export type CleanPoint = { t: string; y: number };

export type CleaningReport = {
  original: number;
  cleaned: number;
  removedNonNumeric: number;
  interpolated: number;
  duplicatesRemoved: number;
  outliersClipped: number;
};

export type Metrics = {
  mae: number;
  rmse: number;
  mape: number;
  r2: number;
};

export type ModelKey = "linear" | "holt";

export type ModelResult = {
  key: ModelKey;
  name: string;
  description: string;
  fitted: number[]; // in-sample fitted values aligned with cleaned series
  forecast: number[]; // future values, length = horizon
  testMetrics: Metrics; // evaluated on hold-out test slice
  fitMetrics: Metrics; // in-sample goodness of fit
  params: Record<string, number>;
};

export type ForecastOutput = {
  clean: CleanPoint[];
  cleaning: CleaningReport;
  futureLabels: string[];
  trainSize: number;
  testSize: number;
  models: ModelResult[];
  bestKey: ModelKey;
};

const round = (n: number, d = 4) => {
  if (!isFinite(n)) return 0;
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
};

/* ------------------------------ cleaning ------------------------------ */

export function cleanSeries(raw: RawPoint[]): { clean: CleanPoint[]; report: CleaningReport } {
  const original = raw.length;
  let removedNonNumeric = 0;
  let duplicatesRemoved = 0;
  let interpolated = 0;
  let outliersClipped = 0;

  // de-duplicate on label, keeping the last occurrence
  const byLabel = new Map<string, number | null>();
  for (const p of raw) {
    const label = String(p.t ?? "").trim();
    if (!label) continue;
    if (byLabel.has(label)) duplicatesRemoved++;
    const v = p.y;
    byLabel.set(label, v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
  }

  let working: { t: string; y: number | null }[] = Array.from(byLabel, ([t, y]) => ({ t, y }));

  // linear interpolation of internal gaps; drop leading/trailing nulls
  const firstValid = working.findIndex((p) => p.y !== null);
  const lastValid = working.length - 1 - [...working].reverse().findIndex((p) => p.y !== null);
  if (firstValid === -1) return { clean: [], report: { original, cleaned: 0, removedNonNumeric: original, interpolated: 0, duplicatesRemoved, outliersClipped: 0 } };

  removedNonNumeric += firstValid + (working.length - 1 - lastValid);
  working = working.slice(firstValid, lastValid + 1);

  for (let i = 0; i < working.length; i++) {
    if (working[i].y === null) {
      let next = i + 1;
      while (next < working.length && working[next].y === null) next++;
      const prev = working[i - 1].y as number;
      const nextVal = working[next].y as number;
      const span = next - (i - 1);
      for (let k = i; k < next; k++) {
        const ratio = (k - (i - 1)) / span;
        working[k].y = prev + (nextVal - prev) * ratio;
        interpolated++;
      }
      i = next;
    }
  }

  let clean: CleanPoint[] = working.map((p) => ({ t: p.t, y: p.y as number }));

  // gentle outlier clipping using median absolute deviation
  if (clean.length >= 8) {
    const vals = clean.map((p) => p.y);
    const med = median(vals);
    const mad = median(vals.map((v) => Math.abs(v - med))) || 1e-9;
    const limit = 4; // robust z threshold
    clean = clean.map((p) => {
      const z = (0.6745 * (p.y - med)) / mad;
      if (Math.abs(z) > limit) {
        outliersClipped++;
        const capped = med + Math.sign(z) * (limit * mad) / 0.6745;
        return { t: p.t, y: capped };
      }
      return p;
    });
  }

  return {
    clean,
    report: { original, cleaned: clean.length, removedNonNumeric, interpolated, duplicatesRemoved, outliersClipped },
  };
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/* ------------------------------ metrics ------------------------------ */

export function metrics(actual: number[], predicted: number[]): Metrics {
  const n = Math.min(actual.length, predicted.length);
  if (n === 0) return { mae: 0, rmse: 0, mape: 0, r2: 0 };
  let absErr = 0;
  let sqErr = 0;
  let pctErr = 0;
  let pctCount = 0;
  const mean = actual.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const e = actual[i] - predicted[i];
    absErr += Math.abs(e);
    sqErr += e * e;
    ssTot += (actual[i] - mean) ** 2;
    if (actual[i] !== 0) {
      pctErr += Math.abs(e / actual[i]);
      pctCount++;
    }
  }
  return {
    mae: round(absErr / n),
    rmse: round(Math.sqrt(sqErr / n)),
    mape: round(pctCount ? (pctErr / pctCount) * 100 : 0, 2),
    r2: round(ssTot === 0 ? 0 : 1 - sqErr / ssTot, 4),
  };
}

/* --------------------------- linear regression --------------------------- */

function fitLinear(y: number[]): { a: number; b: number } {
  const n = y.length;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += y[i];
    sxy += i * y[i];
    sxx += i * i;
  }
  const denom = n * sxx - sx * sx || 1e-9;
  const b = (n * sxy - sx * sy) / denom;
  const a = (sy - b * sx) / n;
  return { a, b };
}

function linearPredict(a: number, b: number, from: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => a + b * (from + i));
}

/* ----------------------- Holt double exp smoothing ----------------------- */

function holtForecast(y: number[], alpha: number, beta: number, horizon: number) {
  const n = y.length;
  let level = y[0];
  let trend = n > 1 ? y[1] - y[0] : 0;
  const fitted: number[] = [y[0]];
  for (let i = 1; i < n; i++) {
    const prevLevel = level;
    fitted.push(level + trend); // one-step-ahead forecast
    level = alpha * y[i] + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const forecast = Array.from({ length: horizon }, (_, h) => level + (h + 1) * trend);
  return { fitted, forecast, level, trend };
}

function optimizeHolt(train: number[]): { alpha: number; beta: number } {
  let best = { alpha: 0.5, beta: 0.1 };
  let bestSse = Infinity;
  for (let a = 0.1; a <= 0.95; a += 0.05) {
    for (let b = 0.0; b <= 0.6; b += 0.05) {
      const { fitted } = holtForecast(train, a, b, 0);
      let sse = 0;
      for (let i = 1; i < train.length; i++) sse += (train[i] - fitted[i]) ** 2;
      if (sse < bestSse) {
        bestSse = sse;
        best = { alpha: a, beta: b };
      }
    }
  }
  return best;
}

/* ----------------------------- future labels ----------------------------- */

export function nextLabels(labels: string[], horizon: number): string[] {
  const last = labels[labels.length - 1] ?? "";
  // try YYYY-MM
  const ym = /^(\d{4})-(\d{1,2})$/.exec(last.trim());
  if (ym) {
    let year = Number(ym[1]);
    let month = Number(ym[2]);
    const out: string[] = [];
    for (let i = 0; i < horizon; i++) {
      month++;
      if (month > 12) { month = 1; year++; }
      out.push(`${year}-${String(month).padStart(2, "0")}`);
    }
    return out;
  }
  // try a plain date
  const d = new Date(last);
  if (!Number.isNaN(d.getTime()) && /\d/.test(last)) {
    const prev = labels.length > 1 ? new Date(labels[labels.length - 2]) : null;
    const stepDays = prev && !Number.isNaN(prev.getTime())
      ? Math.round((d.getTime() - prev.getTime()) / 86400000) || 30
      : 30;
    const out: string[] = [];
    let cur = d.getTime();
    for (let i = 0; i < horizon; i++) {
      cur += stepDays * 86400000;
      out.push(new Date(cur).toISOString().slice(0, 10));
    }
    return out;
  }
  // try a number
  const num = Number(last);
  if (!Number.isNaN(num) && last.trim() !== "") {
    return Array.from({ length: horizon }, (_, i) => String(num + i + 1));
  }
  // fallback: index based
  const base = labels.length;
  return Array.from({ length: horizon }, (_, i) => `t+${i + 1}`);
}

/* ------------------------------ orchestrator ------------------------------ */

export function runForecast(raw: RawPoint[], horizon = 6): ForecastOutput {
  const { clean, report } = cleanSeries(raw);
  const y = clean.map((p) => p.y);
  const n = y.length;

  const testSize = Math.max(1, Math.min(Math.round(n * 0.2), n - 2));
  const trainSize = n - testSize;
  const train = y.slice(0, trainSize);
  const test = y.slice(trainSize);

  // ---- Linear regression
  const linTrain = fitLinear(train);
  const linTestPred = linearPredict(linTrain.a, linTrain.b, trainSize, testSize);
  const linFull = fitLinear(y);
  const linFitted = linearPredict(linFull.a, linFull.b, 0, n);
  const linForecast = linearPredict(linFull.a, linFull.b, n, horizon);

  const linear: ModelResult = {
    key: "linear",
    name: "Linear Regression",
    description: "Least-squares trend line fitted over time.",
    fitted: linFitted.map((v) => round(v, 4)),
    forecast: linForecast.map((v) => round(v, 4)),
    testMetrics: metrics(test, linTestPred),
    fitMetrics: metrics(y, linFitted),
    params: { intercept: round(linFull.a, 4), slope: round(linFull.b, 4) },
  };

  // ---- Holt double exponential smoothing
  const hp = optimizeHolt(train.length >= 3 ? train : y);
  const holtTrain = holtForecast(train, hp.alpha, hp.beta, testSize);
  const holtFull = holtForecast(y, hp.alpha, hp.beta, horizon);

  const holt: ModelResult = {
    key: "holt",
    name: "Holt Exponential Smoothing",
    description: "Time-series smoothing that tracks level and trend.",
    fitted: holtFull.fitted.map((v) => round(v, 4)),
    forecast: holtFull.forecast.map((v) => round(v, 4)),
    testMetrics: metrics(test, holtTrain.forecast),
    fitMetrics: metrics(y, holtFull.fitted),
    params: { alpha: round(hp.alpha, 2), beta: round(hp.beta, 2) },
  };

  const models = [linear, holt];
  const bestKey = holt.testMetrics.rmse <= linear.testMetrics.rmse ? "holt" : "linear";

  return {
    clean,
    cleaning: report,
    futureLabels: nextLabels(clean.map((p) => p.t), horizon),
    trainSize,
    testSize,
    models,
    bestKey,
  };
}

/* ------------------------- moving average (display) ------------------------- */

export function movingAverage(y: number[], window = 3): (number | null)[] {
  return y.map((_, i) => {
    if (i < window - 1) return null;
    let s = 0;
    for (let k = i - window + 1; k <= i; k++) s += y[k];
    return round(s / window, 4);
  });
}