import { useState, useEffect, useMemo } from 'react'
import { Kepler3Satellite, Kepler3RegressionResult } from '../types'

interface Kepler3ViewProps {
  satellites: Kepler3Satellite[]
}

export default function Kepler3View({ satellites }: Kepler3ViewProps) {
  const [regResult, setRegResult] = useState<Kepler3RegressionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    computeRegression()
  }, [satellites])

  const computeRegression = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/kepler3')
      const data = await res.json()
      const items = data.satellites as Kepler3Satellite[]

      if (items.length < 2) {
        setError('Il faut au moins 2 satellites pour tracer la régression.')
        return
      }

      const points = items.map((item) => {
        const T_sec = item.period_min * 60
        const T2 = T_sec * T_sec
        const a3 = Math.pow(item.a_km, 3)
        return { ...item, T2, a3 }
      })

      const n = points.length
      const sumX = points.reduce((acc, p) => acc + p.a3, 0)
      const sumY = points.reduce((acc, p) => acc + p.T2, 0)
      const sumXY = points.reduce((acc, p) => acc + p.a3 * p.T2, 0)
      const sumX2 = points.reduce((acc, p) => acc + p.a3 * p.a3, 0)
      const sumY2 = points.reduce((acc, p) => acc + p.T2 * p.T2, 0)

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
      const intercept = (sumY - slope * sumX) / n

      const rNumerator = n * sumXY - sumX * sumY
      const rDenominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
      const rValue = rDenominator !== 0 ? rNumerator / rDenominator : 0
      const rSquared = rValue * rValue

      const yPred = points.map((p) => slope * p.a3 + intercept)
      const ssRes = points.reduce((acc, p, i) => acc + Math.pow(p.T2 - yPred[i], 2), 0)
      const stdError = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0

      // Constante G du TP (6.67e-11 u.S.I.)
      const G_SI = 6.67e-11
      const M_EARTH_REF_KG = 5.972e24
      const slopeSi = slope * 1e9 // conversion s^2/km^3 -> s^2/m^3
      const earthMassKg = slopeSi > 0 ? (4 * Math.PI * Math.PI) / (G_SI * slopeSi) : 0
      const relativeErrorPercent = Math.abs((earthMassKg - M_EARTH_REF_KG) / M_EARTH_REF_KG) * 100

      const equation = `T² = ${slope.toExponential(4)} · a³ + ${intercept.toExponential(3)}`

      setRegResult({
        slope,
        intercept,
        rValue,
        rSquared,
        pValue: 0,
        stdError,
        earthMassKg,
        relativeErrorPercent,
        equation,
        points,
      })
    } catch (err) {
      setError('Erreur lors du calcul de la régression.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const displayResult = useMemo(() => {
    if (!regResult) return null

    const width = 760
    const height = 280
    const margin = { top: 20, right: 25, bottom: 40, left: 80 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const xMax = Math.max(...regResult.points.map((p) => p.a3)) * 1.1
    const yMax = Math.max(...regResult.points.map((p) => p.T2), regResult.slope * xMax + regResult.intercept) * 1.1

    const toPxX = (x: number) => margin.left + (x / (xMax || 1)) * innerWidth
    const toPxY = (y: number) => margin.top + innerHeight - (y / (yMax || 1)) * innerHeight

    return (
      <div className="bg-white border border-slate-200 rounded-md p-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
          3ᵉ loi de Kepler : régression linéaire T² = f(a³) et masse de la Terre
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <div className="text-xs text-slate-500">Coefficient directeur</div>
            <div className="text-base font-bold text-slate-900 mt-1">{regResult.slope.toExponential(4)} s²/km³</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <div className="text-xs text-slate-500">Coefficient de corrélation r</div>
            <div className="text-base font-bold text-slate-900 mt-1">{regResult.rValue.toFixed(6)}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <div className="text-xs text-slate-500">Masse de la Terre déduite</div>
            <div className="text-base font-bold text-slate-900 mt-1">{regResult.earthMassKg.toExponential(3)} kg</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <div className="text-xs text-slate-500">Écart à la valeur officielle</div>
            <div className="text-base font-bold text-slate-900 mt-1">{regResult.relativeErrorPercent.toFixed(2)} %</div>
          </div>
        </div>

        <div className="border border-slate-200 rounded p-3 bg-white mb-5">
          <div className="text-sm font-semibold text-slate-800 text-center mb-1">
            Régression linéaire de T² = f(a³)
          </div>
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-white">
            {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
              const y = margin.top + innerHeight * (1 - t)
              const x = margin.left + innerWidth * t
              return (
                <g key={i}>
                  <line x1={margin.left} y1={y} x2={margin.left + innerWidth} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                  <line x1={x} y1={margin.top} x2={x} y2={margin.top + innerHeight} stroke="#e2e8f0" strokeWidth="1" />
                  <text x={margin.left - 8} y={y + 4} textAnchor="end" fill="#475569" fontSize="10">
                    {(yMax * t).toExponential(1)}
                  </text>
                  <text x={x} y={margin.top + innerHeight + 15} textAnchor="middle" fill="#475569" fontSize="10">
                    {(xMax * t).toExponential(1)}
                  </text>
                </g>
              )
            })}
            <rect x={margin.left} y={margin.top} width={innerWidth} height={innerHeight} fill="none" stroke="#475569" strokeWidth="1" />
            <line
              x1={toPxX(0)}
              y1={toPxY(regResult.intercept)}
              x2={toPxX(xMax)}
              y2={toPxY(regResult.slope * xMax + regResult.intercept)}
              stroke="#1f77b4"
              strokeWidth="2"
            />
            {regResult.points.map((p) => {
              const cx = toPxX(p.a3)
              const cy = toPxY(p.T2)
              return (
                <g key={p.norad_id}>
                  <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke="#dc2626" strokeWidth="2" />
                  <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke="#dc2626" strokeWidth="2" />
                  <text x={cx + 7} y={cy - 4} fill="#334155" fontSize="10">{p.name}</text>
                </g>
              )
            })}
            <text x={margin.left + innerWidth / 2} y={height - 4} textAnchor="middle" fill="#334155" fontSize="11">
              a³ (km³)
            </text>
            <text x={16} y={margin.top + innerHeight / 2} textAnchor="middle" fill="#334155" fontSize="11" transform={`rotate(-90 16 ${margin.top + innerHeight / 2})`}>
              T² (s²)
            </text>
          </svg>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded p-3 mb-5 font-mono text-xs text-slate-800">
          Équation modèle : <strong>{regResult.equation}</strong> (T en s, a en km) • Formule TP : M<sub>T</sub> = 4π² / (k · G) avec G = 6,67×10⁻¹¹ u.S.I.
        </div>

        <div className="overflow-x-auto mb-5">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-slate-600 border-b border-slate-200 bg-slate-50">
                <th className="py-2 px-3">Satellite</th>
                <th className="py-2 px-3">a (km)</th>
                <th className="py-2 px-3">T (min)</th>
                <th className="py-2 px-3">T² (s²)</th>
                <th className="py-2 px-3">a³ (km³)</th>
              </tr>
            </thead>
            <tbody>
              {regResult.points.map((p) => (
                <tr key={p.norad_id} className="border-b border-slate-100">
                  <td className="py-2 px-3 font-medium text-slate-900">{p.name}</td>
                  <td className="py-2 px-3 text-slate-700">{p.a_km.toLocaleString('fr-FR')}</td>
                  <td className="py-2 px-3 text-slate-700">{p.period_min.toFixed(1)}</td>
                  <td className="py-2 px-3 font-mono text-slate-700">{p.T2.toExponential(3)}</td>
                  <td className="py-2 px-3 font-mono text-slate-700">{p.a3.toExponential(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => downloadCsv(regResult)}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded transition-colors"
          >
            Exporter le tableau (.csv)
          </button>
          <button
            onClick={() => downloadPython(regResult)}
            className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm rounded transition-colors"
          >
            Exporter vers 3-loi.py
          </button>
        </div>
      </div>
    )
  }, [regResult])

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-md p-5 text-slate-500 text-sm">
        Calcul de la régression en cours...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white border border-slate-200 rounded-md p-5 text-red-700 text-sm">
        {error}
      </div>
    )
  }

  return displayResult
}

function downloadCsv(result: Kepler3RegressionResult) {
  const header = 'norad_id,name,category,a_km,period_min,T2_s2,a3_km3\n'
  const lines = result.points.map(
    (p) => `${p.norad_id},${p.name},${p.category},${p.a_km.toFixed(2)},${p.period_min.toFixed(2)},${p.T2.toExponential(6)},${p.a3.toExponential(6)}`
  )
  downloadFile(header + lines.join('\n'), 'kepler3_regression.csv', 'text/csv')
}

function downloadPython(result: Kepler3RegressionResult) {
  const xVals = result.points.map((p) => p.a3.toExponential(6)).join(', ')
  const yVals = result.points.map((p) => p.T2.toExponential(6)).join(', ')
  const names = result.points.map((p) => `"${p.name}"`).join(', ')

  const python = `# Regression lineaire 3eme loi de Kepler (TP Mecanique 4)\nimport numpy as np\nfrom scipy import stats\nimport matplotlib.pyplot as plt\n\nX = np.array([${xVals}])  # a^3 en km^3\nY = np.array([${yVals}])  # T^2 en s^2\nnames = [${names}]\n\nslope, intercept, r_value, p_value, std_error = stats.linregress(X, Y)\nYmodel = slope * X + intercept\n\nG = 6.67e-11\nM_terre = (4 * np.pi**2) / (G * slope * 1e9)\nprint('Y =', slope, '* X +', intercept)\nprint('coefficient de correlation r :', r_value)\nprint('Masse Terre calculee (kg) :', M_terre)\n\nplt.figure(figsize=(10, 8))\nplt.plot(X, Y, 'r+', label='Y=f(X)')\nplt.plot(X, Ymodel, 'b-', label='modele lineaire')\nplt.legend()\nplt.xlabel('a^3 (km^3)')\nplt.ylabel('T^2 (s^2)')\nplt.grid()\nplt.title('Regression lineaire de T^2 = f(a^3)')\nplt.show()\n`
  downloadFile(python, 'kepler3_regression.py', 'text/plain')
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
