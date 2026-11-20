import { useState, useEffect, useCallback, useRef } from 'react'
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
        setError("En attente de mesures en direct...")
      } else {
        setError('Aucune position disponible.')
      }
    } catch {
      setError('Erreur de chargement.')
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
          2ᵉ loi de Kepler : {satellite.name}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sourceMode}
            onChange={(e) => setSourceMode(e.target.value as 'n2yo' | 'all')}
            className="bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 text-sm"
          >
            <option value="n2yo">Direct N2YO</option>
            <option value="all">Orbite complète</option>
          </select>

          <select
            value={earthModel}
            onChange={(e) => setEarthModel(e.target.value as EarthModel)}
            className="bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 text-sm"
          >
            <option value="sphere">Terre sphérique (TP)</option>
            <option value="wgs84">Terre aplatie (WGS84)</option>
          </select>

          <select
            value={areaMethod}
            onChange={(e) => setAreaMethod(e.target.value as AreaMethod)}
            className="bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 text-sm"
          >
            <option value="heron">Formule de Héron</option>
            <option value="cross">Produit vectoriel</option>
          </select>

          <select
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
            className="bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 text-sm"
          >
            <option value={1}>1 s</option>
            <option value={5}>5 s</option>
            <option value={10}>10 s</option>
            <option value={30}>30 s</option>
            <option value={60}>60 s</option>
            <option value={300}>5 min (TP)</option>
          </select>

          <button
            onClick={handleCollectNow}
            disabled={refreshing}
            className="px-3 py-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm rounded transition-colors"
          >
            {refreshing ? '...' : 'Actualiser'}
          </button>
        </div>
      </div>

      {loading && <p className="text-slate-500 text-sm py-6">Chargement...</p>}

      {!loading && (error || !result) && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded text-amber-900 text-sm">
          {error || 'Données insuffisantes.'}
        </div>
      )}

      {!loading && result && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
            <StatBox label="Points" value={result.stats.count.toString()} />
            <StatBox label="Durée" value={result.stats.durationMin.toFixed(1)} unit="min" />
            <StatBox label="r min / max" value={`${result.stats.rMin.toFixed(0)} / ${result.stats.rMax.toFixed(0)}`} unit="km" />
            <StatBox label="v min / max" value={`${result.stats.vMinKmMin.toFixed(1)} / ${result.stats.vMaxKmMin.toFixed(1)}`} unit="km/min" />
            <StatBox label="σ(s) / s" value={result.stats.sRelStdPercent.toFixed(3)} unit="%" />
          </div>

          <div className="mb-5 p-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div>
              Vitesse aréolaire moyenne : <strong>{Math.round(result.stats.sMean).toLocaleString('fr-FR')} km²/min</strong> — écart relatif : <strong>{result.stats.sRelStdPercent.toFixed(3)} %</strong>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={zeroBaseS}
                onChange={(e) => setZeroBaseS(e.target.checked)}
              />
              Axe de s(t) partant de 0
            </label>
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
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={() => downloadPython(result, satellite.name)}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm rounded transition-colors"
            >
              Export Python (.py)
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

  const clipId = useRef(`clip-${Math.random().toString(36).slice(2, 9)}`).current

  const globalXMin = xData.length > 0 ? Math.min(...xData) : 0
  const globalXMax = xData.length > 0 ? Math.max(...xData) : 1
  const totalSpan = Math.max(0.01, globalXMax - globalXMin)
  const minSpan = 0.05

  const TARGET_POINTS = 1000
  const hasManyPoints = xData.length > TARGET_POINTS
  const defaultXMin = hasManyPoints ? xData[xData.length - TARGET_POINTS] : globalXMin
  const defaultXMax = globalXMax

  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; domainStart: [number, number] } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const zoomDomainRef = useRef<[number, number] | null>(null)
  zoomDomainRef.current = zoomDomain

  useEffect(() => {
    setZoomDomain(null)
    setHoverIndex(null)
  }, [xData])

  const curXMin = zoomDomain ? zoomDomain[0] : defaultXMin
  const curXMax = zoomDomain ? zoomDomain[1] : defaultXMax
  const curXRange = curXMax - curXMin || 1

  const visibleIndices: number[] = []
  for (let i = 0; i < xData.length; i++) {
    if (xData[i] >= curXMin && xData[i] <= curXMax) {
      visibleIndices.push(i)
    }
  }
  if (visibleIndices.length > 0) {
    const first = visibleIndices[0]
    if (first > 0 && !visibleIndices.includes(first - 1)) visibleIndices.unshift(first - 1)
    const last = visibleIndices[visibleIndices.length - 1]
    if (last < xData.length - 1 && !visibleIndices.includes(last + 1)) visibleIndices.push(last + 1)
  }

  const isHighDensity = visibleIndices.length <= 400
  const stepDraw = isHighDensity ? 1 : Math.ceil(visibleIndices.length / 250)

  const drawIndices: number[] = []
  for (let i = 0; i < visibleIndices.length; i += stepDraw) {
    drawIndices.push(visibleIndices[i])
  }
  if (visibleIndices.length > 0 && drawIndices[drawIndices.length - 1] !== visibleIndices[visibleIndices.length - 1]) {
    drawIndices.push(visibleIndices[visibleIndices.length - 1])
  }

  const currentYVals = visibleIndices.map((i) => yData[i]).filter((v) => typeof v === 'number' && !isNaN(v))
  const rawYMin = currentYVals.length > 0 ? Math.min(...currentYVals) : 0
  const rawYMax = currentYVals.length > 0 ? Math.max(...currentYVals) : 1

  const yMin = startAtZero ? 0 : rawYMin - (rawYMax - rawYMin || rawYMax * 0.05 || 1) * 0.1
  const yMax = startAtZero ? rawYMax * 1.15 : rawYMax + (rawYMax - rawYMin || rawYMax * 0.05 || 1) * 0.1
  const yRange = yMax - yMin || 1

  const pointsString = drawIndices
    .map((i) => {
      const px = margin.left + ((xData[i] - curXMin) / curXRange) * innerWidth
      const py = margin.top + innerHeight - ((yData[i] - yMin) / yRange) * innerHeight
      return `${px.toFixed(1)},${py.toFixed(1)}`
    })
    .join(' ')

  const refY =
    referenceLine !== undefined
      ? margin.top + innerHeight - ((referenceLine - yMin) / yRange) * innerHeight
      : null

  const handleZoom = useCallback((factor: number) => {
    const curDomain = zoomDomainRef.current || [defaultXMin, defaultXMax]
    const span = curDomain[1] - curDomain[0]
    const newSpan = span * factor

    if (newSpan >= totalSpan) {
      setZoomDomain([globalXMin, globalXMax])
      return
    }
    if (factor < 1 && span <= minSpan) return

    const center = (curDomain[0] + curDomain[1]) / 2
    let newMin = center - newSpan / 2
    let newMax = center + newSpan / 2

    if (newMin < globalXMin) {
      newMin = globalXMin
      newMax = Math.min(globalXMax, newMin + newSpan)
    }
    if (newMax > globalXMax) {
      newMax = globalXMax
      newMin = Math.max(globalXMin, newMax - newSpan)
    }

    setZoomDomain([newMin, newMax])
  }, [defaultXMin, defaultXMax, globalXMin, globalXMax, totalSpan, minSpan])

  const handleReset = () => {
    setZoomDomain(null)
    setHoverIndex(null)
  }

  useEffect(() => {
    const el = svgRef.current
    if (!el) return

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.deltaY < 0) {
        handleZoom(0.7)
      } else {
        handleZoom(1.4)
      }
    }

    el.addEventListener('wheel', onWheelNative, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheelNative)
    }
  }, [handleZoom])

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      domainStart: [curXMin, curXMax],
    }
  }

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging && dragRef.current) {
      const dxPx = e.clientX - dragRef.current.startX
      const span = dragRef.current.domainStart[1] - dragRef.current.domainStart[0]
      const dxData = -(dxPx / innerWidth) * span
      let newMin = dragRef.current.domainStart[0] + dxData
      let newMax = dragRef.current.domainStart[1] + dxData

      if (newMin < globalXMin) {
        newMin = globalXMin
        newMax = newMin + span
      }
      if (newMax > globalXMax) {
        newMax = globalXMax
        newMin = newMax - span
      }
      setZoomDomain([newMin, newMax])
      return
    }

    if (svgRef.current && visibleIndices.length > 0) {
      const rect = svgRef.current.getBoundingClientRect()
      const mousePx = ((e.clientX - rect.left) / rect.width) * width
      if (mousePx >= margin.left && mousePx <= margin.left + innerWidth) {
        const mouseDataX = curXMin + ((mousePx - margin.left) / innerWidth) * curXRange
        let bestIdx = visibleIndices[0]
        let bestDist = Math.abs(xData[bestIdx] - mouseDataX)
        for (let k = 1; k < visibleIndices.length; k++) {
          const idx = visibleIndices[k]
          const dist = Math.abs(xData[idx] - mouseDataX)
          if (dist < bestDist) {
            bestDist = dist
            bestIdx = idx
          }
        }
        setHoverIndex(bestIdx)
        return
      }
    }
    setHoverIndex(null)
  }

  const onMouseUpOrLeave = () => {
    setIsDragging(false)
    dragRef.current = null
  }

  const isAtDefault = zoomDomain === null
  const canZoomOut = curXMin > globalXMin + 0.01 || curXMax < globalXMax - 0.01

  return (
    <div className="border border-slate-200 rounded p-3 bg-white select-none">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="text-sm font-semibold text-slate-800">
          {title}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => handleZoom(0.65)}
            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-700 font-bold"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => handleZoom(1.5)}
            disabled={!canZoomOut}
            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 border border-slate-300 rounded text-slate-700 font-bold"
          >
            −
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isAtDefault}
            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 border border-slate-300 rounded text-slate-700"
          >
            Recentrer
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={`w-full h-auto bg-white rounded ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUpOrLeave}
        onMouseLeave={() => {
          onMouseUpOrLeave()
          setHoverIndex(null)
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={margin.left} y={margin.top} width={innerWidth} height={innerHeight} />
          </clipPath>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
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

        {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
          const x = margin.left + innerWidth * t
          const val = curXMin + curXRange * t
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

        <g clipPath={`url(#${clipId})`}>
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

          <polyline fill="none" stroke={color} strokeWidth="2" points={pointsString} />

          {drawIndices.length <= 120 &&
            drawIndices.map((i) => {
              const cx = margin.left + ((xData[i] - curXMin) / curXRange) * innerWidth
              const cy = margin.top + innerHeight - ((yData[i] - yMin) / yRange) * innerHeight
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={hoverIndex === i ? 4 : 2}
                  fill={hoverIndex === i ? '#dc2626' : color}
                />
              )
            })}

          {hoverIndex !== null && xData[hoverIndex] !== undefined && (
            <g>
              {(() => {
                const hx = margin.left + ((xData[hoverIndex] - curXMin) / curXRange) * innerWidth
                const hy = margin.top + innerHeight - ((yData[hoverIndex] - yMin) / yRange) * innerHeight
                const textVal = `${yData[hoverIndex].toFixed(1)} (${xData[hoverIndex].toFixed(1)} min)`
                const boxWidth = Math.max(120, textVal.length * 7)
                const boxX = Math.min(margin.left + innerWidth - boxWidth - 5, Math.max(margin.left + 5, hx - boxWidth / 2))
                return (
                  <>
                    <line x1={hx} y1={margin.top} x2={hx} y2={margin.top + innerHeight} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
                    <circle cx={hx} cy={hy} r="4" fill="#dc2626" stroke="#ffffff" strokeWidth="1.5" />
                    <rect x={boxX} y={margin.top + 6} width={boxWidth} height="20" rx="3" fill="#0f172a" fillOpacity="0.85" />
                    <text x={boxX + boxWidth / 2} y={margin.top + 20} textAnchor="middle" fill="#ffffff" fontSize="10.5" fontFamily="monospace">
                      {textVal}
                    </text>
                  </>
                )
              })()}
            </g>
          )}
        </g>

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
