const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const profileRoutes = require('./routes/profile');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB (Optional persistence)
connectDB();

// Security and utility middleware
app.use(helmet({
  contentSecurityPolicy: false // Allows frontend assets & external images
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(morgan('dev'));

// Rate limiting to protect hosted instance
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});
app.use('/api/', limiter);

// API Routes
app.use('/api/profile', profileRoutes);

// Health check and system status
app.get('/api/health', (req, res) => {
  const isConfigured = Boolean(process.env.LINKEDIN_LI_AT && process.env.LINKEDIN_JSESSIONID);
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'LinkedIn Reverse Engineered Profile API',
    authConfigured: isConfigured,
    message: isConfigured 
      ? 'LinkedIn session credentials are active.' 
      : 'LinkedIn credentials (LINKEDIN_LI_AT, LINKEDIN_JSESSIONID) are not configured in .env'
  });
});

// Serve frontend in production build if present
if (process.env.NODE_ENV === 'production' || process.env.SERVE_CLIENT === 'true') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error occurred.',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 LinkedIn Profile API Server running on port ${PORT}`);
  console.log(`🔗 Health check available at http://localhost:${PORT}/api/health`);
});
