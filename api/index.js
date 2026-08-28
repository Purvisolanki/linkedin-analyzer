const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const profileRoutes = require('../server/routes/profile');
const axios = require('axios');
const LinkedInClient = require('../server/services/linkedinClient');

const app = express();

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

// Diagnostic Debug Endpoint that inspects redirect locations & cookies
app.get('/api/debug', async (req, res) => {
  const target = req.query.url || req.query.identifier || 'tabhay24';
  const username = target.replace(/^https?:\/\/[^/]+\/in\//i, '').replace(/\/+$/, '');
  const client = new LinkedInClient();

  const results = {
    target: username,
    auth: {
      hasLiAt: Boolean(process.env.LINKEDIN_LI_AT),
      liAtLength: process.env.LINKEDIN_LI_AT?.length,
      hasJsession: Boolean(process.env.LINKEDIN_JSESSIONID),
      csrf: client.getCsrfToken()
    },
    pageTest: null
  };

  try {
    const pageUrl = `https://www.linkedin.com/in/${encodeURIComponent(username)}/`;
    const pRes = await axios.get(pageUrl, {
      headers: {
        'User-Agent': client.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': client.getCookieHeader()
      },
      timeout: 8000,
      maxRedirects: 0,
      validateStatus: () => true
    });

    results.pageTest = {
      status: pRes.status,
      redirectLocation: pRes.headers.location || null,
      headers: pRes.headers,
      bodyPreview: typeof pRes.data === 'string' ? pRes.data.slice(0, 500) : null
    };
  } catch (err) {
    results.pageTest = { error: err.message };
  }

  return res.json(results);
});

module.exports = app;
