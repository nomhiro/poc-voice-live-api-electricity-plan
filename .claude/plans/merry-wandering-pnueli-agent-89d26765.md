# Native MCP Integration Implementation Plan

## Overview

This plan describes how to integrate Azure OpenAI Realtime API's native MCP server support into the existing POC application. This approach leverages the `type: "mcp"` tool configuration, allowing Azure to directly manage tool calls with an MCP server.

## Current Architecture

```
┌─────────────┐     WebRTC      ┌──────────────────────┐
│   Browser   │◄───────────────►│  Azure OpenAI        │
│  (page.tsx) │                 │  Realtime API        │
└──────┬──────┘                 └──────────┬───────────┘
       │                                   │
       │ Function call detected            │ type: "function"
       │                                   │
       ▼                                   ▼
┌──────────────────┐           ┌──────────────────────┐
│ /api/functions/* │◄──────────│  Client processes    │
│ (6 endpoints)    │   POST    │  function_call       │
└──────────────────┘           └──────────────────────┘
```

## Target Architecture (Native MCP)

```
┌─────────────┐     WebRTC      ┌──────────────────────┐
│   Browser   │◄───────────────►│  Azure OpenAI        │
│  (page.tsx) │                 │  Realtime API        │
└─────────────┘                 └──────────┬───────────┘
                                           │
                                           │ MCP Protocol
                                           │ (Azure manages)
                                           ▼
                               ┌──────────────────────┐
                               │  MCP Server          │
                               │  /api/mcp            │
                               │  (Streamable HTTP)   │
                               └──────────┬───────────┘
                                          │
                                          ▼
                               ┌──────────────────────┐
                               │  Tool Handlers       │
                               │  (reuse logic from   │
                               │   /api/functions/*)  │
                               └──────────────────────┘
```

## Key Benefits

1. **Simplified Frontend**: No more function call detection/handling in page.tsx
2. **Azure-managed Tool Calls**: Azure handles the MCP protocol automatically
3. **Standardized Protocol**: MCP is becoming an industry standard
4. **Future-proof**: Easy to add new tools or swap MCP server implementations

## Implementation Steps

### Phase 1: Create MCP Server Endpoint

#### 1.1 Add MCP SDK Dependency

Add to `package.json`:
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.10.0"
  }
}
```

#### 1.2 Create MCP Server Route

Create `app/api/mcp/route.ts` implementing the Streamable HTTP transport:

```typescript
// Key components:
// - McpServer from @modelcontextprotocol/sdk/server/mcp.js
// - StreamableHTTPServerTransport from @modelcontextprotocol/sdk/server/streamableHttp.js
// - Define 6 tools matching existing function endpoints
// - Reuse business logic from existing route handlers
```

**Tool definitions to implement:**
| Tool Name | Description |
|-----------|-------------|
| get_customer_info | Customer verification and contract info |
| get_billing_history | Past billing records |
| get_current_usage | Real-time usage (smart meter only) |
| list_available_plans | Available electricity plans |
| simulate_plan_change | Plan change cost simulation |
| submit_plan_change_request | Submit plan change request |

#### 1.3 Extract Shared Business Logic

Create `lib/tools/` directory with extracted business logic:

```
lib/tools/
├── customerInfo.ts      # get_customer_info logic
├── billingHistory.ts    # get_billing_history logic
├── currentUsage.ts      # get_current_usage logic
├── availablePlans.ts    # list_available_plans logic
├── simulatePlanChange.ts # simulate_plan_change logic
├── submitPlanChange.ts  # submit_plan_change_request logic
└── index.ts             # Barrel export
```

This allows both:
- Existing `/api/functions/*` endpoints to continue working
- New MCP server to use the same logic

### Phase 2: Update Session Configuration

#### 2.1 Modify Session Route

Update `app/api/realtime/session/route.ts`:

```typescript
// Before (current)
const baseBody = {
  tools: [
    { type: 'function', name: 'get_customer_info', ... },
    // ... 5 more function tools
  ]
}

// After (native MCP)
const baseBody = {
  tools: [
    {
      type: 'mcp',
      server_label: 'electricity-support',
      server_url: process.env.MCP_SERVER_URL || 'https://your-domain.com/api/mcp',
      authorization: process.env.MCP_AUTH_TOKEN || '',
      require_approval: 'never'
    }
  ]
}
```

#### 2.2 Add Environment Variables

Add to `.env.local.example`:
```
# MCP Server Configuration
MCP_SERVER_URL=https://your-production-domain.com/api/mcp
MCP_AUTH_TOKEN=your-secure-token
```

### Phase 3: Simplify Frontend

#### 3.1 Update page.tsx

Remove or simplify function call handling in `app/realtime/page.tsx`:

```typescript
// Remove:
// - Function call detection logic (isOutputItemDone, functionItems handling)
// - fetch to /api/functions/* endpoints
// - conversation.item.create with function_call_output
// - response.create after function execution

// Keep:
// - WebRTC connection setup
// - Audio streaming
// - Transcript display (simplified - Azure now handles tool results)
```

#### 3.2 Transcript Display Updates

Since Azure manages tool calls, transcripts will include:
- User speech
- Assistant speech
- Tool call/result messages (if configured to show)

No need to manually inject tool input/output into transcripts.

### Phase 4: Authentication & Security

#### 4.1 MCP Server Authentication

Implement token-based authentication in MCP server:

```typescript
// app/api/mcp/route.ts
export async function POST(req: Request) {
  // Verify Authorization header
  const authHeader = req.headers.get('Authorization');
  const expectedToken = process.env.MCP_AUTH_TOKEN;
  
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Process MCP request...
}
```

#### 4.2 CORS Configuration

For development with localhost:
- Configure CORS headers to allow Azure's domain
- Or use ngrok/cloudflare tunnel for public URL

### Phase 5: Development & Testing

#### 5.1 Local Development Setup

**Challenge**: Azure needs to reach your MCP server, but localhost isn't accessible.

**Solutions:**

1. **ngrok tunnel** (recommended for dev):
   ```bash
   ngrok http 3000
   # Use ngrok URL in MCP_SERVER_URL
   ```

2. **Cloudflare Tunnel**:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. **Azure deployment for testing**:
   - Deploy to Azure App Service
   - Use Azure URL for MCP_SERVER_URL

#### 5.2 Testing Strategy

1. **Unit tests**: Test extracted business logic in `lib/tools/`
2. **Integration tests**: Test MCP server endpoint directly
3. **E2E tests**: Full voice conversation flow

### Phase 6: Production Deployment

#### 6.1 Azure Infrastructure Updates

Update `infra/` Bicep templates:
- No new services needed (MCP runs in same App Service)
- Add environment variables for MCP configuration

#### 6.2 Deployment Checklist

- [ ] Set MCP_SERVER_URL to production domain
- [ ] Generate and set secure MCP_AUTH_TOKEN
- [ ] Verify CORS settings if needed
- [ ] Test full conversation flow
- [ ] Monitor for errors in Application Insights

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `app/api/mcp/route.ts` | Streamable HTTP MCP server endpoint |
| `lib/tools/customerInfo.ts` | Extracted get_customer_info logic |
| `lib/tools/billingHistory.ts` | Extracted get_billing_history logic |
| `lib/tools/currentUsage.ts` | Extracted get_current_usage logic |
| `lib/tools/availablePlans.ts` | Extracted list_available_plans logic |
| `lib/tools/simulatePlanChange.ts` | Extracted simulate_plan_change logic |
| `lib/tools/submitPlanChange.ts` | Extracted submit_plan_change_request logic |
| `lib/tools/index.ts` | Barrel export for tools |

### Modified Files

| File | Changes |
|------|---------|
| `package.json` | Add @modelcontextprotocol/sdk dependency |
| `app/api/realtime/session/route.ts` | Change tools from function to MCP type |
| `app/realtime/page.tsx` | Remove function call handling logic |
| `app/api/functions/*/route.ts` | Import from lib/tools (optional refactor) |
| `.env.local.example` | Add MCP environment variables |

### Deprecated/Removed

| File | Status |
|------|--------|
| `app/api/mcp/proxy/route.ts` | Can be removed (replaced by new MCP server) |

## Architecture Decision Records

### ADR-1: MCP Server Hosting (Next.js API Route)

**Decision**: Host MCP server as Next.js API route (`/api/mcp`)

**Rationale**:
- Simplest deployment (single app)
- Reuse existing infrastructure
- Share database connections and utilities
- Easier local development

**Alternatives considered**:
- Standalone Node.js server: More complex deployment, harder to share code
- Azure Functions: Additional infrastructure, cold start concerns for realtime

### ADR-2: Transport Protocol (Streamable HTTP)

**Decision**: Use Streamable HTTP transport (not SSE)

**Rationale**:
- SSE is deprecated in MCP SDK
- Streamable HTTP is the recommended approach
- Better compatibility with serverless/edge environments
- Simpler request-response pattern

### ADR-3: Business Logic Extraction

**Decision**: Extract business logic to shared `lib/tools/` modules

**Rationale**:
- DRY principle: avoid code duplication
- Existing function endpoints continue to work (backward compatibility)
- Easy unit testing of business logic
- Clear separation of concerns

## Risk Assessment

### High Risk

| Risk | Mitigation |
|------|------------|
| Azure MCP support is preview | Keep function tools as fallback option |
| Development testing (localhost) | Use ngrok/tunnel for development |

### Medium Risk

| Risk | Mitigation |
|------|------------|
| MCP SDK breaking changes | Pin SDK version, test before upgrade |
| Authentication complexity | Start simple (token), enhance later |

### Low Risk

| Risk | Mitigation |
|------|------------|
| Performance | MCP adds minimal overhead |
| Learning curve | MCP SDK is well-documented |

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: MCP Server | 2-3 days | None |
| Phase 2: Session Config | 0.5 day | Phase 1 |
| Phase 3: Frontend | 1 day | Phase 2 |
| Phase 4: Auth | 0.5-1 day | Phase 1 |
| Phase 5: Testing | 1-2 days | All phases |
| Phase 6: Deployment | 0.5 day | All phases |

**Total**: ~6-8 days

## Critical Files for Implementation

1. **`app/api/mcp/route.ts`** - New MCP server endpoint (Streamable HTTP transport)
2. **`app/api/realtime/session/route.ts`** - Session configuration to use MCP tools
3. **`app/realtime/page.tsx`** - Frontend simplification (remove function call handling)
4. **`lib/tools/customerInfo.ts`** - Example of extracted business logic
5. **`app/api/functions/get_customer_info/route.ts`** - Pattern reference for existing logic

## References

- [Azure OpenAI Realtime API - MCP Support](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/realtime-audio)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Streamable HTTP Transport](https://mcpcat.io/guides/building-streamablehttp-mcp-server/)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
