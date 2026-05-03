FROM --platform=$BUILDPLATFORM node:24-alpine@sha256:d1b3b4da11eefd5941e7f0b9cf17783fc99d9c6fc34884a665f40a06dbdfc94f AS build

ARG VITE_DEV_TOOLBAR=false
ENV VITE_DEV_TOOLBAR=$VITE_DEV_TOOLBAR

WORKDIR /app
COPY .npmrc package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine@sha256:f35982400455b4f359083ba9d1ef573fbbe4221a6a8a194dc7a14beb4e2cd3dc
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
