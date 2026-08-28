const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { normalizeLinkedInProfile } = require('./normalizer');
const { parseHtmlProfile } = require('./htmlParser');

class LinkedInClient {
  constructor(config = {}) {
    this.liAt = (config.liAt || process.env.LINKEDIN_LI_AT || '').trim();
    this.jsessionid = (config.jsessionid || process.env.LINKEDIN_JSESSIONID || '').trim();
    this.linkedApiToken = (config.linkedApiToken || process.env.LINKED_API_TOKEN || '').trim();
    this.linkedApiIdent = (config.linkedApiIdent || process.env.LINKED_API_IDENTIFICATION_TOKEN || '').trim();
    this.baseURL = 'https://www.linkedin.com/voyager/api';
    this.userAgent = process.env.LINKEDIN_USER_AGENT || 
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  }

  getCsrfToken() {
    if (!this.jsessionid) return '';
    return this.jsessionid.replace(/^"|"$/g, '').trim();
  }

  async createSessionClient() {
    const jar = new CookieJar();
    const csrf = this.getCsrfToken();

    if (this.liAt) {
      await jar.setCookie(`li_at=${this.liAt}; Domain=.linkedin.com; Path=/`, 'https://www.linkedin.com');
    }
    if (csrf) {
      await jar.setCookie(`JSESSIONID="${csrf}"; Domain=.linkedin.com; Path=/`, 'https://www.linkedin.com');
    }

    return wrapper(axios.create({
      jar,
      withCredentials: true,
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json',
        'csrf-token': csrf,
        'x-restli-protocol-version': '2.0.0',
        'Referer': 'https://www.linkedin.com/feed/'
      }
    }));
  }

  isConfigured() {
    return Boolean((this.liAt && this.jsessionid) || (this.linkedApiToken && this.linkedApiIdent));
  }

  /**
   * Fetch person using connected LinkedApi gateway if tokens are provided
   */
  async fetchViaLinkedApi(targetUrl) {
    if (!this.linkedApiToken || !this.linkedApiIdent) return null;
    try {
      console.log(`[LinkedApi] Dispatching workflow for: ${targetUrl}`);
      const executeRes = await axios.post('https://api.linkedapi.io/v1/fetch-person', {
        person_url: targetUrl.startsWith('http') ? targetUrl : `https://www.linkedin.com/in/${targetUrl}`,
        retrieve_experience: true,
        retrieve_education: true,
        retrieve_skills: true,
        retrieve_languages: true
      }, {
        headers: {
          'Authorization': `Bearer ${this.linkedApiToken}`,
          'X-Identification-Token': this.linkedApiIdent,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      if (executeRes.data && executeRes.data.data) {
        return executeRes.data.data;
      }
    } catch (err) {
      console.warn(`[LinkedApi Gateway] Note:`, err.message);
    }
    return null;
  }

  async fetchProfile(identifier) {
    if (!this.isConfigured()) {
      throw new Error('LinkedIn credentials (LINKEDIN_LI_AT and LINKEDIN_JSESSIONID) are missing from environment variables.');
    }

    const targetUsername = identifier.trim();

    // 1. LinkedApi Connected Workflow if configured
    const linkedApiResult = await this.fetchViaLinkedApi(targetUsername);
    if (linkedApiResult) {
      return {
        profile: normalizeLinkedInProfile(linkedApiResult, targetUsername),
        raw: linkedApiResult
      };
    }

    // 2. Direct Reverse-Engineered Voyager Endpoints
    const sessionClient = await this.createSessionClient();
    const voyagerUrls = [
      `https://www.linkedin.com/voyager/api/identity/profiles/${encodeURIComponent(targetUsername)}/profileView`,
      `https://www.linkedin.com/voyager/api/entities/people/${encodeURIComponent(targetUsername)}`,
      `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(targetUsername)}`,
      `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${encodeURIComponent(targetUsername)})&queryId=voyageIdentityDashProfiles.c7452e58fa37646d09dae4920fc5b4b9`
    ];

    for (const url of voyagerUrls) {
      try {
        console.log(`[Voyager API] Requesting: ${url}`);
        const res = await sessionClient.get(url, {
          timeout: 10000,
          validateStatus: (status) => status < 500
        });

        console.log(`[Voyager API] Response Status: ${res.status}`);
        if (res.status === 200 && res.data && (res.data.data || res.data.included || res.data.elements || res.data.entityUrn)) {
          console.log(`[LinkedInClient] ✅ Successfully resolved full profile via Voyager API!`);
          return {
            profile: normalizeLinkedInProfile(res.data, targetUsername),
            raw: res.data
          };
        }
      } catch (err) {
        console.warn(`[Voyager API] Note:`, err.message);
      }
    }

    // 3. Public HTML DOM Parser fallback
    try {
      const pageUrl = `https://www.linkedin.com/in/${encodeURIComponent(targetUsername)}/`;
      console.log(`[LinkedInClient] Fetching public page: ${pageUrl}`);
      const res = await axios.get(pageUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 9000,
        validateStatus: (status) => status < 500
      });

      if (res.status === 200 && typeof res.data === 'string') {
        const parsedProfile = parseHtmlProfile(res.data, targetUsername);
        if (parsedProfile) {
          console.log(`[LinkedInClient] ✅ Resolved via Public HTML Schema!`);
          return {
            profile: parsedProfile,
            raw: { source: 'html_dom_parser' }
          };
        }
      }
    } catch (e) {
      console.warn(`[LinkedInClient] Public page note:`, e.message);
    }

    throw new Error(`Could not fetch data for '${targetUsername}'.`);
  }
}

module.exports = LinkedInClient;
