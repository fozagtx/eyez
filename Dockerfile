FROM node:22-slim

# Install Playwright system dependencies
RUN apt-get update && apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
    fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable
COPY package.json pnpm-lock.yaml tsconfig.json ./
RUN pnpm install --frozen-lockfile
COPY --chown=node:node src ./src
RUN pnpm build && pnpm prune --prod

# Install Playwright Chromium as node user (matches runtime user)
USER node
RUN pnpm exec playwright install chromium

ENV PORT=7860

EXPOSE 7860

CMD ["node", "dist/server.js"]
