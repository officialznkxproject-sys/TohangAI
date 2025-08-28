const { OWNER_NUMBER } = require('../config/settings');
const User = require('../models/User');

// Load semua commands
const loadCommands = () => {
  const commands = {};
  const categories = ['information', 'productivity', 'entertainment', 'technology', 'owner', 'economy'];
  
  categories.forEach(category => {
    try {
      const categoryCommands = require(`../commands/${category}`);
      commands[category] = categoryCommands;
    } catch (error) {
      console.warn(`No commands found for category: ${category}`);
    }
  });
  
  return commands;
};

const commands = loadCommands();

module.exports = {
  async processCommand(text, user) {
    const prefix = '!';
    if (!text.startsWith(prefix)) return null;
    
    const args = text.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    // Cek user role
    const userRole = await getUserRole(user);
    
    // Cari command di semua kategori
    for (const category in commands) {
      if (commands[category][commandName]) {
        const command = commands[category][commandName];
        
        // Cek permissions
        if (command.adminOnly && userRole !== 'OWNER' && user !== OWNER_NUMBER) {
          return '❌ Anda tidak memiliki izin untuk menggunakan perintah ini.';
        }
        
        // Eksekusi command
        try {
          return await command.execute(args, user);
        } catch (error) {
          console.error(`Error executing command ${commandName}:`, error);
          return '❌ Terjadi kesalahan saat menjalankan perintah.';
        }
      }
    }
    
    return `❌ Perintah "${commandName}" tidak ditemukan. Ketik !help untuk melihat daftar perintah.`;
  }
};

async function getUserRole(userId) {
  try {
    const user = await User.findOne({ userId });
    return user ? user.role : 'USER';
  } catch (error) {
    return 'USER';
  }
  }
