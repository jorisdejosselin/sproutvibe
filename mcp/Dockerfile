FROM python:3.15-slim@sha256:94d3426f1def7db4a106a232ac121bfd975393e5dfd40a619b955fae45fe7913

WORKDIR /app

COPY pyproject.toml .
COPY sprout_mcp/ sprout_mcp/

RUN pip install --no-cache-dir .

ENV SPROUT_URL=""
ENV SPROUT_EMAIL=""
ENV SPROUT_PASSWORD=""

ENTRYPOINT ["sprout-mcp"]
