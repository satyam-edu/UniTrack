import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

async function handlePing() {
    // Query your users table to trigger active DB usage on Supabase
    const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

    if (error) {
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }

    return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'UniTrack DB active',
    });
}

// Support both GET and HEAD methods (HEAD is required for Uptime Robot's free plan)
export async function GET() {
    return handlePing();
}

export async function HEAD() {
    return handlePing();
}