const redis = require('redis');

class Cache {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  async connect() {
    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      
      await this.client.connect();
      this.connected = true;
      console.log('Redis connected');
    } catch (error) {
      console.warn('Redis connection failed:', error.message);
      this.connected = false;
    }
  }

  async get(key) {
    if (!this.connected) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Cache get error:', error.message);
      return null;
    }
  }

  async set(key, data, ttl = 86400) { // 24 hours default
    if (!this.connected) return;
    try {
      await this.client.setEx(key, ttl, JSON.stringify(data));
    } catch (error) {
      console.warn('Cache set error:', error.message);
    }
  }

  generateKey(endpoint, params = {}) {
    const paramStr = Object.keys(params).sort().map(k => `${k}:${params[k]}`).join('|');
    return `discourse:${endpoint}:${paramStr}`;
  }
}

module.exports = new Cache();