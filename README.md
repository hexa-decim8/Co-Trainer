# Co-Trainer - Roller Derby Practice Planner

A comprehensive web application for planning roller derby practices with Notion database integration. Build practice timelines by dragging and dropping drills, filter exercises by tags, and reference your plans on mobile during practice.

## Features

### 🎯 Core Features
- **Notion Integration**: Connects to your Notion database of roller derby drills and exercises
- **Advanced Filtering**: Multi-tag filtering system for Contact Level, Difficulty, Drill Type, Equipment, Position Focus, Skater Level, and more
- **Visual Timeline Builder**: Drag-and-drop interface with 2-hour practice timeline
- **Three Practice Types**: Support for Fundamentals (non-contact), Skills & Drills (full contact), and Scrimmage practices
- **Resizable Drills**: Adjust drill durations directly on the timeline (10-min minimum, 5-min increments)
- **Auto-Reflow**: Timeline automatically reorganizes when drills are added, removed, or resized
- **Template System**: Save practice plans as reusable templates
- **Mobile Reference**: Mobile-optimized view with built-in stopwatch for on-track use

### 📋 Notion Database Schema

Your Notion database should have the following columns:

| Column Name | Type | Notes |
|-------------|------|-------|
| Exercise | Title | Drill name (required) |
| Avg Time | Number | Average duration in minutes |
| Contact Level | Select | Single selection (e.g., Non-Contact, Full Contact) |
| Depends on | Multi-select | Prerequisites for this drill |
| Description | Text | Detailed drill description |
| Difficulty 1-5 | Number | Difficulty rating 1-5 |
| Drill Type | Select | Single selection |
| Equipment | Select | Required equipment |
| Game Type | Select | Type of game/scrimmage |
| Players | Number | Number of players |
| Position Focus | Multi-select | Positions targeted (e.g., Blocker, Jammer) |
| Skater Level | Multi-select | Skill levels (e.g., Beginner, Advanced) |
| Skaters Needed | Number | Total skaters needed |
| Type | Multi-select | Categories (e.g., Warm-up, Skills, Drills, Scrimmage) |
| Video Link | URL | Link to demonstration video |

## Installation

### Prerequisites
- Python 3.9+
- Node.js 18+ and npm
- Notion account with API integration

### 1. Set Up Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Name it "Co-Trainer" and grant it Read content permissions
4. Copy the **Internal Integration Token**
5. Open your Notion database
6. Click the ••• menu → "Add connections" → Select "Co-Trainer"
7. Copy the **Database ID** from the URL:
   ```
   https://notion.so/[workspace]/[DATABASE_ID]?v=...
   ```

### 2. Backend Setup

```powershell
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env with your Notion credentials
# NOTION_API_KEY=your_integration_token_here
# NOTION_DATABASE_ID=your_database_id_here
```

### 3. Frontend Setup

```powershell
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install
```

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```powershell
cd backend
.\venv\Scripts\Activate
python main.py
```
Backend will run on `http://localhost:8000`

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev
```
Frontend will run on `http://localhost:3000`

### Access the Application
- Open your browser to `http://localhost:3000`
- The Practice Planner page will load with your Notion drills

## Usage Guide

### Planning a Practice

1. **Select Practice Type**: Choose Fundamentals, Skills & Drills, or Scrimmage from the dropdown
2. **Filter Drills**: Use the left sidebar to filter drills by:
   - Contact Level (for safety-appropriate drills)
   - Difficulty (skill progression)
   - Type, Position Focus, Skater Level, Equipment, etc.
3. **Search**: Use the search bar to find specific drills by name or description
4. **Drag to Timeline**: Click and drag drill cards from the middle panel to the right timeline
5. **Adjust Duration**: Click the +5/-5 buttons on timeline drills to adjust duration
6. **Reorder**: Drag drills up/down within the timeline to reorder
7. **Review**: Check the total duration (out of 120 minutes) and equipment list
8. **Save**: Click "Save Plan" and choose:
   - **Save Plan**: Save as a dated practice plan
   - **Save as Template**: Save as a reusable template (no date)

### Using Templates

1. Go to **Plan Library** tab
2. Click **Templates** filter
3. Click **View** on a template
4. Use the mobile view or duplicate to create a new practice from the template

### Mobile Reference During Practice

1. From **Plan Library**, click **View** on a practice plan
2. Mobile-optimized view shows:
   - **Stopwatch**: Start/stop/reset timer
   - **Equipment Checklist**: Collapsible list of needed equipment
   - **Drill Timeline**: Sequential list with start/end times
   - **Progress Tracking**: Check off completed drills
   - **Drill Details**: Expand to see full description, video links
   - **Current Drill Highlight**: Based on stopwatch time

## Project Structure

```
Co-Trainer/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── models.py            # Pydantic data models
│   ├── database.py          # SQLAlchemy database setup
│   ├── notion_service.py    # Notion API integration
│   ├── config.py            # Configuration management
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Environment variables template
│
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── Layout.tsx
│   │   │   ├── FilterSidebar.tsx
│   │   │   ├── DrillCard.tsx
│   │   │   ├── DrillDetailModal.tsx
│   │   │   └── TimelinePlanner.tsx
│   │   ├── pages/           # Page components
│   │   │   ├── PlannerPage.tsx
│   │   │   ├── LibraryPage.tsx
│   │   │   └── MobileViewPage.tsx
│   │   ├── api.ts           # API client
│   │   ├── types.ts         # TypeScript types
│   │   ├── App.tsx          # Main app component
│   │   └── main.tsx         # Entry point
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── .gitignore
└── README.md
```

## API Endpoints

### Drills
- `GET /api/drills` - Get all drills with optional filters
- `GET /api/filter-options` - Get available filter values

### Practice Plans
- `POST /api/plans` - Create a new practice plan
- `GET /api/plans` - List all practice plans
- `GET /api/plans/{id}` - Get practice plan with full drill details
- `PUT /api/plans/{id}` - Update a practice plan
- `PATCH /api/plans/{id}/rename` - Rename a practice plan
- `DELETE /api/plans/{id}` - Delete a practice plan
- `GET /api/templates` - Get all templates

## Technology Stack

### Backend
- **FastAPI**: Modern Python web framework
- **SQLAlchemy**: ORM for practice plan storage
- **Notion Client**: Official Notion API SDK
- **Pydantic**: Data validation
- **SQLite**: Lightweight database

### Frontend
- **React 18**: UI library
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool
- **TanStack Query**: Data fetching and caching
- **@dnd-kit**: Drag and drop functionality
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library
- **React Router**: Client-side routing

## Deployment

### Docker Compose (Recommended)

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
Create a `.env` file in the project root:
```
NOTION_API_KEY=secret_xxxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxx
DATABASE_URL=sqlite:///./cotrainer.db
```

## Troubleshooting

### Notion API Issues
- **401 Unauthorized**: Check your Notion API key is correct
- **404 Database Not Found**: Ensure the integration has access to the database
- **Empty results**: Verify database has content and proper column names

### Build Errors
- **Module not found**: Run `npm install` in frontend directory
- **Python import errors**: Activate virtual environment and run `pip install -r requirements.txt`

### Performance
- The backend caches Notion responses to improve speed
- Clear cache by restarting the backend server
- For large databases (>500 drills), consider pagination

## Contributing

Contributions are welcome! Please ensure:
1. Code follows existing style conventions
2. TypeScript types are properly defined
3. API endpoints are documented
4. Mobile responsive design is maintained

## License

MIT License - See LICENSE file for details

## Support

For issues, feature requests, or questions, please open an issue on GitHub.

---

Built with ❤️ for the roller derby community
