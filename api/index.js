const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const profileRoutes = require('../server/routes/profile');

const app = express();

// Security headers & CORS
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json());

// API Routes
app.use('/api/profile', profileRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const isConfigured = Boolean(process.env.LINKEDIN_LI_AT && process.env.LINKEDIN_JSESSIONID);
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'LinkedIn Reverse Engineered Profile API (Vercel Serverless)',
    authConfigured: isConfigured,
    message: isConfigured 
      ? 'LinkedIn session credentials active.' 
      : 'LinkedIn credentials (LINKEDIN_LI_AT, LINKEDIN_JSESSIONID) are missing from environment variables.'
  });
});

module.exports = app;
