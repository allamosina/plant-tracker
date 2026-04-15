import type { PlantStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const statusConfig: Record<PlantStatus, { label: string; className: string }> = {
  healthy: {
    label: 'Healthy',
    className: 'bg-leaf-500/10 text-leaf-500 border-leaf-500/20',
  },
  needs_attention: {
    label: 'Needs Attention',
    className: 'bg-clay-400/10 text-clay-400 border-clay-400/20',
  },
  recovering: {
    label: 'Recovering',
    className: 'bg-olive-400/10 text-olive-400 border-olive-400/20',
  },
}

export function PlantStatusBadge({ status }: { status: PlantStatus }) {
  const config = statusConfig[status]
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium border',
        config.className
      )}
    >
      {config.label}
    </span>
  )
}
