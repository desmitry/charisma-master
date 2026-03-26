#!/bin/bash
set -e

MEDIA_DIR="/backend/app/media"
RESULTS_DIR="/backend/app/media/results"

# Ensure media directories exist with correct ownership
mkdir -p "$MEDIA_DIR" "$RESULTS_DIR"
chown -R appuser:appuser "$MEDIA_DIR"

# Drop privileges and execute the CMD passed from docker-compose
exec runuser -u appuser -- "$@"
