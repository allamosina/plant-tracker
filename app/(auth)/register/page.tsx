'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Leaf } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email: data.email, password: data.password })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success('Account created! You can now sign in.')
    router.push('/login')
  }

  return (
    <div className="bg-stone-100 rounded-2xl border border-stone-300 p-8" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-leaf-500/10 rounded-full mb-4">
          <Leaf className="text-leaf-500" size={28} />
        </div>
        <h1 className="text-2xl font-medium text-leaf-700">Create account</h1>
        <p className="text-olive-500 text-sm mt-1">Start tracking your plant collection</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="label-caps">Email</label>
          <input type="email" placeholder="you@example.com" autoComplete="email" className="input-underline" {...register('email')} />
          {errors.email && <p className="text-xs text-clay-400 mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="label-caps">Password</label>
          <input type="password" autoComplete="new-password" className="input-underline" {...register('password')} />
          {errors.password && <p className="text-xs text-clay-400 mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <label className="label-caps">Confirm password</label>
          <input type="password" autoComplete="new-password" className="input-underline" {...register('confirmPassword')} />
          {errors.confirmPassword && <p className="text-xs text-clay-400 mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-leaf-500 text-stone-50 font-medium text-base py-3.5 rounded-xl hover:bg-leaf-600 transition-colors disabled:opacity-60 mt-2"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>

        <p className="text-sm text-center text-olive-500">
          Already have an account?{' '}
          <Link href="/login" className="text-leaf-500 font-medium hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
