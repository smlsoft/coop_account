# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build args สำหรับ VITE env (ฝังตอน build)
ARG VITE_APP_TITLE="COOP ACCOUNT"
ARG VITE_APP_API=https://glapi-uat.rspcoop.com/

ENV VITE_APP_TITLE=$VITE_APP_TITLE
ENV VITE_APP_API=$VITE_APP_API

RUN npm run build

# ── Stage 2: Serve ───────────────────────────────────────────────
FROM nginx:stable-alpine AS runner

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
