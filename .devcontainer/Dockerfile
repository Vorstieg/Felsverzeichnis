FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

# Install Git LFS and Playwright browser system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends git-lfs && \
    git lfs install && \
    npx --yes playwright install-deps chromium && \
    rm -rf /var/lib/apt/lists/*
