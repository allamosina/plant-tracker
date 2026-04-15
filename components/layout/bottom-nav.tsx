'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CheckSquare, Leaf, MapPin, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Tasks', icon: CheckSquare, exact: true },
  { href: '/plants', label: 'Plants', icon: Leaf },
  { href: '/sites', label: 'Sites', icon: MapPin },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-stone-100 border-t border-stone-300 pb-safe max-w-md mx-auto">
      <div className="h-16 flex items-center justify-around px-2 relative">
        {navItems.map(({ href, label, icon: Icon, exact }, i) => {
          const active = exact ? pathname === href : pathname.startsWith(href)

          // Insert FAB between Plants and Sites
          const showFab = i === 2
          return (
            <div key={href} className="flex items-center justify-center gap-0 contents">
              {showFab && (
                <Link
                  href="/plants/new"
                  className="flex flex-col items-center justify-center w-16 h-full text-stone-400 hover:text-olive-500 transition-colors"
                >
                  <div className="w-11 h-11 bg-leaf-500 rounded-full flex items-center justify-center shadow-md hover:bg-leaf-600 transition-colors mb-0.5 -mt-3">
                    <Plus size={22} className="text-stone-50" strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] font-medium text-stone-400">Add</span>
                </Link>
              )}
              <Link
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center w-16 h-full transition-colors',
                  active ? 'text-leaf-500' : 'text-stone-400 hover:text-olive-500'
                )}
              >
                <Icon size={24} className="mb-1" strokeWidth={2.5} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
