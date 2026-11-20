# Dockerfile pour déploiement Railway/Render/Fly.io
FROM node:22-alpine

WORKDIR /app

# Install dependencies for native modules (sqlite3 via node:sqlite)
RUN apk add --no-cache python3 make g++ sqlite

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p data

# Expose port
EXPOSE 3001

# Start server
CMD ["npm", "start"]