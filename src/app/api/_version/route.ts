import { NextRequest, NextResponse } from 'next/server';

// Configuração de ambiente e versão (mesmas constantes do webhook)
const ENV = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const COMMIT_HASH = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local-dev';
const SUPABASE_PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] || 'unknown';
const PRODUCTION_DOMAIN = process.env.PRODUCTION_DOMAIN || 'saas-chatbot-seven.vercel.app';
const BUILD_TIME = new Date().toISOString();

export async function GET(request: NextRequest) {
  try {
    // Log da requisição para diagnóstico
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const host = request.headers.get('host') || 'unknown';
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const isProduction = host === PRODUCTION_DOMAIN;
    
    console.log(`🔍 [VERSION-CHECK] Host: ${host} | IP: ${ip} | UA: ${userAgent}`);
    console.log(`📊 [VERSION-INFO] env=${ENV}, commit=${COMMIT_HASH}, supabase_ref=${SUPABASE_PROJECT_REF}`);
    console.log(`🏷️ [DOMAIN-CHECK] Production: ${isProduction} | Expected: ${PRODUCTION_DOMAIN}`);
    
    const versionInfo = {
      env: ENV,
      commit: COMMIT_HASH,
      buildTime: BUILD_TIME,
      supabase_project_ref: SUPABASE_PROJECT_REF,
      timestamp: new Date().toISOString(),
      host,
      production_domain: PRODUCTION_DOMAIN,
      is_production_host: isProduction,
      // Configurações do Supabase (sem expor chaves)
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'not-configured',
        project_ref: SUPABASE_PROJECT_REF,
        service_role_configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      // Status do servidor
      server: {
        env: ENV === 'production' ? 'production ✅' : `${ENV} ⚠️`,
        node_version: process.version,
        platform: process.platform,
        vercel_env: process.env.VERCEL_ENV || 'local',
        vercel_region: process.env.VERCEL_REGION || 'local'
      },
      // Informações de deploy
      deploy: {
        vercel_git_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
        vercel_git_commit_ref: process.env.VERCEL_GIT_COMMIT_REF || 'local',
        vercel_git_repo_slug: process.env.VERCEL_GIT_REPO_SLUG || 'local',
        vercel_url: process.env.VERCEL_URL || 'localhost:3000'
      }
    };

    return NextResponse.json(versionInfo, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Env': ENV,
        'X-Commit-Hash': COMMIT_HASH,
        'X-Supabase-Ref': SUPABASE_PROJECT_REF,
        'X-Production-Host': isProduction.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    console.error('❌ [VERSION-CHECK] Error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to get version info',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Permitir apenas GET
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}