import { Header } from '@/components/layout/header'
import { PlantListClient } from './plant-list-client'

export default function PlantsPage() {
  return (
    <>
      <Header title="My Plants" />
      <PlantListClient />
    </>
  )
}
