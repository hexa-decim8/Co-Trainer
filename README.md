# Co-Trainer - Roller Derby Practice Planner

A web application for planning roller derby practices with Notion database integration. Build practice timelines by dragging and dropping drills, filter exercises by multiple criteria, and reference your plans on mobile during practice.

## Quick Start

```bash
chmod +x start.sh
./start.sh
```

Open `http://localhost:3000` in your browser, navigate to Settings, and configure your Notion integration credentials.

## Data Persistence (Docker)

When running with Docker Compose, Co-Trainer persists critical runtime data in named volumes:

- `cotrainer_pgdata` -> `/var/lib/postgresql/data` (PostgreSQL database — all user accounts and practice plans)
- `cotrainer_config` -> `/app/config` (encrypted credentials + JWT secret key)

This means user accounts and login-related secrets survive container restarts and image updates.

Recommended for stable auth across host/container changes:

- Set `SECRET_KEY` in your Compose environment (for example in a local `.env` file).
- The app now prefers this value as the JWT signing key, so refresh tokens remain valid across image rebuilds even if `/app/config` is recreated.

Lifecycle behavior:

- `docker compose up -d` / `docker compose restart`: data persists
- `docker compose down` then `docker compose up -d`: data persists
- `docker compose down -v`: deletes volumes and resets all persisted app data

## Features

- Web-based configuration for Notion credentials (no manual .env editing)
- Notion database integration for drill management
- Multi-criteria filtering (contact level, difficulty, drill type, equipment, position focus, skater level)
- Drag-and-drop timeline builder for 2-hour practice sessions
- Three practice types: Fundamentals, Skills & Drills, and Scrimmage
- Adjustable drill durations with automatic timeline reflow
- Save practices as dated plans or reusable templates
- Mobile-optimized view with stopwatch and progress tracking

## Native iPhone App Directory

All iPhone-specific files are kept under `mobile/ios`.

- Put Swift files, Xcode project/workspace files, Info.plist, and entitlements in `mobile/ios`.
- Do not add iPhone-specific files to `frontend/` or `backend/`.
- Start from `mobile/ios/README.md` for iOS structure and setup notes.

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



### Mobile View

Access saved practices from the Plan Library. The mobile view includes:

- Stopwatch with start/stop/reset controls
- Equipment checklist
- Drill timeline with start/end times
- Progress tracking
- Drill detail expansion with video links
- Current drill highlighting based on elapsed time


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



#### Prerequisites

- GitHub account with this repository
- Render account (free tier available)
- PostgreSQL database (optional, for data persistence)

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





## License

MIT License
