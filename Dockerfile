# Dockerfile for JevShield Phishing Detection Web App
# Designed for production deployment and academic viva presentation

# Step 1: Base image - lightweight Python 3.11 based on Debian Linux (slim)
FROM python:3.11-slim

# Prevent Python from writing .pyc files to disc and enable unbuffered terminal logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000

# Set working directory inside container
WORKDIR /app

# Install system dependencies (curl for container healthcheck)
# Clean up apt caches immediately after to minimize image size
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Step 2: Layer Caching - copy only requirements.txt first
# Docker caches this layer; dependency install is only re-run if requirements.txt changes
COPY requirements.txt .

# Install Python dependencies without caching pip wheels to save disk space
RUN pip install --no-cache-dir -r requirements.txt

# Step 3: Copy application source code and trained model
# Note: large raw CSVs and virtual environments are excluded via .dockerignore
COPY . .

# Step 4: Security best practice - Create a non-privileged user and switch to it
# Running as non-root protects the host if the container is ever compromised
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port 5000 for web traffic
EXPOSE 5000

# Step 5: Container Healthcheck
# Docker monitors /health every 30 seconds to confirm the service is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Step 6: Start the WSGI server
# gunicorn with 2 worker processes listening on all interfaces (0.0.0.0) at port 5000
CMD ["gunicorn", "--workers", "2", "--bind", "0.0.0.0:5000", "app:app"]
