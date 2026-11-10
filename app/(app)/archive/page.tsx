import { redirect } from 'next/navigation'
import { REHOMED_PATH } from '@/lib/departure'

// The old Archive was split into Plant Heaven and Rehomed.
// Unsorted archived plants live on the Rehomed page.
export default function ArchivePage() {
  redirect(REHOMED_PATH)
}
