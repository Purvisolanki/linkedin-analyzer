/**
 * LinkedIn URL & Username Validator and Parser
 */

function extractLinkedInIdentifier(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  let cleaned = input.trim();

  // Remove trailing query parameters and hashes
  cleaned = cleaned.split('?')[0].split('#')[0];

  // Pattern 1: Full LinkedIn profile URLs (e.g. linkedin.com/in/username or https://in.linkedin.com/in/username/)
  const urlPattern = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([a-zA-Z0-9_\-%]+)/i;
  const match = cleaned.match(urlPattern);

  if (match && match[1]) {
    return decodeURIComponent(match[1].replace(/\/+$/, ''));
  }

  // Pattern 2: Raw vanity identifier without spaces (e.g. "williamhgates", "abhay-tiwari-123")
  const vanityPattern = /^[a-zA-Z0-9_\-%]+$/;
  if (vanityPattern.test(cleaned) && !cleaned.includes('linkedin.com')) {
    return decodeURIComponent(cleaned);
  }

  // Pattern 3: If user typed full name with spaces e.g. "abhhay tiwari", convert to hyphenated format "abhhay-tiwari"
  if (/^[a-zA-Z0-9_\-\s%]+$/.test(cleaned)) {
    return encodeURIComponent(cleaned.trim().replace(/\s+/g, '-').toLowerCase());
  }

  return null;
}

module.exports = {
  extractLinkedInIdentifier
};
