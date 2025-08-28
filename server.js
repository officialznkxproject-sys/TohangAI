const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Socket untuk mengirim QR ke frontend
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// State management
let sock = null;
let qrGenerated = false;
let userCount = 0;
const users = new Set();

// Inisialisasi WhatsApp
async function initWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./sessions');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: require('pino')({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome')
    });

    // Handle QR Code
    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;
        
        if (qr && !qrGenerated) {
            qrGenerated = true;
            // Generate QR untuk web
            try {
                const qrImage = await qrcode.toDataURL(qr);
                io.emit('qr', qrImage);
                io.emit('message', 'Scan QR code to login');
                console.log('QR code generated for web interface');
            } catch (error) {
                console.log('QR generation error:', error);
            }
        }
        
        if (connection === 'open') {
            io.emit('message', 'WhatsApp connected successfully!');
            console.log('✅ WhatsApp connected successfully');
            // Simpan credentials
            await saveCreds();
        }
        
        if (connection === 'close') {
            const shouldReconnect = (update.lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            
            if (shouldReconnect) {
                console.log('Connection closed, reconnecting...');
                initWhatsApp();
            } else {
                console.log('Connection closed, please restart bot');
                io.emit('message', 'WhatsApp disconnected. Please restart bot.');
            }
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
            
            // Simpan user
            if (!users.has(user)) {
                users.add(user);
                userCount = users.size;
            }
            
            // Process command
            if (text && text.startsWith('!')) {
                let response = '';
                const args = text.slice(1).trim().split(/ +/);
                const command = args.shift().toLowerCase();
                
                response = await handleBuiltInCommand(command, args, user);
                
                if (response) {
                    await sock.sendMessage(jid, { text: response });
                }
            }
        } catch (error) {
            console.log('Message processing error:', error);
        }
    });

    return sock;
}

// Handle built-in commands
async function handleBuiltInCommand(command, args, user) {
    const ownerNumber = process.env.OWNER_NUMBER || '083131871328';
    const isOwner = user.includes(ownerNumber);
    
    switch (command) {
        case 'ping':
            return '🏓 Pong!';
        
        case 'help':
            return '🤖 T.AI Bot Help:\n\n' +
                  '• !ping - Test connection\n' +
                  '• !help - Show this help\n' +
                  '• !info - Bot information\n' +
                  '• !owner - Contact owner\n' +
                  '• !stats - Bot statistics\n' +
                  'More commands coming soon!';
        
        case 'info':
            return '🤖 T.AI WhatsApp Bot\n' +
                  'Version: 1.0.0\n' +
                  'Multi-tenant friendly\n' +
                  'Powered by Baileys\n' +
                  'Deployed on Zeabur';
        
        case 'owner':
            return `👨‍💻 Owner: ${ownerNumber}\nHubungi owner untuk info lebih lanjut!`;
        
        case 'stats':
            return `📊 Bot Statistics:\n• Users: ${userCount}\n• Status: Connected\n• Database: Memory`;
        
        default:
            return '❌ Command not found. Type !help for available commands.';
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
    res.json({ 
        status: sock && sock.user ? 'connected' : 'disconnected',
        message: 'T.AI WhatsApp Bot is running'
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        whatsapp: sock && sock.user ? 'connected' : 'disconnected'
    });
});

// Start server
http.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`📱 QR Interface: http://localhost:${PORT}/`);
    
    try {
        // Initialize WhatsApp
        await initWhatsApp();
        console.log('✅ T.AI Bot initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize bot:', error);
    }
});
