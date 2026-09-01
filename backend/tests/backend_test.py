"""LearnVerse backend API tests."""
import os
import time
import uuid
import json
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://genius-gateway-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SEED_EMAIL = "ravi_test@example.com"
SEED_PASS = "pass1234"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def seed_token(session):
    """Login seed user; if missing, register."""
    r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASS})
    if r.status_code != 200:
        r = session.post(f"{API}/auth/register", json={
            "name": "Ravi Kumar", "email": SEED_EMAIL,
            "password": SEED_PASS, "mobile": "9876500011",
        })
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth(seed_token):
    return {"Authorization": f"Bearer {seed_token}"}


# -------- Auth --------
class TestAuth:
    def test_register_new_user(self, session):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = session.post(f"{API}/auth/register", json={
            "name": "TEST User", "email": email, "password": "pw12345", "mobile": "9000000000"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and data["user"]["email"] == email

    def test_login_seed(self, session):
        r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASS})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, session, auth):
        r = session.get(f"{API}/auth/me", headers=auth)
        assert r.status_code == 200
        assert r.json()["email"] == SEED_EMAIL

    def test_me_unauth(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401


# -------- Catalog --------
class TestCatalog:
    def test_catalog(self, session):
        r = session.get(f"{API}/catalog")
        assert r.status_code == 200
        d = r.json()
        assert "catalog" in d and "languages" in d and "teachers" in d
        assert len(d["subjects"]) > 0


# -------- DNA --------
class TestDNA:
    def test_get_dna(self, session, auth):
        r = session.get(f"{API}/dna", headers=auth)
        assert r.status_code == 200
        d = r.json()
        assert "total_xp" in d and "time_machine" in d and "streak" in d


# -------- Mistakes --------
class TestMistakes:
    def test_add_and_list_mistake(self, session, auth):
        r = session.post(f"{API}/mistakes", headers=auth,
                         json={"subject": "Algorithms", "topic": "TEST_bfs",
                               "detail": "confused with dfs"})
        assert r.status_code == 200
        assert r.json()["topic"] == "TEST_bfs"
        r2 = session.get(f"{API}/mistakes", headers=auth)
        assert r2.status_code == 200
        assert any(m["topic"] == "TEST_bfs" for m in r2.json())


# -------- Compiler (all 5 languages) --------
class TestCompiler:
    def test_python(self, session, auth):
        r = session.post(f"{API}/compile", headers=auth,
                         json={"language": "python", "code": "print(2+3)"})
        assert r.status_code == 200
        assert "5" in r.json()["output"]

    def test_javascript(self, session, auth):
        r = session.post(f"{API}/compile", headers=auth,
                         json={"language": "javascript", "code": "console.log(2+3)"})
        assert r.status_code == 200
        assert "5" in r.json()["output"]

    def test_c(self, session, auth):
        code = '#include <stdio.h>\nint main(){printf("hi=%d\\n",7);return 0;}'
        r = session.post(f"{API}/compile", headers=auth,
                         json={"language": "c", "code": code})
        assert r.status_code == 200
        assert "hi=7" in r.json()["output"]

    def test_cpp(self, session, auth):
        code = '#include <iostream>\nint main(){std::cout<<"cpp"<<9;return 0;}'
        r = session.post(f"{API}/compile", headers=auth,
                         json={"language": "cpp", "code": code})
        assert r.status_code == 200
        assert "cpp9" in r.json()["output"]

    def test_java(self, session, auth):
        code = 'public class Main { public static void main(String[] a){ System.out.println("java-ok"); } }'
        r = session.post(f"{API}/compile", headers=auth,
                         json={"language": "java", "code": code})
        assert r.status_code == 200
        assert "java-ok" in r.json()["output"]

    def test_stdin(self, session, auth):
        code = 'x=input()\nprint("got:"+x)'
        r = session.post(f"{API}/compile", headers=auth,
                         json={"language": "python", "code": code, "stdin": "hello\n"})
        assert r.status_code == 200
        assert "got:hello" in r.json()["output"]

    def test_unsupported(self, session, auth):
        r = session.post(f"{API}/compile", headers=auth,
                         json={"language": "ruby", "code": "puts 1"})
        assert r.status_code == 400

    def test_problems(self, session, auth):
        r = session.get(f"{API}/compile/problems", headers=auth)
        assert r.status_code == 200 and len(r.json()) >= 3


# -------- Chat streaming --------
class TestChat:
    def test_chat_stream(self, session, auth):
        payload = {"message": "What is 2+2? one word", "session_id": f"test_{uuid.uuid4().hex[:8]}",
                   "subject": "Mathematics", "language": "en", "teacher": "prof", "mode": "solve"}
        r = requests.post(f"{API}/chat/stream", json=payload, headers=auth, stream=True, timeout=60)
        assert r.status_code == 200
        text = ""
        got_delta = False
        done = False
        start = time.time()
        for line in r.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data:"):
                continue
            data = json.loads(line[5:].strip())
            if "delta" in data:
                text += data["delta"]
                got_delta = True
            if data.get("done"):
                done = True
                break
            if time.time() - start > 60:
                break
        assert got_delta, "no streamed tokens"
        assert done
        assert len(text) > 0


# -------- TTS --------
class TestTTS:
    def test_tts(self, session, auth):
        r = session.post(f"{API}/tts", headers=auth,
                         json={"text": "Hello student", "voice": "nova"})
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("/api/tts/") and url.endswith(".mp3")
        r2 = requests.get(f"{BASE_URL}{url}", timeout=30)
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("audio")


# -------- Quiz --------
_quiz_state = {}


class TestQuiz:
    def test_generate(self, session, auth):
        r = session.post(f"{API}/quiz/generate", headers=auth,
                         json={"subject": "Algorithms", "difficulty": "easy"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["questions"]) == 5
        assert all("options" in q and len(q["options"]) == 4 for q in d["questions"])
        _quiz_state["quiz_id"] = d["quiz_id"]

    def test_submit(self, session, auth):
        qid = _quiz_state.get("quiz_id")
        if not qid:
            pytest.skip("no quiz generated")
        r = session.post(f"{API}/quiz/submit", headers=auth,
                         json={"quiz_id": qid, "answers": [0, 1, 2, 3, 0]})
        assert r.status_code == 200
        d = r.json()
        assert "score" in d and d["total"] == 5 and len(d["review"]) == 5

    def test_badges(self, session, auth):
        r = session.get(f"{API}/badges", headers=auth)
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_leaderboard(self, session, auth):
        r = session.get(f"{API}/leaderboard", headers=auth)
        assert r.status_code == 200
        assert any(row["is_me"] for row in r.json())


# -------- Friends --------
class TestFriends:
    def test_search(self, session, auth):
        r = session.post(f"{API}/friends/search", headers=auth, json={"query": "ravi_test"})
        assert r.status_code == 200
        # seed user searches self -> excluded, but shouldn't error
        assert isinstance(r.json(), list)

    def test_flow(self, session, auth):
        # create another user, send request, accept
        other_email = f"friend_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST Friend", "email": other_email, "password": "pw12345", "mobile": "9111111111"
        })
        assert r.status_code == 200
        other_token = r.json()["token"]
        other_uid = r.json()["user"]["user_id"]
        other_auth = {"Authorization": f"Bearer {other_token}"}

        # seed sends request to other
        r = session.post(f"{API}/friends/request", headers=auth,
                         json={"target_user_id": other_uid})
        assert r.status_code == 200

        # other sees incoming
        r = requests.get(f"{API}/friends/requests", headers=other_auth)
        assert r.status_code == 200
        seed_me = requests.get(f"{API}/auth/me", headers=auth).json()
        assert any(x["from"] == seed_me["user_id"] for x in r.json())

        # other accepts
        r = requests.post(f"{API}/friends/accept", headers=other_auth,
                          json={"target_user_id": seed_me["user_id"]})
        assert r.status_code == 200

        # seed friends list contains other
        r = session.get(f"{API}/friends", headers=auth)
        assert r.status_code == 200
        assert any(f["user_id"] == other_uid for f in r.json())


# -------- Interview --------
_intv = {}


class TestInterview:
    def test_start(self, session, auth):
        r = session.post(f"{API}/interview/start", headers=auth,
                         json={"role": "Backend Engineer"}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["question"] and d["number"] == 1
        _intv["sid"] = d["session_id"]

    def test_answer(self, session, auth):
        sid = _intv.get("sid")
        if not sid:
            pytest.skip("no session")
        r = session.post(f"{API}/interview/answer", headers=auth,
                         json={"session_id": sid,
                               "answer": "I would use indexing and query optimization."},
                         timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert "score" in d and "feedback" in d
