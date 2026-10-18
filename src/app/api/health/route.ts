import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'sisfin-saas',
    environment: process.env.NODE_ENV || 'development',
    railwayDomain: 'financas-financas.up.railway.app',
    timestamp: new Date().toISOString(),
  });
}
