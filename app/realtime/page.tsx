"use client"

import { useEffect, useRef, useState } from 'react'

/**
 * Realtime Audio Page (WebRTC) - MCP Server Version
 *
 * This version uses Azure Functions MCP Server for tool execution.
 * Azure OpenAI Realtime API connects directly to the MCP server,
 * so no function call handling is needed in the frontend.
 */
export default function RealtimePage() {
  const [status, setStatus] = useState('idle')
  // transcripts include speaker: 'user' | 'assistant', and partial flag
  const [transcripts, setTranscripts] = useState<Array<{id:string, speaker:'user'|'assistant', text:string, partial?:boolean}>>([])
  // Admin panel state
  const [seedStatus, setSeedStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [seedMessage, setSeedMessage] = useState('')

  // Data initialization function
  async function handleSeedData() {
    if (!window.confirm('すべてのデータを削除して初期データを登録します。よろしいですか？')) {
      return
    }
    setSeedStatus('loading')
    setSeedMessage('データ初期化中...')
    try {
      const res = await fetch('/api/admin/seed-electricity-data', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        setSeedStatus('success')
        setSeedMessage(`✓ ${data.message} (顧客: ${data.details?.customers ?? 0}, プラン: ${data.details?.plans ?? 0})`)
      } else {
        setSeedStatus('error')
        setSeedMessage(`✗ エラー: ${data.error || '不明なエラー'}`)
      }
    } catch (e: unknown) {
      setSeedStatus('error')
      setSeedMessage(`✗ エラー: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const chatContainerRef = useRef<HTMLDivElement | null>(null)

  // autoscroll to bottom when transcripts update
  useEffect(() => {
    const el = chatContainerRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [transcripts])

  // Upsert transcript helper: update matching partial by id, otherwise append.
  function upsertTranscript(speaker: 'user' | 'assistant', id: string, text: string, isFinal: boolean) {
    setTranscripts(prev => {
      const strId = String(id)
      // Find the last index with same speaker and same id
      for (let i = prev.length - 1; i >= 0; --i) {
        if (prev[i].speaker === speaker && String(prev[i].id) === strId) {
          // If existing entry is partial, update it
          if (prev[i].partial) {
            const copy = [...prev]
            copy[i] = { ...copy[i], text, partial: !isFinal }
            return copy
          }
          // If existing entry is final, append new message instead
          break
        }
      }
      // Not found matching partial -> append new
      return [...prev, { id: strId, speaker, text, partial: !isFinal }]
    })
  }

  // Process incoming data channel messages (transcripts only, no function calls)
  function handleDataChannelMessage(payload: Record<string, unknown>) {
    // Prefer explicit transcripts in payload.content if available
    let text: string | null = extractTranscriptFromPayload(payload) || extractTextFromEvent(payload)

    // Sanitize: if extracted text looks like an event name or a single token, ignore it
    const maybeName = payload?.name || payload?.type || payload?.event || payload?.topic || null
    if (text && typeof text === 'string') {
      const trimmed = text.trim()
      if (typeof maybeName === 'string' && trimmed === maybeName.trim()) text = null
      else if (typeof payload?.type === 'string' && trimmed === payload.type) text = null
      else if (/^[\w.-]+$/.test(trimmed)) text = null
    }

    const name = payload?.name || payload?.type || payload?.event || payload?.topic || null
    const isUserDelta = typeof name === 'string' && /conversation\.item\.(?:input_)?audio_transcription\.delta/i.test(name)
    const isUserCompleted = typeof name === 'string' && /conversation\.item\.(?:input_)?audio_transcription\.completed/i.test(name)
    const isResponseDone = typeof name === 'string' && /response\.done|response\.output_item\.done|response\.content_part|response\.content_part\.done/i.test(name)

    // Handle response.done - extract transcripts from content array
    if (isResponseDone) {
      const contents = Array.isArray(payload?.content) ? payload.content : []
      const joined = (contents as Array<Record<string, unknown>>)
        .map((c) => (typeof c?.transcript === 'string' ? c.transcript : extractTextFromEvent(c) || ''))
        .filter(Boolean)
        .join('\n')
      if (joined) {
        setTranscripts(prev => [...prev, { id: 'assistant-done-' + String(Date.now()), speaker: 'assistant', text: joined, partial: false }])
      }
      return
    }

    // Handle user transcription events
    if (isUserDelta || isUserCompleted) {
      const itemId = (payload?.item_id || payload?.id || `user-${Date.now()}`) as string
      const userText = extractTextFromEvent(payload) || ''
      if (userText) {
        const isFinal = isUserCompleted || (!!payload?.is_final) || (!!payload?.final)
        upsertTranscript('user', String(itemId), userText, isFinal)
      }
      return
    }

    // Handle other transcript events
    const speaker: 'user' | 'assistant' = 'assistant'
    if (text) {
      const isFinal = (!!payload?.is_final) || (!!payload?.final) || (!!payload?.committed)
      const id = payload?.transcript_id || payload?.id || (speaker + '-' + String(payload?.sequence || Date.now()))
      upsertTranscript(speaker, String(id), text, isFinal)
    }
  }

  async function start() {
    setStatus('getting-mic')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    localStreamRef.current = stream

    setStatus('creating-pc')
    const pc = new RTCPeerConnection()
    pcRef.current = pc

    // Add local audio track
    for (const track of stream.getAudioTracks()) pc.addTrack(track, stream)

    // Create data channel for receiving events (transcripts)
    try {
      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      dc.onopen = () => console.log('data channel open')
      dc.onclose = () => console.log('data channel closed')
      dc.onerror = (ev) => console.error('data channel error', ev)
      dc.onmessage = (ev) => {
        let payload: Record<string, unknown> = {}
        try {
          const parsed = JSON.parse(ev.data)
          if (Array.isArray(parsed)) {
            payload = parsed.find((p: Record<string, unknown>) => p && (p.content || p.transcript || p.name || p.type)) || parsed[0] || {}
          } else {
            payload = parsed
          }
        } catch (_) {
          payload = { text: String(ev.data) }
        }
        handleDataChannelMessage(payload)
      }
    } catch (e) {
      console.warn('createDataChannel failed', e)
    }

    // Handle remote track (playback)
    pc.ontrack = (ev) => {
      const remoteStream = ev.streams && ev.streams[0]
      if (remoteStream) {
        const audioEl = document.getElementById('remote-audio') as HTMLAudioElement
        if (audioEl) {
          audioEl.srcObject = remoteStream
          audioEl.play().catch(() => {})
        }
      }
    }

    // In case the server opens a data channel to us
    pc.ondatachannel = (e) => {
      const channel = e.channel
      channel.onmessage = (ev) => {
        let payload: Record<string, unknown> = {}
        try {
          const parsed = JSON.parse(ev.data)
          payload = Array.isArray(parsed)
            ? (parsed.find((p: Record<string, unknown>) => p && (p.content || p.transcript || p.name || p.type)) || parsed[0] || {})
            : parsed
        } catch (_) {
          payload = { text: String(ev.data) }
        }
        handleDataChannelMessage(payload)
      }
    }

    setStatus('fetching-session')
    const res = await fetch('/api/realtime/session')
    if (!res.ok) {
      setStatus('session-failed')
      return
    }
    const session = await res.json()
    const ephemeralKey = session?.client_secret
    const candidateRealtimeUrl = session?.realtimeUrl || null
    if (!ephemeralKey) {
      console.error('No ephemeral client_secret returned from server', session)
      setStatus('no-ephemeral')
      return
    }

    setStatus('creating-offer')
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    // Determine target realtime endpoint
    const region = process.env.NEXT_PUBLIC_AZURE_OPENAI_REGION || undefined
    let targetUrl = candidateRealtimeUrl
    if (!targetUrl) {
      if (!region) {
        console.error('No realtimeUrl from server and NEXT_PUBLIC_AZURE_OPENAI_REGION not set')
        setStatus('no-target')
        return
      }
      const deployment = session?.raw?.deployment || session?.raw?.model || process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT
      if (!deployment) {
        console.error('No deployment/model found for realtime URL construction', session)
        setStatus('no-deployment')
        return
      }
      targetUrl = `https://${region}.realtimeapi-preview.ai.azure.com/v1/realtimertc?model=${encodeURIComponent(deployment)}`
    }

    const sdpResp = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        'Authorization': `Bearer ${ephemeralKey}`
      },
      body: offer.sdp
    })

    if (!sdpResp.ok) {
      setStatus('sdp-failed')
      return
    }
    const answerSdp = await sdpResp.text()
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

    setStatus('connected')
  }

  function stop() {
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    setStatus('stopped')
  }

  return (
    <div style={{padding: 20}}>
      {/* Admin Panel */}
      <div style={{marginBottom: 20, padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <button
            onClick={handleSeedData}
            disabled={seedStatus === 'loading'}
            style={{
              padding: '8px 16px',
              background: seedStatus === 'loading' ? '#94a3b8' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: seedStatus === 'loading' ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500
            }}
          >
            {seedStatus === 'loading' ? '初期化中...' : '🔄 データ初期化'}
          </button>
          {seedMessage && (
            <span style={{
              fontSize: 13,
              color: seedStatus === 'success' ? '#16a34a' : seedStatus === 'error' ? '#dc2626' : '#64748b'
            }}>
              {seedMessage}
            </span>
          )}
        </div>
      </div>

      <h2>Realtime audio (WebRTC) — MCP Server POC</h2>
      <p>Status: {status}</p>
      <div>
        <button onClick={start} disabled={status === 'connected' || status === 'creating-pc'}>Start</button>
        <button onClick={stop}>Stop</button>
      </div>
      <audio id="remote-audio" autoPlay controls style={{marginTop: 12}} />
      <div style={{marginTop: 12}}>
        <small>Note: Tools are handled by MCP Server. Azure OpenAI connects directly to the MCP server.</small>
      </div>
      <div style={{marginTop:12}}>
        <h4>Chat (Realtime)</h4>
        <div ref={chatContainerRef} style={{border:'1px solid #ddd', padding:8, height:320, overflow:'auto', background:'#ffffff', display:'flex', flexDirection:'column', gap:8}}>
          {transcripts.length === 0 ? (
            <div style={{color:'#666', textAlign:'center', padding:12}}>No speech yet</div>
          ) : null}
          {transcripts.map(t => (
            <div key={t.id} style={{display:'flex', justifyContent: t.speaker === 'user' ? 'flex-end' : 'flex-start'}}>
              <div style={{
                maxWidth:'75%',
                padding:'10px 12px',
                borderRadius:12,
                background: t.speaker === 'user' ? '#0b86ff' : '#f1f5f9',
                color: t.speaker === 'user' ? '#fff' : '#111',
                boxShadow:'0 1px 2px rgba(0,0,0,0.04)'
              }}>
                <div style={{fontSize:12, marginBottom:6, opacity:0.8}}>
                  {t.speaker === 'user' ? 'You' : 'Assistant'}
                </div>
                <div style={{whiteSpace:'pre-wrap'}}>{t.text}</div>
                {t.partial ? <div style={{fontSize:11, opacity:0.7, marginTop:6}}>(partial)</div> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Best-effort extraction of text from incoming data channel event payloads.
function extractTextFromEvent(obj: unknown): string | null {
  if (!obj) return null
  if (typeof obj === 'string') return obj
  if (typeof obj !== 'object') return null

  const record = obj as Record<string, unknown>
  if (record.text && typeof record.text === 'string') return record.text
  if (record.transcript && typeof record.transcript === 'string') return record.transcript
  if (record.payload) return extractTextFromEvent(record.payload)
  if (record.message) return extractTextFromEvent(record.message)

  // Try to find any string deeply
  try {
    const stack: unknown[] = [obj]
    while (stack.length) {
      const cur = stack.pop()
      if (!cur) continue
      if (typeof cur === 'string') return cur
      if (Array.isArray(cur)) {
        for (const v of cur) stack.push(v)
      } else if (typeof cur === 'object') {
        for (const k of Object.keys(cur)) {
          const v = (cur as Record<string, unknown>)[k]
          if (typeof v === 'string') return v
          if (typeof v === 'object') stack.push(v)
        }
      }
    }
  } catch (_) {}
  return null
}

// Prefer transcripts from payload.content[*].transcript when present.
function extractTranscriptFromPayload(payload: Record<string, unknown>): string | null {
  if (!payload) return null
  try {
    if (Array.isArray(payload.content) && payload.content.length > 0) {
      const pieces = payload.content.map((item: unknown) => {
        if (!item) return ''
        const record = item as Record<string, unknown>
        if (typeof record.transcript === 'string' && record.transcript.trim()) return record.transcript.trim()
        if (record.payload) return extractTextFromEvent(record.payload) || ''
        if (record.message) return extractTextFromEvent(record.message) || ''
        return extractTextFromEvent(item) || ''
      }).filter(Boolean)
      if (pieces.length) return pieces.join('\n')
    }

    if (typeof payload.transcript === 'string' && payload.transcript.trim()) return payload.transcript.trim()
    if (payload.content && typeof payload.content === 'string' && payload.content.trim()) return payload.content.trim()
  } catch (_) {}
  return null
}
