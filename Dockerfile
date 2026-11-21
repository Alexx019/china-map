# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2-alpine AS web
COPY --from=build /app/dist /srv/site
COPY deploy/portainer/Caddyfile /etc/caddy/Caddyfile

FROM node:24-alpine AS api
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=build /app/dist/data/places.json /site/data/places.json
COPY --from=build /app/dist/data/thumbs/photos.json /site/data/thumbs/photos.json
ENV PORT=8787 DB_PATH=/data/china-map.db PLACES_PATH=/site/data/places.json PHOTO_MANIFEST_PATH=/site/data/thumbs/photos.json MEDIA_PATH=/data/media NODE_NO_WARNINGS=1
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8787
CMD ["node", "index.mjs"]

# El ejecutable oficial es estático y está publicado para amd64 y arm64.
FROM ghcr.io/protomaps/go-pmtiles:v1.31.2 AS pmtiles
FROM node:24-alpine AS map-init
COPY --from=pmtiles /go-pmtiles /usr/local/bin/pmtiles
WORKDIR /app
COPY scripts/trip-region.geojson ./trip-region.geojson
COPY scripts/map-context.geojson ./map-context.geojson
COPY deploy/portainer/prepare-map.mjs ./prepare-map.mjs
CMD ["node", "prepare-map.mjs"]
