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
        setError('Il faut au moins 2 satellites pour faire la regression')
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
      const residuals = points.map((p, i) => p.T2 - yPred[i])
      const ssRes = residuals.reduce((acc, r) => acc + r * r, 0)
      const stdError = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0

      const tStat = rValue !== 0 && rValue !== 1 ? (rValue * Math.sqrt(n - 2)) / Math.sqrt(1 - rValue * rValue) : 0
      const pValue = 2 * (1 - studentTCdf(Math.abs(tStat), n - 2))

      const G_SI = 6.6743e-11
      const M_EARTH_REF_KG = 5.9722e24
      const slopeSi = slope * 1e9
      const earthMassKg = slopeSi > 0 ? (4 * Math.PI * Math.PI) / (G_SI * slopeSi) : 0
      const relativeErrorPercent = Math.abs((earthMassKg - M_EARTH_REF_KG) / M_EARTH_REF_KG) * 100

      const equation = 'T² = ' + slope.toExponential(4) + ' * a³ + ' + intercept.toExponential(4)

      setRegResult({
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
      })
    } catch (err) {
      setError('Erreur lors du calcul de la regression')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function studentTCdf(t: number, df: number): number {
    if (df <= 0) return 0.5
    if (df > 100) return 0.5 * (1 + Math.erf(t / Math.sqrt(2)))
    const x = df / (t * t + df)
    return 1 - 0.5 * Math.pow(x, df / 2) * (1 + (df / 2) * (1 - x))
  }

  const displayResult = useMemo(() => {
    if (!regResult) return null
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          3eme loi de Kepler - Regression T² = f(a³)
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Pente (T²/a³)" value={regResult.slope.toExponential(4)} unit="s²/km³" />
          <StatCard label="R²" value={regResult.rSquared.toFixed(6)} />
          <StatCard label="Masse Terre" value={(regResult.earthMassKg / 1e24).toFixed(2)} unit="x10^24 kg" />
          <StatCard label="Erreur relative" value={regResult.relativeErrorPercent.toFixed(2)} unit="%" />
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6 font-mono text-sm">
          <div className="text-blue-300">Equation de regression :</div>
          <div className="text-white mt-1">{regResult.equation}</div>
          <div className="text-slate-400 mt-1">T en secondes, a en km</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="pb-2 pr-4">Satellite</th>
                <th className="pb-2 pr-4">Categorie</th>
                <th className="pb-2 pr-4">a (km)</th>
                <th className="pb-2 pr-4">T (min)</th>
                <th className="pb-2 pr-4">T² (s²)</th>
                <th className="pb-2 pr-4">a³ (km³)</th>
              </tr>
            </thead>
            <tbody>
              {regResult.points.map((p) => (
                <tr key={p.norad_id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2 pr-4 text-white">{p.name}</td>
                  <td className="py-2 pr-4 text-slate-400 capitalize">{p.category}</td>
                  <td className="py-2 pr-4 text-slate-300">{p.a_km.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-slate-300">{p.period_min.toFixed(1)}</td>
                  <td className="py-2 pr-4 font-mono text-slate-300">{p.T2.toExponential(3)}</td>
                  <td className="py-2 pr-4 font-mono text-slate-300">{p.a3.toExponential(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 p-4 bg-slate-800/30 border border-slate-700 rounded-lg">
          <h3 className="font-semibold text-white mb-2">Interpretation physique</h3>
          <ul className="text-slate-300 space-y-1 text-sm">
            <li>• La 3eme loi de Kepler : <strong>T² = (4π²/GM) · a³</strong></li>
            <li>• Pente theorique attendue : <strong>{(4 * Math.PI * Math.PI / 398600.4418).toExponential(4)} s²/km³</strong> (GM = 398600.4418 km³/s²)</li>
            <li>• Masse terrestre deducee : <strong>{regResult.earthMassKg.toExponential(3)} kg</strong> (reference : 5.9722x10^24 kg)</li>
            <li>• Erreur relative : <strong>{regResult.relativeErrorPercent.toFixed(2)}%</strong> {regResult.relativeErrorPercent < 1 ? 'Excellent' : regResult.relativeErrorPercent < 5 ? 'Bon' : 'A ameliorer'}</li>
            <li>• Coefficient de correlation R = <strong>{regResult.rValue.toFixed(6)}</strong> {regResult.rValue > 0.999 ? 'Correlation quasi-parfaite' : 'Correlation imparfaite'}</li>
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => downloadCsv(regResult)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Exporter CSV (T², a³)
          </button>
          <button
            onClick={() => downloadPython(regResult)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            Exporter Python (regression)
          </button>
        </div>
      </div>
    )
  }, [regResult])

  if (loading) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-4 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <span>Calcul de la regression...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="text-red-400">{error}</div>
      </div>
    )
  }

  return displayResult
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

function downloadCsv(result: Kepler3RegressionResult) {
  const header = 'norad_id,name,category,a_km,period_min,T2_s2,a3_km3\n'
  const lines = result.points.map(
    (p) => p.norad_id + ',' + p.name + ',' + p.category + ',' + p.a_km.toFixed(2) + ',' + p.period_min.toFixed(2) + ',' + p.T2.toExponential(6) + ',' + p.a3.toExponential(6)
  )
  const csv = header + lines.join('\n')
  downloadFile(csv, 'kepler3_regression.csv', 'text/csv')
}

function downloadPython(result: Kepler3RegressionResult) {
  const xVals = result.points.map((p) => p.a3.toExponential(6)).join(', ')
  const yVals = result.points.map((p) => p.T2.toExponential(6)).join(', ')
  const names = result.points.map((p) => '\"' + p.name + '\"').join(', ')

  const python = '# Regression lineaire 3eme loi de Kepler - Export KeplerLab\n# Genere automatiquement - Donnees SGP4 archivees\n\nimport numpy as np\nfrom scipy import stats\nimport matplotlib.pyplot as plt\n\n# Donnees : a3 (km3) et T2 (s2)\nX = np.array([' + xVals + '])\nY = np.array([' + yVals + '])\nnames = [' + names + ']\n\n# Regression lineaire\nslope, intercept, r_value, p_value, std_error = stats.linregress(X, Y)\nY_model = slope * X + intercept\n\n# Masse de la Terre deducee\nG = 6.6743e-11\nslope_SI = slope * 1e9  # km3/s2 -> m3/s2\nM_earth = (4 * np.pi**2) / (G * slope_SI)\nM_ref = 5.9722e24\nerror_pct = abs(M_earth - M_ref) / M_ref * 100\n\nprint(f\'Pente (T²/a³) = {slope:.6e} s²/km³\')\nprint(f\'Ordonnee a l\'origine = {intercept:.6e} s²\')\nprint(f\'R² = {r_value**2:.6f}\')\nprint(f\'Masse Terre deducee = {M_earth:.3e} kg\')\nprint(f\'Erreur relative = {error_pct:.2f}%\')\nprint(f\'Equation : T² = {slope:.4e} * a³ + {intercept:.4e}\')\n\n# Graphique\nplt.figure(figsize=(10, 8))\nplt.plot(X, Y, \'r+\', markersize=10, label=\'Donnees satellites\')\nplt.plot(X, Y_model, \'b-\', label=f\'Regression (R²={r_value**2:.6f})\')\nfor i, name in enumerate(names):\n    plt.annotate(name, (X[i], Y[i]), textcoords=\'offset points\', xytext=(5,5), fontsize=9)\nplt.xlabel(\'a³ (km³)\')\nplt.ylabel(\'T² (s²)\')\nplt.title(\'3eme loi de Kepler : T² = f(a³)\')\nplt.legend()\nplt.grid(True, alpha=0.3)\nplt.show()\n'
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