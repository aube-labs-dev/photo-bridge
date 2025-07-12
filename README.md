### 프로젝트 생성

1. 메인 저장소 
```Bash
mkdir photo-bridge
cd photo-bridge
git init
```

2. 프런트엔드 및 백엔드 프로젝트 생성 (또는 기존 프로젝트 사용):
* 백엔드 (Nest.js):
```Bash
# backend 디렉토리에 Nest.js 프로젝트를 생성하고 Git 저장소를 초기화
# 또는 기존 Nest.js 프로젝트를 해당 위치에 이동하고 .git 파일만 남겨두기
# 이 예시에서는 새로 생성한다고 가정
git submodule add https://github.com/aube-labs-dev/photo-bridge-backend.git backend
# 예시: git submodule add https://github.com/your-username/your-nest-backend.git backend
```
* 프런트엔드 (Next.js):
```Bash
git submodule add https://github.com/aube-labs-dev/photo-bridge-frontend.git frontend
# 예시: git submodule add https://github.com/your-username/your-next-frontend.git frontend
```

3. 서브모듈 초기화 및 업데이트:
```Bash
# 다른 사람이 이 모노레포를 클론하거나, 새로운 서브모듈을 추가한 후에는 다음 명령어를 실행
git submodule init
git submodule update
# 또는 한 번에:
git clone --recurse-submodules <your_monorepo_repo_url>
```

### 프로젝트 설명
1. 프로젝트 구조 (Monorepo with Submodules)
Git 서브모듈을 사용하여 backend와 frontend를 독립적으로 관리하면서도 하나의 최상위 프로젝트에서 참조하도록 구성할 거야.
```
photo-bridge/
├── .gitmodules
├── package.json         # 모노레포 루트 패키지 (선택 사항, 없어도 무방)
├── Dockerfile           # Docker 빌드 및 실행 설정
├── nginx.conf           # Nginx 리버스 프록시 설정
├── backend/             # Nest.js 백엔드 (Git Submodule)
│   ├── src/             # Nest.js 소스 코드
│   ├── package.json
│   └── tsconfig.json
└── frontend/            # Next.js 프런트엔드 (Git Submodule)
    ├── pages/           # Next.js 페이지
    ├── public/          # 정적 파일
    ├── package.json
    └── next.config.js
```

2. 백엔드 (Nest.js - WebRTC 시그널링 서버)
Nest.js는 Socket.IO를 사용하여 WebRTC 시그널링 메시지를 중계하는 역할을 해. 데이터베이스 없이 메모리 기반으로 방 정보를 관리.

3. 프런트엔드 (Next.js - 모바일 웹 UI & WebRTC 클라이언트)
Next.js는 사용자 인터페이스를 제공하고, WebSockets를 통해 백엔드 시그널링 서버와 통신하며, WebRTC RTCPeerConnection 및 RTCDataChannel을 사용하여 실제 파일 전송을 담당. 여기서는 Next.js를 **정적 사이트(Static Site)**로 빌드하여 Nginx로 서빙.

frontend/next.config.js
Next.js를 정적 HTML 파일로 내보내기 위한 설정

4. Docker 통합 배포 구성
프런트엔드와 백엔드를 단일 Docker 컨테이너에서 실행하기 위해 Nginx를 리버스 프록시로 사용하고, Nest.js 백엔드를 백그라운드에서 실행


5. 프로젝트 빌드 및 실행

* 모노레포 및 서브모듈 클론:
```Bash
git clone --recurse-submodules <your-monorepo-git-url> photo-bridge
cd photo-bridge

# 만약 기존에 클론했다면:
cd photo-bridge
git submodule init
git submodule update
```
* Docker 이미지 빌드:
```Bash
docker build -t photo-bridge .
```
* Docker 컨테이너 실행:
```Bash
docker run -d -p 80:80 --name photo-bridge-service photo-bridge
```

### 고려사항 및 개선점
```
HTTPS/WSS 적용: 실제 서비스에서는 보안을 위해 Nginx 앞에 Let's Encrypt 등으로 HTTPS/WSS를 반드시 적용해야 해. Docker Compose를 사용하여 Nginx-Certbot 구성을 추가할 수 있어.

STUN/TURN 서버: 현재 구글 공개 STUN 서버를 사용하고 있는데, 안정적인 서비스를 위해서는 자체 STUN 서버를 구축하거나 유료 TURN 서비스(대역폭 소모)를 이용하는 것이 좋아.

파일 전송 UX: 현재는 전송 완료 메시지만 나오지만, 실제로는 전송 진행률, 전송 취소, 전송된 파일 목록 등 더 풍부한 사용자 경험을 제공해야 해.

오류 처리 및 재연결: 네트워크 불안정 시 WebRTC 연결 끊김이나 데이터 전송 실패에 대한 재시도 로직을 견고하게 구현해야 해.

확장성: 대규모 동시 접속자가 예상된다면 단일 컨테이너 방식은 한계가 있어. 백엔드와 프런트엔드 컨테이너를 분리하고, 백엔드 컨테이너를 여러 개 띄우는 방식으로 전환을 고려해야 해.
```
