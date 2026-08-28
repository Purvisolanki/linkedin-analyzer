/**
 * Profile Parser for LinkedIn Embedded HTML & Schema JSON-LD
 */

function parseHtmlProfile(html, username) {
  if (!html || typeof html !== 'string') return null;

  // 1. Try extracting JSON-LD schema (Structured Metadata)
  const jsonLdMatches = html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs) || [];
  let schemaData = null;

  for (const match of jsonLdMatches) {
    const raw = match.replace(/<\/?script[^>]*>/g, '').trim();
    try {
      const parsed = JSON.parse(raw);
      if (parsed['@type'] === 'Person' || (parsed['@graph'] && Array.isArray(parsed['@graph']))) {
        schemaData = parsed['@type'] === 'Person' ? parsed : parsed['@graph'].find(i => i['@type'] === 'Person');
        if (schemaData) break;
      }
    } catch (e) {}
  }

  // 2. Parse OpenGraph & Meta tags from HTML
  const getMeta = (prop) => {
    const m = html.match(new RegExp(`<meta\\s+(?:property|name)=["'](?:og:|twitter:)?${prop}["']\\s+content=["'](.*?)["']`, 'i')) ||
              html.match(new RegExp(`<meta\\s+content=["'](.*?)["']\\s+(?:property|name)=["'](?:og:|twitter:)?${prop}["']`, 'i'));
    return m ? m[1] : null;
  };

  const titleMeta = getMeta('title') || '';
  const descMeta = getMeta('description') || '';
  const imageMeta = getMeta('image') || null;

  // 3. Fallback extraction of Full Name & Headline
  let fullName = schemaData?.name || '';
  let headline = schemaData?.jobTitle || '';
  let location = schemaData?.address?.addressLocality || '';
  let about = schemaData?.description || descMeta;
  let profilePicture = schemaData?.image?.contentUrl || schemaData?.image || imageMeta;

  if (!fullName && titleMeta) {
    // LinkedIn format is typically "Bill Gates - Co-chair | LinkedIn"
    const parts = titleMeta.split(/[-–|]/);
    if (parts.length > 0) fullName = parts[0].trim();
    if (parts.length > 1) headline = parts[1].trim();
  }

  // 4. Extract Experience from JSON-LD or meta descriptions
  const experience = [];
  if (schemaData?.worksFor) {
    const works = Array.isArray(schemaData.worksFor) ? schemaData.worksFor : [schemaData.worksFor];
    works.forEach(w => {
      if (w.name) {
        experience.push({
          title: headline || 'Member',
          company: w.name,
          dateRange: 'Present',
          location: location || ''
        });
      }
    });
  }

  // 5. Extract Education
  const education = [];
  if (schemaData?.alumniOf) {
    const schools = Array.isArray(schemaData.alumniOf) ? schemaData.alumniOf : [schemaData.alumniOf];
    schools.forEach(s => {
      if (s.name) {
        education.push({
          schoolName: s.name,
          degreeName: '',
          fieldOfStudy: '',
          dateRange: null
        });
      }
    });
  }

  if (!fullName && !headline && !about) {
    return null;
  }

  return {
    publicIdentifier: username,
    urn: '',
    fullName: fullName || username,
    firstName: fullName ? fullName.split(' ')[0] : '',
    lastName: fullName ? fullName.split(' ').slice(1).join(' ') : '',
    headline: headline || '',
    location: location || '',
    about: about || '',
    profilePicture,
    backgroundPicture: null,
    experience,
    education,
    skills: [],
    certifications: [],
    languages: [],
    stats: {
      experienceCount: experience.length,
      educationCount: education.length,
      skillsCount: 0,
      certificationsCount: 0,
      languagesCount: 0
    }
  };
}

module.exports = {
  parseHtmlProfile
};
