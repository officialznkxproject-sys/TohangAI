const express = require('express');
const { create } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Import config
const { OWNER_NUMBER } = require('./config/settings');

// Socket untuk mengirim QR ke frontend
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// State management
let sessions = new Map();
let sock = null;

// Connect to MongoDB
const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/t-ai';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB Connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    // Jangan exit, biarkan bot tetap berjalan tanpa database
  }
};

// User Schema
const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  name: String,
  role: {
    type: String,
    default: 'USER',
    enum: ['USER', 'ADMIN', 'OWNER']
  },
  banned: {
    type: Boolean,
    default: false
  },
  banReason: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  tenantId: String,
  subscription: {
    type: String,
    default: 'free'
  }
});

const User = mongoose.model('User', userSchema);

// Inisialisasi WhatsApp
async function initWhatsApp() {
  // Buat folder sessions jika belum ada
  if (!fs.existsSync('./sessions')) {
    fs.mkdirSync('./sessions', { recursive: true });
  }
  
  let state = {};
  // Coba load session jika ada
  if (fs.existsSync('./sessions/session.json')) {
    try {
      state = JSON.parse(fs.readFileSync('./sessions/session.json', 'utf-8'));
    } catch (e) {
      console.log('No valid session found, creating new one');
    }
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
      try {
        const qrImage = await qrcode.toDataURL(qr);
        io.emit('qr', qrImage);
        io.emit('message', 'Scan QR code to login');
      } catch (error) {
        console.log('QR generation error:', error);
      }
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
    try {
      const message = messages[0];
      if (!message.message) return;
      
      const jid = message.key.remoteJid;
      const user = message.key.participant || jid;
      const text = message.message.conversation || 
                  (message.message.extendedTextMessage && message.message.extendedTextMessage.text) || 
                  '';
      
      // Simpan/update user di database
      try {
        await User.findOneAndUpdate(
          { userId: user },
          { $setOnInsert: { createdAt: new Date() } },
          { upsert: true, new: true }
        );
      } catch (dbError) {
        console.log('Database error (non-critical):', dbError.message);
      }
      
      // Process command
      if (text.startsWith('!')) {
        let response = '';
        
        if (text === '!ping') {
          response = '🏓 Pong!';
        } else if (text === '!help') {
          response = '🤖 T.AI Bot Help:\n\n' +
                    '• !ping - Test connection\n' +
                    '• !help - Show this help\n' +
                    '• !info - Bot information\n' +
                    '• !owner - Contact owner\n' +
                    '• !stats - Bot statistics\n' +
                    'More commands coming soon!';
        } else if (text === '!info') {
          response = '🤖 T.AI WhatsApp Bot\n' +
                    'Version: 1.0.0\n' +
                    'Multi-tenant friendly\n' +
                    'Powered by Baileys\n' +
                    'Deployed on Zeabur';
        } else if (text === '!owner') {
          response = `👨‍💻 Owner: ${OWNER_NUMBER}\nHubungi owner untuk info lebih lanjut!`;
        } else if (text === '!stats') {
          try {
            const userCount = await User.countDocuments();
            response = `📊 Bot Statistics:\n• Users: ${userCount}\n• Status: Connected`;
          } catch (error) {
            response = '📊 Bot Statistics:\n• Users: N/A\n• Status: Connected';
          }
        } else {
          response = '❌ Command not found. Type !help for available commands.';
        }
        
        await sock.sendMessage(jid, { text: response });
      }
    } catch (error) {
      console.log('Message processing error:', error);
    }
  });

  return sock;
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
  res.json({ 
    status: sessions.size > 0 ? 'connected' : 'disconnected',
    message: 'T.AI WhatsApp Bot is running'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Start server
http.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  try {
    // Connect to database
    await connectDB();
    
    // Initialize WhatsApp
    await initWhatsApp();
    console.log('✅ T.AI Bot initialized successfully');
    console.log('📱 Open the web interface to scan QR code');
  } catch (error) {
    console.error('❌ Failed to initialize bot:', error);
  }
});
