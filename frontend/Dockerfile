# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration=production

# Stage 2: Serve (non-root)
FROM nginx:alpine

# Create non-root user and adjust permissions
RUN adduser -D -u 1001 appuser \
    && sed -i 's/listen\s*80;/listen 8080;/' /etc/nginx/conf.d/default.conf \
    && chown -R appuser:appuser /var/cache/nginx /var/log/nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid && chown appuser:appuser /var/run/nginx.pid

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

RUN chown -R appuser:appuser /usr/share/nginx/html

USER appuser
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
