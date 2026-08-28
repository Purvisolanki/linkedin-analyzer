# LinkedIn Profile API (Reverse Engineered) - MERN Stack

A high-performance, reverse-engineered LinkedIn Profile API and interactive MERN dashboard. This solution directly queries LinkedIn's internal **Voyage GraphQL & REST APIs** (`/voyage/api/identity/dash/profiles`) using authenticated session cookies (`li_at` and `JSESSIONID`), returning complete structured JSON profile data.

> **Zero Browser Automation:** This system does **NOT** use Puppeteer, Playwright, or Selenium. It executes pure HTTP network calls directly to LinkedIn's private Voyage endpoints with CSRF token exchange.

---

## Features

- **Direct Reverse Engineered Voyage API**: Communicates directly with LinkedIn's internal normalized JSON endpoints.
- **Complete Profile Extraction**:
  - Name, Headline, Location, About Summary
  - High-Resolution Profile Pictures & Background Banners
  - Complete Experience (Role, Company, Dates, Location, Descriptions)
  - Education (Institution, Degrees, Field of Study, Dates)
  - Skills & Endorsement Counts
  - Certifications & Licenses
  - Languages & Proficiencies
- **Dual Mode Caching Engine**: High-speed in-memory LRU cache + MongoDB schema persistence to prevent rate-limiting.
- **RESTful Endpoints**: Both `GET` (query params) and `POST` (JSON body) supported.
- **Modern Interactive Dashboard**: Built with React + Vite + Lucide icons to test profiles live, copy JSON, download `.json` files, and view visual resumes.
- **Production Ready**: Security middleware (`helmet`, `cors`, `express-rate-limit`), logging (`morgan`), and multi-platform deployment readiness.

---

## Reverse Engineering Approach

LinkedIn web client utilizes private internal endpoints prefixed under the **Voyage** service layer. To retrieve full profile graphs without rendering a browser:

1. **Authentication Handshake**:
   - `li_at`: LinkedIn's primary HTTP-only session cookie.
   - `JSESSIONID`: CSRF session token. Sent as `Cookie: JSESSIONID="ajax:xxxx"` and verified via the `csrf-token: ajax:xxxx` HTTP request header.
2. **Endpoint**:
   - Primary: `https://www.linkedin.com/voyage/api/identity/dash/profiles?q=memberIdentity&memberIdentity={username}&decorationId=com.linkedin.voyage.dash.deco.identity.profile.FullProfileWithEntities-93`
   - Fallback: `https://www.linkedin.com/voyage/api/identity/profiles/{username}/profileView`
3. **Protocol Headers**:
   - `Accept: application/vnd.linkedin.normalized+json+2.1`
   - `x-restli-protocol-version: 2.0.0`
4. **Entity Resolution & Normalization**:
   LinkedIn returns normalized graph payloads containing an array of `included` entities (`Profile`, `Position`, `Education`, `Skill`, `Certification`, `VectorImage`). The normalizer in [server/services/normalizer.js](file:///server/services/normalizer.js) traverses the graph, extracts the highest resolution image artifacts, unifies date ranges, and produces a clean JSON structure.

---

## Response Schema

```json
{
  "success": true,
  "source": "live_linkedin_api",
  "data": {
    "publicIdentifier": "williamhgates",
    "urn": "urn:li:fsd_profile:ACoAAA...",
    "fullName": "Bill Gates",
    "firstName": "Bill",
    "lastName": "Gates",
    "headline": "Co-chair, Bill & Melinda Gates Foundation",
    "location": "Seattle, Washington, United States",
    "about": "Co-chair of the Bill & Melinda Gates Foundation. Founder of Breakthrough Energy...",
    "profilePicture": "https://media.licdn.com/dms/image/v2/...",
    "backgroundPicture": "https://media.licdn.com/dms/image/v2/...",
    "experience": [
      {
        "title": "Co-chair",
        "company": "Bill & Melinda Gates Foundation",
        "location": "Seattle, WA",
        "dateRange": "Jan 2000 - Present",
        "startDate": "Jan 2000",
        "endDate": "Present",
        "description": "Working together to reduce poverty, disease, and inequity around the world."
      }
    ],
    "education": [
      {
        "schoolName": "Harvard University",
        "degreeName": "",
        "fieldOfStudy": "",
        "dateRange": "1973 - 1975",
        "startDate": "1973",
        "endDate": "1975"
      }
    ],
    "skills": [
      {
        "name": "Philanthropy",
        "endorsementsCount": 99
      }
    ],
    "certifications": [],
    "languages": [
      {
        "name": "English",
        "proficiency": "Native or bilingual proficiency"
      }
    ],
    "stats": {
      "experienceCount": 1,
      "educationCount": 1,
      "skillsCount": 1,
      "certificationsCount": 0,
      "languagesCount": 1
    }
  },
  "timestamp": "2026-08-29T00:35:00.000Z"
}
```

---

## Setup & Running Locally

### 1. Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- Valid LinkedIn Account (for session cookies)

### 2. Clone & Install
```bash
git clone <YOUR_GITHUB_REPO_URL>
cd ontross

# Install backend dependencies
npm install

# Install frontend dependencies
npm --prefix client install
```

### 3. Extracting LinkedIn Session Cookies
1. Open [LinkedIn](https://www.linkedin.com) in your web browser and log in.
2. Open DevTools (F12 or Right Click -> Inspect).
3. Navigate to **Application** (Chrome/Edge) or **Storage** (Firefox) -> **Cookies** -> `https://www.linkedin.com`.
4. Copy the values of:
   - `li_at`
   - `JSESSIONID` (keep the `ajax:...` format with quotes)

### 4. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` and fill in your values:
```env
PORT=5000
NODE_ENV=development
LINKEDIN_LI_AT=AQEDA...
LINKEDIN_JSESSIONID="ajax:1234567890123456789"
# Optional MongoDB URI
# MONGODB_URI=mongodb://localhost:27017/linkedin_scraper
```

### 5. Run Application
```bash
# Start Backend Server (Port 5000)
npm run server

# Start React Frontend (Port 5173) in a second terminal
npm run client
```
Visit `http://localhost:5173` to access the interactive dashboard.

---

## API Documentation

### 1. Extract Profile (GET)
```http
GET /api/profile?url=https://www.linkedin.com/in/williamhgates
```
**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Optional* | Full LinkedIn profile URL |
| `identifier` | string | Optional* | Vanity username e.g. `williamhgates` |
| `refresh` | boolean | Optional | Set `true` to bypass cache and force live fetch |
*\* Either `url` or `identifier` is required.*

### 2. Extract Profile (POST)
```http
POST /api/profile
Content-Type: application/json

{
  "url": "https://www.linkedin.com/in/williamhgates",
  "refresh": false
}
```

### 3. Server Health Status (GET)
```http
GET /api/health
```
Returns system uptime and confirms if LinkedIn cookies are active.

---

## Public Deployment (HTTPS)

### Option A: Vercel (Fastest & 100% Free Serverless)
This repository includes native Vercel serverless support via [`vercel.json`](file:///vercel.json) and [`api/index.js`](file:///api/index.js).

1. Push your code to a **Public GitHub repository**.
2. Go to **[vercel.com](https://vercel.com)** and click **"Add New..."** -> **"Project"**.
3. Import your GitHub repository.
4. Set **Build and Output Settings**:
   - **Build Command**: `npm run build`
   - **Output Directory**: `client/dist`
5. Add your **Environment Variables** in Vercel:
   - `LINKEDIN_LI_AT` = `<YOUR_LI_AT_COOKIE>`
   - `LINKEDIN_JSESSIONID` = `"ajax:..."`
6. Click **Deploy**. Vercel will instantly give you a free, lightning-fast HTTPS deployment (e.g. `https://your-project.vercel.app`) serving both the API and the React frontend!

### Option B: Render / Railway

---

## Known Limitations & Considerations

1. **Session Expiry**: LinkedIn `li_at` cookies usually remain valid for 6 months to 1 year unless you log out of that browser session. If expired, cookies must be refreshed in the environment variables.
2. **Rate Limits & Checkpoints**: Excessive concurrent requests on a single cookie can trigger LinkedIn's security checkpoint / CAPTCHA challenge. The built-in caching engine and rate limiters mitigate this.
3. **Private / Out-of-Network Profiles**: If a profile has strict privacy settings configured to hide certain sections (e.g. email, phone, or experiences) from members outside their network, those sections will reflect the privacy restrictions set by that user on LinkedIn.
