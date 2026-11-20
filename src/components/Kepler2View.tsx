import { useState, useEffect, useCallback } from 'react'
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
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Kepler2Result | null>(null)
  const [earthModel, setEarthModel] = useState<EarthModel>('sphere')
  const [areaMethod, setAreaMethod] = useState<AreaMethod>('heron')
  const [step, setStep] = useState(10)
  const [sourceMode, setSourceMode] = useState<'n2yo' | 'all'>('n2yo')
  const [zeroBaseS, setZeroBaseS] = useState(true)

  const fetchPositions = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      setError(null)
      const res = await fetch(
        `/api/satellites/${satellite.norad_id}/positions?step=${step}&limit=5000&source=${sourceMode}`
      )
      const data = await res.json()
      if (data.positions && data.positions.length >= 2) {
        setPositions(data.positions)
      } else if (sourceMode === 'n2yo') {
        setPositions([])
        setResult(null)
        setError("En attente des premières mesures en direct depuis N2YO (clique sur Actualiser ou passe sur 'Orbite complète').")
      } else {
        setError('Aucune position disponible pour ce satellite')
      }
    } catch (err) {
      setError('Erreur lors du chargement des positions')
      console.error(err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [satellite.norad_id, step, sourceMode])

  useEffect(() => {
    fetchPositions(false)
  }, [fetchPositions])

  useEffect(() => {
    if (sourceMode !== 'n2yo') return
    const timer = setInterval(() => {
      fetchPositions(true)
    }, 20000)
    return () => clearInterval(timer)
  }, [sourceMode, fetchPositions])

  useEffect(() => {
    if (positions.length >= 2) {
      const res = computeKepler2(positions, earthModel, areaMethod)
      setResult(res)
    }
  }, [positions, earthModel, areaMethod])

  const handleCollectNow = async () => {
    try {
      setRefreshing(true)
      await fetch('/api/collect', { method: 'POST' })
      await fetchPositions(true)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          2ᵉ loi de Kepler — Loi des aires
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sourceMode}
            onChange={(e) => setSourceMode(e.target.value as 'n2yo' | 'all')}
            className="bg-slate-800 border border-blue-600/60 rounded-lg px-3 py-1.5 text-white text-sm"
          >
            <option value="n2yo">Temps réel N2YO (en direct)</option>
            <option value="all">Orbite complète (historique)</option>
          </select>

          <select
            value={earthModel}
            onChange={(e) => setEarthModel(e.target.value as EarthModel)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm"
          >
            <option value="sphere">Terre sphérique (Rt = 6378 km, TP)</option>
            <option value="wgs84">Terre aplatie (réelle)</option>
          </select>

          <select
            value={areaMethod}
            onChange={(e) => setAreaMethod(e.target.value as AreaMethod)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm"
          >
            <option value="heron">Formule de Héron (TP)</option>
            <option value="cross">Produit vectoriel 3D</option>
          </select>

          <select
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm"
          >
            <option value={1}>1 s</option>
            <option value={5}>5 s</option>
            <option value={10}>10 s</option>
            <option value={30}>30 s</option>
            <option value={60}>60 s</option>
            <option value={300}>300 s (5 min TP)</option>
          </select>

          <button
            onClick={handleCollectNow}
            disabled={refreshing}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            {refreshing ? 'Récupération...' : 'Actualiser N2YO'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-4 text-slate-400 py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <span>Chargement des mesures...</span>
        </div>
      )}

      {!loading && (error || !result) && (
        <div className="p-4 bg-amber-900/20 border border-amber-700/60 rounded-lg text-amber-200 text-sm">
          {error || 'Données insuffisantes pour le calcul'}
        </div>
      )}

      {!loading && result && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <StatCard label="Mesures" value={result.stats.count.toString()} />
            <StatCard label="Durée suivie" value={result.stats.durationMin.toFixed(1)} unit="min" />
            <StatCard label="Rayon min / max" value={`${result.stats.rMin.toFixed(0)} / ${result.stats.rMax.toFixed(0)}`} unit="km" />
            <StatCard label="Vitesse min / max" value={`${result.stats.vMinKmMin.toFixed(1)} / ${result.stats.vMaxKmMin.toFixed(1)}`} unit="km/min" />
            <StatCard label="Écart relatif sur s" value={result.stats.sRelStdPercent.toFixed(3)} unit="%" />
          </div>

          <div className="mb-6 p-4 bg-slate-800/30 border border-slate-700 rounded-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="font-semibold text-white">Conclusion sur la 2ᵉ loi de Kepler</h3>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={zeroBaseS}
                  onChange={(e) => setZeroBaseS(e.target.checked)}
                  className="rounded border-slate-600"
                />
                Axe de s(t) partant de 0 (comme dans le script du TP)
              </label>
            </div>
            <ul className="text-slate-300 space-y-1 text-sm">
              <li>
                • Vitesse aréolaire moyenne : <strong>{Math.round(result.stats.sMean).toLocaleString('fr-FR')} km²/min</strong>
              </li>
              <li>
                • Variation relative autour de la moyenne : <strong>{result.stats.sRelStdPercent.toFixed(3)} %</strong>{' '}
                ({result.stats.sRelStdPercent < 1 ? 'vitesse aréolaire bien constante — loi vérifiée' : 'fluctuation notable sur ce pas de temps'})
              </li>
            </ul>
          </div>

          <div className="space-y-6 mb-6">
            <KeplerChart
              title="Rayon r(t) — Distance au centre de la Terre"
              xLabel="Temps (min)"
              yLabel="Rayon (km)"
              xData={result.t}
              yData={result.r}
              color="blue"
            />
            <KeplerChart
              title="Vitesse v(t) — Vitesse du satellite"
              xLabel="Temps (min)"
              yLabel="Vitesse (km/min)"
              xData={result.tt}
              yData={result.v}
              color="amber"
            />
            <KeplerChart
              title="Vitesse aréolaire s(t) — Doit être constante"
              xLabel="Temps (min)"
              yLabel="Vitesse aréolaire (km²/min)"
              xData={result.tt}
              yData={result.s}
              color="green"
              referenceLine={result.stats.sMean}
              startAtZero={zeroBaseS}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => downloadCsv(result, satellite.name)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            >
              Exporter en CSV
            </button>
            <button
              onClick={() => downloadPython(result, satellite.name)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
            >
              Exporter en listes Python (pour le script du TP)
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function KeplerChart({
  title,
  xLabel,
  yLabel,
  xData,
  yData,
  color,
  referenceLine,
  startAtZero = false,
}: {
  title: string
  xLabel: string
  yLabel: string
  xData: number[]
  yData: number[]
  color: 'blue' | 'amber' | 'green'
  referenceLine?: number
  startAtZero?: boolean
}) {
  const colorMap = { blue: '#3b82f6', amber: '#f59e0b', green: '#22c55e' }
  const strokeColor = colorMap[color]

  const width = 760
  const height = 220
  const margin = { top: 20, right: 20, bottom: 30, left: 65 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const xMin = Math.min(...xData)
  const xMax = Math.max(...xData)
  const rawYMin = Math.min(...yData)
  const rawYMax = Math.max(...yData)

  const yMin = startAtZero ? 0 : rawYMin - (rawYMax - rawYMin || rawYMax * 0.05 || 1) * 0.1
  const yMax = startAtZero ? rawYMax * 1.15 : rawYMax + (rawYMax - rawYMin || rawYMax * 0.05 || 1) * 0.1
  const yRange = yMax - yMin || 1
  const xRange = xMax - xMin || 1

  const stepDraw = Math.max(1, Math.floor(xData.length / 250))
  const indices: number[] = []
  for (let i = 0; i < xData.length; i += stepDraw) indices.push(i)
  if (indices[indices.length - 1] !== xData.length - 1) indices.push(xData.length - 1)

  const points = indices
    .map((i) => {
      const px = margin.left + ((xData[i] - xMin) / xRange) * innerWidth
      const py = margin.top + innerHeight - ((yData[i] - yMin) / yRange) * innerHeight
      return `${px.toFixed(1)},${py.toFixed(1)}`
    })
    .join(' ')

  const refY =
    referenceLine !== undefined
      ? margin.top + innerHeight - ((referenceLine - yMin) / yRange) * innerHeight
      : null

  return (
    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
      <h4 className="font-medium text-white mb-3">{title}</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-slate-900/60 rounded">
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerHeight} stroke="rgba(148,163,184,0.4)" strokeWidth="1" />
        <line x1={margin.left} y1={margin.top + innerHeight} x2={margin.left + innerWidth} y2={margin.top + innerHeight} stroke="rgba(148,163,184,0.4)" strokeWidth="1" />
        <text x={margin.left - 8} y={margin.top + 8} textAnchor="end" fill="#94a3b8" fontSize="11">{yMax.toFixed(0)}</text>
        <text x={margin.left - 8} y={margin.top + innerHeight} textAnchor="end" fill="#94a3b8" fontSize="11">{yMin.toFixed(0)}</text>
        {refY !== null && (
          <line
            x1={margin.left}
            y1={refY}
            x2={margin.left + innerWidth}
            y2={refY}
            stroke="rgba(34,197,94,0.6)"
            strokeWidth="1.5"
            strokeDasharray="6,4"
          />
        )}
        <polyline fill="none" stroke={strokeColor} strokeWidth="2.2" points={points} />
        {indices.length <= 80 &&
          indices.map((i) => (
            <circle
              key={i}
              cx={margin.left + ((xData[i] - xMin) / xRange) * innerWidth}
              cy={margin.top + innerHeight - ((yData[i] - yMin) / yRange) * innerHeight}
              r="2.5"
              fill={strokeColor}
            />
          ))}
      </svg>
      <div className="flex justify-between text-xs text-slate-400 mt-2">
        <span>{xLabel} : {xMin.toFixed(1)} → {xMax.toFixed(1)}</span>
        <span>{yLabel} : {rawYMin.toFixed(1)} → {rawYMax.toFixed(1)}</span>
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
