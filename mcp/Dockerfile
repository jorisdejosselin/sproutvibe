FROM python:3.14-slim@sha256:1697e8e8d39bf168e177ac6b5fdab6df86d81cfc24dae17dfb96cfc3ef76b4dd

WORKDIR /app

COPY pyproject.toml .
COPY sprout_mcp/ sprout_mcp/

RUN pip install --no-cache-dir .

ENV SPROUT_URL=""
ENV SPROUT_EMAIL=""
ENV SPROUT_PASSWORD=""

ENTRYPOINT ["sprout-mcp"]
