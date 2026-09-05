FROM --platform=$BUILDPLATFORM node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS build

ARG VITE_DEV_TOOLBAR=false
ENV VITE_DEV_TOOLBAR=$VITE_DEV_TOOLBAR

WORKDIR /app
COPY .npmrc package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine@sha256:aa8c9087d36d93e9d650c5365f883b421e8214aedbad24ade52b844c583358f1
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
