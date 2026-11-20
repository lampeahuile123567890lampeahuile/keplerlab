import { useState, useEffect } from 'react'
import { Satellite } from '../types'
import { computeKepler2, type RawPosition, type Kepler2Result, EarthModel, AreaMethod } from '../physics/kepler'
import { formatCsvExport, formatPythonListsExport } from '../physics/exports'

interface Kepler2ViewProps {
  satellite: Satellite
}

function StatCard({ label, value, unit = '' }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold text-white flex items-baseline gap-1">
        {value}
        {unit && <span className="text-sm font-normal text-slate-400">{unit}</span>}
      </div>
    </div>
  )
}

export default function Kepler2View({ satellite }: Kepler2ViewProps) {
  const [positions, setPositions] = useState<RawPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Kepler2Result | null>(null)
  const [earthModel, setEarthModel] = useState<EarthModel>('sphere')
  const [areaMethod, setAreaMethod] = useState<AreaMethod>('cross')
  const [step, setStep] = useState(30)

  useEffect(() => {
    fetchPositions()
  }, [satellite.norad_id, step])

  const fetchPositions = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/satellites/${satellite.norad_id}/positions?step=${step}&limit=5000`)
      const data = await res.json()
      if (data.positions && data.positions.length > 0) {
        setPositions(data.positions)
      } else {
        setError('Aucune position disponible pour ce satellite')
      }
    } catch (err) {
      setError('Erreur lors du chargement des positions')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (positions.length >= 2) {
      const res = computeKepler2(positions, earthModel, areaMethod)
      setResult(res)
    }
  }, [positions, earthModel, areaMethod])

  if (loading) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-4 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <span>Chargement des positions...</span>
        </div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="text-red-400">{error || 'Donnees insuffisantes pour le calcul'}</div>
      </div>
    )
  }

  const stats = result.stats

  // Pre-compute ternary expressions for JSX
  const sRelStatus = stats.sRelStdPercent < 0.1 ? 'Excellent (quasi-constante)' : stats.sRelStdPercent < 1 ? 'Bon' : stats.sRelStdPercent < 5 ? 'Variable' : 'Non constante'
  const earthModelLabel = earthModel === 'sphere' ? 'Spherique (TP)' : 'WGS84 (realiste)'
  const areaMethodLabel = areaMethod === 'cross' ? 'Produit vectoriel 3D' : 'Formule de Heron (2D)'
  const eccentricityEff = ((stats.rMax - stats.rMin) / (stats.rMax + stats.rMin)).toFixed(3)

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          2eme loi de Kepler - Vitesse areolaire constante
        </h2>
        <div className="flex flex-wrap gap-2 ml-auto">
          <select
            value={earthModel}
            onChange={(e) => setEarthModel(e.target.value as EarthModel)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
          >
            <option value="sphere">Terre spherique (R=6378 km)</option>
            <option value="wgs84">WGS84 (ellipsoide)</option>
          </select>
          <select
            value={areaMethod}
            onChange={(e) => setAreaMethod(e.target.value as AreaMethod)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
          >
            <option value="cross">Produit vectoriel 3D</option>
            <option value="heron">Formule de Heron</option>
          </select>
          <select
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
          >
            <option value={10}>10 s</option>
            <option value={30}>30 s</option>
            <option value={60}>60 s</option>
            <option value={300}>300 s</option>
          </select>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard label="Points" value={stats.count.toString()} />
          <StatCard label="Duree" value={stats.durationMin.toFixed(1)} unit="min" />
          <StatCard label="r min / max" value={stats.rMin.toFixed(0) + " / " + stats.rMax.toFixed(0)} unit="km" />
          <StatCard label="v min / max" value={stats.vMinKmMin.toFixed(1) + " / " + stats.vMaxKmMin.toFixed(1)} unit="km/min" />
          <StatCard label="sigma(s)/s" value={stats.sRelStdPercent.toFixed(3)} unit="%" />
        </div>

        <div className="mb-6 p-4 bg-slate-800/30 border border-slate-700 rounded-lg">
          <h3 className="font-semibold text-white mb-2">Interpretation physique (2eme loi)</h3>
          <ul className="text-slate-300 space-y-1 text-sm">
            <li>• La 2eme loi : <strong>vitesse areolaire constante</strong> (aire balayee par unite de temps = cste)</li>
            <li>• Moyenne vitesse areolaire : <strong>{stats.sMean.toFixed(2)} km2/min</strong></li>
            <li>• Ecart-type relatif : <strong>{stats.sRelStdPercent.toFixed(3)}%</strong> {sRelStatus}</li>
            <li>• Modele Terre : <strong>{earthModelLabel}</strong> | Methode aire : <strong>{areaMethodLabel}</strong></li>
            <li>• r in [{stats.rMin.toFixed(0)}, {stats.rMax.toFixed(0)}] km - excentricite effective approx {eccentricityEff}</li>
          </ul>
        </div>

        <div className="space-y-6 mb-6">
          <KeplerChart
            title="Rayon r(t) - Distance au centre de la Terre"
            xLabel="Temps (min)"
            yLabel="Rayon (km)"
            xData={result.t}
            yData={result.r}
            color="blue"
          />
          <KeplerChart
            title="Vitesse v(t) - Variation orbitale"
            xLabel="Temps (min)"
            yLabel="Vitesse (km/min)"
            xData={result.tt}
            yData={result.v}
            color="amber"
          />
          <KeplerChart
            title="Vitesse areolaire s(t) - Test de la 2eme loi (doit etre constante)"
            xLabel="Temps (min)"
            yLabel="Vitesse areolaire (km2/min)"
            xData={result.tt}
            yData={result.s}
            color="green"
            referenceLine={stats.sMean}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => downloadCsv(result, satellite.name)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Exporter CSV (donnees completes)
          </button>
          <button
            onClick={() => downloadPython(result, satellite.name)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            Exporter Python (listes pour TP)
          </button>
        </div>
      </div>
    </div>
  )
}

function KeplerChart({ title, xLabel, yLabel, xData, yData, color, referenceLine }: { title: string; xLabel: string; yLabel: string; xData: number[]; yData: number[]; color: 'blue' | 'amber' | 'green'; referenceLine?: number }) {
  const colorMap = { blue: 'bg-blue-500', amber: 'bg-amber-500', green: 'bg-green-500' }

  const width = 600
  const height = 200
  const margin = { top: 20, right: 20, bottom: 40, left: 60 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const xMin = Math.min(...xData)
  const xMax = Math.max(...xData)
  const yMin = Math.min(...yData)
  const yMax = Math.max(...yData)
  const yRange = yMax - yMin || 1
  const xRange = xMax - xMin || 1

  const points = xData.map((x, i) => {
    const px = margin.left + ((x - xMin) / xRange) * innerWidth
    const py = margin.top + innerHeight - ((yData[i] - yMin) / yRange) * innerHeight
    return `${px},${py}`
  }).join(' ')

  const refY = referenceLine !== undefined
    ? margin.top + innerHeight - ((referenceLine - yMin) / yRange) * innerHeight
    : null

  return (
    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
      <h4 className="font-medium text-white mb-3">{title}</h4>
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="bg-slate-900/50 rounded">
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect x={margin.left} y={margin.top} width={innerWidth} height={innerHeight} fill="url(#grid)" />
          <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerHeight} stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
          <line x1={margin.left} y1={margin.top + innerHeight} x2={margin.left + innerWidth} y2={margin.top + innerHeight} stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
          {refY !== null && (
            <line x1={margin.left} y1={refY} x2={margin.left + innerWidth} y2={refY} stroke="rgba(34,197,94,0.5)" strokeWidth="1" strokeDasharray="5,5" />
          )}
          <polyline fill="none" stroke={colorMap[color]} strokeWidth="2" points={points} />
          {xData.map((x, i) => (
            <circle key={i} cx={margin.left + ((x - xMin) / xRange) * innerWidth} cy={margin.top + innerHeight - ((yData[i] - yMin) / yRange) * innerHeight} r="2" fill={colorMap[color]} />
          ))}
        </svg>
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-2">
        <span>{xLabel}: {xMin.toFixed(1)} - {xMax.toFixed(1)}</span>
        <span>{yLabel}: {yMin.toFixed(1)} - {yMax.toFixed(1)}</span>
      </div>
    </div>
  )
}

function downloadCsv(result: Kepler2Result, satName: string) {
  const csv = formatCsvExport(result)
  downloadFile(csv, 'kepler2_' + satName.replace(/\s+/g, '_') + '.csv', 'text/csv')
}

function downloadPython(result: Kepler2Result, satName: string) {
  const python = formatPythonListsExport(result, satName)
  downloadFile(python, 'kepler2_' + satName.replace(/\s+/g, '_') + '.py', 'text/plain')
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
