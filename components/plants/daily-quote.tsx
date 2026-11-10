'use client'

import { useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { quoteOfTheDay } from '@/lib/departure'

const subscribe = () => () => {}

/**
 * Picks the quote in the browser only: these pages are prerendered at build
 * time, so a server-picked quote would be stuck on the build day.
 */
export function DailyQuote({ quotes, emoji }: { quotes: string[]; emoji: string }) {
  const quote = useSyncExternalStore(subscribe, () => quoteOfTheDay(quotes), () => null)

  return (
    <section className="px-8 pt-6 pb-10 text-center">
      <div className="text-4xl mb-4" aria-hidden>{emoji}</div>
      <motion.p
        key={quote ?? 'empty'}
        initial={{ opacity: 0 }}
        animate={{ opacity: quote ? 1 : 0 }}
        transition={{ duration: 0.8 }}
        className="text-lg leading-relaxed text-leaf-700 font-light italic min-h-[3.5rem]"
      >
        {quote}
      </motion.p>
    </section>
  )
}
