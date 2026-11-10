'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useDepartedCounts } from '@/lib/hooks/use-plants'
import { HEAVEN_PATH, REHOMED_PATH } from '@/lib/departure'

function Door({ href, emoji, title, count }: { href: string; emoji: string; title: string; count: number }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3.5 rounded-xl bg-stone-100 border border-stone-300 hover:border-stone-400 transition-colors"
    >
      <span className="text-xl" aria-hidden>{emoji}</span>
      <span className="flex-1 text-sm text-leaf-700">{title}</span>
      <span className="text-xs text-stone-500">{count}</span>
      <ChevronRight size={16} className="text-stone-400" />
    </Link>
  )
}

/** Quiet entrance to Plant Heaven / Rehomed at the very end of the plant list. */
export function DepartedFooter() {
  const { heaven, rehomed, unsorted, total } = useDepartedCounts()
  if (total === 0) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="pt-6 pb-2"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-stone-300" />
        <p className="text-xs text-olive-500 italic">Plants that were once with you</p>
        <div className="flex-1 h-px bg-stone-300" />
      </div>

      <div className="space-y-2">
        {heaven > 0 && <Door href={HEAVEN_PATH} emoji="🕊" title="Plant Heaven" count={heaven} />}
        {rehomed > 0 && <Door href={REHOMED_PATH} emoji="🌱" title="Rehomed" count={rehomed} />}
      </div>

      {unsorted > 0 && (
        <Link href={REHOMED_PATH} className="block text-center text-xs text-leaf-500 hover:underline mt-3">
          {unsorted} archived {unsorted === 1 ? 'plant needs' : 'plants need'} a place
        </Link>
      )}
    </motion.section>
  )
}
