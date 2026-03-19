FROM python:3.10-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Popular Python packages available in the code executor
RUN pip install --no-cache-dir \
    numpy==1.26.4 \
    pandas==2.2.3 \
    matplotlib==3.9.2 \
    requests==2.32.3 \
    scipy==1.14.1 \
    sympy==1.13.3 \
    pillow==10.4.0 \
    scikit-learn==1.5.2

# Copy application code
COPY . .

# entrypoint.sh runs Alembic migrations then starts uvicorn
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
