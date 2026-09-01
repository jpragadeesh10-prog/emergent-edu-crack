import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Video, Loader2, Send, Star, RotateCcw } from "lucide-react";

const ROLES = ["Software Engineer", "Data Scientist", "Frontend Developer", "ML Engineer", "Backend Developer"];

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

  const start = async () => {
    setBusy(true);
    try {
      const res = await api.post("/interview/start", { role });
      setSession(res.data.session_id);
      setQuestion(res.data.question);
      setNumber(res.data.number);
      setLog([]); setDone(false);
    } catch (e) { toast.error("Failed to start"); }
    finally { setBusy(false); }
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
      } else {
        setQuestion(res.data.next_question);
        setNumber(res.data.number);
      }
    } catch (e) { toast.error("Failed"); }
    finally { setBusy(false); }
  };

  const reset = () => { setSession(null); setQuestion(""); setLog([]); setDone(false); setAvg(0); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Video className="w-7 h-7 text-indigo-400" />
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Mock Interview</h1>
      </div>

      {!session && (
        <div className="glass rounded-2xl p-8 max-w-lg">
          <div className="w-14 h-14 orb animate-float mb-5" />
          <h3 className="font-display text-xl font-semibold mb-2">1-on-1 AI Interviewer</h3>
          <p className="text-slate-400 text-sm mb-5">Pick a role. The AI asks 5 progressively harder questions and scores each answer with feedback.</p>
          <select value={role} onChange={(e) => setRole(e.target.value)}
            data-testid="role-select"
            className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 mb-4 text-slate-200">
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <button onClick={start} disabled={busy} data-testid="start-interview-btn"
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 font-semibold px-6 py-3 rounded-full transition-colors active:scale-95 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />} Start Interview
          </button>
        </div>
      )}

      {session && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {!done && (
              <div className="glass rounded-2xl p-6" data-testid="interview-question">
                <p className="text-xs font-mono uppercase tracking-widest text-indigo-400 mb-2">Question {number} of 5</p>
                <p className="text-lg leading-relaxed">{question || <Loader2 className="w-5 h-5 animate-spin" />}</p>
                <textarea value={answer} onChange={(e) => setAnswer(e.target.value)}
                  data-testid="answer-input"
                  placeholder="Type your answer…" rows={5}
                  className="w-full mt-4 bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 resize-none text-slate-200" />
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
                <p className="text-slate-400 text-sm mt-2">Average score across {log.length} answers</p>
                <button onClick={reset} data-testid="restart-interview-btn"
                  className="mt-5 flex items-center gap-2 mx-auto px-6 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 font-semibold transition-colors active:scale-95">
                  <RotateCcw className="w-4 h-4" /> New Interview
                </button>
              </div>
            )}

            {/* transcript */}
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
            <p className="text-sm text-slate-400">Running avg: <span className="text-amber-400 font-bold">{avg}/10</span></p>
          </div>
        </div>
      )}
    </div>
  );
}
