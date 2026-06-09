# Use official Node.js Alpine base image with pinned version
FROM node:20.11.0-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./

# Install exact versions from package-lock
RUN npm ci

# Copy code
COPY . .

# Accept NEXT_PUBLIC_* vars as build args so they are baked into the bundle
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_FIREBASE_API_KEY=
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
ARG NEXT_PUBLIC_FIREBASE_APP_ID=
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

# Run build
RUN npm run build

# Final runner image
FROM node:20.11.0-alpine

# Set to production env
ENV NODE_ENV=production

WORKDIR /app

# Copy built app and dependencies
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/public /app/public
COPY --from=builder /app/node_modules /app/node_modules

# Create non-root system user and group
RUN addgroup -g 10001 -S nextgroup && \
    adduser -u 10001 -S nextuser -G nextgroup

# Change ownership of /app files
RUN chown -R nextuser:nextgroup /app

# Expose port and run as non-root user
USER nextuser
EXPOSE 3000

CMD ["npx", "next", "start"]
