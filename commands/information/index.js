const axios = require('axios');

module.exports = {
  cuaca: {
    description: 'Mendapatkan informasi cuaca untuk kota tertentu',
    usage: '!cuaca <kota>',
    execute: async (args) => {
      if (!args.length) return '❌ Mohon sertakan nama kota. Contoh: !cuaca Jakarta';
      
      const city = args.join(' ');
      try {
        // Implementasi API cuaca
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.WEATHER_API_KEY}&units=metric&lang=id`);
        const data = response.data;
        
        return `🌤️ Cuaca di ${data.name}:
🌡️ Suhu: ${data.main.temp}°C
💨 Kelembaban: ${data.main.humidity}%
🌫️ Kondisi: ${data.weather[0].description}
💨 Angin: ${data.wind.speed} m/s`;
      } catch (error) {
        return '❌ Gagal mendapatkan data cuaca. Pastikan nama kota benar.';
      }
    }
  },
  
  berita: {
    description: 'Mendapatkan berita terbaru',
    usage: '!berita [kategori]',
    execute: async (args) => {
      // Implementasi berita
      return '📰 Fitur berita akan segera hadir!';
    }
  },
  
  jadwal: {
    description: 'Melihat jadwal sholat untuk kota tertentu',
    usage: '!jadwal <kota>',
    execute: async (args) => {
      // Implementasi jadwal sholat
      return '🕌 Fitur jadwal sholat akan segera hadir!';
    }
  },
  
  help: {
    description: 'Menampilkan semua perintah yang tersedia',
    usage: '!help [kategori]',
    execute: async (args) => {
      const categories = {
        information: '📊 Informasi',
        productivity: '📈 Produktivitas',
        entertainment: '🎮 Hiburan',
        technology: '🤖 Teknologi',
        owner: '⚙️ Owner',
        economy: '💰 Ekonomi'
      };
      
      if (args.length) {
        const category = args[0].toLowerCase();
        if (categories[category]) {
          let helpText = `📋 Perintah ${categories[category]}:\n\n`;
          const commands = require(`../${category}`);
          
          for (const [cmd, details] of Object.entries(commands)) {
            helpText += `• ${cmd}: ${details.description}\n  Contoh: ${details.usage}\n\n`;
          }
          
          return helpText;
        } else {
          return `❌ Kategori "${args[0]}" tidak ditemukan. Kategori yang tersedia: ${Object.keys(categories).join(', ')}`;
        }
      }
      
      let helpText = '🤖 T.AI - Daftar Perintah\n\n';
      helpText += 'Ketik !help <kategori> untuk melihat perintah spesifik\n\n';
      
      for (const [category, name] of Object.entries(categories)) {
        helpText += `📁 ${name}: !help ${category}\n`;
      }
      
      return helpText;
    }
  }
};
