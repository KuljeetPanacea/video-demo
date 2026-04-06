


import express from 'express';
import http from 'http';      
import cors from 'cors';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
app.use(cors());
app.use(express.json());

const LIVEKIT_URL = "wss://voicetest-lzl976kv.livekit.cloud";
const API_KEY = "API7kNixTJ6heAg";
const API_SECRET = "P6oxdtEtLwcUodBsziSl0JN685FNXVzjeeplBkuWAUd";
const DEEPGRAM_API_KEY = "cbb4f8ff75a558dcf8a558aa05659a890fe627df";

const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);

// ================= TOKEN =================
app.post('/getToken', async (req, res) => {
  try {
    const {
      room_name = 'room-123',
      participant_identity,
      participant_name = 'User'
    } = req.body;

    if (!participant_identity) {
      return res.status(400).json({ error: "participant_identity is required" });
    }

    let currentCount = 0;
    try {
      const participants = await roomService.listParticipants(room_name);
      currentCount = participants.length;

      const alreadyIn = participants.find(p => p.identity === participant_identity);
      if (!alreadyIn && currentCount >= 23) {
        return res.status(403).json({ error: "Room is full (max 2 users)" });
      }
    } catch (e) {
      console.log("Room not found yet, first user");
    }

    const at = new AccessToken(API_KEY, API_SECRET, {
      identity: participant_identity,
      name: participant_name,
      ttl: '10m',
    });

    at.addGrant({
      roomJoin: true,
      room: room_name,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    res.json({
      server_url: LIVEKIT_URL,
      participant_token: token
    });

  } catch (error) {
    console.error("❌ Token error:", error);
    res.status(500).json({ error: "Token generation failed" });
  }
});

// ================= HTTPS SERVER =================
const server = http.createServer(app);
// ================= WEBSOCKET =================
const wss = new WebSocketServer({ server });

wss.on('connection', (clientWs) => {
  console.log("🎙 Transcription WebSocket connected");
const deepgramWs = new WebSocket(
  'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1',
  {
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` }
  }
);

  deepgramWs.on('open', () => {
    console.log("✅ Deepgram connected");
  });

  deepgramWs.on('message', (data) => {
    try {
      console.log("DG RAW:", data.toString()); // 👈 ADD THIS
      const result = JSON.parse(data.toString());
      const transcript = result?.channel?.alternatives?.[0]?.transcript;
      const isFinal = result?.is_final;

      if (transcript && isFinal && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'transcript',
          text: transcript
        }));
      }
    } catch {}
  });

  deepgramWs.on('error', (e) => console.error("Deepgram error:", e));

  clientWs.on('message', (data) => {
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.send(data);
    }
  });

  clientWs.on('close', () => {
    console.log("Client disconnected");
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.close();
    }
  });
});
app.get('/', (req, res) => {
  res.send("Hello from LiveKit Voice Backend!");
});
// ================= START SERVER =================
server.listen(3001, "0.0.0.0", () => {
  console.log("🚀 HTTPS Server running on:");
  console.log("👉 https://localhost:3001");
});