FROM node:20-bookworm-slim

# Install Python 3, pip, and required C libraries for Pillow / Telegram
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    curl \
    unzip \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (cached layer)
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt 2>/dev/null || pip3 install --no-cache-dir -r requirements.txt

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Build Vite frontend and production server
RUN npm run build

# Set environment
ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

# Start server
CMD ["node", "dist/server.js"]
