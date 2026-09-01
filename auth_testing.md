# Auth-Gated App Testing Playbook (LearnVerse)

NOTE: This app supports TWO auth methods.
1. Email/Password (JWT) — token stored in localStorage as `lv_token`, sent as `Authorization: Bearer <token>`.
2. Emergent Google OAuth — session_token cookie + also returned to client and stored as `lv_token`.

For automated UI testing, the SIMPLEST path is email/password login:
- Go to /login
- Ensure mode is "Sign In"
- Fill data-testid="email-input" = ravi_test@example.com
- Fill data-testid="password-input" = pass1234
- Click data-testid="submit-auth-btn"
- App navigates to /dashboard

For backend API testing, obtain a JWT:
```
curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"ravi_test@example.com","password":"pass1234"}'
# -> {"token":"<JWT>","user":{...}}
curl -s "$API/auth/me" -H "Authorization: Bearer <JWT>"
```

To seed a Google-style session directly in Mongo (test_database):
```
mongosh --eval "
use('test_database');
var uid='test-user-'+Date.now();
var st='test_session_'+Date.now();
db.users.insertOne({user_id:uid,email:'g.'+Date.now()+'@example.com',name:'G Tester',picture:'',mobile:'',provider:'google',created_at:new Date()});
db.user_sessions.insertOne({user_id:uid,session_token:st,expires_at:new Date(Date.now()+7*24*3600*1000).toISOString(),created_at:new Date().toISOString()});
db.learning_dna.insertOne({user_id:uid,subjects:{},activity:{},total_xp:0});
print('session_token: '+st);
"
```
Then use as Bearer token OR set cookie `session_token`.

## Key data-testids
- Login: google-login-btn, email-input, password-input, submit-auth-btn, toggle-auth-mode, name-input, mobile-input
- Nav/sidebar: sidebar, nav-dashboard, nav-tutor, nav-compiler, nav-quiz, nav-interview, nav-friends, nav-subjects, logout-btn
- Tutor: subject-select, language-select, teacher-select, mode-solve, mode-explain_back, mode-blind_spot, chat-input, send-btn, chat-window, speak-btn-<idx>, new-chat-btn
- Compiler: lang-<id>, code-editor, run-btn, output-console, stdin-input, problem-<id>
- Quiz: quiz-subject-select, quiz-difficulty-select, generate-quiz-btn, q<qi>-opt<oi>, submit-quiz-btn, quiz-result, leaderboard, new-quiz-btn
- Interview: role-select, start-interview-btn, interview-question, answer-input, submit-answer-btn, interview-done, restart-interview-btn
- Friends: friend-search-input, friend-search-btn, add-friend-<id>, accept-friend-<id>, friends-list, friend-requests
- Dashboard: stat-xp, stat-streak, mastery-grid, time-machine, mistake-list

## Success indicators
- /api/auth/me returns user data (200)
- Dashboard loads without redirect to /login
- Compiler returns real output for python/js/c/cpp/java
- Chat streams tokens; TTS returns a /api/tts/<key>.mp3 URL that plays
