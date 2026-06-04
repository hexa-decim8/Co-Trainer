# Co-Trainer - Roller Derby Practice Planner

A web application for planning roller derby practices with Notion database integration. Build practice timelines by dragging and dropping drills, filter exercises by multiple criteria, and reference your plans on mobile during practice.

## Quick Start

```bash
chmod +x start.sh
./start.sh
```

Open `http://localhost:3000` in your browser, navigate to Settings, and configure your Notion integration credentials.

## Features

- Web-based configuration for Notion credentials (no manual .env editing)
- Notion database integration for drill management
- Multi-criteria filtering (contact level, difficulty, drill type, equipment, position focus, skater level)
- Drag-and-drop timeline builder for 2-hour practice sessions
- Three practice types: Fundamentals, Skills & Drills, and Scrimmage
- Adjustable drill durations with automatic timeline reflow
- Save practices as dated plans or reusable templates
- Mobile-optimized view with stopwatch and progress tracking

## Notion Database Schema

Your Notion database requires the following properties:

| Property | Type | Description |
|----------|------|-------------|
| Exercise | Title | Drill name |
| Avg Time | Number | Duration in minutes |
| Contact Level | Select | Contact level classification |
| Depends on | Multi-select | Prerequisite drills |
| Description | Text | Drill instructions |
| Difficulty 1-5 | Number | Rating from 1-5 |
| Drill Type | Select | Drill category |
| Equipment | Select | Required equipment |
| Game Type | Select | Game/scrimmage type |
| Players | Number | Player count |
| Position Focus | Multi-select | Target positions |
| Skater Level | Multi-select | Appropriate skill levels |
| Skaters Needed | Number | Total skaters required |
| Type | Multi-select | Practice categories |
| Video Link | URL | Demonstration video |

## Installation

### Prerequisites

- Python 3.9+
- Node.js 18+
- Notion account with API access

### Setup

**Backend:**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On macOS/Linux
# OR
.\venv\Scripts\Activate  # On Windows
pip install -r requirements.txt
```

**Frontend:**

```bash
cd frontend
npm install
```

### Working with Virtual Environment

The virtual environment isolates project dependencies from your system Python. Here's what you need to know:

**Activating the virtual environment:**
```bash
cd backend
source venv/bin/activate  # macOS/Linux
# OR
.\venv\Scripts\Activate  # Windows
```

When activated, your prompt will show `(venv)` prefix.

**Deactivating:**
```bash
deactivate
```

**Installing new packages:**
```bash
# Make sure venv is activated first
pip install package-name
```

### Notion Integration

1. Create an integration at [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Grant "Read content" permissions
3. Connect the integration to your drill database
4. Copy the Integration Token and Database ID
5. Enter credentials in the Settings page at `http://localhost:3000`

## Running the Application

### Quick Start

```bash
./start.sh
```

### Manual Start

**Backend (Terminal 1):**

```bash
cd backend
source venv/bin/activate  # macOS/Linux - activate venv first
python main.py
```

Runs on `http://localhost:8000`

**Frontend (Terminal 2):**

```bash
cd frontend
npm run dev
```

Runs on `http://localhost:3000`

## Usage

### Mobile View

Access saved practices from the Plan Library. The mobile view includes:

- Stopwatch with start/stop/reset controls
- Equipment checklist
- Drill timeline with start/end times
- Progress tracking
- Drill detail expansion with video links
- Current drill highlighting based on elapsed time

## Project Structure

```
backend/
├── main.py              # FastAPI application entry point
├── models.py            # Pydantic data models
├── database.py          # SQLAlchemy ORM setup
├── notion_service.py    # Notion API client
├── config.py            # Configuration management
└── requirements.txt

frontend/
├── src/
│   ├── components/      # React components
│   ├── pages/          # Route components
│   ├── api.ts          # API client
│   ├── types.ts        # TypeScript definitions
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## API Endpoints

**Drills:**
- `GET /api/drills` - List drills with optional filters
- `GET /api/filter-options` - Get available filter values

**Practice Plans:**
- `POST /api/plans` - Create practice plan
- `GET /api/plans` - List all plans
- `GET /api/plans/{id}` - Get plan details
- `PUT /api/plans/{id}` - Update plan
- `PATCH /api/plans/{id}/rename` - Rename plan
- `DELETE /api/plans/{id}` - Delete plan
- `GET /api/templates` - List templates

## Technology Stack

**Backend:**
- FastAPI (web framework)
- SQLAlchemy (ORM)
- Notion SDK (API client)
- Pydantic (validation)
- SQLite (storage)

**Frontend:**
- React 18
- TypeScript
- Vite (build tool)
- TanStack Query (data fetching)
- dnd-kit (drag and drop)
- Tailwind CSS (styling)
- React Router (routing)

## Deployment

### Render Deployment (Recommended for Free Hosting)

Deploy Co-Trainer as a single monolithic service on Render with optional persistent database.

#### Prerequisites

- GitHub account with this repository
- Render account (free tier available)
- PostgreSQL database (optional, for data persistence)

#### Quick Deploy to Render

**1. Create a new Web Service:**
- Go to [Render Dashboard](https://dashboard.render.com/)
- Click **New +** → **Web Service**
- Connect your GitHub repository
- Configure service:

```
Name: co-trainer
Environment: Docker
Branch: main
Root Directory: (leave blank)
Dockerfile Path: ./Dockerfile
Port: 8000
Instance Type: Free
```

**2. Set Environment Variables:**

Go to **Environment** tab and add:

```bash
# Required: JWT secret for authentication
SECRET_KEY=your-generated-secret-key-at-least-32-chars

# Optional: Notion integration (if using Notion features)
NOTION_API_KEY=secret_xxxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxx

# Optional: Remote PostgreSQL database (for data persistence)
DATABASE_URL=postgresql://user:password@host:port/database
```

**Generate a SECRET_KEY:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

**3. Deploy:**

Click **Create Web Service** - Render will build and deploy automatically.

Your app will be available at: `https://your-service-name.onrender.com`

#### Database Configuration

**Default (SQLite):**
- Uses local SQLite database
- ⚠️ **Data is lost when instance suspends/restarts** on free tier
- Good for testing only

**Persistent Database (Recommended for Production):**

Choose one of these free PostgreSQL options:

**Option A: Supabase (Recommended)**
1. Sign up at [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → Database → Connection String
4. Copy the `postgres://` URI
5. Add to Render environment variables as `DATABASE_URL`
- Free tier: 500MB storage, no time limit

**Option B: Neon**
1. Sign up at [neon.tech](https://neon.tech)
2. Create database
3. Copy connection string
4. Add to Render as `DATABASE_URL`
- Free tier: 0.5GB storage, serverless

**Option C: PlanetScale**
1. Sign up at [planetscale.com](https://planetscale.com)
2. Create database (MySQL)
3. Get connection string
4. Add to Render as `DATABASE_URL`
- Free tier: 5GB storage
- Note: Requires MySQL-compatible SQLAlchemy settings

**Option D: Self-hosted PostgreSQL**
- Use Oracle Cloud Free Tier (2 VMs, 200GB forever free)
- Run PostgreSQL in Docker
- Connect via: `postgresql://user:pass@your-server-ip:5432/cotrainer`

#### Health Checks

Render will automatically ping `/api/health` to verify the service is running.

#### Logs

View application logs in Render dashboard under **Logs** tab.

#### Updates

Push to your `main` branch - Render auto-deploys on new commits.

Manual deploy: Dashboard → **Manual Deploy** → **Deploy latest commit**

#### Cost Summary

**Free tier limits:**
- Web Service: Free (750 hours/month, suspends after 15 min inactivity)
- Database: Use external free PostgreSQL (Supabase recommended)
- Total cost: **$0/month**

**Paid tier ($7/month):**
- No suspension
- More resources
- Still requires external database for best persistence

### Production Docker (Single Image)

Production now runs as a single image using the root `Dockerfile`. The container serves both API and frontend on port `8000`.

TLS/HTTPS is expected to be handled externally (load balancer, reverse proxy, or hosting platform).

**1. Configure your environment:**

```bash
# Copy the example environment file
cp .env.production.example .env.production

# Edit with your settings
nano .env.production
```

Set these values in `.env.production`:
- `DATABASE_URL` - External PostgreSQL connection string
- `SECRET_KEY` - Generate with: `openssl rand -hex 32`
- `NOTION_API_KEY` - Your Notion integration API key (optional)
- `NOTION_DATABASE_ID` - Your Notion database ID (optional)

**2. Start the application:**

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

**3. Verify health:**

```bash
curl http://localhost:8000/api/health
curl -I http://localhost:8000/
```

**View logs:**
```bash
docker compose -f docker-compose.prod.yml logs -f app
```

**Update application:**
```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

For complete deployment documentation, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Docker Hub Publishing via GitHub Actions

The CI workflow at `.github/workflows/docker-build-test.yml`:
- Builds and smoke-tests the container on pull requests and pushes
- Publishes to Docker Hub on successful pushes to `main`

Set GitHub repository secrets:
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

Optional GitHub repository variable:
- `DOCKERHUB_REPOSITORY` (example: `yourname/co-trainer`)

If `DOCKERHUB_REPOSITORY` is unset, image name defaults to `${DOCKERHUB_USERNAME}/co-trainer`.

Published tags:
- `latest`
- `sha-<short_commit>`

### Development Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - NOTION_API_KEY=${NOTION_API_KEY}
      - NOTION_DATABASE_ID=${NOTION_DATABASE_ID}
    volumes:
      - ./data:/app/data

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
```

### Environment Variables

Create `.env` in the backend directory:

```
NOTION_API_KEY=secret_xxxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxx
DATABASE_URL=sqlite:///./cotrainer.db
```

## Troubleshooting

**Notion API Issues:**
- 401 Unauthorized: Verify API key
- 404 Not Found: Confirm database access permissions
- Empty results: Check database content and column names match schema

**Performance:**
- Backend caches Notion responses
- Restart backend to clear cache
- Large databases (500+ drills) may benefit from pagination

## Contributing

Contributions welcome. Please maintain:
- Existing code style
- TypeScript type definitions
- API documentation
- Mobile responsive design

## License

MIT License
