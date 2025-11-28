/*
Prototype headless Realtime participant (WebSocket) for Azure OpenAI Realtime sessions.
Assumptions:
- You have a running Next dev server exposing GET /api/realtime/session which returns JSON
  { client_secret: string, realtimeUrl: string }
- realtimeUrl is a WebSocket-compatible join URL returned by Azure Realtime sessions API.
- The Realtime service emits messages that include tool_call events in a JSON message with
  a `type` or `event` indicating a tool call. This script is heuristic and logs messages.

What it does:
1. GET the session info from local Next endpoint.
2. Connect to the returned realtimeUrl via WebSocket, using the client_secret as an Authorization bearer token if required.
3. Listen for messages; when a tool_call is detected, POST the arguments to local /api/functions/{name}
4. Send a message back to the Realtime socket with role 'tool' containing the result, referencing the tool_call id.

Note: Azure Realtime WebSocket protocol shapes may differ; adapt parsing and send formats accordingly.
*/

const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const WebSocket = require('ws');

async function getSessionInfo() {
  const res = await fetch('http://localhost:3000/api/realtime/session');
  if (!res.ok) throw new Error(`Failed to get session: ${res.status} ${await res.text()}`);
  return res.json();
}

function isToolCallMessage(msg) {
  // Heuristic: message.event === 'tool_call' or msg.type === 'tool_call' or contains tool_call property
  if (!msg || typeof msg !== 'object') return false
  // Also accept Azure realtime item shape: { item: { type: 'function_call', name, call_id, arguments } } or top-level item
  const hasAzureFunctionCall = Boolean((msg.item && msg.item.type === 'function_call') || (Array.isArray(msg.output) && msg.output.some(o => o?.type === 'function_call')) || msg.type === 'function_call')
  return msg.event === 'tool_call' || msg.type === 'tool_call' || Boolean(msg.tool_call) || Boolean(msg.toolCall) || hasAzureFunctionCall
}

async function callLocalFunction(name, args) {
  try {
    const url = `http://localhost:3000/api/functions/${name}`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
    const text = await res.text()
    try { return JSON.parse(text) } catch { return { raw: text } }
  } catch (e) {
    return { error: String(e) }
  }
}

async function main() {
  console.log('Fetching session info from local endpoint...')
  const session = await getSessionInfo()
  console.log('Session:', session)

  const realtimeUrl = session.realtimeUrl || session.raw?.sessionUrl || session.raw?.joinUrl
  const clientSecret = session.client_secret || session.raw?.client_secret?.value || session.raw?.client_secret_value
  if (!realtimeUrl) throw new Error('No realtimeUrl found in session response')

  console.log('Connecting to realtime URL via WebSocket...')
  const wsHeaders = {}
  if (clientSecret) wsHeaders['Authorization'] = `Bearer ${clientSecret}`

  const ws = new WebSocket(realtimeUrl, { headers: wsHeaders })

  ws.on('open', () => {
    console.log('WebSocket connected')
  })

  ws.on('message', async (data) => {
    let parsed
    try {
      parsed = JSON.parse(data.toString())
    } catch (e) {
      console.log('Non-JSON message:', data.toString())
      return
    }
    console.log('WS message:', JSON.stringify(parsed, null, 2))

    if (isToolCallMessage(parsed)) {
      // Extract tool call info, supporting several shapes including Azure realtime items
      let tc = null
      if (parsed.tool_call || parsed.toolCall) tc = parsed.tool_call || parsed.toolCall
      else if (parsed.item && parsed.item.type === 'function_call') tc = parsed.item
      else if (Array.isArray(parsed.output)) tc = parsed.output.find(o => o?.type === 'function_call') || parsed
      else tc = parsed

      const callId = tc.id || tc.tool_call_id || tc.toolCallId || tc.call_id || tc.callId || null
      const name = tc.name || tc.tool || (tc.function && tc.function.name) || (tc.item && tc.item.name)
      let argumentsObj = {}
      const rawArgs = tc.arguments || tc.args || tc.parameters || tc.arguments_json || tc.argumentsText || ''
      if (typeof rawArgs === 'string' && rawArgs.trim()) {
        try { argumentsObj = JSON.parse(rawArgs) } catch (_) { argumentsObj = { raw: rawArgs } }
      } else if (typeof rawArgs === 'object') {
        argumentsObj = rawArgs
      }

      console.log('Detected tool_call ->', { callId, name, argumentsObj })
      if (!name) {
        console.warn('tool_call missing name; skipping')
        return
      }

      const result = await callLocalFunction(name, argumentsObj)
      console.log('Local function result:', result)

      // Construct a reply message. Azure-specific format may require different envelope.
      // Construct a reply message that mirrors Azure Realtime function result envelope.
      // Note: Azure may expect a 'response' or 'tool_result' style event; this is a best-effort prototype.
      const toolMessage = {
        event: 'tool_result',
        data: {
          object: 'realtime.tool_result',
          tool_call_id: callId,
          name,
          result: result
        }
      }

      try {
        ws.send(JSON.stringify(toolMessage))
        console.log('Sent tool_result back to realtime')
      } catch (e) {
        console.error('Failed to send tool_result:', e)
      }
    }
  })

  ws.on('close', (code, reason) => console.log('WebSocket closed', code, reason && reason.toString()))
  ws.on('error', (err) => console.error('WebSocket error', err))
}

main().catch(err => { console.error('Headless participant error:', err); process.exit(1) })
