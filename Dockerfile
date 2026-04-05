# ── Stage 1: Python venv with robotics deps ──────────────────────────────────
FROM python:3.10-slim AS backend

WORKDIR /app

# Create a clean virtualenv
RUN python3.10 -m venv /app/.venv

# Install robotics + web stack into the venv.
# `pin` is the PyPI package that provides Pinocchio + bundles its C++ deps.
# `example-robot-data` provides the Panda URDF and meshes.
RUN /app/.venv/bin/pip install --no-cache-dir \
        "pin" \
        "example-robot-data" \
        "ikpy" \
        "fastapi>=0.104.0" \
        "uvicorn[standard]>=0.24.0" \
        "scipy>=1.11.0" \
        "numpy>=1.24.0"

# Copy backend source
COPY backend/ ./backend/

# Expose FastAPI port
EXPOSE 8000

ENV PYTHONUNBUFFERED=1

CMD ["/app/.venv/bin/uvicorn", "backend.main:app", \
     "--host", "0.0.0.0", "--port", "8000", "--reload"]
