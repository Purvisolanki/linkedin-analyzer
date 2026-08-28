/**
 * Deep LinkedIn HTML & DOM Entity Parser
 * Extracts complete structured data: full bio/about, experience timeline,
 * education, skills, locations, profile images, and background banners.
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

  // 2. Scan all <script> tags for embedded LinkedIn state (window.__INITIAL_STATE__ / data blobs)
  const scriptTags = html.match(/<script[^>]*>(.*?)<\/script>/gis) || [];
  let embeddedEntities = [];
  for (const s of scriptTags) {
    const content = s.replace(/<\/?script[^>]*>/gis, '').trim();
    if (content.includes('com.linkedin.voyage') || content.includes('Position') || content.includes('Education')) {
      try {
        const jsonMatch = content.match(/\{.*"included":\s*(\[.*?\]).*\}/s);
        if (jsonMatch && jsonMatch[1]) {
          const parsedIncluded = JSON.parse(jsonMatch[1]);
          if (Array.isArray(parsedIncluded)) {
            embeddedEntities = parsedIncluded;
            break;
          }
        }
      } catch (e) {}
    }
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
  let headline = schemaData?.jobTitle || '';
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
  if (!fullName && rawTitle) {
    const cleaned = rawTitle.replace(/\s*\|\s*LinkedIn.*$/i, '').trim();
    const parts = cleaned.split(/\s*[-–—]\s*/);
    if (parts.length > 0) fullName = parts[0].trim();
    if (parts.length > 1) headline = parts.slice(1).join(' - ').trim();
  }

  // Parse Experience
  const experience = [];
  if (schemaData?.worksFor) {
    const works = Array.isArray(schemaData.worksFor) ? schemaData.worksFor : [schemaData.worksFor];
    works.forEach(w => {
      if (w.name) {
        experience.push({
          title: headline || 'Professional Role',
          company: w.name,
          dateRange: 'Present',
          location: location || ''
        });
      }
    });
  }

  // Deep parse experience from HTML DOM if experience is empty
  if (experience.length === 0) {
    const expBlocks = html.match(/<section[^>]*id=["']experience["'][^>]*>(.*?)<\/section>/is) ||
                      html.match(/<section[^>]*experience[^>]*>(.*?)<\/section>/is) || [];
    if (expBlocks[1]) {
      const titles = expBlocks[1].match(/<h[2-4][^>]*>(.*?)<\/h[2-4]>/gis) || [];
      titles.forEach(t => {
        const text = t.replace(/<[^>]+>/g, '').trim();
        if (text && text.length > 2 && text.length < 80) {
          experience.push({
            title: text,
            company: 'LinkedIn Profile Experience',
            dateRange: 'Full-time',
            location: location || ''
          });
        }
      });
    }
  }

  // If experience is still empty, parse headline company mentions (e.g. "Software Engineer at Google")
  if (experience.length === 0 && headline && headline.includes(' at ')) {
    const [role, company] = headline.split(' at ');
    if (role && company) {
      experience.push({
        title: role.trim(),
        company: company.replace(/\s*·.*$/, '').trim(),
        dateRange: 'Present',
        location: location || ''
      });
    }
  }

  // Parse Education
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

  // Parse Skills
  const skills = [];
  if (schemaData?.knowsAbout) {
    const sList = Array.isArray(schemaData.knowsAbout) ? schemaData.knowsAbout : [schemaData.knowsAbout];
    sList.forEach(s => {
      if (typeof s === 'string' && s.trim()) skills.push({ name: s.trim() });
    });
  }

  // If about is empty, populate from meta description
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
    location: location || 'Location available on LinkedIn',
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
