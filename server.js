const express = require('express');
const { create } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Import config
const { OWNER_NUMBER } = require('./config/settings');

// Import utils
const connectDB = require('./utils/database');

// Socket untuk mengirim QR ke frontend
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// State management
let sessions = new Map();
let sock = null;

// Inisialisasi WhatsApp
async function initWhatsApp() {
  // Buat folder sessions jika belum ada
  if (!fs.existsSync('./sessions')) {
    fs.mkdirSync('./sessions', { recursive: true });
  }
  
  let state = {};
  // Coba load session jika ada
  if (fs.existsSync('./sessions/session.json')) {
    state = JSON.parse(fs.readFileSync('./sessions/session.json', 'utf-8'));
  }
  
  const saveCreds = () => {
    fs.writeFileSync('./sessions/session.json', JSON.stringify(state, null, 2));
  };
  
  sock = create({
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
      // Simpan credentials
      saveCreds();
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
    
    // Process command sederhana
    if (text.startsWith('!')) {
      let response = '';
      
      if (text === '!ping') {
        response = '🏓 Pong!';
      } else if (text === '!help') {
        response = '🤖 T.AI Bot Help:\n\n' +
                  '• !ping - Test connection\n' +
                  '• !help - Show this help\n' +
                  '• !info - Bot information\n' +
                  'More commands coming soon!';
      } else if (text === '!info') {
        response = '🤖 T.AI WhatsApp Bot\n' +
                  'Version: 1.0.0\n' +
                  'Multi-tenant friendly\n' +
                  'Powered by Baileys';
      } else {
        response = '❌ Command not found. Type !help for available commands.';
      }
      
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
  try {
    // Connect to database
    await connectDB();
    // Initialize WhatsApp
    await initWhatsApp();
    console.log('T.AI Bot initialized successfully');
  } catch (error) {
    console.error('Failed to initialize bot:', error);
  }
});
