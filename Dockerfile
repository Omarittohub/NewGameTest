# Stage 1: Build the React Client
FROM node:22-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
COPY shared/ ../shared/
RUN npm run build

# Stage 2: Build the Express Server
FROM node:22-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
COPY shared/ ../shared/
RUN npm run build

# Stage 3: Production Image
FROM node:22-alpine
WORKDIR /app
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/package*.json ./server/
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=client-builder /app/client/dist ./server/dist/client/dist

WORKDIR /app/server
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/src/index.js"]
