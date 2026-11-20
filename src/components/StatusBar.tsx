interface StatusBarProps {
  status: {
    ok: boolean
    totalSatellites: number
    totalPositions: number
    n2yoPositions?: number
    lastTimestamp: number | null
    n2yoConfigured: boolean
    n2yoHourlyUsage: number
    n2yoHourlyLimit: number
  } | null
}

export default function StatusBar({ status }: StatusBarProps) {
  if (!status) return null

  return (
    <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
      <span>
        Base locale : <strong className="text-slate-700">{status.totalSatellites}</strong> satellites,{' '}
        <strong className="text-slate-700">{status.totalPositions.toLocaleString('fr-FR')}</strong> points
        {typeof status.n2yoPositions === 'number' && status.n2yoPositions > 0
          ? ` (dont ${status.n2yoPositions.toLocaleString('fr-FR')} en direct N2YO)`
          : ''}
      </span>
      {status.lastTimestamp && (
        <span>
          • Dernière mesure : {new Date(status.lastTimestamp * 1000).toLocaleString('fr-FR')}
        </span>
      )}
      <span>
        • API N2YO : {status.n2yoConfigured ? 'connectée' : 'non configurée'} ({status.n2yoHourlyUsage}/{status.n2yoHourlyLimit} req/h)
      </span>
    </div>
  )
}
