'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, User } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useDepartedCounts } from '@/lib/hooks/use-plants'
import { HEAVEN_PATH, REHOMED_PATH } from '@/lib/departure'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

export function UserMenu() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const { heaven, rehomed } = useDepartedCounts()

  async function handleSignOut() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    setLoading(false)
    toast.success('Signed out')
    router.push('/login')
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="User menu">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem className="cursor-pointer" onClick={() => router.push(HEAVEN_PATH)}>
          <span className="w-4 mr-2 text-center" aria-hidden>🕊</span>
          <span className={`flex-1 ${heaven ? '' : 'text-muted-foreground'}`}>Plant Heaven</span>
          <span className="text-xs text-muted-foreground">{heaven || ''}</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => router.push(REHOMED_PATH)}>
          <span className="w-4 mr-2 text-center" aria-hidden>🌱</span>
          <span className={`flex-1 ${rehomed ? '' : 'text-muted-foreground'}`}>Rehomed</span>
          <span className="text-xs text-muted-foreground">{rehomed || ''}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          onClick={handleSignOut}
          disabled={loading}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {loading ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
