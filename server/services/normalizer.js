/**
 * LinkedIn Entity Normalizer
 * Transforms LinkedIn Dash / Voyage normalized JSON responses & GraphQL entities
 * into a clean, human-readable, and well-structured JSON document.
 */

/**
 * Extracts high resolution vector or artifact URL from LinkedIn Image Vector format.
 * @param {Object} vectorImage 
 * @returns {string|null}
 */
function extractImageUrl(vectorImage) {
  if (!vectorImage) return null;

  try {
    const rootUrl = vectorImage.rootUrl || '';
    const artifacts = vectorImage.artifacts || [];

    if (!artifacts || artifacts.length === 0) {
      return rootUrl || null;
    }

    // Pick largest artifact by width or last artifact
    const sorted = [...artifacts].sort((a, b) => (b.width || 0) - (a.width || 0));
    const bestArtifact = sorted[0];
    const segment = bestArtifact.fileIdentifyingUrlPathSegment || '';

    if (!rootUrl && !segment) return null;
    return `${rootUrl}${segment}`;
  } catch (err) {
    return null;
  }
}

/**
 * Formats a Date object or LinkedIn Year/Month object to readable string (e.g., "Jan 2021")
 * @param {Object} dateObj 
 * @returns {string|null}
 */
function formatDate(dateObj) {
  if (!dateObj) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  if (typeof dateObj === 'string') return dateObj;

  const year = dateObj.year;
  const month = dateObj.month ? months[dateObj.month - 1] : null;

  if (month && year) return `${month} ${year}`;
  if (year) return `${year}`;
  return null;
}

/**
 * Formats a date range object
 * @param {Object} timePeriod 
 * @returns {string|null}
 */
function formatDateRange(timePeriod) {
  if (!timePeriod) return null;
  const startDate = formatDate(timePeriod.startDate);
  const endDate = timePeriod.endDate ? formatDate(timePeriod.endDate) : 'Present';

  if (!startDate && !endDate) return null;
  if (!startDate) return endDate;
  return `${startDate} - ${endDate}`;
}

/**
 * Normalizes LinkedIn raw Voyage Dash response entities
 * @param {Object} rawData - Response from Voyage profile API
 * @param {string} requestedUsername - Target username
 * @returns {Object} Clean structured profile
 */
function normalizeLinkedInProfile(rawData, requestedUsername) {
  if (!rawData) {
    throw new Error('No raw LinkedIn data provided for normalization');
  }

  const included = Array.isArray(rawData.included) ? rawData.included : [];
  const rootData = rawData.data || {};

  // 1. Locate primary profile entity
  let profileEntity = included.find(
    (item) => item.$type === 'com.linkedin.voyage.dash.identity.profile.Profile' ||
              item.$type === 'com.linkedin.voyage.identity.profile.Profile'
  );

  // Fallback to searching by publicIdentifier if multiple profile types exist
  if (!profileEntity && requestedUsername) {
    profileEntity = included.find(
      (item) => (item.publicIdentifier && item.publicIdentifier.toLowerCase() === requestedUsername.toLowerCase())
    );
  }

  // If still not found in included, inspect root
  if (!profileEntity && rootData.publicIdentifier) {
    profileEntity = rootData;
  }

  // 2. Extract Basic Profile Info
  const firstName = profileEntity?.firstName || '';
  const lastName = profileEntity?.lastName || '';
  const fullName = profileEntity?.fullName || `${firstName} ${lastName}`.trim() || requestedUsername;
  const headline = profileEntity?.headline || profileEntity?.miniProfile?.occupation || '';
  const publicIdentifier = profileEntity?.publicIdentifier || requestedUsername;
  const urn = profileEntity?.entityUrn || profileEntity?.urn || '';

  // Location extraction
  const locationName = profileEntity?.locationName || 
                       profileEntity?.geoLocationName || 
                       profileEntity?.location?.name || 
                       profileEntity?.geoRegion || '';

  // Summary / About
  const about = profileEntity?.summary || profileEntity?.about || '';

  // Profile Picture & Background Picture
  let profilePicture = null;
  let backgroundPicture = null;

  if (profileEntity?.picture?.['com.linkedin.common.VectorImage']) {
    profilePicture = extractImageUrl(profileEntity.picture['com.linkedin.common.VectorImage']);
  } else if (profileEntity?.profilePicture?.displayImageReference?.vectorImage) {
    profilePicture = extractImageUrl(profileEntity.profilePicture.displayImageReference.vectorImage);
  }

  if (profileEntity?.backgroundPicture?.['com.linkedin.common.VectorImage']) {
    backgroundPicture = extractImageUrl(profileEntity.backgroundPicture['com.linkedin.common.VectorImage']);
  } else if (profileEntity?.backgroundImage?.displayImageReference?.vectorImage) {
    backgroundPicture = extractImageUrl(profileEntity.backgroundImage.displayImageReference.vectorImage);
  }

  // 3. Extract Experience (Positions)
  const experienceEntities = included.filter((item) =>
    item.$type === 'com.linkedin.voyage.dash.identity.profile.Position' ||
    item.$type === 'com.linkedin.voyage.identity.profile.Position' ||
    item.$type === 'com.linkedin.voyage.dash.identity.profile.PositionGroup'
  );

  const experience = experienceEntities.map((pos) => {
    // Determine company logo if present
    let companyLogo = null;
    if (pos.companyLogo?.['com.linkedin.common.VectorImage']) {
      companyLogo = extractImageUrl(pos.companyLogo['com.linkedin.common.VectorImage']);
    } else if (pos.companyLogoUrl) {
      companyLogo = pos.companyLogoUrl;
    }

    return {
      title: pos.title || pos.name || '',
      company: pos.companyName || pos.company?.name || '',
      companyUrn: pos.companyUrn || pos.company?.entityUrn || null,
      companyLogo,
      location: pos.locationName || pos.geoLocationName || '',
      dateRange: formatDateRange(pos.timePeriod) || (pos.dateRange ? `${pos.dateRange.start || ''} - ${pos.dateRange.end || 'Present'}` : null),
      startDate: formatDate(pos.timePeriod?.startDate),
      endDate: pos.timePeriod?.endDate ? formatDate(pos.timePeriod.endDate) : 'Present',
      description: pos.description || '',
      employmentType: pos.employmentType || null
    };
  }).filter((item) => item.title || item.company);

  // 4. Extract Education
  const educationEntities = included.filter((item) =>
    item.$type === 'com.linkedin.voyage.dash.identity.profile.Education' ||
    item.$type === 'com.linkedin.voyage.identity.profile.EducationGroup' ||
    item.$type === 'com.linkedin.voyage.identity.profile.Education'
  );

  const education = educationEntities.map((edu) => {
    let schoolLogo = null;
    if (edu.schoolLogo?.['com.linkedin.common.VectorImage']) {
      schoolLogo = extractImageUrl(edu.schoolLogo['com.linkedin.common.VectorImage']);
    }

    return {
      schoolName: edu.schoolName || edu.school?.name || '',
      degreeName: edu.degreeName || '',
      fieldOfStudy: edu.fieldsOfStudy?.[0] || edu.fieldOfStudy || '',
      dateRange: formatDateRange(edu.timePeriod) || null,
      startDate: formatDate(edu.timePeriod?.startDate),
      endDate: formatDate(edu.timePeriod?.endDate),
      grade: edu.grade || null,
      activities: edu.activities || null,
      description: edu.description || '',
      schoolLogo
    };
  }).filter((item) => item.schoolName);

  // 5. Extract Skills
  const skillEntities = included.filter((item) =>
    item.$type === 'com.linkedin.voyage.dash.identity.profile.Skill' ||
    item.$type === 'com.linkedin.voyage.identity.profile.Skill'
  );

  const skills = skillEntities.map((s) => ({
    name: s.name || s.skillName || '',
    endorsementsCount: s.endorsementCount || s.endorsementsCount || 0
  })).filter((s) => s.name);

  // 6. Extract Certifications / Licenses
  const certEntities = included.filter((item) =>
    item.$type === 'com.linkedin.voyage.dash.identity.profile.Certification' ||
    item.$type === 'com.linkedin.voyage.identity.profile.Certification'
  );

  const certifications = certEntities.map((c) => ({
    name: c.name || c.authority || '',
    authority: c.authority || c.companyName || '',
    url: c.url || c.licenseUrl || null,
    dateRange: formatDateRange(c.timePeriod) || formatDate(c.issuedOn),
    licenseNumber: c.licenseNumber || null
  })).filter((c) => c.name);

  // 7. Extract Languages
  const langEntities = included.filter((item) =>
    item.$type === 'com.linkedin.voyage.dash.identity.profile.Language' ||
    item.$type === 'com.linkedin.voyage.identity.profile.Language'
  );

  const languages = langEntities.map((l) => ({
    name: l.name || '',
    proficiency: l.proficiency || null
  })).filter((l) => l.name);

  // 8. Extract Honors & Awards
  const honorEntities = included.filter((item) =>
    item.$type === 'com.linkedin.voyage.dash.identity.profile.Honor'
  );

  const honors = honorEntities.map((h) => ({
    title: h.title || '',
    issuer: h.issuer || '',
    issueDate: formatDate(h.issueDate),
    description: h.description || ''
  })).filter((h) => h.title);

  // 9. Extract Projects
  const projectEntities = included.filter((item) =>
    item.$type === 'com.linkedin.voyage.dash.identity.profile.Project'
  );

  const projects = projectEntities.map((p) => ({
    title: p.title || '',
    description: p.description || '',
    url: p.url || null,
    dateRange: formatDateRange(p.timePeriod)
  })).filter((p) => p.title);

  return {
    publicIdentifier,
    urn,
    fullName,
    firstName,
    lastName,
    headline,
    location: locationName,
    about,
    profilePicture,
    backgroundPicture,
    experience,
    education,
    skills,
    certifications,
    languages,
    honors,
    projects,
    stats: {
      experienceCount: experience.length,
      educationCount: education.length,
      skillsCount: skills.length,
      certificationsCount: certifications.length,
      languagesCount: languages.length
    }
  };
}

module.exports = {
  normalizeLinkedInProfile,
  extractImageUrl,
  formatDateRange
};
