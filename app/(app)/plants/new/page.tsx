import { Header } from '@/components/layout/header'
import { PlantForm } from '@/components/plants/plant-form'

export default function NewPlantPage() {
  return (
    <>
      <Header title="Add plant" showBack />
      <PlantForm />
    </>
  )
}
