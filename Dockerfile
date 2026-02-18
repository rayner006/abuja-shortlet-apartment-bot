FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -S nodejs && \
    adduser -S nodejs -G nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Railway uses dynamic PORT
EXPOSE 8080

# Health check with longer startup time
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+process.env.PORT+'/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "src/index.js"]
