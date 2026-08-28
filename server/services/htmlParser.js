/**
 * Profile Parser for LinkedIn HTML Pages
 */

function parseHtmlProfile(html, username) {
  if (!html || typeof html !== 'string') return null;

  // 1. Check for JSON-LD structured data (often in <script type="application/ld+json">)
  const jsonLdMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis) || [];
  let schemaData = null;

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

  // 2. Extract <title> tag
  const titleTagMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const titleTag = titleTagMatch ? titleTagMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim() : '';

  // 3. Helper to extract meta tag contents
  const getMeta = (prop) => {
    const regexes = [
      new RegExp(`<meta[^>]+(?:property|name)=["'](?:og:|twitter:)?${prop}["'][^>]+content=["']([^"']*)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["'](?:og:|twitter:)?${prop}["']`, 'i')
    ];
    for (const r of regexes) {
      const m = html.match(r);
      if (m && m[1]) return m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
    }
    return '';
  };

  const titleMeta = getMeta('title');
  const descMeta = getMeta('description');
  const imageMeta = getMeta('image');

  // 4. Resolve Name, Headline, and Location
  let fullName = schemaData?.name || '';
  let headline = schemaData?.jobTitle || '';
  let location = schemaData?.address?.addressLocality || '';
  let about = schemaData?.description || descMeta || '';
  let profilePicture = schemaData?.image?.contentUrl || schemaData?.image || imageMeta || null;

  const rawTitle = titleMeta || titleTag || '';
  if (!fullName && rawTitle) {
    // Format is typically "First Last - Headline | LinkedIn" or "First Last | LinkedIn"
    const cleaned = rawTitle.replace(/\s*\|\s*LinkedIn.*$/i, '').trim();
    const parts = cleaned.split(/\s*[-–—]\s*/);
    if (parts.length > 0) fullName = parts[0].trim();
    if (parts.length > 1) headline = parts.slice(1).join(' - ').trim();
  }

  // If headline is still empty, parse description meta
  if (!headline && descMeta) {
    // Description is often "View Full Name's profile on LinkedIn, a professional community of..."
    const descMatch = descMeta.match(/^(.*?)(?:·|\.|\bat\b|\bwith\b)/i);
    if (descMatch && descMatch[1]) {
      headline = descMatch[1].replace(/^(?:View\s+)?.*?(?:'s\s+profile\s+on\s+LinkedIn\s*[-–,]\s*)?/i, '').trim();
    }
  }

  const experience = [];
  if (schemaData?.worksFor) {
    const works = Array.isArray(schemaData.worksFor) ? schemaData.worksFor : [schemaData.worksFor];
    works.forEach(w => {
      if (w.name) {
        experience.push({
          title: headline || 'Current Role',
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

  // If we have any text or title from the 1MB HTML payload, guarantee profile construction
  if (fullName || rawTitle || descMeta || html.length > 1000) {
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
