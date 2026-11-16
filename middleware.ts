import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const ADMIN_COOKIE_NAME = 'admin_session';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'dev-secret-key-chargeshare-fallback-12345';
  return new TextEncoder().encode(secret);
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Content-Security-Policy', "frame-ancestors 'none';");
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. If visiting /admin/login while already logged in as ADMIN, redirect to /admin dashboard
  if (pathname === '/admin/login') {
    const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (sessionCookie) {
      try {
        const { payload } = await jwtVerify(sessionCookie, getJwtSecret());
        if (payload.role === 'ADMIN') {
          return applySecurityHeaders(
            NextResponse.redirect(new URL('/admin', request.url))
          );
        }
      } catch {
        // Invalid cookie; allow displaying login page
      }
    }
    return applySecurityHeaders(NextResponse.next());
  }

  const isAdminPage = pathname.startsWith('/admin');
  const isAdminApi = pathname.startsWith('/api/v1/admin');

  if (isAdminPage || isAdminApi) {
    // 1. Bearer-token auth is strictly forbidden on admin routes
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      if (isAdminApi) {
        return NextResponse.json(
          {
            data: null,
            error: {
              code: 'FORBIDDEN',
              message: 'Bearer token auth is not accepted on admin endpoints. Cookie session required.',
            },
          },
          { status: 403 }
        );
      }
      return applySecurityHeaders(
        NextResponse.redirect(new URL('/admin/login', request.url))
      );
    }

    // 2. Validate cookie session
    const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!sessionCookie) {
      if (isAdminApi) {
        return NextResponse.json(
          {
            data: null,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Admin session cookie missing or expired',
            },
          },
          { status: 401 }
        );
      }
      return applySecurityHeaders(
        NextResponse.redirect(new URL('/admin/login', request.url))
      );
    }

    try {
      const { payload } = await jwtVerify(sessionCookie, getJwtSecret());
      if (payload.role !== 'ADMIN') {
        if (isAdminApi) {
          return NextResponse.json(
            {
              data: null,
              error: {
                code: 'FORBIDDEN',
                message: 'Admin privileges required',
              },
            },
            { status: 403 }
          );
        }
        return applySecurityHeaders(
          NextResponse.redirect(new URL('/admin/login', request.url))
        );
      }

      // CSRF check on non-GET requests with cookie auth
      if (request.method !== 'GET') {
        const origin = request.headers.get('origin');
        const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        if (origin && origin !== appUrl) {
          return NextResponse.json(
            {
              data: null,
              error: {
                code: 'FORBIDDEN',
                message: 'CSRF check failed: Origin header mismatch',
              },
            },
            { status: 403 }
          );
        }
      }
    } catch {
      if (isAdminApi) {
        return NextResponse.json(
          {
            data: null,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid or expired admin session token',
            },
          },
          { status: 401 }
        );
      }
      return applySecurityHeaders(
        NextResponse.redirect(new URL('/admin/login', request.url))
      );
    }
  }

  const response = NextResponse.next();
  if (isAdminPage) {
    applySecurityHeaders(response);
  }
  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/v1/admin/:path*'],
};
