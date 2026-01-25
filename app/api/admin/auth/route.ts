import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Admin authentication endpoint
 *
 * POST: Login - validates password, sets httpOnly cookie
 * DELETE: Logout - clears the cookie
 *
 * Environment variable (server-side only):
 * - ADMIN_V2_PASSWORD_HASH: Expected password hash
 *
 * To generate a hash, run in Node:
 *   node -e "let h=0;for(const c of 'your-password'){h=(h<<5)-h+c.charCodeAt(0);h=h&h;}console.log(h.toString(16))"
 */

const EXPECTED_HASH = process.env.ADMIN_V2_PASSWORD_HASH;
const COOKIE_NAME = 'monarch_admin_session';

function hashPassword(password: string): string {
  let hash = 0;
  for (const char of password) {
    const charCode = char.charCodeAt(0);
    hash = (hash << 5) - hash + charCode;
    hash &= hash;
  }
  return hash.toString(16);
}

export async function POST(request: NextRequest) {
  if (!EXPECTED_HASH) {
    return NextResponse.json({ error: 'Authentication not configured' }, { status: 500 });
  }

  try {
    const { password } = await request.json();

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }

    const hash = hashPassword(password);

    if (hash !== EXPECTED_HASH) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Set httpOnly cookie - client can't read this via JS
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, hash, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/admin',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ success: true });
}

export async function GET() {
  // Check if user is authenticated
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);

  if (!session?.value || session.value !== EXPECTED_HASH) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({ authenticated: true });
}
