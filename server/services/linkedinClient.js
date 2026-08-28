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

  getCsrfToken() {
    if (!this.jsessionid) return '';
    return this.jsessionid.replace(/^"|"$/g, '');
  }

  getCookieHeader() {
    const cookies = [];
    if (this.liAt) cookies.push(`li_at=${this.liAt}`);
    if (this.jsessionid) cookies.push(`JSESSIONID=${this.jsessionid}`);
    return cookies.join('; ');
  }

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

  isConfigured() {
    return Boolean(this.liAt && this.jsessionid);
  }

  /**
   * Searches LinkedIn for a person by name if not given a direct vanity URL
   * @param {string} query 
   * @returns {Promise<string|null>} Resolved vanity identifier
   */
  async searchMember(query) {
    const searchUrl = `${this.baseURL}/graphql?variables=(start:0,count:1,query:(keywords:${encodeURIComponent(query)},flagshipSearchIntent:SEARCH_SRP))&queryId=voyageSearchDashClusters.2b39f3796d11124e41416e9196feeb10`;

    try {
      const response = await axios.get(searchUrl, {
        headers: this.getHeaders(),
        timeout: 10000
      });

      const included = response.data?.included || [];
      const profile = included.find(item => item.$type === 'com.linkedin.voyage.dash.identity.profile.Profile' || item.publicIdentifier);

      return profile?.publicIdentifier || null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Fetches full LinkedIn profile data
   * @param {string} identifier 
   */
  async fetchProfile(identifier) {
    if (!this.isConfigured()) {
      throw new Error('LinkedIn credentials (LINKEDIN_LI_AT and LINKEDIN_JSESSIONID) are missing or not configured in environment variables.');
    }

    let targetUsername = identifier;

    // Primary Voyage Dash Profiles API
    const profileUrl = `${this.baseURL}/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(targetUsername)}&decorationId=com.linkedin.voyage.dash.deco.identity.profile.FullProfileWithEntities-93`;

    try {
      const response = await axios.get(profileUrl, {
        headers: this.getHeaders(),
        timeout: 15000,
        validateStatus: (status) => status < 500
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`LinkedIn authentication failed (${response.status}). Please check your LINKEDIN_LI_AT and LINKEDIN_JSESSIONID cookies.`);
      }

      if (response.status === 404) {
        throw new Error(`LinkedIn profile '${targetUsername}' was not found. Please verify the URL.`);
      }

      if (response.status !== 200) {
        throw new Error(`LinkedIn API returned status ${response.status}.`);
      }

      if (!response.data || (!response.data.data && !response.data.included)) {
        throw new Error(`Empty response from LinkedIn for '${targetUsername}'.`);
      }

      const normalizedData = normalizeLinkedInProfile(response.data, targetUsername);
      return {
        profile: normalizedData,
        raw: response.data
      };

    } catch (error) {
      if (error.response?.status === 400 || error.message.includes('decoration')) {
        return await this.fetchProfileFallback(targetUsername);
      }
      throw error;
    }
  }

  async fetchProfileFallback(publicIdentifier) {
    const fallbackUrl = `${this.baseURL}/identity/profiles/${encodeURIComponent(publicIdentifier)}/profileView`;
    const response = await axios.get(fallbackUrl, {
      headers: this.getHeaders(),
      timeout: 15000
    });

    const normalizedData = normalizeLinkedInProfile(response.data, publicIdentifier);
    return {
      profile: normalizedData,
      raw: response.data
    };
  }
}

module.exports = LinkedInClient;
