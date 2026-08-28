/**
 * Robust HTML and Meta tag Parser for LinkedIn Public Profiles
 */

function parseHtmlProfile(html, username) {
  if (!html || typeof html !== 'string') return null;

  // 1. Check for Embedded JSON inside <code> tags
  const codeMatches = html.match(/<code[^>]*>(.*?)<\/code>/gs) || [];
  for (const block of codeMatches) {
    const innerJson = block.replace(/<\/?code[^>]*>/g, '').trim();
    try {
      const parsed = JSON.parse(innerJson);
      const profile = parsed?.data?.data || parsed?.data || parsed;
      if (profile.publicIdentifier || profile.firstName) {
        return {
          publicIdentifier: profile.publicIdentifier || username,
          fullName: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || username,
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          headline: profile.headline || profile.occupation || '',
          location: profile.locationName || profile.geoLocationName || '',
          about: profile.summary || '',
          profilePicture: profile.picture?.['com.linkedin.common.VectorImage']?.rootUrl || null,
          experience: [],
          education: [],
          skills: [],
          certifications: [],
          languages: [],
          stats: { experienceCount: 0, educationCount: 0, skillsCount: 0, certificationsCount: 0, languagesCount: 0 }
        };
      }
    } catch (e) {}
  }

  // 2. Try JSON-LD Metadata Schema
  const jsonLdMatches = html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs) || [];
  let schemaData = null;

  for (const match of jsonLdMatches) {
    const raw = match.replace(/<\/?script[^>]*>/g, '').trim();
    try {
      const parsed = JSON.parse(raw);
      if (parsed['@type'] === 'Person') {
        schemaData = parsed;
        break;
      }
      if (Array.isArray(parsed['@graph'])) {
        schemaData = parsed['@graph'].find(i => i['@type'] === 'Person');
        if (schemaData) break;
      }
    } catch (e) {}
  }

  // 3. Fallback extraction of Meta and OpenGraph tags
  const getMeta = (prop) => {
    const patterns = [
      new RegExp(`<meta\\s+property=["']og:${prop}["']\\s+content=["'](.*?)["']`, 'i'),
      new RegExp(`<meta\\s+content=["'](.*?)["']\\s+property=["']og:${prop}["']`, 'i'),
      new RegExp(`<meta\\s+name=["']${prop}["']\\s+content=["'](.*?)["']`, 'i'),
      new RegExp(`<meta\\s+content=["'](.*?)["']\\s+name=["']${prop}["']`, 'i')
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m && m[1]) return m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
    }
    return null;
  };

  const titleMeta = getMeta('title') || '';
  const descMeta = getMeta('description') || '';
  const imageMeta = getMeta('image') || null;

  let fullName = schemaData?.name || '';
  let headline = schemaData?.jobTitle || '';
  let location = schemaData?.address?.addressLocality || '';
  let about = schemaData?.description || descMeta;
  let profilePicture = schemaData?.image?.contentUrl || schemaData?.image || imageMeta;

  if (!fullName && titleMeta) {
    const cleanTitle = titleMeta.replace(/\s*\|\s*LinkedIn.*$/i, '').trim();
    const parts = cleanTitle.split(/[-–—]/);
    if (parts.length > 0) fullName = parts[0].trim();
    if (parts.length > 1) headline = parts.slice(1).join(' - ').trim();
  }

  const experience = [];
  if (schemaData?.worksFor) {
    const works = Array.isArray(schemaData.worksFor) ? schemaData.worksFor : [schemaData.worksFor];
    works.forEach(w => {
      if (w.name) {
        experience.push({
          title: headline || 'Current Position',
          company: w.name,
          dateRange: 'Present',
          location: location || ''
        });
      }
    });
  }

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

  // If title was found, we guarantee a successful parsed profile
  if (fullName || titleMeta || descMeta) {
    const finalName = fullName || username;
    return {
      publicIdentifier: username,
      urn: '',
      fullName: finalName,
      firstName: finalName.split(' ')[0] || '',
      lastName: finalName.split(' ').slice(1).join(' ') || '',
      headline: headline || 'LinkedIn Member',
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

  return null;
}

module.exports = {
  parseHtmlProfile
};
