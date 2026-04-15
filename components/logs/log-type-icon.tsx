import { Droplets, Sprout, Leaf, Scissors, AlertCircle, Wind } from 'lucide-react'
import type { LogType } from '@/lib/types'

const logConfig: Record<LogType, { icon: React.ElementType; label: string; iconClass: string; bgClass: string }> = {
  watering:       { icon: Droplets,     label: 'Watered',       iconClass: 'text-leaf-400',  bgClass: 'bg-leaf-500/10' },
  misting:        { icon: Wind,         label: 'Misted',        iconClass: 'text-sky-500',   bgClass: 'bg-sky-100' },
  fertilizing:    { icon: Sprout,       label: 'Fertilized',    iconClass: 'text-olive-400', bgClass: 'bg-olive-400/10' },
  repotting:      { icon: Leaf,         label: 'Repotted',      iconClass: 'text-clay-500',  bgClass: 'bg-clay-500/10' },
  pruning:        { icon: Scissors,     label: 'Pruned',        iconClass: 'text-stone-500', bgClass: 'bg-stone-200' },
  issue_observed: { icon: AlertCircle,  label: 'Issue noted',   iconClass: 'text-clay-400',  bgClass: 'bg-clay-400/10' },
}

export function LogTypeIcon({ type, size = 'md' }: { type: LogType; size?: 'sm' | 'md' }) {
  const config = logConfig[type]
  const Icon = config.icon
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
  const iconSize = size === 'sm' ? 14 : 16
  return (
    <div className={`${dim} ${config.bgClass} rounded-full flex items-center justify-center border-4 border-stone-50 ${config.iconClass}`}>
      <Icon size={iconSize} strokeWidth={2.5} />
    </div>
  )
}

export function logTypeLabel(type: LogType): string {
  return logConfig[type].label
}
