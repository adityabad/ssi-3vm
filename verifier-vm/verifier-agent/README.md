# Holder Veramo Agent (development scaffold)

This folder contains a minimal Veramo agent scaffold that exposes simple HTTP endpoints for DIDComm pack/unpack operations. It's intended for local development and proof-of-concept use with the `holder-wallet` React app.

WARNING: This configuration is intentionally minimal and uses ephemeral in-memory key storage. Do NOT use this in production.

Files
- `index.js` - Express server creating a minimal Veramo agent and exposing `/pack` and `/unpack` endpoints.
- `package.json` - dependencies and start script.

Run locally

1. Change to this folder:

```powershell
cd e:/ssi-3vm-nothing-workkkssss-again/ssi-3vm/holder-vm/holder-agent
```

2. Install dependencies:

```powershell
npm install
```

3. Start the agent:

```powershell
npm start
```

Endpoints
- POST /unpack
  - Body: packed DIDComm message JSON (raw or string)
  - Returns: the unpacked DIDComm message as returned by Veramo.

- POST /pack
  - Body: { message, to, from }
  - Returns: packed DIDComm message JSON.

Integration notes
- Update the React app to call this agent instead of using the `didcomm` library directly. For example, replace calls to `didcomm.unpack(packed, ... )` with POST to `/unpack` on this agent.
- This scaffold uses in-memory KMS and DID manager; for persistence replace Veramo storage plugins with a database-backed store and configure a secure KMS.
