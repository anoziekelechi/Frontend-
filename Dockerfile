# docker-compose.yml
version: '3.9'

services:
  frontend:
    build: ./frontend
    depends_on:
      - backend

  backend:
    build: ./backend
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: empire
      POSTGRES_USER: empire_user
      POSTGRES_PASSWORD: supersecretpassword
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:







  # docker-compose.override.yml — DEVELOPMENT (Hot Reload)
version: '3.9'

services:
  frontend:
    ports:
      - "5173:5173"                    # Vite dev server
    volumes:
      - ./frontend:/app
      - /app/node_modules               # Prevent node_modules override
    command: npm run dev
    environment:
      - CHOKIDAR_USEPOLLING=true
      - VITE_API_URL=http://backend:8000   # Important: Docker internal URL

  backend:
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    command: uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
    environment:
      - ENVIRONMENT=development





# docker-compose.prod.yml — PRODUCTION
version: '3.9'

services:
  frontend:
    ports:
      - "80:80"                         # Nginx serves on port 80
    restart: unless-stopped

  backend:
    restart: unless-stopped
    env_file:
      - .env.production
    environment:
      - ENVIRONMENT=production

  db:
    restart: unless-stopped
    env_file:
      - .env.production






      # frontend/Dockerfile — FINAL
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for SPA + API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]



# frontend/Dockerfile — FINAL PRODUCTION READY (Multi-Stage)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build Vite app
RUN npm run build

# Production stage — tiny & secure Nginx image
FROM nginx:alpine

# Copy built React files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]










# nginx/nginx.conf — FINAL, CLEAN, SINGLE COUNTRY (LIBERIA)

server {
  listen 80;
  listen 443 ssl;

  # Liberia Domains
  server_name myshop.lr www.myshop.lr;

  # Serve React frontend (Vite build)
  root /usr/share/nginx/html;
  index index.html;

  # React Router SPA routing support
  location / {
    try_files $uri /index.html;
  }

  # Proxy all API calls to FastAPI backend
  location /api/ {
    proxy_pass http://backend:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Optional: Cache static assets
  location /static/ {
    alias /usr/share/nginx/html/static/;
    expires 30d;
    add_header Cache-Control "public";
  }
}

# Security: Catch-all for unknown domains
server {
  listen 80 default_server;
  listen 443 ssl default_server;
  server_name _;
  return 444;   # Silent drop
}
      
