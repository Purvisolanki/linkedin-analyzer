const axios = require('axios');
const { normalizeLinkedInProfile } = require('./normalizer');
const { parseHtmlProfile } = require('./htmlParser');

class LinkedInClient {
  constructor(config = {}) {
    this.liAt = config.liAt || process.env.LINKEDIN_LI_AT || '';
    this.jsessionid = config.jsessionid || process.env.LINKEDIN_JSESSIONID || '';
    this.baseURL = 'https://www.linkedin.com/voyager/api';
    this.userAgent = process.env.LINKEDIN_USER_AGENT || 
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  }

  getCsrfToken() {
    if (!this.jsessionid) return '';
    return this.jsessionid.trim().replace(/^"|"$/g, '');
  }

  getCookieHeader() {
    const rawLiAt = (this.liAt || '').trim();
    const rawJsession = (this.jsessionid || '').trim().replace(/^"|"$/g, '');
    const parts = [];
    if (rawLiAt) parts.push(`li_at=${rawLiAt}`);
    if (rawJsession) parts.push(`JSESSIONID="${rawJsession}"`);
    parts.push('bcookie="v=2&"');
    parts.push('lang=v=2&lang=en-us');
    return parts.join('; ');
  }

  getHeaders() {
    const csrf = this.getCsrfToken();
    return {
      'User-Agent': this.userAgent,
      'Accept': 'application/vnd.linkedin.normalized+json+2.1',
      'Accept-Language': 'en-US,en;q=0.9',
      'csrf-token': csrf,
      'x-restli-protocol-version': '2.0.0',
      'x-li-lang': 'en_US',
      'x-li-track': JSON.stringify({ clientVersion: '1.13.8821' }),
      'Cookie': this.getCookieHeader(),
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'Referer': 'https://www.linkedin.com/feed/'
    };
  }

  isConfigured() {
    return Boolean(this.liAt && this.jsessionid);
  }

  /**
   * Resolve public vanity username to LinkedIn member Urn/Profile
   */
  async resolveMemberProfile(username) {
    const endpoints = [
      // 1. Classic Voyager Identity Profiles endpoint
      `${this.baseURL}/identity/profiles/${encodeURIComponent(username)}/profileView`,
      // 2. Voyager Dash Member Identity endpoint
      `${this.baseURL}/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(username)}`,
      // 3. GraphQL Vanity query
      `${this.baseURL}/graphql?variables=(vanityName:${encodeURIComponent(username)})&queryId=voyageIdentityDashProfiles.622b7b5dc6439546b4ec2b55b9ebca72`
    ];

    for (const url of endpoints) {
      try {
        console.log(`[Voyager API] Trying endpoint: ${url}`);
        const res = await axios.get(url, {
          headers: this.getHeaders(),
          timeout: 8000,
          validateStatus: () => true
        });

        console.log(`[Voyager API] Status: ${res.status}`);
        if (res.status === 200 && res.data) {
          return res.data;
        }
      } catch (err) {
        console.warn(`[Voyager API] ${url} failed:`, err.message);
      }
    }
    return null;
  }

  /**
   * Main profile fetcher
   */
  async fetchProfile(identifier) {
    console.log(`\n========================================`);
    console.log(`[LinkedInClient] Processing: "${identifier}"`);
    console.log(`========================================\n`);

    if (!this.isConfigured()) {
      throw new Error('LinkedIn credentials (LINKEDIN_LI_AT and LINKEDIN_JSESSIONID) are missing from environment variables.');
    }

    const targetUsername = identifier.trim();

    // 1. Try authenticated Voyager API
    const rawVoyager = await this.resolveMemberProfile(targetUsername);
    if (rawVoyager) {
      console.log(`[LinkedInClient] ✅ Successfully resolved via Voyager REST API!`);
      const normalized = normalizeLinkedInProfile(rawVoyager, targetUsername);
      return {
        profile: normalized,
        raw: rawVoyager
      };
    }

    // 2. Fetch full public web page and parse deeply
    try {
      const pageUrl = `https://www.linkedin.com/in/${encodeURIComponent(targetUsername)}/`;
      console.log(`[LinkedInClient] Fetching public web page: ${pageUrl}`);
      const res = await axios.get(pageUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': this.getCookieHeader()
        },
        timeout: 9000,
        validateStatus: () => true
      });

      console.log(`[LinkedInClient] Public page status: ${res.status}, Body length: ${res.data?.length || 0}`);

      if (res.status === 200 && typeof res.data === 'string') {
        const parsedProfile = parseHtmlProfile(res.data, targetUsername);
        if (parsedProfile) {
          console.log(`[LinkedInClient] ✅ Successfully extracted full profile fields!`);
          return {
            profile: parsedProfile,
            raw: { source: 'html_dom_parser' }
          };
        }
      }
    } catch (e) {
      console.error(`[LinkedInClient] Web page fetch error:`, e.message);
    }

    throw new Error(`Could not retrieve full profile data for '${targetUsername}'.`);
  }
}

module.exports = LinkedInClient;
