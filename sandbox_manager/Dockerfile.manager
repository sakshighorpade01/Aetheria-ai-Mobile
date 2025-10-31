# Dockerfile.manager
FROM python:3.11-slim

WORKDIR /app

# Copy only the requirements for this specific service
COPY ./sandbox_manager/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only the source code for this specific service
COPY ./sandbox_manager/ .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]