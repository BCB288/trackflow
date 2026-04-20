FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY public/ ./public/
COPY views/ ./views/

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV TRACKFLOW_DB_PATH=/app/data/trackflow.db

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

USER node

CMD ["node", "src/server.js"]
