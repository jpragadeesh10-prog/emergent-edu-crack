# LearnVerse — SIH Student Innovation Learning Platform (PRD)

## Original Problem Statement
Build a real (non-demo) student platform for Smart India Hackathon: Google + email login, secure accounts,
attractive animated UI, an AI doubt-solver (ChatGPT-like) covering ALL subjects (high-level maths, physics,
chemistry, core CSE/AIDS/mechanical + full autonomous-college syllabus), an AI voice teacher (pick teacher,
change language/voice, Tanglish & Indian-language accents), friend requests + search by mobile, badges,
quizzes, Learning DNA (starts at 0, grows daily), mistake tracking, friends competition, 1-1 live mock
interview, LeetCode-style online compiler, plus Explain-It-Back, AI Blind-Spot Detector, and AI Time Machine.

## Architecture
- Frontend: React 19 + React Router + Tailwind + framer-motion + lucide-react (dark cyber-academic theme).
- Backend: FastAPI (single server.py + subjects_data.py), MongoDB (motor).
- Auth: Dual — Emergent Google OAuth (session_token) + email/password (bcrypt + JWT). Token stored client-side
  as `lv_token` and sent as Bearer; backend accepts cookie or Bearer.
- AI: GPT 5.4 via emergentintegrations (EMERGENT_LLM_KEY) for chat (SSE streaming), quiz gen, interviewer.
- Voice: OpenAI TTS (tts-1) via emergentintegrations, cached in Mongo, served at /api/tts/<key>.mp3.
- Compiler: LOCAL in-container execution (python3, node, gcc, g++, javac) with timeouts. NOTE: Piston public
  API became whitelist-only (Feb 2026), so local execution is used.

## User Personas
- Engineering/college student solving doubts across subjects, practising code, and prepping for interviews.

## Core Requirements (static)
Google+email auth · AI tutor (all subjects, multilingual, 3 modes) · voice teacher · Learning DNA · mistake
tracking · Time Machine · quizzes+badges+leaderboard · friends+search · mock interview · multi-language compiler.

## Implemented (2026-06)
- [x] Auth: register/login (JWT) + Google OAuth session exchange + /auth/me + logout (cookie & Bearer cleanup)
- [x] AI Tutor: SSE streaming chat, subject/language/teacher selectors, modes solve/explain_back/blind_spot, TTS "Listen"
- [x] Learning DNA dashboard: XP/streak/rings starting at 0, AI Time Machine buckets, badges, mistake tracking
- [x] Quiz Arena: AI-generated 5Q quizzes (with retry), scoring, review, badges, friends leaderboard
- [x] Mock Interview: 1-1 AI interviewer, per-answer feedback+score, 5 questions, average score
- [x] Code Lab: Python/JS/C/C++/Java local execution + stdin + sample problems
- [x] Friends: search by email/mobile/name, request/accept, friends list with XP
- [x] Subjects library: full backend catalog (92 subjects across 10 categories) with filter
- [x] Landing + Login pages, animated theme
- [x] Voice Answers: Whisper STT mic button in AI Tutor + Mock Interview (speak instead of type)
- [x] Live Interview Camera: webcam video-call layout, AI interviewer speaks each question (TTS), replay + voice answers
- [x] Daily Challenge: 30-second daily spark quiz on dashboard, grows streak, awards XP, one-per-day
- Tested: backend 29/29 pytest pass, frontend E2E 100% (iteration_1 & iteration_2)

## Backlog / Remaining (P1/P2)
- P1: Authentic Accents — ElevenLabs multilingual voices for natural Tamil/Hindi (DEFERRED: needs user's ElevenLabs API key; currently OpenAI TTS, English-accented)
- P2: Sandbox hardening for code execution (nsjail/resource limits, no network)
- P2: Persist chat history sidebar UI; daily activity heatmap visualization
- P2: Split server.py into routers for maintainability

## Next Tasks
- Add ElevenLabs (once key provided) for authentic Indian-language teacher voices
