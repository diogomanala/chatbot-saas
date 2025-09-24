import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: devices, error } = await supabase
      .from('devices')
      .select('*');

    if (error) {
      console.error('Erro ao buscar devices:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Devices encontrados:', devices);

    return NextResponse.json({
      devices_found: devices?.length || 0,
      devices: devices || []
    });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}