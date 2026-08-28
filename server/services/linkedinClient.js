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
    console.log(`\n========================================`);
    console.log(`[LinkedInClient] Fetching profile for: "${identifier}"`);
    console.log(`[LinkedInClient] Auth Check: li_at present? ${Boolean(this.liAt)} (Length: ${this.liAt?.length || 0})`);
    console.log(`[LinkedInClient] Auth Check: JSESSIONID present? ${Boolean(this.jsessionid)} (Length: ${this.jsessionid?.length || 0})`);
    console.log(`[LinkedInClient] Formatted CSRF Token: "${this.getCsrfToken()}"`);
    console.log(`========================================\n`);

    if (!this.isConfigured()) {
      throw new Error('LinkedIn credentials (LINKEDIN_LI_AT and LINKEDIN_JSESSIONID) are missing from environment variables.');
    }

    const targetUsername = identifier.trim();

    // 1. Voyage Dash Identity Profile Endpoint
    try {
      const url1 = `${this.baseURL}/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(targetUsername)}&decorationId=com.linkedin.voyage.dash.deco.identity.profile.FullProfileWithEntities-93`;
      console.log(`[Strategy 1] Calling Voyage Dash API: ${url1}`);
      const res1 = await axios.get(url1, {
        headers: this.getHeaders(),
        timeout: 8000,
        validateStatus: () => true
      });

      console.log(`[Strategy 1] Status Code: ${res1.status}`);
      if (res1.status === 200 && res1.data && (res1.data.data || res1.data.included)) {
        console.log(`[Strategy 1] ✅ Successfully extracted data from Voyage Dash API!`);
        return {
          profile: normalizeLinkedInProfile(res1.data, targetUsername),
          raw: res1.data
        };
      } else {
        console.log(`[Strategy 1] ⚠️ Response preview:`, typeof res1.data === 'object' ? JSON.stringify(res1.data).slice(0, 200) : String(res1.data).slice(0, 200));
      }
    } catch (e) {
      console.error(`[Strategy 1] ❌ Error:`, e.message);
    }

    // 2. Standard ProfileView Endpoint
    try {
      const url2 = `${this.baseURL}/identity/profiles/${encodeURIComponent(targetUsername)}/profileView`;
      console.log(`[Strategy 2] Calling ProfileView API: ${url2}`);
      const res2 = await axios.get(url2, {
        headers: this.getHeaders(),
        timeout: 8000,
        validateStatus: () => true
      });

      console.log(`[Strategy 2] Status Code: ${res2.status}`);
      if (res2.status === 200 && res2.data) {
        console.log(`[Strategy 2] ✅ Successfully extracted data from ProfileView API!`);
        return {
          profile: normalizeLinkedInProfile(res2.data, targetUsername),
          raw: res2.data
        };
      } else {
        console.log(`[Strategy 2] ⚠️ Response preview:`, typeof res2.data === 'object' ? JSON.stringify(res2.data).slice(0, 200) : String(res2.data).slice(0, 200));
      }
    } catch (e) {}

    // 3. Web HTML + JSON-LD Schema Extractor
    try {
      const url3 = `https://www.linkedin.com/in/${encodeURIComponent(targetUsername)}/`;
      console.log(`[Strategy 3] Calling Public Profile URL: ${url3}`);
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

      console.log(`[Strategy 3] Status Code: ${res3.status}`);
      if (res3.status === 200 && typeof res3.data === 'string') {
        const html = res3.data;
        console.log(`[Strategy 3] HTML received length: ${html.length} chars. Parsing tags...`);

        // Check embedded code tags
        const codeMatches = html.match(/<code[^>]*>(.*?)<\/code>/gs) || [];
        console.log(`[Strategy 3] Found ${codeMatches.length} <code> blocks in HTML.`);
        for (const block of codeMatches) {
          const innerJson = block.replace(/<\/?code[^>]*>/g, '').trim();
          try {
            const parsed = JSON.parse(innerJson);
            if (parsed.included || parsed.data) {
              console.log(`[Strategy 3] ✅ Successfully parsed internal <code> entity graph!`);
              return {
                profile: normalizeLinkedInProfile(parsed, targetUsername),
                raw: parsed
              };
            }
          } catch (jsonErr) {}
        }

        // Parse JSON-LD and OpenGraph metadata
        const parsedProfile = parseHtmlProfile(html, targetUsername);
        if (parsedProfile) {
          console.log(`[Strategy 3] ✅ Successfully parsed OpenGraph / JSON-LD metadata for: ${parsedProfile.fullName}`);
          return {
            profile: parsedProfile,
            raw: { source: 'html_jsonld_parser' }
          };
        } else {
          console.log(`[Strategy 3] ⚠️ HTML Parser could not identify structured fields.`);
        }
      }
    } catch (e) {
      console.error(`[Strategy 3] ❌ Error:`, e.message);
    }

    throw new Error(`Could not fetch data for '${targetUsername}'. Please check the Vercel logs for detailed step-by-step diagnostic output.`);
  }
}

module.exports = LinkedInClient;
