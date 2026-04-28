FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1

# Install build tools and curl
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install rustup (non-interactive) so native Python extensions can be built
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

# Install Python deps first (cache-able layer). Requirements file is in this folder.
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip setuptools wheel \
 && pip install -r /app/requirements.txt

# Copy source
COPY . /app

EXPOSE 8001

# Use PORT env var when provided by the host (Render sets $PORT)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}"]
