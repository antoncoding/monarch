import { NextResponse } from 'next/server';

const GIST_URL = process.env.BROWSE_BLACKLIST_GIST_URL;

export async function GET() {
  // Return empty array if not configured
  if (!GIST_URL) {
    return NextResponse.json([]);
  }

  try {
    const response = await fetch(GIST_URL, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error('[Browse Blacklist] Failed to fetch:', response.status);
      return NextResponse.json([]);
    }

    const text = await response.text();
    const keys = text
      .split('\n')
      .map((line) => line.split(" ")[0].trim().toLowerCase())
      .filter((line) => line.length > 0 && !line.startsWith('#'));

    return NextResponse.json(keys);
  } catch (error) {
    console.error('[Browse Blacklist] Error fetching blacklist:', error);
    return NextResponse.json([]);
  }
}
