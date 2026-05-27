FROM --platform=$BUILDPLATFORM node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14 AS build

ARG VITE_DEV_TOOLBAR=false
ENV VITE_DEV_TOOLBAR=$VITE_DEV_TOOLBAR

WORKDIR /app
COPY .npmrc package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine@sha256:8122337ed6c475bb486bc9340da453d4599f225e6b920ff0d92ca2267486b9b5
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
