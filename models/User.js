const mongoose = require('mongoose');

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
  // Untuk multi-tenant
  tenantId: String,
  subscription: {
    type: String,
    default: 'free'
  }
});

module.exports = mongoose.model('User', userSchema);
