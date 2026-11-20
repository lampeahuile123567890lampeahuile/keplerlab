export const RT_SPHERE_KM = 6378.0;
export const J_S_MIN = 1436.066;
export const OMEGA_DEG_PER_MIN = 360 / J_S_MIN;

export const WGS84_A_KM = 6378.137;
export const WGS84_F = 1 / 298.257223563;
export const WGS84_E2 = WGS84_F * (2 - WGS84_F);

export const G_SI = 6.6743e-11;
export const M_EARTH_REF_KG = 5.9722e24;

export type EarthModel = 'sphere' | 'wgs84';
export type AreaMethod = 'heron' | 'cross';

export interface RawPosition {
  timestamp: number;
  lat: number;
  lon: number;
  altitude_km: number;
  source?: string;
}

export interface Kepler2Result {
  t: number[];
  tt: number[];
  lat: number[];
  lon: number[];
  h: number[];
  r: number[];
  x: number[];
  y: number[];
  z: number[];
  d: number[];
  v: number[];
  S: number[];
  s: number[];
  stats: {
    count: number;
    durationMin: number;
    rMin: number;
    rMax: number;
    vMinKmMin: number;
    vMaxKmMin: number;
    sMean: number;
    sStd: number;
    sRelStdPercent: number;
  };
}

export function heronArea(a: number, b: number, c: number): number {
  const p = (a + b + c) / 2;
  return Math.sqrt(Math.max(0, p * (p - a) * (p - b) * (p - c)));
}

export function crossProductArea(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number
): number {
  const cx = y1 * z2 - z1 * y2;
  const cy = z1 * x2 - x1 * z2;
  const cz = x1 * y2 - y1 * x2;
  return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
}

export interface Kepler3RegressionResult {
  slope: number;
  intercept: number;
  rValue: number;
  rSquared: number;
  pValue: number;
  stdError: number;
  earthMassKg: number;
  relativeErrorPercent: number;
  equation: string;
  points: { a_km: number; period_min: number; T2: number; a3: number }[];
}

export function computeKepler3Regression(
  items: { norad_id: number; name: string; category: string; a_km: number; period_min: number }[]
): Kepler3RegressionResult {
  const points = items.map((item) => {
    const T_sec = item.period_min * 60;
    const T2 = T_sec * T_sec;
    const a3 = Math.pow(item.a_km, 3);
    return { ...item, T2, a3 };
  });

  const n = points.length;
  if (n < 2) {
    return {
      slope: 0,
      intercept: 0,
      rValue: 0,
      rSquared: 0,
      pValue: 1,
      stdError: 0,
      earthMassKg: 0,
      relativeErrorPercent: 100,
      equation: 'Y = 0 * X + 0',
      points,
    };
  }

  const sumX = points.reduce((acc, p) => acc + p.a3, 0);
  const sumY = points.reduce((acc, p) => acc + p.T2, 0);
  const sumXY = points.reduce((acc, p) => acc + p.a3 * p.T2, 0);
  const sumX2 = points.reduce((acc, p) => acc + p.a3 * p.a3, 0);
  const sumY2 = points.reduce((acc, p) => acc + p.T2 * p.T2, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const rNumerator = n * sumXY - sumX * sumY;
  const rDenominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  const rValue = rDenominator !== 0 ? rNumerator / rDenominator : 0;
  const rSquared = rValue * rValue;

  // Standard error of estimate
  const yPred = points.map((p) => slope * p.a3 + intercept);
  const residuals = points.map((p, i) => p.T2 - yPred[i]);
  const ssRes = residuals.reduce((acc, r) => acc + r * r, 0);
  const stdError = Math.sqrt(ssRes / (n - 2));

  // p-value approximation for slope (two-tailed t-test)
  const tStat = Math.abs(slope) / (stdError / Math.sqrt(sumX2 - sumX * sumX / n));
  // Approximate p-value for large n
  const pValue = tStat > 0 ? 2 * (1 - 0.5 * (1 + Math.sign(tStat) * Math.min(1, Math.sqrt(tStat * tStat / (tStat * tStat + n - 2))))) : 1;

  // Kepler's 3rd law: T^2 = (4 * pi^2 / (G * M)) * a^3
  // So slope = 4 * pi^2 / (G * M)  =>  M = 4 * pi^2 / (G * slope)
  // GM is computed in km^3/s^2, need to convert to m^3/s^2 for G_SI (1 km^3 = 1e9 m^3)
  const GM_km3_s2 = (4 * Math.PI * Math.PI) / slope;
  const GM_m3_s2 = GM_km3_s2 * 1e9;
  const earthMassKg = GM_m3_s2 / G_SI;
  const relativeErrorPercent = ((earthMassKg - M_EARTH_REF_KG) / M_EARTH_REF_KG) * 100;

  const equation = `Y = ${slope.toExponential(4)} * X + ${intercept.toExponential(4)}`;

  return {
    slope,
    intercept,
    rValue,
    rSquared,
    pValue,
    stdError,
    earthMassKg,
    relativeErrorPercent,
    equation,
    points,
  };
}

export function computeKepler2(
  positions: RawPosition[],
  earthModel: EarthModel = 'sphere',
  areaMethod: AreaMethod = 'cross'
): Kepler2Result {
  const n = positions.length;
  if (n < 2) {
    return {
      t: [], tt: [], lat: [], lon: [], h: [], r: [], x: [], y: [], z: [],
      d: [], v: [], S: [], s: [],
      stats: { count: n, durationMin: 0, rMin: 0, rMax: 0, vMinKmMin: 0, vMaxKmMin: 0, sMean: 0, sStd: 0, sRelStdPercent: 0 },
    };
  }

  const t0 = positions[0].timestamp;
  const t: number[] = new Array(n);
  const lat: number[] = new Array(n);
  const lon: number[] = new Array(n);
  const h: number[] = new Array(n);
  const r: number[] = new Array(n);
  const x: number[] = new Array(n);
  const y: number[] = new Array(n);
  const z: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const pos = positions[i];
    t[i] = (pos.timestamp - t0) / 60;
    lat[i] = pos.lat;
    lon[i] = pos.lon;
    h[i] = pos.altitude_km;

    const loncr = ((pos.lon + OMEGA_DEG_PER_MIN * t[i]) * Math.PI) / 180;
    const latr = (pos.lat * Math.PI) / 180;

    if (earthModel === 'sphere') {
      const ri = pos.altitude_km + RT_SPHERE_KM;
      r[i] = ri;
      x[i] = ri * Math.cos(latr) * Math.cos(loncr);
      y[i] = ri * Math.cos(latr) * Math.sin(loncr);
      z[i] = ri * Math.sin(latr);
    } else {
      const sinLat = Math.sin(latr);
      const cosLat = Math.cos(latr);
      const N = WGS84_A_KM / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
      const rho = (N + pos.altitude_km) * cosLat;
      const xi = rho * Math.cos(loncr);
      const yi = rho * Math.sin(loncr);
      const zi = (N * (1 - WGS84_E2) + pos.altitude_km) * sinLat;
      x[i] = xi;
      y[i] = yi;
      z[i] = zi;
      r[i] = Math.sqrt(xi * xi + yi * yi + zi * zi);
    }
  }

  const tt: number[] = [];
  const d: number[] = [];
  const v: number[] = [];
  const S: number[] = [];
  const s: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const dt = t[i + 1] - t[i];
    if (dt <= 0) continue;

    const dx = x[i + 1] - x[i];
    const dy = y[i + 1] - y[i];
    const dz = z[i + 1] - z[i];
    const di = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const vi = di / dt;
    const Si =
      areaMethod === 'heron'
        ? heronArea(r[i], r[i + 1], di)
        : crossProductArea(x[i], y[i], z[i], x[i + 1], y[i + 1], z[i + 1]);
    const si = Si / dt;

    tt.push(t[i]);
    d.push(di);
    v.push(vi);
    S.push(Si);
    s.push(si);
  }

  const rMin = Math.min(...r);
  const rMax = Math.max(...r);
  const vMinKmMin = v.length ? Math.min(...v) : 0;
  const vMaxKmMin = v.length ? Math.max(...v) : 0;
  const sMean = s.length ? s.reduce((acc, val) => acc + val, 0) / s.length : 0;
  const sVar = s.length ? s.reduce((acc, val) => acc + (val - sMean) * (val - sMean), 0) / s.length : 0;
  const sStd = Math.sqrt(sVar);
  const sRelStdPercent = sMean > 0 ? (sStd / sMean) * 100 : 0;

  return {
    t, tt, lat, lon, h, r, x, y, z, d, v, S, s,
    stats: { count: n, durationMin: t[n - 1] - t[0], rMin, rMax, vMinKmMin, vMaxKmMin, sMean, sStd, sRelStdPercent },
  };
}
