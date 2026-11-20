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
    const interval = setInterval(fetchStatus, 30000)
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
    } catch (err) {
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
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        <span className="ml-4 text-slate-300">Chargement de l'archive...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <StatusBar status={status} />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            KeplerLab
          </h1>
          <p className="text-slate-400 mt-1">Observatoire Orbital & Lois de Kepler — Données SGP4 / N2YO</p>
        </header>

        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">✕</button>
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
                <p>Sélectionnez un satellite pour commencer l'analyse</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

export default App