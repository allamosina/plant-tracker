'use client'

import { useState } from 'react'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { LogTypeIcon, logTypeLabel } from './log-type-icon'
import { useDeleteLog } from '@/lib/hooks/use-logs'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogForm } from './log-form'
import type { PlantLog } from '@/lib/types'

interface LogItemProps {
  log: PlantLog
}

export function LogItem({ log }: LogItemProps) {
  const [editOpen, setEditOpen] = useState(false)
  const deleteLog = useDeleteLog()
  const isIssue = log.type === 'issue_observed'
  const logDate = parseISO(log.date)

  async function handleDelete() {
    try {
      await deleteLog.mutateAsync({ id: log.id, plantId: log.plant_id })
      toast.success('Log deleted')
    } catch {
      toast.error('Failed to delete log')
    }
  }

  return (
    <>
      <div className="relative pl-4 mb-6">
        {/* Timeline dot */}
        <div className="absolute -left-[17px] top-0">
          <LogTypeIcon type={log.type} size="sm" />
        </div>

        {/* Content card */}
        <div
          className={`bg-stone-100 rounded-xl p-4 border ${isIssue ? 'border-clay-400/30' : 'border-stone-300'}`}
          style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}
        >
          <div className="flex justify-between items-start mb-1">
            <div>
              <h4 className={`font-medium text-sm ${isIssue ? 'text-clay-500' : 'text-leaf-700'}`}>
                {logTypeLabel(log.type)}
                {isIssue && log.issue_description && ` · ${log.issue_description}`}
              </h4>
              <span className="text-xs text-stone-500" title={format(logDate, 'PPpp')}>
                {formatDistanceToNow(logDate, { addSuffix: true })}
              </span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="p-1 -mr-1 rounded-full hover:bg-stone-200 text-stone-400 transition-colors">
                    <MoreVertical size={16} />
                  </button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil size={14} className="mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleDelete}
                  disabled={deleteLog.isPending}
                >
                  <Trash2 size={14} className="mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {log.note && (
            <p className="text-sm text-olive-500 mt-2 whitespace-pre-wrap">{log.note}</p>
          )}

          {log.photo_url && (
            <div className="relative mt-3 h-32 w-full rounded-lg overflow-hidden bg-stone-200">
              <Image src={log.photo_url} alt="Log photo" fill className="object-cover" sizes="300px" />
            </div>
          )}
        </div>
      </div>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl bg-stone-50">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-leaf-700">Edit log</SheetTitle>
          </SheetHeader>
          <LogForm plantId={log.plant_id} log={log} onSuccess={() => setEditOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
