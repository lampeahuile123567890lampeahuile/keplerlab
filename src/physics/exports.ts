import type { Kepler2Result } from './kepler';

export function formatCsvExport(res: Kepler2Result): string {
  const header = 't_min,lat_deg,lon_deg,h_km,r_km,x_km,y_km,z_km,v_km_min,s_km2_min';
  const lines = [header];
  for (let i = 0; i < res.t.length; i++) {
    const vi = i < res.v.length ? res.v[i].toFixed(4) : '';
    const si = i < res.s.length ? res.s[i].toFixed(2) : '';
    lines.push(
      [
        res.t[i].toFixed(4),
        res.lat[i].toFixed(6),
        res.lon[i].toFixed(6),
        res.h[i].toFixed(4),
        res.r[i].toFixed(4),
        res.x[i].toFixed(3),
        res.y[i].toFixed(3),
        res.z[i].toFixed(3),
        vi,
        si,
      ].join(',')
    );
  }
  return lines.join('\n');
}

export function formatPythonListsExport(res: Kepler2Result, satName: string): string {
  const maxPts = 120;
  const step = Math.max(1, Math.floor(res.t.length / maxPts));
  const tArr: string[] = [];
  const latArr: string[] = [];
  const lonArr: string[] = [];
  const hArr: string[] = [];

  for (let i = 0; i < res.t.length; i += step) {
    tArr.push(res.t[i].toFixed(3));
    latArr.push(res.lat[i].toFixed(4));
    lonArr.push(res.lon[i].toFixed(4));
    hArr.push(res.h[i].toFixed(2));
  }

  return `# Données exportées depuis KeplerLab — Satellite : ${satName}
# Prêt à coller dans '2e loi de Kepler 2026.py'

## t en min
t=[${tArr.join(', ')}]
## latitude en degre
lat=[${latArr.join(', ')}]
## longitude en degre
lon=[${lonArr.join(', ')}]
## altitude en km
h=[${hArr.join(', ')}]
`;
}
