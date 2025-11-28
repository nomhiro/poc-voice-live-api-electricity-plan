/*
Simple headless participant (REST-based) that demonstrates automated function-calling
pipeline using Azure/OpenAI "tools" flow. This script does NOT attach to the
Realtime WebSocket; instead it drives the function-calling flow via the
chat completions REST API and the local `/api/functions/*` endpoints.

Why: Realtime websocket protocol details vary; implementing a robust WS
participant requires protocol-specific wiring. This REST-based script
implements server-side automation (model calls -> local function execution -> model final response)
which achieves the same end result: server executes tools when model requests them.

Usage (dev):
  set the following env vars in your shell or .env.local:
    AZURE_OPENAI_ENDPOINT (e.g. https://<name>.openai.azure.com)
    AZURE_OPENAI_API_KEY
    AZURE_OPENAI_DEPLOYMENT (deployment name)
    LOCAL_ORIGIN (optional, default http://localhost:3000)

  node scripts/headless_participant.js

Notes:
- This is a minimal example for PoC and dev. For production: add retries, auth,
  validation, logging, secrets in KeyVault, and proper error handling.
*/

const DEFAULT_ORIGIN = process.env.LOCAL_ORIGIN || 'http://localhost:3000'
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT
const AZURE_KEY = process.env.AZURE_OPENAI_API_KEY
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-realtime'

if (!AZURE_ENDPOINT || !AZURE_KEY) {
  console.error('Missing AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY')
  process.exit(1)
}

// Tools definition must match the server's session `tools`.
const tools = [
  {
    type: 'function',
    function: {
      name: 'list_locations',
      description: 'Return list of rental locations (id, name, address, phone)',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_availability',
      description: 'Get available vehicles for a location and date range',
      parameters: {
        type: 'object',
        properties: {
          locationId: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          vehicleType: { type: 'string' }
        },
        required: ['locationId', 'startDate', 'endDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_reservation',
      description: 'Create a reservation in the rent-a-car system',
      parameters: {
        type: 'object',
        properties: {
          locationId: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          customerName: { type: 'string' },
          customerContact: { type: 'object' },
          vehicleType: { type: 'string' },
          vehicleId: { type: 'string' }
        },
        required: ['locationId', 'startDate', 'endDate', 'customerName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_reservation_status',
      description: 'Get reservations by customer name',
      parameters: {
        type: 'object',
        properties: { customerName: { type: 'string' } },
        required: ['customerName']
      }
    }
  }
]

async function azureChatCreate(messages) {
  const url = AZURE_ENDPOINT.replace(/\/+$/, '') + '/openai/deployments/' + encodeURIComponent(DEPLOYMENT) + '/chat/completions?api-version=2025-02-01-preview'
  const body = {
    model: DEPLOYMENT,
    messages,
    tools,
    tool_choice: 'auto'
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': AZURE_KEY
    },
    body: JSON.stringify(body)
  })

  if (!resp.ok) {
    const t = await resp.text()
    throw new Error(`Azure chat create failed: ${resp.status} ${t}`)
  }

  return resp.json()
}

async function callLocalFunction(name, args) {
  const url = `${DEFAULT_ORIGIN}/api/functions/${encodeURIComponent(name)}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  })
  const text = await resp.text()
  try { return JSON.parse(text) } catch(e) { return { body: text } }
}

async function runConversation(userPrompt) {
  const messages = [{ role: 'user', content: userPrompt }]

  // First call: ask model and let it choose to call tools
  const initial = await azureChatCreate(messages)
  const responseMessage = initial.choices?.[0]?.message
  console.log('Model response (raw):', JSON.stringify(responseMessage, null, 2))

  // Check for tool calls in the model message
  const toolCalls = responseMessage?.tool_calls || []
  if (!toolCalls.length) {
    console.log('No tool calls; final content:', responseMessage?.content)
    return responseMessage?.content
  }

  // Execute each tool_call and append a tool message with the result
  for (const tc of toolCalls) {
    const funcName = tc?.function?.name || tc?.function_name || tc?.name
    let args = {}
    try { args = JSON.parse(tc.function.arguments) } catch(e) { args = tc.function.arguments || {} }
    console.log('Executing tool:', funcName, 'args:', args)

    let result
    try {
      result = await callLocalFunction(funcName, args)
    } catch (e) {
      result = { error: String(e) }
    }

    // Add the tool result message into the conversation
    messages.push({
      tool_call_id: tc.id,
      role: 'tool',
      name: funcName,
      content: typeof result === 'string' ? result : JSON.stringify(result)
    })
  }

  // Finalize: ask model to produce final response including tool outputs
  const finalResp = await azureChatCreate(messages)
  const finalMessage = finalResp.choices?.[0]?.message
  console.log('Final model message:', JSON.stringify(finalMessage, null, 2))
  return finalMessage?.content
}

// Simple REPL loop for testing
async function repl() {
  const readline = require('readline')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  for await (const line of rl) {
    const input = line.trim()
    if (!input) continue
    try {
      const out = await runConversation(input)
      console.log('\n=== Assistant Final ===\n', out, '\n')
    } catch (e) {
      console.error('Conversation failed:', e)
    }
  }
}

repl().catch(e => { console.error(e); process.exit(1) })
