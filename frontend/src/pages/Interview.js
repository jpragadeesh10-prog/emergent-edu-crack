import { useState, useRef, useEffect, useCallback } from "react";
import { api, getToken } from "@/lib/api";
import { toast } from "sonner";
import MicButton from "@/components/MicButton";
import {
  Video, VideoOff, Loader2, Send, Star, RotateCcw, Mic, Volume2, Circle,
  History, Play, ChevronDown, ChevronUp, Save,
} from "lucide-react";

const ROLES = ["Software Engineer", "Data Scientist", "Frontend Developer", "ML Engineer", "Backend Developer"];
const BACKEND = process.env.REACT_APP_BACKEND_URL;

export default function Interview() {
  const [role, setRole] = useState("Software Engineer");
  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState("");
  const [number, setNumber] = useState(0);
  const [answer, setAnswer] = useState("");
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [avg, setAvg] = useState(0);
  const [camOn, setCamOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [records, setRecords] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const sessionRef = useRef(null);

  const loadRecords = useCallback(() => {
    api.get("/interview/records").then((r) => setRecords(r.data)).catch(() => {});
  }, []);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const stopCam = useCallback(() => {
    try { recorderRef.current?.state === "recording" && recorderRef.current.stop(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }, []);

  useEffect(() => () => { stopCam(); audioRef.current?.pause(); }, [stopCam]);

  const startCam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamOn(true);
      // start recording the session
      try {
        chunksRef.current = [];
        const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
        rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
        rec.start(1000);
        recorderRef.current = rec;
      } catch {}
      return true;
    } catch {
      toast.error("Camera access denied — you can still answer by text/voice");
      return false;
    }
  };

  const speakQuestion = async (text) => {
    try {
      setSpeaking(true);
      const res = await api.post("/tts", { text, voice: "onyx" });
      const url = BACKEND + res.data.url;
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setSpeaking(false);
      await audio.play();
    } catch {
      setSpeaking(false);
    }
  };

  const start = async () => {
    setBusy(true);
    await startCam();
    try {
      const res = await api.post("/interview/start", { role });
      setSession(res.data.session_id);
      sessionRef.current = res.data.session_id;
      setQuestion(res.data.question);
      setNumber(res.data.number);
      setLog([]); setDone(false);
      speakQuestion(res.data.question);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to start interview");
    } finally { setBusy(false); }
  };

  const uploadRecording = async () => {
    const sid = sessionRef.current;
    if (!sid) return;
    setSaving(true);
    // stop recorder and wait for final chunk
    const rec = recorderRef.current;
    const blob = await new Promise((resolve) => {
      if (rec && rec.state === "recording") {
        rec.onstop = () => resolve(new Blob(chunksRef.current, { type: "video/webm" }));
        rec.stop();
      } else if (chunksRef.current.length) {
        resolve(new Blob(chunksRef.current, { type: "video/webm" }));
      } else resolve(null);
    });
    try {
      const fd = new FormData();
      fd.append("session_id", sid);
      if (blob && blob.size > 0) fd.append("video", blob, "interview.webm");
      const token = getToken();
      await fetch(`${BACKEND}/api/interview/save`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      toast.success("Interview saved to your history");
      loadRecords();
    } catch {
      toast.error("Could not save recording");
    } finally { setSaving(false); }
  };

  const sendAnswer = async () => {
    if (!answer.trim()) return;
    setBusy(true);
    const myAnswer = answer.trim();
    const currentQ = question;
    setAnswer("");
    try {
      const res = await api.post("/interview/answer", { session_id: session, answer: myAnswer });
      setLog((l) => [...l, { q: currentQ, a: myAnswer, feedback: res.data.feedback, score: res.data.score }]);
      setAvg(res.data.avg_score);
      if (res.data.done) {
        setDone(true); setQuestion("");
        speakQuestion(`That's a wrap. Your average score was ${res.data.avg_score} out of 10. Well done.`);
        uploadRecording();
      } else {
        setQuestion(res.data.next_question);
        setNumber(res.data.number);
        speakQuestion(res.data.next_question);
      }
    } catch (e) { toast.error("Failed to submit answer"); }
    finally { setBusy(false); }
  };

  const reset = () => {
    setSession(null); sessionRef.current = null; setQuestion(""); setLog([]);
    setDone(false); setAvg(0); audioRef.current?.pause(); setSpeaking(false); stopCam();
  };

  const token = getToken();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Video className="w-7 h-7 text-indigo-400" />
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Mock Interview</h1>
      </div>

      {!session && (
        <>
          <div className="glass rounded-2xl p-8 max-w-lg">
            <div className="w-14 h-14 orb animate-float mb-5" />
            <h3 className="font-display text-xl font-semibold mb-2">1-on-1 Live AI Interview</h3>
            <p className="text-slate-400 text-sm mb-5">
              Turn on your camera and face a real interview. The AI interviewer speaks each question aloud,
              you answer by voice or text, and the whole session is recorded so you can replay it later.
            </p>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              data-testid="role-select"
              className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 mb-4 text-slate-200">
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
            <button onClick={start} disabled={busy} data-testid="start-interview-btn"
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 font-semibold px-6 py-3 rounded-full transition-colors active:scale-95 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />} Start Live Interview
            </button>
          </div>

          {/* History */}
          <div className="glass rounded-2xl p-6" data-testid="interview-history">
            <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-cyan-400" /> Past Interviews
            </h3>
            {records.length === 0 ? (
              <p className="text-sm text-slate-500">No saved interviews yet. Finish one to see it here.</p>
            ) : (
              <div className="space-y-3">
                {records.map((r) => (
                  <div key={r.id} className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden" data-testid={`record-${r.id}`}>
                    <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800/40 transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                        <Play className="w-4 h-4 text-indigo-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{r.role}</p>
                        <p className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</p>
                      </div>
                      <span className="flex items-center gap-1 text-amber-400 text-sm font-bold">
                        <Star className="w-3.5 h-3.5 fill-amber-400" /> {r.avg_score}/10
                      </span>
                      {expanded === r.id ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </button>
                    {expanded === r.id && (
                      <div className="p-4 border-t border-slate-800 space-y-4">
                        {r.has_video ? (
                          <video controls playsInline data-testid={`record-video-${r.id}`}
                            src={`${BACKEND}/api/interview/video/${r.id}?auth=${token}`}
                            className="w-full max-w-md rounded-xl bg-black" />
                        ) : (
                          <p className="text-xs text-slate-500">No video was recorded for this session.</p>
                        )}
                        {r.qa.map((qa, i) => (
                          <div key={i} className="text-sm">
                            <p className="text-slate-400"><span className="text-indigo-400 font-mono">Q{i + 1}:</span> {qa.q}</p>
                            <p className="text-slate-200 mt-0.5">{qa.a}</p>
                            <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400" /> {qa.score}/10 — <span className="text-slate-400">{qa.feedback}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {session && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="grid grid-cols-2 gap-4" data-testid="video-stage">
              <div className={`relative rounded-2xl overflow-hidden aspect-video bg-slate-900 border transition-colors ${
                speaking ? "border-indigo-400" : "border-slate-800"
              }`}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-24 h-24 orb ${speaking ? "animate-float" : ""}`} />
                </div>
                {speaking && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full border-2 border-indigo-400" style={{ animation: "pulse-ring 1.2s ease-out infinite" }} />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-xs bg-black/60 px-2 py-1 rounded-lg">
                  <Volume2 className={`w-3.5 h-3.5 ${speaking ? "text-indigo-400" : "text-slate-500"}`} />
                  AI Interviewer
                </div>
              </div>
              <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-900 border border-slate-800">
                <video ref={videoRef} autoPlay playsInline muted data-testid="webcam-video"
                  className="w-full h-full object-cover" />
                {!camOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                    <VideoOff className="w-8 h-8" />
                    <button onClick={startCam} className="text-xs text-indigo-400 hover:text-indigo-300">Enable camera</button>
                  </div>
                )}
                {camOn && (
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 text-xs bg-rose-500/80 px-2 py-1 rounded-lg">
                    <Circle className="w-2 h-2 fill-white animate-pulse" /> REC
                  </div>
                )}
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-xs bg-black/60 px-2 py-1 rounded-lg">
                  <Circle className={`w-2.5 h-2.5 ${camOn ? "fill-emerald-400 text-emerald-400" : "fill-slate-500 text-slate-500"}`} /> You
                </div>
              </div>
            </div>

            {!done && (
              <div className="glass rounded-2xl p-6" data-testid="interview-question">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-mono uppercase tracking-widest text-indigo-400">Question {number} of 5</p>
                  <button onClick={() => speakQuestion(question)} disabled={speaking}
                    data-testid="replay-question-btn"
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition-colors disabled:opacity-50">
                    <Volume2 className="w-3.5 h-3.5" /> {speaking ? "Speaking…" : "Replay"}
                  </button>
                </div>
                <p className="text-lg leading-relaxed">{question || <Loader2 className="w-5 h-5 animate-spin" />}</p>
                <div className="flex items-end gap-3 mt-4">
                  <MicButton onTranscript={(t) => setAnswer((p) => (p ? p + " " : "") + t)} />
                  <textarea value={answer} onChange={(e) => setAnswer(e.target.value)}
                    data-testid="answer-input"
                    placeholder="Speak with the mic, or type your answer…" rows={3}
                    className="flex-1 bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 resize-none text-slate-200" />
                </div>
                <button onClick={sendAnswer} disabled={busy || !answer.trim()}
                  data-testid="submit-answer-btn"
                  className="mt-3 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 font-semibold px-6 py-3 rounded-full transition-colors active:scale-95 disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit Answer
                </button>
              </div>
            )}

            {done && (
              <div className="glass rounded-2xl p-8 text-center" data-testid="interview-done">
                <p className="text-xs font-mono uppercase tracking-widest text-indigo-400 mb-2">Interview Complete</p>
                <p className="font-display text-5xl font-extrabold text-gradient">{avg}/10</p>
                <p className="text-slate-400 text-sm mt-2 flex items-center justify-center gap-2">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving recording…</>
                    : <><Save className="w-4 h-4 text-emerald-400" /> Saved to your history</>}
                </p>
                <button onClick={reset} data-testid="restart-interview-btn"
                  className="mt-5 flex items-center gap-2 mx-auto px-6 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 font-semibold transition-colors active:scale-95">
                  <RotateCcw className="w-4 h-4" /> New Interview
                </button>
              </div>
            )}

            {log.map((l, i) => (
              <div key={i} className="glass rounded-2xl p-5">
                <p className="text-sm text-slate-400 mb-1"><span className="text-indigo-400 font-mono">Q{i + 1}:</span> {l.q}</p>
                <p className="text-sm text-slate-200 mb-3">{l.a}</p>
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex items-center gap-1 text-amber-400 text-sm font-bold">
                    <Star className="w-4 h-4 fill-amber-400" /> {l.score}/10
                  </span>
                </div>
                <p className="text-sm text-slate-400 border-t border-slate-800 pt-2">{l.feedback}</p>
              </div>
            ))}
          </div>

          <div className="glass rounded-2xl p-6 h-fit">
            <h3 className="font-display text-lg font-semibold mb-3">Session</h3>
            <p className="text-sm text-slate-400 mb-2">Role: <span className="text-white">{role}</span></p>
            <p className="text-sm text-slate-400 mb-2">Answered: <span className="text-white">{log.length}/5</span></p>
            <p className="text-sm text-slate-400 mb-4">Running avg: <span className="text-amber-400 font-bold">{avg}/10</span></p>
            <div className="text-xs text-slate-500 space-y-1.5 border-t border-slate-800 pt-4">
              <p className="flex items-center gap-2"><Mic className="w-3.5 h-3.5" /> Answer by voice or text</p>
              <p className="flex items-center gap-2"><Volume2 className="w-3.5 h-3.5" /> Interviewer speaks each question</p>
              <p className="flex items-center gap-2"><Circle className="w-3.5 h-3.5" /> Recorded for replay</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
