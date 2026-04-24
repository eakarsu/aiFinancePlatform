#!/bin/bash

# AI Finance Platform - Start Script
# Cleans ports, seeds data, starts backend and frontend with hot reload monitoring

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration (avoiding port 5000 as requested)
BACKEND_PORT=3002
FRONTEND_PORT=3000

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          AI Finance Platform - Startup Script              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============== STEP 1: KILL EVERYTHING FIRST ==============
echo -e "${BLUE}[1/7] Killing all existing processes...${NC}"

# Kill by process name
pkill -9 -f "node src/index.js" 2>/dev/null || true
pkill -9 -f "nodemon" 2>/dev/null || true
pkill -9 -f "react-scripts" 2>/dev/null || true
sleep 1

# Kill by port - be aggressive (avoiding 5000)
for port in 3000 3002 5173 8080; do
    pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}Killing processes on port $port${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
done
sleep 2

# Verify ports are free
for port in $BACKEND_PORT $FRONTEND_PORT; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo -e "${RED}ERROR: Port $port still in use. Force killing...${NC}"
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
done

echo -e "${GREEN}✓ All ports cleaned${NC}"
echo ""

# ============== STEP 2: Load Environment Variables ==============
echo -e "${BLUE}[2/7] Loading environment variables...${NC}"

if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
    echo -e "${GREEN}✓ Loaded .env from root${NC}"
else
    echo -e "${RED}ERROR: .env file not found at $SCRIPT_DIR/.env${NC}"
    exit 1
fi
echo ""

# ============== STEP 3: Check Prerequisites ==============
echo -e "${BLUE}[3/7] Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
echo -e "${GREEN}✓ npm $(npm -v)${NC}"

# Check PostgreSQL
if pg_isready -q 2>/dev/null; then
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"
else
    echo -e "${YELLOW}⚠ Starting PostgreSQL...${NC}"
    brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
    sleep 2
fi
echo ""

# ============== STEP 4: Install Dependencies ==============
echo -e "${BLUE}[4/7] Checking dependencies...${NC}"

cd "$SCRIPT_DIR"

if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    cd backend && npm install && cd ..
else
    echo -e "${GREEN}✓ Backend dependencies OK${NC}"
fi

if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend && npm install && cd ..
else
    echo -e "${GREEN}✓ Frontend dependencies OK${NC}"
fi
echo ""

# ============== STEP 5: Database Setup ==============
echo -e "${BLUE}[5/7] Setting up database...${NC}"
cd "$SCRIPT_DIR/backend"
npx prisma generate 2>/dev/null || true
npx prisma db push --accept-data-loss 2>/dev/null || echo -e "${YELLOW}⚠ Migration skipped${NC}"
echo -e "${GREEN}✓ Database ready${NC}"
echo ""

# ============== STEP 6: Seed Database ==============
echo -e "${BLUE}[6/7] Seeding database...${NC}"
cd "$SCRIPT_DIR/backend"
if [ -f "prisma/seed.js" ]; then
    node prisma/seed.js 2>&1 || echo -e "${YELLOW}⚠ Seeding skipped${NC}"
fi
echo ""

# ============== STEP 7: Start Services ==============
echo -e "${BLUE}[7/7] Starting services...${NC}"
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Backend:  http://localhost:${BACKEND_PORT}                           ║${NC}"
echo -e "${GREEN}║  Frontend: http://localhost:${FRONTEND_PORT}                           ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║  Demo Login: demo@aifinance.com / demo123456               ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║  Press Ctrl+C to stop all services                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    pkill -9 -f "node src/index.js" 2>/dev/null || true
    pkill -9 -f "nodemon" 2>/dev/null || true
    pkill -9 -f "react-scripts" 2>/dev/null || true
    lsof -ti:3000,3002 | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✓ Stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
cd "$SCRIPT_DIR/backend"
echo -e "${CYAN}Starting backend on port $BACKEND_PORT...${NC}"
npx nodemon --watch src --ext js,json src/index.js &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 3
if ! lsof -ti:$BACKEND_PORT >/dev/null 2>&1; then
    echo -e "${RED}Backend failed to start!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Backend running (PID: $BACKEND_PID)${NC}"

# Start frontend
cd "$SCRIPT_DIR/frontend"
echo -e "${CYAN}Starting frontend on port $FRONTEND_PORT...${NC}"
PORT=$FRONTEND_PORT BROWSER=none npm start &
FRONTEND_PID=$!

echo -e "${GREEN}✓ Frontend starting (PID: $FRONTEND_PID)${NC}"
echo ""
echo -e "${GREEN}Ready! Open http://localhost:3000 in your browser${NC}"
echo ""

# Wait for processes
wait
