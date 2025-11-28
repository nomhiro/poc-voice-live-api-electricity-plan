# Project Overview

## Purpose
This is a Next.js POC (Proof of Concept) application that demonstrates WebRTC-based voice communication with Azure OpenAI Realtime API. It implements a electricity company customer support system with voice-based AI agent interaction.

## Key Features
1. **Voice-based AI Agent**: Real-time voice conversation with AI for electricity customer support
2. **Function Calling**: AI can call backend functions (get customer info, billing history, plan simulation, etc.)
3. **WebRTC Integration**: Direct browser-to-Azure audio connection
4. **Multilingual Support**: Japanese language support with transcription
5. **Fallback Data**: Works with sample data when Cosmos DB is not configured

## Application Flow
1. Client requests session from `/api/realtime/session`
2. Server creates Azure Realtime session with function tools
3. Client establishes WebRTC connection with Azure
4. AI agent guides customer through electricity contract inquiries and plan changes
5. Functions are executed server-side when called by AI
2. **Function Calling**: AI can call backend functions (list locations, check availability, create reservations, etc.)
3. **WebRTC Integration**: Direct browser-to-Azure audio connection
4. **Multilingual Support**: Japanese language support with transcription
5. **Fallback Data**: Works with sample data when Cosmos DB is not configured

## Application Flow
1. Client requests session from `/api/realtime/session`
2. Server creates Azure Realtime session with function tools
3. Client establishes WebRTC connection with Azure
4. AI agent guides customer through rental car reservation process
5. Functions are executed server-side when called by AI