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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = parseInt(noradInput.trim(), 10)
    if (!isNaN(id) && id > 0) {
      setAdding(true)
      try {
        await onAdd(id)
        setNoradInput('')
      } finally {
        setAdding(false)
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-md p-4">
        <h2 className="font-bold text-slate-800 mb-3 text-base border-b border-slate-100 pb-2">
          Satellites étudiés
        </h2>

        {elliptical.length > 0 && (
          <SatelliteGroup title="Orbites elliptiques (liste du TP)" satellites={elliptical} selected={selected} onSelect={onSelect} />
        )}

        {circular.length > 0 && (
          <SatelliteGroup title="Orbite circulaire (témoin)" satellites={circular} selected={selected} onSelect={onSelect} />
        )}

        {custom.length > 0 && (
          <SatelliteGroup title="Autres satellites ajoutés" satellites={custom} selected={selected} onSelect={onSelect} />
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-md p-4">
        <h2 className="font-bold text-slate-800 mb-2 text-sm">
          Suivre un autre satellite (NORAD ID)
        </h2>
        <form onSubmit={handleAdd} className="space-y-2">
          <input
            type="number"
            value={noradInput}
            onChange={(e) => setNoradInput(e.target.value)}
            placeholder="Ex : 25544 (ISS), 37818 (TacSat-4)"
            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
            min="1"
            max="999999"
          />
          <button
            type="submit"
            disabled={adding || !noradInput.trim()}
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium py-1.5 rounded transition-colors"
          >
            {adding ? 'Ajout en cours...' : 'Ajouter ce satellite'}
          </button>
          <p className="text-xs text-slate-500">
            Récupère les paramètres orbitaux depuis N2YO / CelesTrak.
          </p>
        </form>
      </div>
    </div>
  )
}

function SatelliteGroup({ title, satellites, selected, onSelect }: {
  title: string
  satellites: Satellite[]
  selected: Satellite | null
  onSelect: (sat: Satellite) => void
}) {
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{title}</h3>
      <ul className="space-y-1">
        {satellites.map((sat) => {
          const isSel = selected?.norad_id === sat.norad_id
          return (
            <li key={sat.norad_id}>
              <button
                onClick={() => onSelect(sat)}
                className={`w-full text-left px-3 py-2 rounded border text-sm transition-colors ${
                  isSel
                    ? 'bg-blue-50 border-blue-600 text-blue-950'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{sat.name}</span>
                  <span className="text-xs text-slate-500 font-mono">e = {sat.eccentricity?.toFixed(3)}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  ID {sat.norad_id} • T = {sat.period_min?.toFixed(1)} min • {sat.perigee_km} / {sat.apogee_km} km
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
