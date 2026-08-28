const express = require('express');
const router = express.Router();
const LinkedInClient = require('../services/linkedinClient');
const profileService = require('../services/cache');
const { extractLinkedInIdentifier } = require('../utils/validator');

const linkedinClient = new LinkedInClient();

/**
 * Common handler for profile extraction
 */
async function handleProfileRequest(req, res) {
  const input = req.query.url || req.query.identifier || req.body?.url || req.body?.identifier;
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1' || req.body?.refresh === true;

  if (!input) {
    return res.status(400).json({
      success: false,
      error: 'Missing required "url" or "identifier" parameter. Example: /api/profile?url=https://linkedin.com/in/williamhgates'
    });
  }

  const username = extractLinkedInIdentifier(input);
  if (!username) {
    return res.status(400).json({
      success: false,
      error: 'Invalid LinkedIn profile URL or vanity username format.'
    });
  }

  // 1. Check MongoDB / Cache (unless force refresh requested)
  if (!refresh) {
    const cached = await profileService.getProfile(username);
    if (cached) {
      return res.json({
        success: true,
        source: 'mongodb_cache',
        data: cached,
        timestamp: new Date().toISOString()
      });
    }
  }

  // 2. Fetch live via reverse-engineered Voyage API
  try {
    const result = await linkedinClient.fetchProfile(username);
    
    // Save to MongoDB in a single atomic upsert
    await profileService.saveProfile(username, result.profile);

    return res.json({
      success: true,
      source: 'live_linkedin_api',
      data: result.profile,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Profile fetch error [${username}]:`, error.message);
    const status = error.response?.status || (error.message.includes('not found') ? 404 : 500);

    return res.status(status).json({
      success: false,
      error: error.message || 'An error occurred while fetching LinkedIn profile data.'
    });
  }
}

// GET & POST Endpoints
router.get('/', handleProfileRequest);
router.post('/', handleProfileRequest);

/**
 * @route   GET /api/profile/history
 * @desc    Fetch recent profiles in a single query
 */
router.get('/history', async (req, res) => {
  try {
    const history = await profileService.getHistory(15);
    return res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
