#!/bin/bash
# Co-Trainer Startup Script

echo "=== Co-Trainer Startup ==="
echo ""

# Check if Python is installed
if command -v python3 &> /dev/null; then
    echo "✓ Python found: $(python3 --version)"
else
    echo "✗ Python not found. Please install Python 3.9+"
    exit 1
fi

# Check if Node.js is installed
if command -v node &> /dev/null; then
    echo "✓ Node.js found: $(node --version)"
else
    echo "✗ Node.js not found. Please install Node.js 18+"
    exit 1
fi

echo ""

# Setup backend
echo "Setting up backend..."
cd backend

# Create virtual environment if it doesn'\''t exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
echo "Installing backend dependencies..."
source venv/bin/activate
pip install -q -r requirements.txt

# Create .env if it doesn'\''t exist
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "⚠  Configure Notion credentials in Settings page after startup"
fi

cd ..

# Setup frontend
echo "Setting up frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
else
    echo "✓ Frontend dependencies already installed"
fi

cd ..

echo ""
echo "=== Starting Co-Trainer ==="
echo ""
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend in background
cd backend
source venv/bin/activate
python main.py &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend (this runs in foreground)
cd ../frontend
npm run dev

# If frontend exits, kill backend
kill $BACKEND_PID 2>/dev/null