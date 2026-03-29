import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    
    const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

    // อนุญาตทุก route ชั่วคราว - จะใช้ client-side auth check แทน
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};