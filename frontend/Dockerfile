FROM --platform=$BUILDPLATFORM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build

ARG VITE_DEV_TOOLBAR=false
ENV VITE_DEV_TOOLBAR=$VITE_DEV_TOOLBAR

WORKDIR /app
COPY .npmrc package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine@sha256:054e14f543eb688809d59ec2ad1644d1a61678e247c87a318ad605977eb37eaf
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
