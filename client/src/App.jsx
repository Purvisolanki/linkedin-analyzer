import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Code2, 
  User, 
  Briefcase, 
  GraduationCap, 
  Award, 
  Globe, 
  Copy, 
  Check,
  Download, 
  ExternalLink,
  Sun,
  Moon,
  ArrowRight,
  RefreshCw,
  Sparkles
} from 'lucide-react';

const API_BASE = '/api';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('visual');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const sampleProfiles = [
    { label: 'Bill Gates', url: 'https://www.linkedin.com/in/williamhgates' },
    { label: 'Satya Nadella', url: 'https://www.linkedin.com/in/satyanadella' },
    { label: 'Sundar Pichai', url: 'https://www.linkedin.com/in/sundarpichai' }
  ];

  const handleFetchProfile = async (targetUrl = urlInput, forceRefresh = false) => {
    if (!targetUrl.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const endpoint = `${API_BASE}/profile?url=${encodeURIComponent(targetUrl.trim())}${forceRefresh ? '&refresh=true' : ''}`;
      const res = await fetch(endpoint);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not fetch profile.');
      }

      setProfileData(data.data);
    } catch (err) {
      setError(err.message);
      setProfileData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (!profileData) return;
    navigator.clipboard.writeText(JSON.stringify(profileData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    if (!profileData) return;
    const blob = new Blob([JSON.stringify(profileData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profileData.publicIdentifier || 'profile'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-container">
      {/* Clean Navbar */}
      <header className="navbar">
        <div className="brand">
          <div className="brand-logo">in</div>
          <div>
            <div className="brand-title">Profile API</div>
            <div className="brand-tag">LinkedIn Data Extractor</div>
          </div>
        </div>

        <div className="nav-actions">
          <button 
            className="theme-toggle-btn" 
            onClick={toggleTheme} 
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun size={18} color="#f59e0b" /> : <Moon size={18} color="#6366f1" />}
          </button>
        </div>
      </header>

      {/* Hero & Search */}
      <section className="panel hero-section">
        <h1 className="hero-headline">
          Get <span className="gradient-text">LinkedIn Profile Data</span> as JSON
        </h1>
        
        <p className="hero-description">
          Enter any public LinkedIn profile URL to extract structured profile information, work history, education, and skills.
        </p>

        {/* Search Bar */}
        <form 
          className="search-box-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleFetchProfile();
          }}
        >
          <Search className="search-icon-inside" size={19} />
          <input 
            type="text"
            className="search-input-field"
            placeholder="Paste LinkedIn URL (e.g. https://www.linkedin.com/in/williamhgates)"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <button 
            type="submit" 
            className="btn-search"
            disabled={loading || !urlInput.trim()}
          >
            {loading ? (
              <>
                <div className="spinner-ring" />
                <span>Fetching...</span>
              </>
            ) : (
              <>
                <span>Search</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {/* Sample Pills */}
        <div className="quick-pills">
          <span className="quick-pill-label">Examples:</span>
          {sampleProfiles.map((item, idx) => (
            <button 
              key={idx} 
              type="button"
              className="quick-pill-btn"
              onClick={() => {
                setUrlInput(item.url);
                handleFetchProfile(item.url);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* Error Alert */}
      {error && (
        <div className="panel fade-in" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem', borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.08)' }}>
          <div style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.95rem' }}>
            {error}
          </div>
          {error.includes('credentials') && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
              Add <code>LINKEDIN_LI_AT</code> and <code>LINKEDIN_JSESSIONID</code> in your Vercel Environment Variables.
            </div>
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="tabs-nav">
        <button 
          className={`tab-nav-btn ${activeTab === 'visual' ? 'active' : ''}`}
          onClick={() => setActiveTab('visual')}
        >
          <User size={16} /> Profile View
        </button>
        <button 
          className={`tab-nav-btn ${activeTab === 'json' ? 'active' : ''}`}
          onClick={() => setActiveTab('json')}
        >
          <Code2 size={16} /> JSON Response
        </button>
        <button 
          className={`tab-nav-btn ${activeTab === 'docs' ? 'active' : ''}`}
          onClick={() => setActiveTab('docs')}
        >
          <Globe size={16} /> API Docs
        </button>
      </div>

      {/* TAB 1: Visual Resume */}
      {activeTab === 'visual' && (
        <div className="fade-in">
          {loading && (
            <div className="panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div className="spinner-ring" style={{ width: 32, height: 32, borderWidth: 3, margin: '0 auto 1.25rem', borderColor: 'rgba(99, 102, 241, 0.2)', borderTopColor: 'var(--accent-primary)' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.3rem' }}>Fetching Profile...</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Reading profile details and formatting response</p>
            </div>
          )}

          {!loading && !profileData && !error && (
            <div className="panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-pill)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: 'var(--text-muted)' }}>
                <User size={26} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem' }}>No Profile Loaded</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto', fontSize: '0.92rem' }}>
                Enter a profile URL above or pick an example to view details.
              </p>
            </div>
          )}

          {!loading && profileData && (
            <div>
              {/* Profile Card Header */}
              <div className="panel profile-card-header">
                <div 
                  className="profile-cover-banner"
                  style={profileData.backgroundPicture ? { backgroundImage: `url(${profileData.backgroundPicture})` } : {}}
                >
                  <div className="profile-cover-overlay" />
                </div>
                
                <div className="profile-info-body">
                  <div className="profile-avatar-row">
                    <img 
                      src={profileData.profilePicture || 'https://static.licdn.com/aero-v1/sc/h/9c8pery4andgg6nwjkctxshak'} 
                      alt={profileData.fullName}
                      className="profile-avatar-img"
                    />
                    <div className="profile-action-btns">
                      <button 
                        className="btn-secondary" 
                        onClick={() => handleFetchProfile(profileData.publicIdentifier, true)}
                      >
                        <RefreshCw size={14} /> Refresh
                      </button>
                      <a 
                        href={`https://www.linkedin.com/in/${profileData.publicIdentifier}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="btn-secondary"
                      >
                        <ExternalLink size={14} /> Open in LinkedIn
                      </a>
                    </div>
                  </div>

                  <h2 className="profile-full-name">{profileData.fullName}</h2>
                  <p className="profile-tagline">{profileData.headline || 'No headline available'}</p>

                  <div className="profile-chips-bar">
                    {profileData.location && (
                      <span className="profile-chip-item">
                        <Globe size={14} color="var(--accent-primary)" /> {profileData.location}
                      </span>
                    )}
                    <span className="profile-chip-item">
                      <Briefcase size={14} color="var(--accent-cyan)" /> {profileData.experience?.length || 0} Experience items
                    </span>
                    <span className="profile-chip-item">
                      <GraduationCap size={14} color="var(--accent-emerald)" /> {profileData.education?.length || 0} Education items
                    </span>
                  </div>

                  {profileData.about && (
                    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>About</h4>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.94rem', whiteSpace: 'pre-line' }}>
                        {profileData.about}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Profile Details Grid */}
              <div className="profile-content-grid">
                <div>
                  {/* Experience */}
                  <div className="panel" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
                    <h3 className="section-heading">
                      <Briefcase className="section-heading-icon" size={20} />
                      <span>Experience</span>
                    </h3>
                    
                    {(!profileData.experience || profileData.experience.length === 0) ? (
                      <p style={{ color: 'var(--text-muted)' }}>No experience details listed.</p>
                    ) : (
                      profileData.experience.map((exp, i) => (
                        <div key={i} className="experience-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                              <div className="exp-title">{exp.title}</div>
                              <div className="exp-company">{exp.company}</div>
                            </div>
                            {exp.dateRange && <div className="exp-date">{exp.dateRange}</div>}
                          </div>
                          {exp.location && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{exp.location}</div>}
                          {exp.description && <div className="exp-desc">{exp.description}</div>}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Education */}
                  <div className="panel" style={{ padding: '1.75rem' }}>
                    <h3 className="section-heading">
                      <GraduationCap className="section-heading-icon" size={20} />
                      <span>Education</span>
                    </h3>

                    {(!profileData.education || profileData.education.length === 0) ? (
                      <p style={{ color: 'var(--text-muted)' }}>No education records listed.</p>
                    ) : (
                      profileData.education.map((edu, i) => (
                        <div key={i} className="experience-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                              <div className="exp-title">{edu.schoolName}</div>
                              <div className="exp-company" style={{ color: 'var(--text-secondary)' }}>
                                {[edu.degreeName, edu.fieldOfStudy].filter(Boolean).join(' • ')}
                              </div>
                            </div>
                            {edu.dateRange && <div className="exp-date">{edu.dateRange}</div>}
                          </div>
                          {edu.description && <div className="exp-desc">{edu.description}</div>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Column: Skills, Certifications, Languages */}
                <div>
                  {/* Skills */}
                  <div className="panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h3 className="section-heading">
                      <Sparkles className="section-heading-icon" size={18} />
                      <span>Skills</span>
                    </h3>

                    {(!profileData.skills || profileData.skills.length === 0) ? (
                      <p style={{ color: 'var(--text-muted)' }}>No skills listed.</p>
                    ) : (
                      <div className="skills-badge-wrap">
                        {profileData.skills.map((s, idx) => (
                          <span key={idx} className="skill-pill">
                            {typeof s === 'string' ? s : s.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Certifications */}
                  {profileData.certifications && profileData.certifications.length > 0 && (
                    <div className="panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                      <h3 className="section-heading">
                        <Award className="section-heading-icon" size={18} />
                        <span>Certifications</span>
                      </h3>
                      {profileData.certifications.map((c, i) => (
                        <div key={i} style={{ marginBottom: '0.85rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{c.name}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{c.authority}</div>
                          {c.dateRange && <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.15rem' }}>{c.dateRange}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Languages */}
                  {profileData.languages && profileData.languages.length > 0 && (
                    <div className="panel" style={{ padding: '1.5rem' }}>
                      <h3 className="section-heading">
                        <Globe className="section-heading-icon" size={18} />
                        <span>Languages</span>
                      </h3>
                      {profileData.languages.map((l, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.88rem' }}>
                          <span style={{ fontWeight: 600 }}>{l.name}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{l.proficiency || 'Proficient'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Clean JSON Viewer */}
      {activeTab === 'json' && (
        <div className="fade-in">
          <div className="code-viewer-shell">
            <div className="code-header-bar">
              <div className="code-mac-dots">
                <span className="mac-dot" style={{ background: '#ff5f56' }} />
                <span className="mac-dot" style={{ background: '#ffbd2e' }} />
                <span className="mac-dot" style={{ background: '#27c93f' }} />
              </div>
              <div style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                output.json
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={handleCopyJson}
                  disabled={!profileData}
                >
                  {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={handleDownloadJson}
                  disabled={!profileData}
                >
                  <Download size={14} />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {profileData ? (
              <pre className="code-pre-box">
                {JSON.stringify(profileData, null, 2)}
              </pre>
            ) : (
              <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No data loaded yet. Search for a profile first.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: API Integration Docs */}
      {activeTab === 'docs' && (
        <div className="panel fade-in" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            API Usage
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', fontSize: '0.95rem' }}>
            Call the API from your code or automation tool:
          </p>

          <div className="api-doc-block">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span className="http-badge http-get">GET</span>
              <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>/api/profile?url=&#123;LINKEDIN_URL&#125;</code>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Returns clean JSON with name, headline, experience, education, skills, and image URLs.
            </p>
          </div>

          <div className="api-doc-block">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span className="http-badge http-post">POST</span>
              <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>/api/profile</code>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
              Send JSON body:
            </p>
            <pre style={{ background: 'var(--bg-code)', padding: '0.75rem 1rem', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#93c5fd' }}>
{`{
  "url": "https://www.linkedin.com/in/williamhgates"
}`}
            </pre>
          </div>
        </div>
      )}

      {/* Clean Footer */}
      <footer style={{ textAlign: 'center', marginTop: '3.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        LinkedIn Profile API
      </footer>
    </div>
  );
}
