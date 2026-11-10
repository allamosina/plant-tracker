import Link from 'next/link'
import Image from 'next/image'
import { displayName, lifeSpanLabel, timeTogetherLabel } from '@/lib/departure'
import type { Plant } from '@/lib/types'

interface MemorialCardProps {
  plant: Plant
  /** heaven — soft, faded photo; rehomed — full colour, they're still growing */
  tone: 'heaven' | 'rehomed'
  /** Extra line under the dates, e.g. who has it now */
  subtitle?: string | null
  /** Optional action rendered under the card body (e.g. "I got it back") */
  action?: React.ReactNode
}

export function MemorialCard({ plant, tone, subtitle, action }: MemorialCardProps) {
  const name = displayName(plant)
  const photoClass =
    tone === 'heaven' ? 'sepia-[.3] saturate-75 opacity-90' : ''

  return (
    <div
      className={`rounded-2xl border overflow-hidden ${
        tone === 'heaven' ? 'bg-white/60 border-white/80 backdrop-blur-sm' : 'bg-stone-100 border-stone-300'
      }`}
      style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}
    >
      <Link href={`/plants/${plant.id}`} className="flex items-start gap-4 p-4">
        <div className="w-16 h-16 rounded-xl bg-stone-200 flex items-center justify-center overflow-hidden flex-shrink-0">
          {plant.photo_url ? (
            <Image
              src={plant.photo_url}
              alt={name}
              width={64}
              height={64}
              className={`w-full h-full object-cover ${photoClass}`}
            />
          ) : (
            <span className={`text-3xl ${tone === 'heaven' ? 'opacity-80' : ''}`}>🪴</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-leaf-700 truncate">{name}</h3>
          {plant.species && <p className="text-xs italic text-olive-500 truncate">{plant.species}</p>}
          <p className="text-xs text-stone-500 mt-1">{lifeSpanLabel(plant)}</p>
          <p className="text-xs text-stone-500">With you for {timeTogetherLabel(plant)}</p>
          {subtitle && <p className="text-xs text-leaf-700 mt-1 truncate">{subtitle}</p>}
          {plant.departure_note && tone === 'heaven' && (
            <p className="text-sm text-olive-500 italic mt-2 line-clamp-2">&ldquo;{plant.departure_note}&rdquo;</p>
          )}
        </div>
      </Link>
      {action && <div className="px-4 pb-4 -mt-1">{action}</div>}
    </div>
  )
}
