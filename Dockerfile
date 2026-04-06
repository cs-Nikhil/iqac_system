# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

# Install deps with best cache reuse
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/
RUN npm ci --prefix backend && npm ci --prefix frontend

# Copy source and build the frontend
COPY backend backend
COPY frontend frontend
RUN npm run build --prefix frontend

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install backend prod deps only
COPY backend/package*.json backend/
RUN npm ci --prefix backend --omit=dev

# Copy backend source
COPY backend backend

# Copy built frontend into runtime image (served by backend/server.js in production)
COPY --from=build /app/frontend/dist frontend/dist

# Ensure runtime uploads path exists
RUN mkdir -p backend/uploads

EXPOSE 5000
CMD ["node", "backend/server.js"]

