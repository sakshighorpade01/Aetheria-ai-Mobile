# Dockerfile

# Use an official Python runtime as a parent image
FROM python:3.11

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY ./python-backend/requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the python-backend application code into the container at /app
COPY ./python-backend/ .

RUN mkdir -p /app/uploads
# Make port 8765 available to the world outside this container
# This doesn't publish the port, just documents it.
EXPOSE 8765

# Define environment variables (can be overridden at runtime)
ENV PORT=8765
ENV PYTHONUNBUFFERED=1 

# Command to run the application using Gunicorn
# Assumes your Flask app instance in app.py is named 'app'
# Uses eventlet for SocketIO compatibility
# Update the CMD line to add timeout parameter
CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "--timeout", "300", "--keep-alive", "65", "--bind", "0.0.0.0:8765", "app:app"]