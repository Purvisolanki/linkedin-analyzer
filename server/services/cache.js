/**
 * MongoDB Data Access & Caching Layer
 * Single-query execution, zero N+1 overhead, lean projection queries.
 */

const Profile = require('../models/Profile');
const connectDB = require('../config/db');

class ProfileService {
  constructor() {
    this.memoryCache = new Map();
    this.ttlMs = 1000 * 60 * 60 * 12; // 12 hours cache
  }

  async getProfile(identifier) {
    const key = identifier.toLowerCase();

    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key);
      if (Date.now() - entry.timestamp < this.ttlMs) {
        return entry.data;
      }
      this.memoryCache.delete(key);
    }

    await connectDB();
    if (Profile.db?.readyState === 1) {
      try {
        const doc = await Profile.findOne({ publicIdentifier: key }).lean().exec();
        if (doc) {
          this.memoryCache.set(key, { timestamp: Date.now(), data: doc });
          return doc;
        }
      } catch (err) {
        console.warn('MongoDB lookup warning:', err.message);
      }
    }

    return null;
  }

  async saveProfile(identifier, data, rawPayload = null) {
    const key = identifier.toLowerCase();
    const payload = {
      ...data,
      publicIdentifier: key,
      rawPayload,
      lastScrapedAt: new Date()
    };

    this.memoryCache.set(key, { timestamp: Date.now(), data: payload });

    await connectDB();
    if (Profile.db?.readyState === 1) {
      try {
        await Profile.findOneAndUpdate(
          { publicIdentifier: key },
          { $set: payload },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean().exec();
      } catch (err) {
        console.warn('MongoDB save warning:', err.message);
      }
    }

    return payload;
  }

  async getHistory(limit = 15) {
    await connectDB();
    if (Profile.db?.readyState === 1) {
      try {
        return await Profile.find({})
          .sort({ lastScrapedAt: -1 })
          .limit(limit)
          .select('publicIdentifier fullName headline location profilePicture lastScrapedAt stats')
          .lean()
          .exec();
      } catch (err) {
        console.warn('MongoDB history query warning:', err.message);
      }
    }

    return Array.from(this.memoryCache.values())
      .map(e => e.data)
      .sort((a, b) => new Date(b.lastScrapedAt || 0) - new Date(a.lastScrapedAt || 0))
      .slice(0, limit);
  }
}

module.exports = new ProfileService();
