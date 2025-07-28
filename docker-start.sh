#!/bin/bash

echo "Starting Discourse API with n8n and Redis..."

# Build and start services
docker-compose up --build -d

echo "Services started!"
echo "- Discourse API: http://localhost:3000"
echo "- n8n: http://localhost:5678 (admin/password)"
echo "- Redis: localhost:6379"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"