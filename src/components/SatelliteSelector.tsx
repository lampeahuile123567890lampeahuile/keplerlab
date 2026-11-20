import { useState } from 'react'
import { Satellite } from '../types'

interface SatelliteSelectorProps {
  satellites: Satellite[]
  selected: Satellite | null
  onSelect: (sat: Satellite) => void
  onAdd: (noradId: number) => void
}

export default function SatelliteSelector({ satellites, selected, onSelect, onAdd }: SatelliteSelectorProps) {
  const [noradInput, setNoradInput] = useState('')
  const [adding, setAdding] = useState(false)

  const elliptical = satellites.filter((s) => s.category === 'elliptical')
  const circular = satellites.filter((s) => s.category === 'circular')
  const custom = satellites.filter((s) => s.category === 'custom')

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const id = parseInt(noradInput.trim(), 10)
    if (!isNaN(id) && id > 0) {
      onAdd(id)
      setNoradInput('')
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Satellites du TP
        </h2>

        {elliptical.length > 0 && (
          <SatelliteGroup title="Orbites elliptiques (TP)" color="amber" satellites={elliptical} selected={selected} onSelect={onSelect} />
        )}

        {circular.length > 0 && (
          <SatelliteGroup title="Orbites circulaires (témoin)" color="green" satellites={circular} selected={selected} onSelect={onSelect} />
        )}

        {custom.length > 0 && (
          <SatelliteGroup title="Ajoutés manuellement" color="purple" satellites={custom} selected={selected} onSelect={onSelect} />
        )}
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter par NORAD ID
        </h2>
        <form onSubmit={handleAdd} className="space-y-2">
          <input
            type="number"
            value={noradInput}
            onChange={(e) => setNoradInput(e.target.value)}
            placeholder="Ex: 25544 (ISS), 37820 (TacSat-4)..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            min="1"
            max="99999"
          />
          <button
            type="submit"
            disabled={adding || !noradInput.trim()}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-colors"
          >
            {adding ? 'Ajout en cours...' : 'Récupérer TLE et archiver'}
          </button>
          <p className="text-xs text-slate-500 text-center">
            Récupère le TLE via Celestrak + archive SGP4 sur une orbite complète
          </p>
        </form>
      </div>
    </div>
  )
}

function SatelliteGroup({ title, color, satellites, selected, onSelect }: {
  title: string
  color: 'amber' | 'green' | 'purple'
  satellites: Satellite[]
  selected: Satellite | null
  onSelect: (sat: Satellite) => void
}) {
  const colorMap = { amber: 'text-amber-400', green: 'text-green-400', purple: 'text-purple-400' }
  return (
    <div className="mb-4">
      <h3 className={`text-xs font-medium uppercase tracking-wider mb-2 ${colorMap[color]}`}>{title}</h3>
      <ul className="space-y-1">
        {satellites.map((sat) => (
          <li key={sat.norad_id}>
            <button
              onClick={() => onSelect(sat)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                selected?.norad_id === sat.norad_id
                  ? 'bg-blue-600/30 text-white border border-blue-500'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{sat.name}</span>
                <span className={`text-xs ${colorMap[color]}`}>e={sat.eccentricity?.toFixed(3)}</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                NORAD {sat.norad_id} • T={sat.period_min?.toFixed(1)} min • p={sat.perigee_km} km • a={sat.apogee_km} km
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}