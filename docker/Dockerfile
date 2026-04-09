FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 3001
ENV PORT=3001
ENV DATABASE_URL=sqlite:/app/data/meridian.db
ENV API_AUTH_ENABLED=true
CMD ["node", "dist/index.js"]
