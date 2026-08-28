/**
 * LinkedIn URL & Username Validator and Parser
 */

/**
 * Extracts public identifier / vanity username from LinkedIn profile URL or raw username.
 * Supports various formats:
 * - https://www.linkedin.com/in/williamhgates
 * - https://www.linkedin.com/in/williamhgates/
 * - https://in.linkedin.com/in/williamhgates?miniProfileUrn=...
 * - linkedin.com/in/williamhgates
 * - williamhgates
 * 
 * @param {string} input 
 * @returns {string|null} Parsed vanity username/identifier
 */
function extractLinkedInIdentifier(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  let cleaned = input.trim();

  // Remove trailing query params or hash if present
  cleaned = cleaned.split('?')[0].split('#')[0];

  // If full URL
  const urlPattern = /(?:https?:\/\/)?(?:www\.|[a-z]{2,3}\.)?linkedin\.com\/in\/([a-zA-Z0-9_\-%]+)/i;
  const match = cleaned.match(urlPattern);

  if (match && match[1]) {
    return decodeURIComponent(match[1].replace(/\/+$/, ''));
  }

  // If given a raw username or identifier
  const usernamePattern = /^[a-zA-Z0-9_\-%]+$/;
  if (usernamePattern.test(cleaned) && !cleaned.includes('linkedin.com')) {
    return decodeURIComponent(cleaned);
  }

  return null;
}

module.exports = {
  extractLinkedInIdentifier
};
