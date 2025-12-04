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

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
echo "Installing backend dependencies..."
source venv/bin/activate
pip install -q -r requirements.txt

# Create .env if it doesn't exist
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

# Store PIDs for cleanup
BACKEND_PID=""
FRONTEND_PID=""

# Function to cleanup all processes
cleanup() {
    echo ""
    echo "=== Shutting down Co-Trainer ==="
    
    # Kill frontend process and its children
    if [ ! -z "$FRONTEND_PID" ]; then
        echo "Stopping frontend..."
        kill -TERM $FRONTEND_PID 2>/dev/null
        # Kill any remaining npm/vite processes
        pkill -P $FRONTEND_PID 2>/dev/null
        wait $FRONTEND_PID 2>/dev/null
    fi
    
    # Kill backend process
    if [ ! -z "$BACKEND_PID" ]; then
        echo "Stopping backend..."
        kill -TERM $BACKEND_PID 2>/dev/null
        wait $BACKEND_PID 2>/dev/null
    fi
    
    # Extra cleanup: kill any remaining uvicorn or vite processes
    pkill -f "uvicorn.*main:app" 2>/dev/null
    pkill -f "vite.*--host 0.0.0.0" 2>/dev/null
    
    echo "✓ All servers stopped cleanly"
    exit 0
}

# Set up trap for clean shutdown
trap cleanup SIGINT SIGTERM EXIT

# Start backend in background
echo "Starting backend server..."
cd backend
source venv/bin/activate
python3 main.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "Waiting for backend to initialize..."
sleep 3

# Check if backend is still running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✗ Backend failed to start"
    exit 1
fi
echo "✓ Backend running (PID: $BACKEND_PID)"

# Start frontend in background (so we can trap signals)
echo "Starting frontend server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Check if frontend started
sleep 2
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "✗ Frontend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi
echo "✓ Frontend running (PID: $FRONTEND_PID)"

echo ""
echo "=== Co-Trainer is running ==="
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for either process to exit
wait $FRONTEND_PID $BACKEND_PID
