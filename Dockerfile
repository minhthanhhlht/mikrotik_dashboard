# ==============================================================================
# Stage 1: Build Frontend React App
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Production Node.js Backend Server
# ==============================================================================
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install backend dependencies
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source code
COPY backend/ ./

# Copy built frontend assets from builder stage
WORKDIR /app
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Persist data (sessions, settings)
VOLUME ["/app/backend/data"]

EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "server.js"]

