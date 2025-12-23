# Build frontend
FROM node:18-alpine as frontend-builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Build backend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies and install
COPY backend/requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist ./static

# Create data directory for SQLite and config
RUN mkdir -p /app/data /app/config && \
    chmod -R 777 /app/data /app/config

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "main.py"]
