const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, delay } = require('@whiskeysockets/baileys');
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
let qrTimeout = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Inisialisasi WhatsApp
async function initWhatsApp() {
    try {
        console.log('🔄 Initializing WhatsApp connection...');
        
        const { state, saveCreds } = await useMultiFileAuthState('./sessions');
        
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true, // Juga print di terminal untuk backup
            logger: require('pino')({ level: 'silent' }),
            browser: Browsers.ubuntu('Chrome'),
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 20000
        });

        // Handle QR Code
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr } = update;
            
            console.log('Connection update:', connection, qr ? 'QR received' : 'No QR');
            
            if (qr) {
                console.log('📱 QR Code received, generating for web...');
                reconnectAttempts = 0; // Reset reconnect attempts
                
                try {
                    const qrImage = await qrcode.toDataURL(qr);
                    io.emit('qr', qrImage);
                    io.emit('message', 'Scan QR code to connect to WhatsApp');
                    console.log('✅ QR code generated and sent to web interface');
                    
                    // Set timeout untuk regenerate QR jika belum di-scan
                    if (qrTimeout) clearTimeout(qrTimeout);
                    qrTimeout = setTimeout(() => {
                        console.log('🔄 QR code expired, regenerating...');
                        io.emit('message', 'QR code expired. Regenerating...');
                        initWhatsApp().catch(console.error);
                    }, 60000); // Regenerate setelah 60 detik
                    
                } catch (error) {
                    console.error('❌ QR generation error:', error);
                    io.emit('message', 'Error generating QR code. Please refresh.');
                }
            }
            
            if (connection === 'open') {
                console.log('✅ WhatsApp connected successfully!');
                io.emit('message', 'WhatsApp connected successfully!');
                io.emit('connected', true);
                if (qrTimeout) clearTimeout(qrTimeout);
                reconnectAttempts = 0;
                
                // Simpan credentials
                await saveCreds();
            }
            
            if (connection === 'close') {
                console.log('❌ WhatsApp connection closed');
                const shouldReconnect = (update.lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    console.log(`🔄 Attempting reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
                    io.emit('message', `Reconnecting... Attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
                    
                    await delay(2000 * reconnectAttempts); // Exponential backoff
                    initWhatsApp().catch(console.error);
                } else {
                    console.log('❌ Max reconnection attempts reached or logged out');
                    io.emit('message', 'Connection failed. Please refresh the page.');
                    io.emit('connected', false);
                }
            }
            
            if (connection === 'connecting') {
                console.log('🔄 Connecting to WhatsApp...');
                io.emit('message', 'Connecting to WhatsApp...');
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
    } catch (error) {
        console.error('❌ Failed to initialize WhatsApp:', error);
        io.emit('message', 'Failed to initialize. Please refresh the page.');
        throw error;
    }
}

// Handle built-in commands
async function handleBuiltInCommand(command, args, user) {
    const ownerNumber = process.env.OWNER_NUMBER || '083131871328';
    const isOwner = user.includes(ownerNumber);
    
    switch (command) {
        case 'ping':
            return '🏓 Pong! T.AI Bot is online!';
        
        case 'help':
            return '🤖 T.AI Bot Help:\n\n' +
                  '• !ping - Test connection\n' +
                  '• !help - Show this help\n' +
                  '• !info - Bot information\n' +
                  '• !owner - Contact owner\n' +
                  '• !status - Bot status\n' +
                  'More commands coming soon!';
        
        case 'info':
            return '🤖 T.AI WhatsApp Bot\n' +
                  'Version: 1.0.0\n' +
                  'Powered by Baileys\n' +
                  'Deployed on Zeabur\n' +
                  'Owner: ' + ownerNumber;
        
        case 'owner':
            return `👨‍💻 Owner: ${ownerNumber}\nHubungi owner untuk info lebih lanjut!`;
        
        case 'status':
            return `📊 Bot Status:\n• Connected: ${sock && sock.user ? 'Yes' : 'No'}\n• Ready to receive commands!`;
        
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
        message: 'T.AI WhatsApp Bot is running',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/restart', async (req, res) => {
    try {
        if (sock) {
            await sock.logout();
            await sock.ws.close();
        }
        await initWhatsApp();
        res.json({ success: true, message: 'Bot restarted successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
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
    console.log(`🔄 Restart endpoint: http://localhost:${PORT}/api/restart`);
    
    try {
        // Initialize WhatsApp
        await initWhatsApp();
        console.log('✅ T.AI Bot initialization process started');
    } catch (error) {
        console.error('❌ Failed to initialize bot:', error);
    }
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    if (sock) {
        await sock.logout();
        await sock.ws.close();
    }
    process.exit(0);
});
