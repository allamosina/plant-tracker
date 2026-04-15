'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { UserMenu } from './user-menu'

interface HeaderProps {
  title: string | React.ReactNode
  showBack?: boolean
  action?: React.ReactNode
  transparent?: boolean
}

export function Header({ title, showBack = false, action, transparent = false }: HeaderProps) {
  const router = useRouter()

  return (
    <header className={`sticky top-0 z-40 px-4 py-4 flex items-center justify-between ${transparent ? 'bg-transparent' : 'bg-stone-50/80 backdrop-blur-md'}`}>
      <div className="flex items-center flex-1">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="mr-3 p-2 -ml-2 rounded-full hover:bg-stone-200/60 transition-colors text-leaf-700"
            aria-label="Go back"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <h1 className="text-xl font-medium text-leaf-700 truncate">{title}</h1>
      </div>

      {action && <div className="shrink-0 ml-4">{action}</div>}
      {!showBack && !action && <UserMenu />}
      {!showBack && action && <UserMenu />}
    </header>
  )
}
