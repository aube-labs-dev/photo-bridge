# 1. 빌드 스테이지: Nest.js 백엔드 빌드
FROM node:20-alpine AS backend_builder

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/. .
RUN npm run build

# 2. 빌드 스테이지: Next.js 프런트엔드 빌드 (정적 export)
FROM node:20-alpine AS frontend_builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/. .
RUN npm run build

# 3. 런타임 스테이지: Nginx와 Nest.js 실행
FROM nginx:alpine

# Nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/nginx.conf

# 백엔드 빌드 결과 복사
COPY --from=backend_builder /app/backend/dist /app/backend/dist

# 프런트엔드 빌드 결과 복사 (정적 파일)
# Next.js의 'out' 디렉토리
COPY --from=frontend_builder /app/frontend/out /usr/share/nginx/html

# Nest.js 백엔드를 백그라운드에서 실행하고, Nginx를 포그라운드에서 실행
# 'daemon off;'는 Nginx가 컨테이너의 주 프로세스로 실행되도록 함
# Nest.js는 3000번 포트에서 실행되고 Nginx는 80번 포트에서 프록시 함
CMD sh -c "node /app/backend/dist/main & nginx -g 'daemon off;'"

# 80번 포트 노출 (외부에서 접근 가능하도록)
EXPOSE 80