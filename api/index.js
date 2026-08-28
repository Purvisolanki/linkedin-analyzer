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

// Diagnostic Debug Endpoint that returns raw HTML & API dump directly to browser/JSON
app.get('/api/debug', async (req, res) => {
  const target = req.query.url || req.query.identifier || 'tabhay24';
  const username = target.replace(/^https?:\/\/[^/]+\/in\//i, '').replace(/\/+$/, '');
  const client = new LinkedInClient();

  const results = {
    target: username,
    auth: {
      hasLiAt: Boolean(process.env.LINKEDIN_LI_AT),
      liAtPrefix: process.env.LINKEDIN_LI_AT ? process.env.LINKEDIN_LI_AT.slice(0, 8) + '...' : null,
      hasJsession: Boolean(process.env.LINKEDIN_JSESSIONID),
      csrf: client.getCsrfToken()
    },
    voyagerEndpointStatus: {},
    htmlSnippet: null,
    scriptsFound: 0,
    extractedSample: null
  };

  // 1. Test Voyager ProfileView endpoint
  try {
    const vUrl = `https://www.linkedin.com/voyager/api/identity/profiles/${encodeURIComponent(username)}/profileView`;
    const vRes = await axios.get(vUrl, {
      headers: client.getHeaders(),
      timeout: 8000,
      validateStatus: () => true
    });
    results.voyagerEndpointStatus[vUrl] = {
      status: vRes.status,
      dataPreview: vRes.data ? JSON.stringify(vRes.data).slice(0, 500) : null
    };
  } catch (err) {
    results.voyagerEndpointStatus.error = err.message;
  }

  // 2. Test Public Page HTML
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
      validateStatus: () => true
    });

    results.publicPage = {
      status: pRes.status,
      htmlLength: pRes.data?.length || 0,
      headSnippet: typeof pRes.data === 'string' ? pRes.data.slice(0, 1500) : null
    };
  } catch (err) {
    results.publicPage = { error: err.message };
  }

  return res.json(results);
});

module.exports = app;
