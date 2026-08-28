import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Code2, 
  User, 
  Briefcase, 
  GraduationCap, 
  Award, 
  Globe, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check,
  Download, 
  ExternalLink,
  Layers,
  Sparkles,
  RefreshCw,
  Sun,
  Moon,
  Zap,
  ArrowRight,
  Database
} from 'lucide-react';

const API_BASE = '/api';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('visual'); // 'visual' | 'json' | 'docs'
  const [copied, setCopied] = useState(false);
  const [healthStatus, setHealthStatus] = useState({ checked: false, configured: false });

  // Sync theme attribute to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Curated prominent demo profiles
  const examples = [
    { label: 'Bill Gates', url: 'https://www.linkedin.com/in/williamhgates' },
    { label: 'Satya Nadella', url: 'https://www.linkedin.com/in/satyanadella' },
    { label: 'Sundar Pichai', url: 'https://www.linkedin.com/in/sundarpichai' },
    { label: 'Reid Hoffman', url: 'https://www.linkedin.com/in/reidhoffman' }
  ];

  // Check health and authentication status on load
  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then(res => res.json())
      .then(data => {
        setHealthStatus({ checked: true, configured: data.authConfigured, message: data.message });
      })
      .catch(() => {
        setHealthStatus({ checked: true, configured: false, message: 'Backend unreachable.' });
      });
  }, []);

  const handleFetchProfile = async (targetUrl = urlInput, forceRefresh = false) => {
    if (!targetUrl.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const endpoint = `${API_BASE}/profile?url=${encodeURIComponent(targetUrl.trim())}${forceRefresh ? '&refresh=true' : ''}`;
      const res = await fetch(endpoint);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch LinkedIn profile.');
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
    a.download = `${profileData.publicIdentifier || 'linkedin_profile'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-container">
      {/* Stripe / Google Styled Navbar */}
      <header className="navbar">
        <div className="brand">
          <div className="brand-icon">
            <Layers size={22} />
          </div>
          <div>
            <div className="brand-title">Voyage API Engine</div>
            <div className="brand-tag">LinkedIn Profile Reverse Engineering</div>
          </div>
        </div>

        <div className="nav-actions">
          {healthStatus.checked && (
            <div className={`pill-badge ${healthStatus.configured ? 'pill-success' : 'pill-warning'}`}>
              {healthStatus.configured ? (
                <>
                  <CheckCircle2 size={13} />
                  <span>Session Active</span>
                </>
              ) : (
                <>
                  <AlertCircle size={13} />
                  <span>Missing Credentials</span>
                </>
              )}
            </div>
          )}

          <button 
            className="theme-toggle-btn" 
            onClick={toggleTheme} 
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={19} color="#f59e0b" /> : <Moon size={19} color="#6366f1" />}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="panel hero-section">
        <div className="hero-chip">
          <Zap size={14} />
          <span>Zero Browser Automation • Sub-Second Latency</span>
        </div>

        <h1 className="hero-headline">
          Reverse-Engineered <span className="gradient-text">LinkedIn Profile</span> API
        </h1>
        
        <p className="hero-description">
          Query internal LinkedIn Voyage GraphQL & REST services directly. Extract structured data including resumes, experiences, skills, and high-res vector imagery.
        </p>

        {/* Search Box Form */}
        <form 
          className="search-box-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleFetchProfile();
          }}
        >
          <Search className="search-icon-inside" size={20} />
          <input 
            type="text"
            className="search-input-field"
            placeholder="Paste LinkedIn URL (e.g. https://www.linkedin.com/in/williamhgates) or vanity username"
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
                <span>Extracting</span>
              </>
            ) : (
              <>
                <span>Extract Profile</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Selector */}
        <div className="quick-pills">
          <span className="quick-pill-label">Try instant samples:</span>
          {examples.map((item, idx) => (
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

      {/* Error Alert Display */}
      {error && (
        <div className="panel fade-in" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem', borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
          {!healthStatus.configured && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Please configure your <code>LINKEDIN_LI_AT</code> and <code>LINKEDIN_JSESSIONID</code> cookies in your environment variables.
            </p>
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="tabs-nav">
        <button 
          className={`tab-nav-btn ${activeTab === 'visual' ? 'active' : ''}`}
          onClick={() => setActiveTab('visual')}
        >
          <User size={16} /> Visual Profile
        </button>
        <button 
          className={`tab-nav-btn ${activeTab === 'json' ? 'active' : ''}`}
          onClick={() => setActiveTab('json')}
        >
          <Code2 size={16} /> Structured JSON
        </button>
        <button 
          className={`tab-nav-btn ${activeTab === 'docs' ? 'active' : ''}`}
          onClick={() => setActiveTab('docs')}
        >
          <Globe size={16} /> API Integration
        </button>
      </div>

      {/* TAB 1: Visual Resume & Profile */}
      {activeTab === 'visual' && (
        <div className="fade-in">
          {loading && (
            <div className="panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div className="spinner-ring" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto 1.5rem', borderColor: 'rgba(99, 102, 241, 0.2)', borderTopColor: 'var(--accent-primary)' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Calling LinkedIn Voyage API</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Extracting normalized graph entities, positions, and high-res vector pictures...</p>
            </div>
          )}

          {!loading && !profileData && !error && (
            <div className="panel" style={{ textAlign: 'center', padding: '4.5rem 2rem' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-pill)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: 'var(--text-muted)' }}>
                <User size={30} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Profile Loaded</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: 450, margin: '0 auto' }}>
                Paste any LinkedIn profile link above or click one of the quick samples to inspect complete profile data.
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
                        title="Force live scrape bypass cache"
                      >
                        <RefreshCw size={14} /> Refresh Live
                      </button>
                      <a 
                        href={`https://www.linkedin.com/in/${profileData.publicIdentifier}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="btn-secondary"
                      >
                        <ExternalLink size={14} /> View on LinkedIn
                      </a>
                    </div>
                  </div>

                  <h2 className="profile-full-name">{profileData.fullName}</h2>
                  <p className="profile-tagline">{profileData.headline || 'No headline available'}</p>

                  <div className="profile-chips-bar">
                    {profileData.location && (
                      <span className="profile-chip-item">
                        <Globe size={15} color="var(--accent-primary)" /> {profileData.location}
                      </span>
                    )}
                    <span className="profile-chip-item">
                      <Briefcase size={15} color="var(--accent-cyan)" /> {profileData.experience?.length || 0} Experience items
                    </span>
                    <span className="profile-chip-item">
                      <GraduationCap size={15} color="var(--accent-emerald)" /> {profileData.education?.length || 0} Education items
                    </span>
                  </div>

                  {/* Summary / About */}
                  {profileData.about && (
                    <div style={{ marginTop: '1.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>About</h4>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.96rem', whiteSpace: 'pre-line' }}>
                        {profileData.about}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Grid Content: Experience, Education, Skills, Certifications */}
              <div className="profile-content-grid">
                {/* Left: Experience & Education */}
                <div>
                  {/* Experience Card */}
                  <div className="panel" style={{ padding: '2rem', marginBottom: '1.75rem' }}>
                    <h3 className="section-heading">
                      <Briefcase className="section-heading-icon" size={22} />
                      <span>Experience</span>
                    </h3>
                    
                    {(!profileData.experience || profileData.experience.length === 0) ? (
                      <p style={{ color: 'var(--text-muted)' }}>No experience details available.</p>
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
                          {exp.location && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{exp.location}</div>}
                          {exp.description && <div className="exp-desc">{exp.description}</div>}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Education Card */}
                  <div className="panel" style={{ padding: '2rem' }}>
                    <h3 className="section-heading">
                      <GraduationCap className="section-heading-icon" size={22} />
                      <span>Education</span>
                    </h3>

                    {(!profileData.education || profileData.education.length === 0) ? (
                      <p style={{ color: 'var(--text-muted)' }}>No education records found.</p>
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

                {/* Right: Skills, Certifications, Languages */}
                <div>
                  {/* Skills Card */}
                  <div className="panel" style={{ padding: '1.75rem', marginBottom: '1.75rem' }}>
                    <h3 className="section-heading">
                      <Sparkles className="section-heading-icon" size={20} />
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

                  {/* Certifications Card */}
                  {profileData.certifications && profileData.certifications.length > 0 && (
                    <div className="panel" style={{ padding: '1.75rem', marginBottom: '1.75rem' }}>
                      <h3 className="section-heading">
                        <Award className="section-heading-icon" size={20} />
                        <span>Certifications</span>
                      </h3>
                      {profileData.certifications.map((c, i) => (
                        <div key={i} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{c.name}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{c.authority}</div>
                          {c.dateRange && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>{c.dateRange}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Languages Card */}
                  {profileData.languages && profileData.languages.length > 0 && (
                    <div className="panel" style={{ padding: '1.75rem' }}>
                      <h3 className="section-heading">
                        <Globe className="section-heading-icon" size={20} />
                        <span>Languages</span>
                      </h3>
                      {profileData.languages.map((l, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.65rem', fontSize: '0.9rem' }}>
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

      {/* TAB 2: Structured JSON Code Viewer (Stripe/JetBrains style) */}
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
                response.json
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
                No JSON available. Search a profile first.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: API Integration Docs */}
      {activeTab === 'docs' && (
        <div className="panel fade-in" style={{ padding: '2.5rem' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.75rem' }}>
            API Integration Reference
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
            Connect to this hosted API from any client, backend service, or automation tool over standard HTTPS.
          </p>

          {/* Endpoint 1 */}
          <div className="api-doc-block">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="http-badge http-get">GET</span>
              <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>/api/profile?url=&#123;LINKEDIN_URL&#125;</code>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              Accepts a LinkedIn profile URL or raw username. Returns structured JSON.
            </p>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Optional: <code>&refresh=true</code> forces a fresh live Voyage fetch (bypassing MongoDB cache).
            </div>
          </div>

          {/* Endpoint 2 */}
          <div className="api-doc-block">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="http-badge http-post">POST</span>
              <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>/api/profile</code>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Accepts JSON payload in the request body:
            </p>
            <pre style={{ background: 'var(--bg-code)', padding: '0.75rem 1rem', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#93c5fd' }}>
{`{
  "url": "https://www.linkedin.com/in/williamhgates",
  "refresh": false
}`}
            </pre>
          </div>

          {/* Endpoint 3 */}
          <div className="api-doc-block">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="http-badge http-get">GET</span>
              <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>/api/health</code>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Healthcheck endpoint returning session authentication state.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ textAlign: 'center', marginTop: '3.5rem', color: 'var(--text-muted)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        <span>LinkedIn Voyage Reverse-Engineered Engine</span>
        <span>•</span>
        <span>MERN Stack</span>
      </footer>
    </div>
  );
}
