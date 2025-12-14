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

### Production Docker with HTTPS

For a production deployment with automatic HTTPS/SSL certificates:

**1. Configure your environment:**

```bash
# Copy the example environment file
cp .env.production.example .env.production

# Edit with your settings
nano .env.production
```

Set these values in `.env.production`:
- `DOMAIN` - Your domain name (e.g., `cotrainer.example.com`)
- `EMAIL` - Your email for Let's Encrypt notifications
- `POSTGRES_PASSWORD` - Strong database password
- `SECRET_KEY` - Generate with: `openssl rand -hex 32`
- `NOTION_API_KEY` - Your Notion integration API key
- `NOTION_DATABASE_ID` - Your Notion database ID

**2. Point your domain DNS to your server:**
```
A Record: @ -> YOUR_SERVER_IP
```

**3. Initialize SSL certificate:**

```bash
# Make script executable
chmod +x nginx/init-letsencrypt.sh

# Run the script (it reads DOMAIN and EMAIL from .env.production)
# First with staging certificate for testing
./nginx/init-letsencrypt.sh

# The script will prompt if there are issues
# Alternatively, you can pass domain and email as arguments:
# ./nginx/init-letsencrypt.sh skaterscript.com your-email@example.com 0
```

**4. Start the application:**

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

Your application will be available at `https://your-domain.com` with automatic SSL certificate renewal every 90 days.

**View logs:**
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

**Update application:**
```bash
git pull
docker-compose -f docker-compose.prod.yml up -d --build
```

For complete deployment documentation, see [DEPLOYMENT.md](DEPLOYMENT.md).

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
