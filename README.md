# AIGC Platform

AI-powered content generation platform — text-to-image, image-to-video, text-to-speech.

## Features

- **Image Generation** — Multiple models (FLUX, SD 3.5, Qwen-Image, Kolors, etc.)
- **Video Generation** — Image-to-video with async polling (CogVideoX, Wan2.1, LTX-2, etc.)
- **Audio Generation** — Text-to-speech with voice/pitch/speed controls (IndexTTS, CosyVoice, etc.)
- **History Management** — Browse, preview, and delete past generations with type filters
- **JWT Authentication** — Register, login, token-based session management
- **Glassmorphism UI** — Dark theme with frosted glass panels

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router 6, Tailwind CSS 3, Vite 5 |
| Backend | Express 4, JWT, bcryptjs |
| API | [ai.gitee.com](https://ai.gitee.com) |
| Storage | JSON files (server/data/) |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup data directories
npm run setup

# 3. Configure environment
cp .env.example .env
# Edit .env and fill in your AI_API_TOKEN

# 4. Start development
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Project Structure

```
aigc-platform/
├── public/
├── src/
│   ├── api/            # API client
│   ├── components/
│   │   ├── common/     # Shared UI components
│   │   ├── history/    # History grid, card, detail
│   │   └── studio/     # Image, Video, Audio studios
│   ├── contexts/       # Auth context
│   ├── data/           # Model definitions
│   ├── hooks/          # Custom hooks
│   ├── layouts/        # Auth & Dashboard layouts
│   └── pages/          # Route pages
├── server/
│   ├── middleware/      # Auth, Logger
│   ├── routes/          # Auth, Generate, History
│   ├── services/        # User & History store
│   └── utils/           # Crypto, Token
├── scripts/             # Setup script
├── .env.example         # Environment template
└── package.json
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and get JWT token |
| POST | `/api/generate/image` | Generate image (sync) |
| POST | `/api/generate/video` | Generate video (async) |
| POST | `/api/generate/audio` | Generate audio (async) |
| GET | `/api/history` | Get user's history |
| DELETE | `/api/history/:id` | Delete a history item |

## License

MIT
