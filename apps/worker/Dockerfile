FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/worker/package.json apps/worker/

# Install dependencies
RUN npm install --workspace=apps/worker --include-workspace-root

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/worker/ apps/worker/

# Build
RUN npm run build --workspace=apps/worker

# ─── Production ────────────────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/packages/shared/ packages/shared/
COPY --from=builder /app/apps/worker/dist/ apps/worker/dist/
COPY --from=builder /app/apps/worker/package.json apps/worker/

ENV NODE_ENV=production

CMD ["node", "apps/worker/dist/index.js"]
