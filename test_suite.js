const { extractLinkedInIdentifier } = require('./server/utils/validator');
const { normalizeLinkedInProfile } = require('./server/services/normalizer');

console.log('--- Running Tests ---');

// 1. URL Parser Tests
const testUrls = [
  'https://www.linkedin.com/in/williamhgates',
  'https://www.linkedin.com/in/williamhgates/',
  'https://in.linkedin.com/in/satyanadella?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3A123',
  'linkedin.com/in/sundarpichai',
  'reidhoffman'
];

testUrls.forEach(url => {
  const parsed = extractLinkedInIdentifier(url);
  console.log(`[URL Test] Input: "${url}" -> Extracted: "${parsed}"`);
  if (!parsed) {
    console.error(`❌ Failed to parse: ${url}`);
    process.exit(1);
  }
});
console.log('✅ URL Validator passed all cases!\n');

// 2. Normalizer Tests with Sample Voyage Entity Graph
const mockVoyageData = {
  included: [
    {
      $type: 'com.linkedin.voyage.dash.identity.profile.Profile',
      publicIdentifier: 'williamhgates',
      firstName: 'Bill',
      lastName: 'Gates',
      headline: 'Co-chair, Bill & Melinda Gates Foundation',
      summary: 'Co-chair of the Bill & Melinda Gates Foundation. Founder of Breakthrough Energy.',
      locationName: 'Seattle, Washington, United States',
      picture: {
        'com.linkedin.common.VectorImage': {
          rootUrl: 'https://media.licdn.com/dms/image/v2/mock/',
          artifacts: [
            { width: 100, fileIdentifyingUrlPathSegment: 'small.jpg' },
            { width: 800, fileIdentifyingUrlPathSegment: 'large.jpg' }
          ]
        }
      }
    },
    {
      $type: 'com.linkedin.voyage.dash.identity.profile.Position',
      title: 'Co-chair',
      companyName: 'Bill & Melinda Gates Foundation',
      locationName: 'Seattle, WA',
      timePeriod: {
        startDate: { year: 2000, month: 1 }
      },
      description: 'Working together to reduce poverty, disease, and inequity around the world.'
    },
    {
      $type: 'com.linkedin.voyage.dash.identity.profile.Education',
      schoolName: 'Harvard University',
      timePeriod: {
        startDate: { year: 1973 },
        endDate: { year: 1975 }
      }
    },
    {
      $type: 'com.linkedin.voyage.dash.identity.profile.Skill',
      name: 'Philanthropy',
      endorsementCount: 99
    },
    {
      $type: 'com.linkedin.voyage.dash.identity.profile.Language',
      name: 'English',
      proficiency: 'Native or bilingual proficiency'
    }
  ]
};

const normalized = normalizeLinkedInProfile(mockVoyageData, 'williamhgates');
console.log('[Normalizer Output]:', JSON.stringify(normalized, null, 2));

if (
  normalized.fullName === 'Bill Gates' &&
  normalized.experience.length === 1 &&
  normalized.education.length === 1 &&
  normalized.skills.length === 1 &&
  normalized.profilePicture === 'https://media.licdn.com/dms/image/v2/mock/large.jpg'
) {
  console.log('✅ Entity Normalizer passed all structural tests!');
} else {
  console.error('❌ Normalizer assertion failed.');
  process.exit(1);
}
