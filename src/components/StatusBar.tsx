interface StatusBarProps {
  status: {
    ok: boolean
    totalSatellites: number
    totalPositions: number
    lastTimestamp: number | null
    n2yoConfigured: boolean
    n2yoHourlyUsage: number
    n2yoHourlyLimit: number
  } | null
}

export default function StatusBar({ status }: StatusBarProps) {
  if (!status) return null

  const usagePercent = (status.n2yoHourlyUsage / status.n2yoHourlyLimit) * 100

  return (
    <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Archive: {status.totalSatellites} satellites, {status.totalPositions.toLocaleString()} positions
          </span>
          {status.lastTimestamp && (
            <span className="text-slate-400">
              Dernière mise à jour: {new Date(status.lastTimestamp * 1000).toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className={status.n2yoConfigured ? 'text-green-400' : 'text-amber-400'}>
              {status.n2yoConfigured ? '●' : '◐'} N2YO API
            </span>
            <div className="w-40 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <span className="text-slate-400 text-xs">
              {status.n2yoHourlyUsage}/{status.n2yoHourlyLimit} req/h
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}