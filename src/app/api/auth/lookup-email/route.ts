import { supabaseAdmin } from '@/lib/supabase-server'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { enrollment_no } = await request.json()

    if (!enrollment_no) {
      return Response.json(
        { error: 'Enrollment number is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('enrollment_no', enrollment_no)
      .single()

    if (error || !data) {
      return Response.json(
        { error: 'No account found with this enrollment number' },
        { status: 404 }
      )
    }

    return Response.json({ email: data.email })
  } catch {
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
