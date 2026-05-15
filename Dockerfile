# Single combined image: builds the React frontend, builds the Express backend,
# then serves both on the same port. Designed for one-service hosts (Railway, Render, Fly).

# ---- Stage 1: build frontend ----
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
# Frontend talks to its own origin — same host serves /api/*
ENV VITE_API_URL=""
RUN npm run build

# ---- Stage 2: build backend ----
FROM node:20-alpine AS backend
WORKDIR /be
COPY backend/package.json backend/package-lock.json* ./
RUN npm install
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ---- Stage 3: runtime ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# install production deps only
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

# prisma client + schema
COPY --from=backend /be/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend /be/node_modules/@prisma ./node_modules/@prisma
COPY --from=backend /be/prisma ./prisma
COPY --from=backend /be/dist ./dist

# bundled SPA — backend serves these as static files at root
COPY --from=frontend /fe/dist ./public

EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/seed.js && node dist/index.js"]
