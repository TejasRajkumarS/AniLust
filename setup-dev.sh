#!/bin/bash

# AniLust Development Setup Script
# Run this script to set up both frontend and backend for local development

set -e

echo "🚀 Setting up AniLust development environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Found Node.js: $NODE_VERSION"
echo ""

# Setup Backend
echo -e "${BLUE}📦 Setting up Backend Server...${NC}"
cd server

if [ ! -f ".env" ]; then
    echo "Creating backend .env file..."
    cp .env.example .env
    echo "FRONTEND_URL=http://localhost:3000" >> .env
    echo "✅ Backend .env created"
else
    echo "ℹ️  Backend .env already exists"
fi

echo "Installing backend dependencies..."
npm install

echo -e "${GREEN}✅ Backend setup complete${NC}"
echo ""

# Setup Frontend
cd ..
echo -e "${BLUE}📦 Setting up Frontend...${NC}"

if [ ! -f ".env" ]; then
    echo "Creating frontend .env file..."
    echo "VITE_BACKEND_URL=http://localhost:5000" > .env
    echo "VITE_HIANIME_API_URL=" >> .env
    echo "✅ Frontend .env created"
else
    echo "ℹ️  Frontend .env already exists"
fi

echo "Installing frontend dependencies..."
npm install

echo -e "${GREEN}✅ Frontend setup complete${NC}"
echo ""

# Summary
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ Setup Complete! Here's what to do next:${NC}"
echo ""
echo "1. Start the Backend (in one terminal):"
echo -e "   ${BLUE}cd server && npm run dev${NC}"
echo ""
echo "2. Start the Frontend (in another terminal):"
echo -e "   ${BLUE}npm run dev${NC}"
echo ""
echo "3. Open your browser:"
echo -e "   ${BLUE}http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
