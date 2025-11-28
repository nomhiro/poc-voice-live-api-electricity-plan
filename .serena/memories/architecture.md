# Architecture Overview

## Directory Structure
```
app/
├── api/
│   ├── functions/           # AI-callable function endpoints
│   │   ├── get_customer_info/
│   │   ├── get_billing_history/
│   │   ├── get_current_usage/
│   │   ├── list_available_plans/
│   │   ├── simulate_plan_change/
│   │   └── submit_plan_change_request/
│   ├── hello/              # Sample API endpoint
│   ├── mcp/proxy/          # MCP proxy endpoint
│   └── realtime/session/   # Azure Realtime session creation
├── realtime/               # Realtime voice demo page
├── layout.tsx              # Root layout
└── page.tsx                # Home page

lib/
└── cosmosClient.ts         # Cosmos DB client utility

scripts/                    # Build/utility scripts
.vscode/mcp.json           # MCP server configuration
```

## Key Components

### 1. Azure Realtime Integration (`app/api/realtime/session/route.ts`)
- Creates Azure OpenAI Realtime sessions
- Configures AI agent instructions and tools for electricity support
- Handles authentication and endpoint validation
- Returns session data for WebRTC connection

### 2. Frontend Voice Interface (`app/realtime/page.tsx`)
- WebRTC peer connection management
- Real-time audio streaming
- Data channel handling for AI events
- Function call execution and response handling
- Transcript display (assistant only)

### 3. Function Endpoints (`app/api/functions/`)
- RESTful endpoints callable by AI agent
- Cosmos DB integration with fallback sample data
- Electricity company business logic (customer info, billing, plans)

### 4. Database Layer (`lib/cosmosClient.ts`)
- Cosmos DB client singleton
- Environment-based configuration
- Graceful fallback when not configured

## Data Flow
1. User speaks → WebRTC → Azure Realtime API
2. AI processes speech → Function calls → Local API endpoints
3. API endpoints → Cosmos DB (or sample data) → Response
4. Response → AI → Speech synthesis → WebRTC → User audio
5. Transcripts displayed in UI via data channel events

## Environment Configuration
- Production: Azure-hosted with Cosmos DB
- Development: Local with sample data fallback
- Configurable endpoints and deployments