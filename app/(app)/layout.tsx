'use client'

import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { BottomNav } from '@/components/layout/bottom-nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-stone-200 flex justify-center w-full">
      <div className="max-w-md w-full bg-stone-50 min-h-screen relative shadow-2xl overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="flex-1 pb-24"
          >
            {children}
          </motion.main>
        </AnimatePresence>
        <BottomNav />
      </div>
    </div>
  )
}
