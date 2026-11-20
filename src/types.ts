export interface Satellite {
  norad_id: number
  name: string
  category: 'elliptical' | 'circular' | 'custom'
  description: string
  perigee_km: number | null
  apogee_km: number | null
  eccentricity: number | null
  period_min: number | null
  inclination_deg: number | null
  is_active: number
  created_at: number
  position_count?: number
  min_ts?: number
  max_ts?: number
}

export interface Position {
  timestamp: number
  lat: number
  lon: number
  altitude_km: number
  source: string
}

export interface Kepler3Satellite {
  norad_id: number
  name: string
  category: string
  perigee_km: number
  apogee_km: number
  a_km: number
  period_min: number
}

export interface Kepler3RegressionResult {
  slope: number
  intercept: number
  rValue: number
  rSquared: number
  pValue: number
  stdError: number
  earthMassKg: number
  relativeErrorPercent: number
  equation: string
  points: Kepler3Satellite[]
}