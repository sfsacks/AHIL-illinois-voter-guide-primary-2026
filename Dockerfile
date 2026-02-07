FROM node:20-bookworm-slim

WORKDIR /app

# Copy frontend package files and install deps
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source and data
COPY frontend/ ./

# Build Next.js
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["npx", "next", "start", "-H", "0.0.0.0"]
