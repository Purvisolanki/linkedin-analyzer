/**
 * Reverse Engineered LinkedIn Voyage API Client
 * 
 * Directly interacts with LinkedIn internal Voyage Dash & Identity endpoints
 * without requiring any browser automation (No Puppeteer / Playwright).
 */

const axios = require('axios');
const { normalizeLinkedInProfile } = require('./normalizer');

class LinkedInClient {
  constructor(config = {}) {
    this.liAt = config.liAt || process.env.LINKEDIN_LI_AT || '';
    this.jsessionid = config.jsessionid || process.env.LINKEDIN_JSESSIONID || '';
    this.baseURL = 'https://www.linkedin.com/voyage/api';
    this.userAgent = process.env.LINKEDIN_USER_AGENT || 
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  }

  /**
   * Cleans JSESSIONID to format required for csrf-token header
   * LinkedIn session cookies usually contain quotes e.g. "ajax:1234567890"
   */
  getCsrfToken() {
    if (!this.jsessionid) return '';
    return this.jsessionid.replace(/^"|"$/g, '');
  }

  /**
   * Formats the Cookie header string
   */
  getCookieHeader() {
    const cookies = [];
    if (this.liAt) cookies.push(`li_at=${this.liAt}`);
    if (this.jsessionid) cookies.push(`JSESSIONID=${this.jsessionid}`);
    return cookies.join('; ');
  }

  /**
   * Returns authenticated Voyage API headers
   */
  getHeaders() {
    return {
      'User-Agent': this.userAgent,
      'Accept': 'application/vnd.linkedin.normalized+json+2.1',
      'Accept-Language': 'en-US,en;q=0.9',
      'csrf-token': this.getCsrfToken(),
      'x-restli-protocol-version': '2.0.0',
      'x-li-lang': 'en_US',
      'x-li-track': JSON.stringify({ clientVersion: '1.13.8821' }),
      'Cookie': this.getCookieHeader(),
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'Referer': 'https://www.linkedin.com/'
    };
  }

  /**
   * Checks if credentials are configured
   */
  isConfigured() {
    return Boolean(this.liAt && this.jsessionid);
  }

  /**
   * Fetches full LinkedIn profile data by member vanity username or identifier
   * @param {string} publicIdentifier - e.g. 'williamhgates'
   * @returns {Promise<Object>} Normalized profile object
   */
  async fetchProfile(publicIdentifier) {
    if (!this.isConfigured()) {
      throw new Error('LinkedIn credentials (LINKEDIN_LI_AT and LINKEDIN_JSESSIONID) are missing or not configured in backend.');
    }

    if (!publicIdentifier) {
      throw new Error('Public identifier is required.');
    }

    // Endpoint 1: Primary Voyage Dash Identity Profiles API
    const profileUrl = `${this.baseURL}/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(publicIdentifier)}&decorationId=com.linkedin.voyage.dash.deco.identity.profile.FullProfileWithEntities-93`;

    try {
      const response = await axios.get(profileUrl, {
        headers: this.getHeaders(),
        timeout: 15000,
        validateStatus: (status) => status < 500
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`LinkedIn authentication failed (Status ${response.status}). Please verify your LI_AT and JSESSIONID cookies.`);
      }

      if (response.status === 404) {
        throw new Error(`LinkedIn profile '${publicIdentifier}' was not found.`);
      }

      if (response.status !== 200) {
        throw new Error(`LinkedIn API responded with status ${response.status}: ${JSON.stringify(response.data)}`);
      }

      // Check if data exists in response
      if (!response.data || (!response.data.data && !response.data.included)) {
        throw new Error(`Empty response returned by LinkedIn for profile '${publicIdentifier}'.`);
      }

      // Normalize raw Dash graph data
      const normalizedData = normalizeLinkedInProfile(response.data, publicIdentifier);
      return {
        profile: normalizedData,
        raw: response.data
      };

    } catch (error) {
      // If primary Dash decoration ID changed, try fallback endpoint
      if (error.response?.status === 400 || error.message.includes('decoration')) {
        return await this.fetchProfileFallback(publicIdentifier);
      }
      throw error;
    }
  }

  /**
   * Fallback profile fetcher using standard identity/profiles endpoint
   * @param {string} publicIdentifier 
   */
  async fetchProfileFallback(publicIdentifier) {
    const fallbackUrl = `${this.baseURL}/identity/profiles/${encodeURIComponent(publicIdentifier)}/profileView`;

    try {
      const response = await axios.get(fallbackUrl, {
        headers: this.getHeaders(),
        timeout: 15000
      });

      const normalizedData = normalizeLinkedInProfile(response.data, publicIdentifier);
      return {
        profile: normalizedData,
        raw: response.data
      };
    } catch (fallbackError) {
      throw new Error(`Failed to fetch LinkedIn profile: ${fallbackError.message}`);
    }
  }
}

module.exports = LinkedInClient;
