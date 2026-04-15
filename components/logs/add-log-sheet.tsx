'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { LogForm } from './log-form'

interface AddLogSheetProps {
  plantId: string
  wateringIntervalDays?: number | null
  mistingIntervalDays?: number | null
  fertilizingIntervalDays?: number | null
  trigger?: React.ReactElement
}

export function AddLogSheet({
  plantId,
  wateringIntervalDays,
  mistingIntervalDays,
  fertilizingIntervalDays,
  trigger,
}: AddLogSheetProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Log care
            </Button>
          )
        }
      />
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="mb-4">
          <SheetTitle>Log care</SheetTitle>
        </SheetHeader>
        <LogForm
          plantId={plantId}
          wateringIntervalDays={wateringIntervalDays}
          mistingIntervalDays={mistingIntervalDays}
          fertilizingIntervalDays={fertilizingIntervalDays}
          onSuccess={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
