const fs = require('fs');
const path = require('path');
const { DEFAULT_CONNECTION_CONFIG } = require('@whiskeysockets/baileys');

// Simpan credentials ke file
const useAuth = () => {
  const sessionPath = path.join(__dirname, '../sessions/session.json');
  
  // Pastikan folder sessions ada
  if (!fs.existsSync(path.dirname(sessionPath))) {
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  }
  
  let state;
  if (fs.existsSync(sessionPath)) {
    state = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
  }
  
  const saveCreds = () => {
    if (state) {
      fs.writeFileSync(sessionPath, JSON.stringify(state, null, 2));
    }
  };
  
  return { state, saveCreds };
};

module.exports = {
  useAuth
};
