# Suggested Commands

## Development Commands
- `npm install` - Install dependencies
- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Testing Commands
No specific test commands are configured in package.json.

## Environment Setup
Required environment variables (set in `.env.local`):
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint (e.g., https://<resource>.openai.azure.com)
- `AZURE_OPENAI_API_KEY` - Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT` - Optional deployment name (defaults to 'gpt-realtime')

Optional Cosmos DB variables:
- `COSMOS_ENDPOINT` - Cosmos DB endpoint
- `COSMOS_KEY` - Cosmos DB key
- `COSMOS_DB` - Database name (default: 'rentacar-db')
- `COSMOS_LOCATIONS_CONTAINER` - Container name (default: 'locations')

Client-side environment variables:
- `NEXT_PUBLIC_AZURE_OPENAI_REGION` - Azure region for realtime API (e.g., 'eastus2')
- `NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT` - Deployment name for client-side use

## Key URLs
- Main page: http://localhost:3000
- Realtime demo: http://localhost:3000/realtime
- Session API: http://localhost:3000/api/realtime/session