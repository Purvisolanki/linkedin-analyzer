const axios = require('axios');
const { normalizeLinkedInProfile } = require('./normalizer');
const { parseHtmlProfile } = require('./htmlParser');

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
    return this.jsessionid.trim().replace(/^"|"$/g, '');
  }

  getCookieHeader() {
    const rawLiAt = (this.liAt || '').trim();
    const rawJsession = (this.jsessionid || '').trim().replace(/^"|"$/g, '');
    const parts = [];
    if (rawLiAt) parts.push(`li_at=${rawLiAt}`);
    if (rawJsession) parts.push(`JSESSIONID="${rawJsession}"`);
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
      'Referer': 'https://www.linkedin.com/'
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

    // 1. Voyage Dash Identity Profile Endpoint
    try {
      const url1 = `${this.baseURL}/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(targetUsername)}&decorationId=com.linkedin.voyage.dash.deco.identity.profile.FullProfileWithEntities-93`;
      const res1 = await axios.get(url1, {
        headers: this.getHeaders(),
        timeout: 8000,
        validateStatus: () => true
      });

      if (res1.status === 200 && res1.data && (res1.data.data || res1.data.included)) {
        return {
          profile: normalizeLinkedInProfile(res1.data, targetUsername),
          raw: res1.data
        };
      }
    } catch (e) {}

    // 2. Standard ProfileView Endpoint
    try {
      const url2 = `${this.baseURL}/identity/profiles/${encodeURIComponent(targetUsername)}/profileView`;
      const res2 = await axios.get(url2, {
        headers: this.getHeaders(),
        timeout: 8000,
        validateStatus: () => true
      });

      if (res2.status === 200 && res2.data) {
        return {
          profile: normalizeLinkedInProfile(res2.data, targetUsername),
          raw: res2.data
        };
      }
    } catch (e) {}

    // 3. Web HTML + JSON-LD Schema Extractor (HTTP 200 Fallback)
    try {
      const url3 = `https://www.linkedin.com/in/${encodeURIComponent(targetUsername)}/`;
      const res3 = await axios.get(url3, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': this.getCookieHeader()
        },
        timeout: 8000,
        validateStatus: () => true
      });

      if (res3.status === 200 && typeof res3.data === 'string') {
        const html = res3.data;

        // A. Check for embedded raw code tags
        const codeMatches = html.match(/<code style="display:\s*none" id="[^"]+">(.*?)<\/code>/gs) || [];
        for (const block of codeMatches) {
          const innerJson = block.replace(/<\/?code[^>]*>/g, '').trim();
          try {
            const parsed = JSON.parse(innerJson);
            if (parsed.included || parsed.data) {
              return {
                profile: normalizeLinkedInProfile(parsed, targetUsername),
                raw: parsed
              };
            }
          } catch (jsonErr) {}
        }

        // B. Parse JSON-LD metadata & schema graph
        const parsedProfile = parseHtmlProfile(html, targetUsername);
        if (parsedProfile) {
          return {
            profile: parsedProfile,
            raw: { source: 'html_jsonld_parser' }
          };
        }
      }
    } catch (e) {}

    throw new Error(`Could not fetch data for '${targetUsername}'. Please verify that the profile is public and that your LINKEDIN_LI_AT cookie is valid.`);
  }
}

module.exports = LinkedInClient;
