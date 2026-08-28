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
    return this.jsessionid.trim().replace(/^"|"$/g, '');
  }

  getCookieHeader() {
    const rawLiAt = (this.liAt || '').trim();
    const rawJsession = (this.jsessionid || '').trim().replace(/^"|"$/g, '');
    return `li_at=${rawLiAt}; JSESSIONID="${rawJsession}"; bcookie="v=2&"; lang=v=2&lang=en-us`;
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
      'Referer': 'https://www.linkedin.com/in/'
    };
  }

  isConfigured() {
    return Boolean(this.liAt && this.jsessionid);
  }

  /**
   * Fetches profile using full endpoint cascade with public HTML parser fallback
   */
  async fetchProfile(identifier) {
    if (!this.isConfigured()) {
      throw new Error('LinkedIn credentials (LINKEDIN_LI_AT and LINKEDIN_JSESSIONID) are missing or not configured in environment variables.');
    }

    const targetUsername = identifier.trim();
    const errors = [];

    // Endpoint A: Member Identity GraphQL Decoration endpoint
    try {
      const urlA = `${this.baseURL}/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(targetUsername)}&decorationId=com.linkedin.voyage.dash.deco.identity.profile.FullProfileWithEntities-93`;
      const resA = await axios.get(urlA, {
        headers: this.getHeaders(),
        timeout: 10000,
        validateStatus: () => true
      });

      if (resA.status === 200 && resA.data && (resA.data.data || resA.data.included)) {
        return {
          profile: normalizeLinkedInProfile(resA.data, targetUsername),
          raw: resA.data
        };
      }
      errors.push(`Dash: HTTP ${resA.status}`);
    } catch (e) {
      errors.push(`Dash: ${e.message}`);
    }

    // Endpoint B: Full Profile View endpoint
    try {
      const urlB = `${this.baseURL}/identity/profiles/${encodeURIComponent(targetUsername)}/profileView`;
      const resB = await axios.get(urlB, {
        headers: this.getHeaders(),
        timeout: 10000,
        validateStatus: () => true
      });

      if (resB.status === 200 && resB.data) {
        return {
          profile: normalizeLinkedInProfile(resB.data, targetUsername),
          raw: resB.data
        };
      }
      errors.push(`ProfileView: HTTP ${resB.status}`);
    } catch (e) {
      errors.push(`ProfileView: ${e.message}`);
    }

    // Endpoint C: Mini Profile & Vanity Resolution
    try {
      const urlC = `https://www.linkedin.com/in/${encodeURIComponent(targetUsername)}/`;
      const resC = await axios.get(urlC, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': this.getCookieHeader()
        },
        timeout: 10000,
        validateStatus: () => true
      });

      if (resC.status === 200 && typeof resC.data === 'string') {
        const html = resC.data;
        // Parse embedded JSON-LD or code tags from LinkedIn page
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
          } catch (jsonErr) {
            // continue checking next code tag
          }
        }
      }
      errors.push(`Web HTML: HTTP ${resC.status}`);
    } catch (e) {
      errors.push(`Web HTML: ${e.message}`);
    }

    throw new Error(`LinkedIn session rejected the query for '${targetUsername}'. Please ensure LINKEDIN_LI_AT and LINKEDIN_JSESSIONID cookies are fresh and copied from a logged-in browser session. (${errors.join(' | ')})`);
  }
}

module.exports = LinkedInClient;
