import type { PlantStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const statusConfig: Record<PlantStatus, { label: string; className: string }> = {
  healthy: {
    label: 'Healthy',
    className: 'bg-leaf-500 text-white border-leaf-600',
  },
  needs_attention: {
    label: 'Needs Attention',
    className: 'bg-clay-400 text-white border-clay-500',
  },
  recovering: {
    label: 'Recovering',
    className: 'bg-amber-500 text-white border-amber-600',
  },
}

export function PlantStatusBadge({ status }: { status: PlantStatus }) {
  const config = statusConfig[status]
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold border',
        config.className
      )}
    >
      {config.label}
    </span>
  )
}
