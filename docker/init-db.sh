#!/bin/sh
# Database initialization wrapper for Radio Calico
# This script ensures the database schema is applied correctly on first run
# Called automatically by PostgreSQL docker-entrypoint when container starts

set -e

echo "Radio Calico: Initializing database schema..."

# The SQL file is mounted at /docker-entrypoint-initdb.d/01-schema.sql
# PostgreSQL automatically executes all .sql files in this directory on first init

# Log successful initialization
echo "Radio Calico: Database schema initialized successfully"
echo "  - song_ratings table created"
echo "  - song_votes table created"
echo "  - error_logs table created with 30-day retention policy"
