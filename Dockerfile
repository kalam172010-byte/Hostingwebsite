FROM node:20-bookworm-slim

# Install Python 3, pip, and compilation tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    curl \
    unzip \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all project files into container
COPY . .

# Install Python dependencies safely
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt 2>/dev/null || pip3 install --no-cache-dir -r requirements.txt || true

# Install Node dependencies cleanly without lifecycle script conflicts
RUN npm install --ignore-scripts --no-audit --no-fund

# Run production build
RUN npm run build

# Set production environment and Render port
ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

# Start production server
CMD ["node", "dist/server.js"]
