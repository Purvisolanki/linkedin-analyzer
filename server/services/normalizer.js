/**
 * Enhanced LinkedIn Profile Normalizer
 * Extracts complete profile fields: Contact info (email, phones, websites, addresses),
 * Experience, Education, Skills, Birthdate, and Vector Images.
 */

function extractImageUrl(vectorImage) {
  if (!vectorImage) return null;
  try {
    const rootUrl = vectorImage.rootUrl || '';
    const artifacts = vectorImage.artifacts || [];
    if (!artifacts || artifacts.length === 0) return rootUrl || null;
    const sorted = [...artifacts].sort((a, b) => (b.width || 0) - (a.width || 0));
    const bestArtifact = sorted[0];
    const segment = bestArtifact.fileIdentifyingUrlPathSegment || '';
    return `${rootUrl}${segment}`;
  } catch (err) {
    return null;
  }
}

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

function formatDateRange(timePeriod) {
  if (!timePeriod) return null;
  const startDate = formatDate(timePeriod.startDate);
  const endDate = timePeriod.endDate ? formatDate(timePeriod.endDate) : 'Present';
  if (!startDate && !endDate) return null;
  if (!startDate) return endDate;
  return `${startDate} - ${endDate}`;
}

function getLocaleString(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj.en_US || obj.en || Object.values(obj)[0] || '';
}

function normalizeLinkedInProfile(rawData, requestedUsername) {
  if (!rawData) {
    throw new Error('No raw LinkedIn data provided for normalization');
  }

  const included = Array.isArray(rawData.included) ? rawData.included : [];
  const rootData = rawData.data || {};

  // Check if response is from identityDashProfilesByMemberIdentity GraphQL
  const graphqlElements = rootData?.identityDashProfilesByMemberIdentity?.elements || [];
  const graphqlProfile = graphqlElements[0] || null;

  // 1. Locate primary profile entity
  let profileEntity = graphqlProfile || included.find(
    (item) => item.$type?.includes('profile.Profile') || item.$type?.includes('dash.identity.profile.Profile')
  );

  if (!profileEntity && requestedUsername) {
    profileEntity = included.find(
      (item) => item.publicIdentifier && item.publicIdentifier.toLowerCase() === requestedUsername.toLowerCase()
    );
  }

  if (!profileEntity && included.length > 0) {
    profileEntity = included.find(i => i.firstName || i.multiLocaleFirstName || i.headline) || included[0];
  }

  if (!profileEntity && rootData.publicIdentifier) {
    profileEntity = rootData;
  }

  // 2. Resolve Names, Headline, Location
  const firstName = profileEntity?.firstName || getLocaleString(profileEntity?.multiLocaleFirstName) || '';
  const lastName = profileEntity?.lastName || getLocaleString(profileEntity?.multiLocaleLastName) || '';
  const fullName = profileEntity?.fullName || `${firstName} ${lastName}`.trim() || requestedUsername;
  const headline = profileEntity?.headline || getLocaleString(profileEntity?.multiLocaleHeadline) || profileEntity?.miniProfile?.occupation || '';
  const publicIdentifier = profileEntity?.publicIdentifier || requestedUsername;
  const urn = profileEntity?.entityUrn || profileEntity?.urn || rootData.entityUrn || '';

  const locationName = profileEntity?.locationName || 
                       profileEntity?.geoLocationName || 
                       profileEntity?.location?.name || 
                       profileEntity?.geoRegion || 
                       profileEntity?.address || '';

  const about = profileEntity?.summary || profileEntity?.about || getLocaleString(profileEntity?.multiLocaleSummary) || '';

  // 3. Pictures
  let profilePicture = null;
  let backgroundPicture = null;

  if (profileEntity?.picture?.['com.linkedin.common.VectorImage']) {
    profilePicture = extractImageUrl(profileEntity.picture['com.linkedin.common.VectorImage']);
  } else if (profileEntity?.profilePicture?.displayImageReference?.vectorImage) {
    profilePicture = extractImageUrl(profileEntity.profilePicture.displayImageReference.vectorImage);
  } else if (profileEntity?.profilePicture?.vectorImage) {
    profilePicture = extractImageUrl(profileEntity.profilePicture.vectorImage);
  }

  if (profileEntity?.backgroundPicture?.['com.linkedin.common.VectorImage']) {
    backgroundPicture = extractImageUrl(profileEntity.backgroundPicture['com.linkedin.common.VectorImage']);
  } else if (profileEntity?.backgroundImage?.displayImageReference?.vectorImage) {
    backgroundPicture = extractImageUrl(profileEntity.backgroundImage.displayImageReference.vectorImage);
  }

  // 4. Contact Info (Email, Phone, Websites, Instant Messengers, Birthdate)
  let email = profileEntity?.emailAddress?.emailAddress || profileEntity?.emailAddress || null;
  let phones = [];
  if (Array.isArray(profileEntity?.phoneNumbers)) {
    phones = profileEntity.phoneNumbers.map(p => p.phoneNumber?.number || p.number).filter(Boolean);
  }
  let websites = [];
  if (Array.isArray(profileEntity?.websites)) {
    websites = profileEntity.websites.map(w => w.url).filter(Boolean);
  }
  let birthDate = null;
  if (profileEntity?.birthDateOn) {
    const b = profileEntity.birthDateOn;
    if (b.day && b.month) birthDate = `${b.day}/${b.month}`;
  }

  // 5. Experience
  const experienceEntities = included.filter((item) =>
    item.$type?.includes('Position') || item.$type?.includes('PositionGroup')
  );

  const experience = experienceEntities.map((pos) => {
    let companyLogo = null;
    if (pos.companyLogo?.['com.linkedin.common.VectorImage']) {
      companyLogo = extractImageUrl(pos.companyLogo['com.linkedin.common.VectorImage']);
    } else if (pos.companyLogoUrl) {
      companyLogo = pos.companyLogoUrl;
    }

    return {
      title: pos.title || getLocaleString(pos.multiLocaleTitle) || pos.name || '',
      company: pos.companyName || pos.company?.name || '',
      companyUrn: pos.companyUrn || pos.company?.entityUrn || null,
      companyLogo,
      location: pos.locationName || pos.geoLocationName || '',
      dateRange: formatDateRange(pos.timePeriod) || (pos.dateRange ? `${pos.dateRange.start || ''} - ${pos.dateRange.end || 'Present'}` : null),
      startDate: formatDate(pos.timePeriod?.startDate),
      endDate: pos.timePeriod?.endDate ? formatDate(pos.timePeriod.endDate) : 'Present',
      description: pos.description || getLocaleString(pos.multiLocaleDescription) || '',
      employmentType: pos.employmentType || null
    };
  }).filter((item) => item.title || item.company);

  // 6. Education
  const educationEntities = included.filter((item) => item.$type?.includes('Education'));
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

  // 7. Skills
  const skillEntities = included.filter((item) => item.$type?.includes('Skill'));
  const skills = skillEntities.map((s) => ({
    name: s.name || s.skillName || getLocaleString(s.multiLocaleName) || '',
    endorsementsCount: s.endorsementCount || s.endorsementsCount || 0
  })).filter((s) => s.name);

  // 8. Certifications
  const certEntities = included.filter((item) => item.$type?.includes('Certification'));
  const certifications = certEntities.map((c) => ({
    name: c.name || c.authority || '',
    authority: c.authority || c.companyName || '',
    url: c.url || c.licenseUrl || null,
    dateRange: formatDateRange(c.timePeriod) || formatDate(c.issuedOn),
    licenseNumber: c.licenseNumber || null
  })).filter((c) => c.name);

  // 9. Languages
  const langEntities = included.filter((item) => item.$type?.includes('Language'));
  const languages = langEntities.map((l) => ({
    name: l.name || '',
    proficiency: l.proficiency || null
  })).filter((l) => l.name);

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
    contactInfo: {
      email,
      phones,
      websites,
      birthDate
    },
    experience,
    education,
    skills,
    certifications,
    languages,
    honors: [],
    projects: [],
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
