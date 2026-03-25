FROM python:3.14-slim@sha256:fb83750094b46fd6b8adaa80f66e2302ecbe45d513f6cece637a841e1025b4ca

WORKDIR /app

COPY pyproject.toml .
COPY sprout_mcp/ sprout_mcp/

RUN pip install --no-cache-dir .

ENV SPROUT_URL=""
ENV SPROUT_EMAIL=""
ENV SPROUT_PASSWORD=""

ENTRYPOINT ["sprout-mcp"]
