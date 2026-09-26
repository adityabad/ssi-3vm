import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer } from 'ws';
import { Wallet } from 'ethers'; // We'll use this just for logging the DID

dotenv.config();
const app = express();
app.use(cors());
app.use(express.text({ type: '*/*' })); // Accept any text-based body

// --- Mediator Setup ---
// In a real system, this private key would be persistent and secured.
const mediatorWallet = Wallet.createRandom(); 
console.log(`Mediator identity (for logging): ${mediatorWallet.address}`);

const mailboxes = new Map();      // Stores messages for offline DIDs
const connections = new Map();    // Tracks active WebSocket connections (did -> ws)

// --- Create HTTP and WebSocket Servers ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('A client connected via WebSocket');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'subscribe' && data.did) {
        connections.set(data.did, ws);
        console.log(`Wallet subscribed for DID: ${data.did}`);
        
        // On subscribing, immediately deliver any pending messages
        const queue = mailboxes.get(data.did) || [];
        if (queue.length > 0) {
          ws.send(JSON.stringify(queue));
          mailboxes.set(data.did, []); // Clear the mailbox
          console.log(`Delivered ${queue.length} pending messages to ${data.did}`);
        }
      }
    } catch (e) { console.error('Error handling subscription:', e); }
  });

  ws.on('close', () => {
    // Find which DID this connection belonged to and remove it
    for (const [did, connection] of connections.entries()) {
      if (connection === ws) {
        connections.delete(did);
        console.log(`Client for ${did} disconnected.`);
        break;
      }
    }
  });
});

// --- HTTP Endpoint for Receiving Messages ---
app.post('/send', (req, res) => {
  const recipientDid = req.header('X-Recipient-DID');
  if (!recipientDid) {
    return res.status(400).json({ error: "X-Recipient-DID header is required." });
  }
  
  const packedMessage = JSON.parse(req.body);

  // If the recipient is currently connected, send it directly
  if (connections.has(recipientDid)) {
    console.log(`Recipient ${recipientDid} is online. Pushing message directly.`);
    connections.get(recipientDid).send(JSON.stringify([packedMessage]));
  } else {
    // Otherwise, store it in their mailbox for later pickup
    console.log(`Recipient ${recipientDid} is offline. Storing in mailbox.`);
    if (!mailboxes.has(recipientDid)) mailboxes.set(recipientDid, []);
    mailboxes.get(recipientDid).push(packedMessage);
  }
  
  res.status(202).json({ status: "Message accepted." });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`DIDComm Mediator running on http://localhost:${PORT}`);
});