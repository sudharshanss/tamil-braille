import { NextRequest, NextResponse } from 'next/server';

// Simple Google TTS proxy using public translate endpoint
// Note: This uses an unofficial endpoint suitable for prototypes

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = (searchParams.get('text') || '').toString();
    const lang = (searchParams.get('lang') || 'ta').toString();

    if (!text.trim()) {
      return new NextResponse('Missing text', { status: 400 });
    }

    // Google TTS has a length limit per request; keep it short
    const q = text.slice(0, 200);

    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(q)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;

    const resp = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!resp.ok) {
      const body = await resp.text();
      return new NextResponse(`TTS upstream error: ${body}`, { status: 500 });
    }

    const arrayBuffer = await resp.arrayBuffer();
    return new NextResponse(Buffer.from(arrayBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new NextResponse(`TTS error: ${msg}`, { status: 500 });
  }
}


