# Code Style and Conventions

## TypeScript Configuration
- Strict mode enabled
- ES2020 target
- No JavaScript files allowed (`allowJs: false`)
- Force consistent casing in file names
- Incremental compilation enabled

## Code Style
- **Language**: TypeScript throughout (no JavaScript)
- **React**: Functional components with hooks
- **API Routes**: Next.js 13+ app router pattern
- **Error Handling**: Try-catch with graceful fallbacks
- **Environment Variables**: Prefixed appropriately (`AZURE_`, `COSMOS_`, `NEXT_PUBLIC_`)

## File Naming Conventions
- API routes: `route.ts` in named directories
- Pages: `page.tsx`
- Components: PascalCase
- Utilities: camelCase

## Patterns Used
1. **Singleton Pattern**: Cosmos DB client
2. **Fallback Pattern**: Sample data when external services unavailable
3. **Environment Configuration**: Multiple deployment targets
4. **Error Boundaries**: Graceful error handling with user-friendly messages

## Dependencies Philosophy
- Minimal dependencies approach
- Official Azure SDKs where needed
- Built-in browser APIs (WebRTC, Web Audio)
- Next.js built-in features preferred

## Function Call Pattern
Functions callable by AI follow REST conventions:
- Accept POST requests with JSON bodies
- Return JSON responses
- Include error handling with status codes
- Support both GET and POST for flexibility