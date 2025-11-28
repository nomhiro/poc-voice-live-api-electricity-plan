import { NextResponse } from 'next/server'

// Local MCP proxy for testing model 'tools/call' behavior.
// Accepts POST payloads in either of these shapes:
// 1) { method: 'tools/call', params: { name, arguments } }
// 2) { name: 'create_reservation', arguments: { ... } }
// Forwards the inner arguments to /api/functions/{name} and returns the response.

const DEFAULT_ORIGIN = process.env.LOCAL_ORIGIN || 'http://localhost:3000'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    let name: string | undefined
    let args: any = {}

    if (body && typeof body === 'object') {
      if (body.method === 'tools/call' && body.params && typeof body.params === 'object') {
        name = body.params.name
        args = body.params.arguments || {}
      } else if (body.name) {
        name = body.name
        args = body.arguments || {}
      }
    }

    if (!name) return NextResponse.json({ error: 'Missing tool name' }, { status: 400 })

    const origin = DEFAULT_ORIGIN
    const url = `${origin}/api/functions/${encodeURIComponent(name)}`

    let resp: Response
    try {
      resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    })
    } catch (innerErr: any) {
      return NextResponse.json({ error: innerErr?.message || String(innerErr), stack: innerErr?.stack }, { status: 502 })
    }

    const text = await resp.text()
    try {
      const json = JSON.parse(text)
      return NextResponse.json({ status: resp.status, body: json }, { status: resp.status })
    } catch (_) {
      return NextResponse.json({ status: resp.status, body: text }, { status: resp.status })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e), stack: e?.stack }, { status: 500 })
  }
}
