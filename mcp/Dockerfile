FROM python:3.14-slim@sha256:51dafde81dbdb6ebde285137a295cf18a47ca95234fe388a343719cb97305b3d

WORKDIR /app

COPY pyproject.toml .
COPY sprout_mcp/ sprout_mcp/

RUN pip install --no-cache-dir .

ENV SPROUT_URL=""
ENV SPROUT_EMAIL=""
ENV SPROUT_PASSWORD=""

ENTRYPOINT ["sprout-mcp"]
