require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is missing. Create a .env file (see .env.example).');
  process.exit(1);
}

// --- MongoDB setup ---
const messageSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  text: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', messageSchema);

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });

async function saveMessage(username, text) {
  if (!username || !text || !String(text).trim()) throw new Error('username and text required');
  const msg = await Message.create({ username: String(username).trim(), text: String(text).trim() });
  return { id: msg._id, username: msg.username, text: msg.text, createdAt: msg.createdAt };
}

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// REST APIs
app.get('/api/messages', async (req, res) => {
  try {
    const docs = await Message.find().sort({ createdAt: 1 }).limit(500);
    res.json(docs.map((d) => ({ id: d._id, username: d.username, text: d.text, createdAt: d.createdAt })));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const msg = await saveMessage(req.body.username, req.body.text);
    io.emit('new_message', msg);
    res.status(201).json(msg);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/', (_, res) => res.send('Chat server running'));

// Socket.io
const online = new Map(); // socket.id -> username
const emitOnline = () => io.emit('online_users', [...new Set(online.values())]);

io.on('connection', (socket) => {
  socket.on('join', (username) => {
    online.set(socket.id, username);
    emitOnline();
  });

  socket.on('send_message', async (data, ack) => {
    try {
      const msg = await saveMessage(data.username, data.text);
      io.emit('new_message', msg); // broadcast to everyone (incl. sender)
      ack && ack({ ok: true });
    } catch (e) {
      ack && ack({ ok: false, error: e.message });
    }
  });

  socket.on('typing', (username) => socket.broadcast.emit('typing', username));
  socket.on('stop_typing', (username) => socket.broadcast.emit('stop_typing', username));

  socket.on('disconnect', () => {
    online.delete(socket.id);
    emitOnline();
  });
});

server.listen(PORT, () => console.log(`Server on port ${PORT}`));
