import { describe, it, expect } from 'vitest';
import {
  computeKepler2,
  computeKepler3Regression,
  heronArea,
  crossProductArea,
  M_EARTH_REF_KG,
  OMEGA_DEG_PER_MIN,
  type RawPosition,
} from './kepler';

describe('Moteur physique — 2e et 3e lois de Kepler', () => {
  it('calcule correctement une orbite circulaire géocentrique (vitesse aréolaire constante)', () => {
    // Orbite circulaire équatoriale fictive : h = 400 km, T = 92.5 min
    const r = 6378.0 + 400.0;
    const T_min = 92.5;
    const positions: RawPosition[] = [];
    for (let sec = 0; sec <= 600; sec += 10) {
      const tMin = sec / 60;
      // Angle inertial = 360 * t / T ; longitude terrestre = angle - omega * t
      const angleDeg = (360 * tMin) / T_min;
      const lonDeg = angleDeg - OMEGA_DEG_PER_MIN * tMin;
      positions.push({
        timestamp: 1700000000 + sec,
        lat: 0,
        lon: lonDeg,
        altitude_km: 400,
      });
    }

    const res = computeKepler2(positions, 'sphere', 'cross');
    expect(res.r[0]).toBeCloseTo(r, 3);
    // La vitesse aréolaire doit être quasi-constante (écart-type relatif < 0.01%)
    expect(res.stats.sRelStdPercent).toBeLessThan(0.01);
  });

  it('donne des résultats cohérents entre formule de Héron et produit vectoriel 3D', () => {
    const a = heronArea(7000, 7000, 100);
    const b = crossProductArea(7000, 0, 0, 7000 * Math.cos(100 / 7000), 7000 * Math.sin(100 / 7000), 0);
    // Les deux méthodes donnent des résultats très proches (différence < 0.01%)
    expect(a).toBeCloseTo(b, -2);
  });

  it('calcule la masse de la Terre via la 3e loi de Kepler avec une erreur < 1%', () => {
    // Valeurs théoriques exactes autour de la Terre (GM = 398600.4418 km^3/s^2)
    const GM = 398600.4418;
    const semiMajorAxes = [6795, 10000, 15000, 24500];
    const items = semiMajorAxes.map((a, idx) => {
      const T_sec = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / GM);
      return {
        norad_id: idx + 1,
        name: `Sat-${idx}`,
        category: 'elliptical',
        a_km: a,
        period_min: T_sec / 60,
      };
    });

    const reg = computeKepler3Regression(items);
    expect(reg.rValue).toBeGreaterThan(0.99999);
    expect(Math.abs(reg.relativeErrorPercent)).toBeLessThan(0.1);
    expect(reg.earthMassKg).toBeCloseTo(M_EARTH_REF_KG, -22);
  });
});
