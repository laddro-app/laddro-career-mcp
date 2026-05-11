FROM node:22-slim AS builder

WORKDIR /app

# Copy SDK (local dependency)
COPY career-sdk/ ./career-sdk/

# Install MCP server dependencies
COPY package.json ./
RUN npm install --install-links

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim

WORKDIR /app

COPY --from=builder /app/career-sdk ./career-sdk
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/server.js"]
