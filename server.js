const express = require('express');
const { create } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Import config
const { OWNER_NUMBER } = require('./config/settings');

// Import controllers
const authController = require('./controllers/authController');
const commandController = require('./controllers/commandController');

// Socket untuk mengirim QR ke frontend
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// State management
let sessions = new Map();

// Inisialisasi WhatsApp
async function initWhatsApp() {
  const { state, saveCreds } = await authController.useAuth();
  
  const sock = create({
    auth: state,
    printQRInTerminal: false,
    logger: require('pino')({ level: 'silent' })
  });

  // Handle QR Code
  sock.ev.on('connection.update', async (update) => {
    const { connection, qr } = update;
    
    if (qr) {
      // Generate QR untuk web
      const qrImage = await qrcode.toDataURL(qr);
      io.emit('qr', qrImage);
      io.emit('message', 'Scan QR code to login');
    }
    
    if (connection === 'open') {
      io.emit('message', 'WhatsApp connected successfully!');
      sessions.set(sock.id, sock);
    }
    
    if (connection === 'close') {
      io.emit('message', 'WhatsApp disconnected. Refresh to generate new QR.');
      sessions.delete(sock.id);
    }
  });

  // Save credentials
  sock.ev.on('creds.update', saveCreds);

  // Handle incoming messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (!message.message) return;
    
    const jid = message.key.remoteJid;
    const user = message.key.participant || jid;
    const text = message.message.conversation || 
                (message.message.extendedTextMessage && message.message.extendedTextMessage.text) || 
                '';
    
    // Process command
    const response = await commandController.processCommand(text, user);
    
    if (response) {
      await sock.sendMessage(jid, { text: response });
    }
  });

  return sock;
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
  res.json({ status: sessions.size > 0 ? 'connected' : 'disconnected' });
});

// Start server
http.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initWhatsApp();
});
