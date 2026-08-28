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
    if (this.liAt) cookies.push(`li_at=${this.liAt.trim()}`);
    if (this.jsessionid) {
      const cleanJsession = this.jsessionid.trim().replace(/^"|"$/g, '');
      cookies.push(`JSESSIONID="${cleanJsession}"`);
    }
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
   * Primary profile fetcher with multi-endpoint fallback cascade
   */
  async fetchProfile(identifier) {
    if (!this.isConfigured()) {
      throw new Error('LinkedIn credentials (LINKEDIN_LI_AT and LINKEDIN_JSESSIONID) are missing or not configured in environment variables.');
    }

    const targetUsername = identifier.trim();
    const errors = [];

    // Strategy 1: GraphQL / Dash Member Profiles API
    try {
      const url1 = `${this.baseURL}/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(targetUsername)}&decorationId=com.linkedin.voyage.dash.deco.identity.profile.FullProfileWithEntities-93`;
      const res = await axios.get(url1, {
        headers: this.getHeaders(),
        timeout: 12000,
        validateStatus: (s) => s < 500
      });

      if (res.status === 200 && res.data && (res.data.data || res.data.included)) {
        return {
          profile: normalizeLinkedInProfile(res.data, targetUsername),
          raw: res.data
        };
      }
      errors.push(`Strategy 1 (Dash API) returned status ${res.status}`);
    } catch (e) {
      errors.push(`Strategy 1 error: ${e.message}`);
    }

    // Strategy 2: Identity Profile View API
    try {
      const url2 = `${this.baseURL}/identity/profiles/${encodeURIComponent(targetUsername)}/profileView`;
      const res = await axios.get(url2, {
        headers: this.getHeaders(),
        timeout: 12000,
        validateStatus: (s) => s < 500
      });

      if (res.status === 200 && res.data) {
        return {
          profile: normalizeLinkedInProfile(res.data, targetUsername),
          raw: res.data
        };
      }
      errors.push(`Strategy 2 (ProfileView API) returned status ${res.status}`);
    } catch (e) {
      errors.push(`Strategy 2 error: ${e.message}`);
    }

    // Strategy 3: GraphQL Member Profile Query
    try {
      const url3 = `${this.baseURL}/graphql?variables=(vanityName:${encodeURIComponent(targetUsername)})&queryId=voyageIdentityDashProfiles.622b7b5dc6439546b4ec2b55b9ebca72`;
      const res = await axios.get(url3, {
        headers: this.getHeaders(),
        timeout: 12000,
        validateStatus: (s) => s < 500
      });

      if (res.status === 200 && res.data && (res.data.data || res.data.included)) {
        return {
          profile: normalizeLinkedInProfile(res.data, targetUsername),
          raw: res.data
        };
      }
      errors.push(`Strategy 3 (GraphQL query) returned status ${res.status}`);
    } catch (e) {
      errors.push(`Strategy 3 error: ${e.message}`);
    }

    throw new Error(`Could not locate LinkedIn profile '${targetUsername}'. (${errors[0] || 'Profile not found or restricted'})`);
  }
}

module.exports = LinkedInClient;
