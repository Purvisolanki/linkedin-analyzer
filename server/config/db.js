const mongoose = require('mongoose');

let cachedConnection = null;

/**
 * Connect to MongoDB with serverless connection pooling & caching.
 * Prevents redundant reconnections across Vercel serverless function invocations.
 */
async function connectDB() {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    return null;
  }

  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  try {
    cachedConnection = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      bufferCommands: false
    });
    console.log('MongoDB connected successfully.');
    return cachedConnection;
  } catch (error) {
    console.warn(`MongoDB connection warning: ${error.message}`);
    return null;
  }
}

module.exports = connectDB;
