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
      'Accept': 'application/vnd.linkedin.normalized+json+2.1, application/json, text/plain, */*',
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

  async fetchProfile(identifier) {
    if (!this.isConfigured()) {
      throw new Error('LinkedIn credentials (LINKEDIN_LI_AT and LINKEDIN_JSESSIONID) are missing from environment variables.');
    }

    const targetUsername = identifier.trim();

    // 1. Direct REST & Voyager API Calls with maxRedirects: 0 (No redirect loops)
    const voyagerUrls = [
      `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(targetUsername)}`,
      `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(targetUsername)}&decorationId=com.linkedin.voyage.dash.deco.identity.profile.FullProfileWithEntities-93`,
      `https://www.linkedin.com/voyager/api/identity/profiles/${encodeURIComponent(targetUsername)}/profileView`,
      `https://www.linkedin.com/voyager/api/graphql?variables=(vanityName:${encodeURIComponent(targetUsername)})&queryId=voyageIdentityDashProfiles.622b7b5dc6439546b4ec2b55b9ebca72`
    ];

    for (const url of voyagerUrls) {
      try {
        console.log(`[Voyager API] Calling: ${url}`);
        const res = await axios.get(url, {
          headers: this.getHeaders(),
          timeout: 8000,
          maxRedirects: 0, // Prevents redirect loops completely
          validateStatus: (status) => status < 400
        });

        console.log(`[Voyager API] Status: ${res.status}`);
        if (res.status === 200 && res.data && (res.data.data || res.data.included)) {
          console.log(`[LinkedInClient] ✅ Successfully resolved via Voyager REST API!`);
          return {
            profile: normalizeLinkedInProfile(res.data, targetUsername),
            raw: res.data
          };
        }
      } catch (err) {
        console.warn(`[Voyager API] Note on ${url}:`, err.response?.status || err.message);
      }
    }

    // 2. Fetch Public Profile HTML fallback with maxRedirects: 0
    try {
      const pageUrl = `https://www.linkedin.com/in/${encodeURIComponent(targetUsername)}/`;
      console.log(`[LinkedInClient] Fetching public web page: ${pageUrl}`);
      const res = await axios.get(pageUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': this.getCookieHeader(),
          'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"'
        },
        timeout: 9000,
        maxRedirects: 0,
        validateStatus: (status) => status < 400
      });

      console.log(`[LinkedInClient] Public Page Status: ${res.status}`);
      if (res.status === 200 && typeof res.data === 'string') {
        const parsedProfile = parseHtmlProfile(res.data, targetUsername);
        if (parsedProfile) {
          console.log(`[LinkedInClient] ✅ Successfully resolved via HTML DOM Parser!`);
          return {
            profile: parsedProfile,
            raw: { source: 'html_dom_parser' }
          };
        }
      }
    } catch (e) {
      console.warn(`[LinkedInClient] Public page note:`, e.response?.status || e.message);
    }

    throw new Error(`Could not retrieve full profile data for '${targetUsername}'.`);
  }
}

module.exports = LinkedInClient;
