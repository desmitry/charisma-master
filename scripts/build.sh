#/bin/env bash

cd backend

docker build -t ghcr.io/desmitry/charisma-master-backend:latest -f Dockerfile .

cd ..

cd frontend

docker build -t ghcr.io/desmitry/charisma-master-frontend:latest -f Dockerfile .

cd ..