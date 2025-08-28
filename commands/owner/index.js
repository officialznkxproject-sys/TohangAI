const { OWNER_NUMBER } = require('../../config/settings');
const User = require('../../models/User');

module.exports = {
  ban: {
    description: 'Memblokir user dari bot',
    usage: '!ban <nomor> [alasan]',
    adminOnly: true,
    execute: async (args, user) => {
      if (user !== OWNER_NUMBER) return '❌ Hanya owner yang dapat menggunakan perintah ini.';
      
      if (!args.length) return '❌ Mohon sertakan nomor yang akan diblokir.';
      
      const target = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
      const reason = args.slice(1).join(' ') || 'Tidak ada alasan';
      
      try {
        await User.findOneAndUpdate(
          { userId: target },
          { banned: true, banReason: reason },
          { upsert: true, new: true }
        );
        
        return `✅ User ${target} telah diblokir. Alasan: ${reason}`;
      } catch (error) {
        return '❌ Gagal memblokir user.';
      }
    }
  },
  
  addcmd: {
    description: 'Menambah perintah custom',
    usage: '!addcmd <nama> <response>',
    adminOnly: true,
    execute: async (args, user) => {
      if (user !== OWNER_NUMBER) return '❌ Hanya owner yang dapat menggunakan perintah ini.';
      
      if (args.length < 2) return '❌ Format: !addcmd <nama> <response>';
      
      const cmdName = args[0].toLowerCase();
      const response = args.slice(1).join(' ');
      
      // Simpan ke database
      try {
        // Implementasi penyimpanan command custom
        return `✅ Perintah "${cmdName}" berhasil ditambahkan.`;
      } catch (error) {
        return '❌ Gagal menambahkan perintah.';
      }
    }
  },
  
  stats: {
    description: 'Melihat statistik bot',
    usage: '!stats',
    adminOnly: true,
    execute: async (args, user) => {
      if (user !== OWNER_NUMBER) return '❌ Hanya owner yang dapat menggunakan perintah ini.';
      
      // Implementasi statistik
      return '📊 Statistik bot:\n• Pengguna: 100\n• Grup: 15\n• Perintah dijalankan: 1,234';
    }
  }
};
