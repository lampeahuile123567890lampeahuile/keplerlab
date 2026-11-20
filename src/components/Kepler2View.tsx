import { useState, useEffect, useCallback } from 'react'
import { Satellite } from '../types'
import { computeKepler2, type RawPosition, type Kepler2Result, EarthModel, AreaMethod } from '../physics/kepler'
import { formatCsvExport, formatPythonListsExport } from '../physics/exports'

interface Kepler2ViewProps {
  satellite: Satellite
}

function StatBox({ label, value, unit = '' }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-lg font-bold text-slate-900">
        {value}
        {unit && <span className="text-xs font-normal text-slate-500 ml-1">{unit}</span>}
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
        setError('Aucune position disponible pour ce satellite.')
      }
    } catch {
      setError('Erreur lors du chargement des positions.')
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
      setResult(computeKepler2(positions, earthModel, areaMethod))
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
    <div className="bg-white border border-slate-200 rounded-md p-5">
      <div className="mb-4 pb-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">
          2ᵉ loi de Kepler : loi des aires ({satellite.name})
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sourceMode}
            onChange={(e) => setSourceMode(e.target.value as 'n2yo' | 'all')}
            className="bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 text-sm"
          >
            <option value="n2yo">Temps réel N2YO (en direct)</option>
            <option value="all">Orbite complète (historique)</option>
          </select>

          <select
            value={earthModel}
            onChange={(e) => setEarthModel(e.target.value as EarthModel)}
            className="bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 text-sm"
          >
            <option value="sphere">Terre sphérique (Rt = 6378 km, TP)</option>
            <option value="wgs84">Terre aplatie (ellipsoïde)</option>
          </select>

          <select
            value={areaMethod}
            onChange={(e) => setAreaMethod(e.target.value as AreaMethod)}
            className="bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 text-sm"
          >
            <option value="heron">Formule de Héron (TP)</option>
            <option value="cross">Produit vectoriel 3D</option>
          </select>

          <select
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
            className="bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 text-sm"
          >
            <option value={1}>Pas : 1 s</option>
            <option value={5}>Pas : 5 s</option>
            <option value={10}>Pas : 10 s</option>
            <option value={30}>Pas : 30 s</option>
            <option value={60}>Pas : 60 s</option>
            <option value={300}>Pas : 5 min (TP)</option>
          </select>

          <button
            onClick={handleCollectNow}
            disabled={refreshing}
            className="px-3 py-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm rounded transition-colors"
          >
            {refreshing ? 'Récupération...' : 'Actualiser N2YO'}
          </button>
        </div>
      </div>

      {loading && <p className="text-slate-500 text-sm py-6">Chargement des mesures...</p>}

      {!loading && (error || !result) && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded text-amber-900 text-sm">
          {error || 'Données insuffisantes pour le calcul.'}
        </div>
      )}

      {!loading && result && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
            <StatBox label="Nombre de mesures" value={result.stats.count.toString()} />
            <StatBox label="Durée suivie" value={result.stats.durationMin.toFixed(1)} unit="min" />
            <StatBox label="Rayon min / max" value={`${result.stats.rMin.toFixed(0)} / ${result.stats.rMax.toFixed(0)}`} unit="km" />
            <StatBox label="Vitesse min / max" value={`${result.stats.vMinKmMin.toFixed(1)} / ${result.stats.vMaxKmMin.toFixed(1)}`} unit="km/min" />
            <StatBox label="Écart relatif σ(s)/s" value={result.stats.sRelStdPercent.toFixed(3)} unit="%" />
          </div>

          <div className="mb-5 p-3.5 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-slate-900">Résultats et méthode du TP</strong>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={zeroBaseS}
                  onChange={(e) => setZeroBaseS(e.target.checked)}
                />
                Ordonnée de s(t) partant de 0 (comme dans le script Python)
              </label>
            </div>
            <p>
              • Vitesse aréolaire moyenne : <strong>{Math.round(result.stats.sMean).toLocaleString('fr-FR')} km²/min</strong> — dispersion relative : <strong>{result.stats.sRelStdPercent.toFixed(3)} %</strong>{' '}
              ({result.stats.sRelStdPercent < 1 ? 'constante aux erreurs d’arrondi près' : 'fluctuation notable sur ce pas de temps'}).
            </p>
            <p className="text-xs text-slate-500">
              Calculs repris de <code>2e loi de Kepler 2026.py</code> : r = h + R<sub>t</sub> (R<sub>t</sub> = 6378 km), correction du jour sidéral J<sub>s</sub> = 1436,066 min (ω = 360/J<sub>s</sub>), passage en coordonnées cartésiennes géocentriques (x, y, z), aire du triangle par Héron S = √(p(p-a)(p-b)(p-c)), puis s = S / Δt.
            </p>
          </div>

          <div className="space-y-5 mb-5">
            <KeplerChart
              title="Rayon en fonction du temps"
              xLabel="temps en min"
              yLabel="rayon en km"
              xData={result.t}
              yData={result.r}
              color="#1f77b4"
            />
            <KeplerChart
              title="Vitesse en fonction du temps"
              xLabel="temps en min"
              yLabel="vitesse en km/min"
              xData={result.tt}
              yData={result.v}
              color="#d97706"
            />
            <KeplerChart
              title="Vitesse aréolaire en fonction du temps"
              xLabel="temps en min"
              yLabel="vitesse aréolaire en km²/min"
              xData={result.tt}
              yData={result.s}
              color="#16a34a"
              referenceLine={result.stats.sMean}
              startAtZero={zeroBaseS}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => downloadCsv(result, satellite.name)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded transition-colors"
            >
              Télécharger les données (.csv)
            </button>
            <button
              onClick={() => downloadPython(result, satellite.name)}
              className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm rounded transition-colors"
            >
              Exporter les listes pour le script Python (.py)
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
  color: string
  referenceLine?: number
  startAtZero?: boolean
}) {
  const width = 760
  const height = 240
  const margin = { top: 20, right: 20, bottom: 38, left: 72 }
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

  const yTicks = [0, 0.25, 0.5, 0.75, 1]
  const xTicks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="border border-slate-200 rounded p-3 bg-white">
      <div className="text-sm font-semibold text-slate-800 text-center mb-1">{title}</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-white">
        {yTicks.map((t, idx) => {
          const y = margin.top + innerHeight * (1 - t)
          const val = yMin + yRange * t
          return (
            <g key={`y-${idx}`}>
              <line x1={margin.left} y1={y} x2={margin.left + innerWidth} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={margin.left - 8} y={y + 4} textAnchor="end" fill="#475569" fontSize="10.5">
                {Math.round(val).toLocaleString('fr-FR')}
              </text>
            </g>
          )
        })}
        {xTicks.map((t, idx) => {
          const x = margin.left + innerWidth * t
          const val = xMin + xRange * t
          return (
            <g key={`x-${idx}`}>
              <line x1={x} y1={margin.top} x2={x} y2={margin.top + innerHeight} stroke="#e2e8f0" strokeWidth="1" />
              <text x={x} y={margin.top + innerHeight + 15} textAnchor="middle" fill="#475569" fontSize="10.5">
                {val.toFixed(1)}
              </text>
            </g>
          )
        })}

        <rect x={margin.left} y={margin.top} width={innerWidth} height={innerHeight} fill="none" stroke="#475569" strokeWidth="1" />

        {refY !== null && (
          <line
            x1={margin.left}
            y1={refY}
            x2={margin.left + innerWidth}
            y2={refY}
            stroke="#64748b"
            strokeWidth="1.2"
            strokeDasharray="5,4"
          />
        )}

        <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
        {indices.length <= 70 &&
          indices.map((i) => (
            <circle
              key={i}
              cx={margin.left + ((xData[i] - xMin) / xRange) * innerWidth}
              cy={margin.top + innerHeight - ((yData[i] - yMin) / yRange) * innerHeight}
              r="2.5"
              fill={color}
            />
          ))}

        <text x={margin.left + innerWidth / 2} y={height - 4} textAnchor="middle" fill="#334155" fontSize="11">
          {xLabel}
        </text>
        <text
          x={14}
          y={margin.top + innerHeight / 2}
          textAnchor="middle"
          fill="#334155"
          fontSize="11"
          transform={`rotate(-90 14 ${margin.top + innerHeight / 2})`}
        >
          {yLabel}
        </text>
      </svg>
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
