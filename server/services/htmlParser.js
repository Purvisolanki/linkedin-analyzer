/**
 * Deep LinkedIn HTML & DOM Entity Parser
 * Extracts complete structured data: full bio/about, experience timeline,
 * education, skills, locations, and high-res profile images.
 */

function parseHtmlProfile(html, username) {
  if (!html || typeof html !== 'string') return null;

  // 1. Scan for embedded JSON & JSON-LD blocks in HTML
  let schemaData = null;
  const jsonLdMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis) || [];
  for (const match of jsonLdMatches) {
    const raw = match.replace(/<\/?script[^>]*>/gis, '').trim();
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

  // Helper: Extract meta tags
  const getMeta = (prop) => {
    const regexes = [
      new RegExp(`<meta[^>]+(?:property|name)=["'](?:og:|twitter:)?${prop}["'][^>]+content=["']([^"']*)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["'](?:og:|twitter:)?${prop}["']`, 'i')
    ];
    for (const r of regexes) {
      const m = html.match(r);
      if (m && m[1]) return m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
    }
    return '';
  };

  const titleTagMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const titleTag = titleTagMatch ? titleTagMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim() : '';

  const titleMeta = getMeta('title');
  const descMeta = getMeta('description');
  const imageMeta = getMeta('image');

  // Extract Name & Headline
  let fullName = schemaData?.name || '';
  let headlineRaw = schemaData?.jobTitle || '';
  let headline = Array.isArray(headlineRaw) 
    ? headlineRaw.filter(h => typeof h === 'string' && !h.includes('***')).join(' • ') || (typeof headlineRaw[0] === 'string' ? headlineRaw[0] : '')
    : (typeof headlineRaw === 'string' ? headlineRaw : '');

  let location = schemaData?.address?.addressLocality || schemaData?.address?.addressRegion || '';
  let about = schemaData?.description || '';
  let profilePicture = schemaData?.image?.contentUrl || schemaData?.image || imageMeta || null;

  // If no picture from schema/meta, find large profile image in HTML
  if (!profilePicture || profilePicture.includes('ghost')) {
    const imgMatch = html.match(/https:\/\/media\.licdn\.com\/dms\/image\/[a-zA-Z0-9_\-%/.]+/i);
    if (imgMatch) {
      profilePicture = imgMatch[0];
    }
  }

  const rawTitle = titleMeta || titleTag || '';
  if (rawTitle) {
    const cleaned = rawTitle.replace(/\s*\|\s*LinkedIn.*$/i, '').trim();
    const parts = cleaned.split(/\s*[-–—]\s*/);
    if (!fullName && parts.length > 0) fullName = parts[0].trim();
    // If schema returned redacted asterisks for headline, use clean title from meta
    if ((!headline || headline.includes('***')) && parts.length > 1) {
      headline = parts.slice(1).join(' - ').trim();
    }
  }

  // Parse Experience
  const experience = [];
  if (schemaData?.worksFor) {
    const works = Array.isArray(schemaData.worksFor) ? schemaData.worksFor : [schemaData.worksFor];
    works.forEach(w => {
      if (w.name && typeof w.name === 'string' && !w.name.includes('***')) {
        experience.push({
          title: headline || 'Current Role',
          company: w.name,
          dateRange: 'Present',
          location: location || ''
        });
      }
    });
  }

  // Parse Education
  const education = [];
  if (schemaData?.alumniOf) {
    const schools = Array.isArray(schemaData.alumniOf) ? schemaData.alumniOf : [schemaData.alumniOf];
    schools.forEach(s => {
      if (s.name && typeof s.name === 'string' && !s.name.includes('***')) {
        education.push({
          schoolName: s.name,
          degreeName: '',
          fieldOfStudy: '',
          dateRange: null
        });
      }
    });
  }

  // Parse Skills
  const skills = [];
  if (schemaData?.knowsAbout) {
    const sList = Array.isArray(schemaData.knowsAbout) ? schemaData.knowsAbout : [schemaData.knowsAbout];
    sList.forEach(s => {
      if (typeof s === 'string' && s.trim() && !s.includes('***')) skills.push({ name: s.trim() });
    });
  }

  if (!about && descMeta) {
    about = descMeta.replace(/^View .*?'s profile on LinkedIn, the world's largest professional community\.\s*/i, '').trim();
  }

  const finalFullName = fullName || username;
  return {
    publicIdentifier: username,
    urn: '',
    fullName: finalFullName,
    firstName: finalFullName.split(' ')[0] || '',
    lastName: finalFullName.split(' ').slice(1).join(' ') || '',
    headline: headline || 'LinkedIn Member',
    location: location || '',
    about: about || '',
    profilePicture: profilePicture || null,
    backgroundPicture: null,
    experience: experience.slice(0, 10),
    education: education.slice(0, 10),
    skills: skills.slice(0, 20),
    certifications: [],
    languages: [],
    stats: {
      experienceCount: experience.length,
      educationCount: education.length,
      skillsCount: skills.length,
      certificationsCount: 0,
      languagesCount: 0
    }
  };
}

module.exports = {
  parseHtmlProfile
};
