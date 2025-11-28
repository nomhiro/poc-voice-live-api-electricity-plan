# Task Completion Checklist

## When Completing Any Task

### 1. Code Quality
- [ ] Run `npm run lint` to check for linting errors
- [ ] Ensure TypeScript compilation succeeds
- [ ] Test in development mode (`npm run dev`)

### 2. Environment Variables
- [ ] Update `.env.local.example` if new environment variables added
- [ ] Ensure all required variables are documented
- [ ] Test both with and without optional variables (Cosmos DB)

### 3. API Routes
- [ ] Test API endpoints manually if modified
- [ ] Ensure error handling returns appropriate status codes
- [ ] Verify JSON response format consistency

### 4. Realtime Features
- [ ] Test voice interaction on `/realtime` page
- [ ] Verify function calls work correctly
- [ ] Check transcript display functionality
- [ ] Test WebRTC connection establishment

### 5. Before Deployment
- [ ] Run `npm run build` to ensure production build succeeds
- [ ] Test with production environment variables
- [ ] Verify HTTPS requirements for WebRTC in production

### 6. Documentation
- [ ] Update README.md if functionality changes significantly
- [ ] Update function descriptions in realtime session if tools modified
- [ ] Ensure code is self-documenting with clear variable names

## Testing Notes
- No automated tests currently configured
- Manual testing required for all features
- Focus on browser compatibility for WebRTC features
- Test with actual Azure OpenAI endpoints when possible