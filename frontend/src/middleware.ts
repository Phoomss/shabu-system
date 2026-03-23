import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get('accessToken')?.value
        ?? request.headers.get('authorization')?.split(' ')[1];

    const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

    if (!isPublic && !token) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isPublic && token) {
        return NextResponse.redirect(new URL('/pos', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};