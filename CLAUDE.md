# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js TypeScript POC application that demonstrates WebRTC-based voice communication with Azure OpenAI Realtime API. It implements an **electricity company customer support system** where users can interact with an AI agent through voice to manage their electricity contracts, check billing history, and change plans.

## Development Commands

### Next.js App
- `npm install` - Install dependencies
- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### MCP Server
- `cd mcp-server && npm install` - Install MCP server dependencies
- `cd mcp-server && npm run build` - Build MCP server
- `cd mcp-server && npm start` - Start MCP server (http://localhost:7071)

### Local Development with ngrok
For Azure OpenAI to connect to local MCP server:
1. Start MCP server: `cd mcp-server && npm start`
2. Expose via ngrok: `ngrok http 7071`
3. Set `MCP_SERVER_URL` in `.env.local` to ngrok URL + `/runtime/webhooks/mcp`

## Architecture

The application uses an MCP (Model Context Protocol) server architecture:

### Next.js Frontend (`app/`)
- `app/api/realtime/session/` - Creates Azure OpenAI Realtime sessions with MCP configuration
- `app/realtime/` - Frontend voice interface using WebRTC for real-time audio

### MCP Server (`mcp-server/`)
Azure Functions-based MCP server that provides tools to Azure OpenAI:
- `get_customer_info` - Customer verification and contract info
- `get_billing_history` - Past billing records
- `get_current_usage` - Real-time usage (smart meter only)
- `list_available_plans` - Available electricity plans
- `simulate_plan_change` - Plan change cost simulation
- `submit_plan_change_request` - Submit plan change request

### Key Data Flow
1. Client requests session → Server creates Azure Realtime session with MCP config
2. WebRTC connection established between browser and Azure
3. Azure OpenAI connects directly to MCP server for tool discovery (`tools/list`)
4. AI agent processes voice → Azure calls MCP tools (`tools/call`) → Returns responses
5. MCP server queries Cosmos DB (or uses sample data)

## Environment Variables

Required (set in `.env.local`):
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI resource endpoint
- `AZURE_OPENAI_API_KEY` - API key

Optional:
- `AZURE_OPENAI_DEPLOYMENT` - Model deployment name (defaults to 'gpt-realtime')
- `MCP_SERVER_URL` - MCP server URL (defaults to 'http://localhost:7071/runtime/webhooks/mcp')
- `COSMOS_ENDPOINT`, `COSMOS_KEY` - Cosmos DB configuration
- `COSMOS_DB` - Database name (defaults to 'electricity-support-db')
- `COSMOS_CUSTOMERS_CONTAINER` - Customers container (defaults to 'customers')
- `COSMOS_BILLINGS_CONTAINER` - Billings container (defaults to 'billings')
- `COSMOS_USAGES_CONTAINER` - Usages container (defaults to 'usages')
- `COSMOS_PLANS_CONTAINER` - Plans container (defaults to 'plans')
- `COSMOS_PLAN_CHANGES_CONTAINER` - Plan changes container (defaults to 'plan_change_requests')
- `NEXT_PUBLIC_AZURE_OPENAI_REGION` - Azure region for client-side WebRTC

## Cosmos DB Schema

### Containers
| Container | Partition Key | Purpose |
|-----------|---------------|---------|
| customers | /customerId | Customer and contract info |
| billings | /customerId | Monthly billing history |
| usages | /customerId | Current month usage |
| plans | /planType | Electricity plan master |
| plan_change_requests | /customerId | Plan change requests |

### Sample Data
- 3 customers: 野村宏樹 (C-001), 佐藤花子 (C-002), 鈴木一郎 (C-003)
- 4 plans: 従量電灯B, スマートエコプラン, グリーンプラスプラン, ファミリーバリュープラン
- 6 months of billing history per customer

## Technology Stack

- **Frontend**: React 18.2 with TypeScript, WebRTC APIs
- **Backend**: Next.js API routes + Azure Functions MCP server
- **Database**: Azure Cosmos DB (optional, falls back to sample data)
- **AI**: Azure OpenAI Realtime API with native MCP support
- **Audio**: WebRTC peer connections, data channels for events
- **MCP**: Model Context Protocol via Azure Functions Extension
- **Infrastructure**: Azure Bicep templates in `infra/`

## Code Conventions

- Strict TypeScript mode, no JavaScript files
- Functional React components with hooks
- Environment-based configuration with graceful fallbacks
- Error handling with user-friendly messages and appropriate HTTP status codes
- Japanese language for AI interactions and user-facing messages

## Testing and Quality

When completing tasks:
1. Run `npm run lint` to check for issues
2. Test both development (`npm run dev`) and production builds (`npm run build`)
3. Manually test voice functionality at `/realtime`
4. Verify API endpoints work with and without Cosmos DB configuration
5. Test sample data fallback when Cosmos DB is not configured

## Key URLs

- Main application: http://localhost:3000
- Voice demo: http://localhost:3000/realtime
- Session API: http://localhost:3000/api/realtime/session
- Seed data: POST http://localhost:3000/api/admin/seed-electricity-data
- MCP Server: http://localhost:7071/runtime/webhooks/mcp
