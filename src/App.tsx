import { useState, useEffect } from 'react'
import SatelliteSelector from './components/SatelliteSelector'
import Kepler2View from './components/Kepler2View'
import Kepler3View from './components/Kepler3View'
import StatusBar from './components/StatusBar'
import { Satellite } from './types'

function App() {
  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [selectedSat, setSelectedSat] = useState<Satellite | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<any>(null)

  useEffect(() => {
    fetchSatellites()
    fetchStatus()
    const interval = setInterval(fetchStatus, 20000)
    return () => clearInterval(interval)
  }, [])

  const fetchSatellites = async () => {
    try {
      const res = await fetch('/api/satellites')
      const data = await res.json()
      setSatellites(data.satellites)
      if (data.satellites.length > 0 && !selectedSat) {
        setSelectedSat(data.satellites[0])
      }
    } catch {
      setError('Impossible de charger les satellites')
    } finally {
      setLoading(false)
    }
  }

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status')
      const data = await res.json()
      setStatus(data)
    } catch {}
  }

  const handleAddSatellite = async (noradId: number) => {
    try {
      const res = await fetch('/api/satellites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noradId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Erreur lors de l'ajout")
      }
      const data = await res.json()
      setSatellites((prev) => [...prev, data.satellite])
      setSelectedSat(data.satellite)
    } catch (err: any) {
      setError(err.message)
      setTimeout(() => setError(null), 5000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <span>Chargement des données...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="max-w-7xl mx-auto px-4 py-6">
        <header className="mb-6 pb-4 border-b border-slate-200">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            TP Mécanique 4 — Vérification des lois de Kepler
          </h1>
          <p className="text-slate-600 mt-1 text-sm">
            Automatisation des relevés de position (n2yo.com) et exploitation Python/Web des 2ᵉ et 3ᵉ lois
          </p>
          <div className="mt-2">
            <StatusBar status={status} />
          </div>
        </header>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-red-800 text-sm flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-900 font-bold">✕</button>
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1">
            <SatelliteSelector
              satellites={satellites}
              selected={selectedSat}
              onSelect={setSelectedSat}
              onAdd={handleAddSatellite}
            />
          </aside>

          <section className="lg:col-span-3 space-y-6">
            {selectedSat ? (
              <>
                <Kepler2View satellite={selectedSat} />
                <Kepler3View satellites={satellites} />
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <p>Sélectionnez un satellite dans la liste.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
