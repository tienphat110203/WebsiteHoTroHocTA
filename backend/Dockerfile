FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY ml_scripts/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy ML scripts
COPY ml_scripts/ ./ml_scripts/

# Create model directory
RUN mkdir -p essay_scoring_model

# Set environment variables
ENV PYTHONPATH=/app

# Command to run when container starts
CMD ["python", "ml_scripts/train_essay_model.py"]
