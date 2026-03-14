import { useState, useEffect, useMemo, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK DATA — Rich, realistic tracing data
// ═══════════════════════════════════════════════════════════════════════════════

const MOCK_REQUEST_LOGS = [
  { id: "req-a1f3", method: "POST", path: "/api/v1/separate", status: 202, duration_ms: 342, user_id: "u-7x9k", user_email: "producer@studio.vn", ip: "103.45.67.89", timestamp: "2025-12-11T09:00:01.234Z", request_id: "rid-001", task_id: "task-5e2a", body: { model: "bs_roformer", filename: "edm_remix.flac", file_size: 15800000 }, response: { task_id: "task-5e2a", status: "pending", credit_consumed: 1 }, headers: { "user-agent": "Mozilla/5.0 Chrome/120", "content-type": "multipart/form-data" } },
  { id: "req-b2g4", method: "GET", path: "/api/v1/status/task-5e2a", status: 200, duration_ms: 12, user_id: "u-7x9k", user_email: "producer@studio.vn", ip: "103.45.67.89", timestamp: "2025-12-11T09:00:15.891Z", request_id: "rid-002", task_id: "task-5e2a", response: { status: "processing", progress: 23 } },
  { id: "req-c3h5", method: "GET", path: "/api/v1/status/task-5e2a", status: 200, duration_ms: 8, user_id: "u-7x9k", user_email: "producer@studio.vn", ip: "103.45.67.89", timestamp: "2025-12-11T09:01:02.445Z", request_id: "rid-003", task_id: "task-5e2a", response: { status: "processing", progress: 67 } },
  { id: "req-d4j6", method: "POST", path: "/api/v1/separate", status: 402, duration_ms: 45, user_id: "u-3m1n", user_email: "dj_mix@gmail.com", ip: "42.115.23.101", timestamp: "2025-12-11T09:01:30.112Z", request_id: "rid-004", task_id: null, body: { model: "demucs_v4", filename: "party_mix.mp3" }, response: { error: "Insufficient credits", credits_remaining: 0 }, error: true },
  { id: "req-e5k7", method: "POST", path: "/api/v1/auth/login", status: 200, duration_ms: 89, user_id: "u-7x9k", user_email: "producer@studio.vn", ip: "103.45.67.89", timestamp: "2025-12-11T08:55:00.000Z", request_id: "rid-005", response: { token: "eyJ...truncated" } },
  { id: "req-f6l8", method: "POST", path: "/api/v1/separate", status: 202, duration_ms: 298, user_id: "u-9p2q", user_email: "musician@band.vn", ip: "118.70.12.45", timestamp: "2025-12-11T08:50:00.000Z", request_id: "rid-006", task_id: "task-7f4b", body: { model: "bs_roformer", filename: "rock_ballad.wav", file_size: 42000000 }, response: { task_id: "task-7f4b", status: "pending", credit_consumed: 2 } },
  { id: "req-g7m9", method: "GET", path: "/api/v1/status/task-7f4b", status: 200, duration_ms: 11, user_id: "u-9p2q", user_email: "musician@band.vn", ip: "118.70.12.45", timestamp: "2025-12-11T08:58:00.000Z", request_id: "rid-007", task_id: "task-7f4b", response: { status: "failed", error: "GPU OOM: model requires 9.2GB, available 7.8GB" }, error: true },
  { id: "req-h8n0", method: "POST", path: "/api/v1/separate", status: 400, duration_ms: 23, user_id: "u-4r5s", user_email: "test@fake.com", ip: "185.220.101.33", timestamp: "2025-12-11T09:02:00.000Z", request_id: "rid-008", body: { model: "bs_roformer", filename: "not_audio.exe" }, response: { error: "Invalid file type. Supported: mp3, wav, flac, ogg" }, error: true },
  { id: "req-i9o1", method: "GET", path: "/api/v1/me", status: 200, duration_ms: 15, user_id: "u-7x9k", user_email: "producer@studio.vn", ip: "103.45.67.89", timestamp: "2025-12-11T09:03:00.000Z", request_id: "rid-009", response: { email: "producer@studio.vn", credits: 6 } },
  { id: "req-j0p2", method: "POST", path: "/api/v1/separate", status: 429, duration_ms: 3, user_id: "u-4r5s", user_email: "test@fake.com", ip: "185.220.101.33", timestamp: "2025-12-11T09:02:01.000Z", request_id: "rid-010", response: { error: "Rate limit exceeded. Try again in 58 seconds." }, error: true },
];

const MOCK_TASK_LOGS = {
  "task-5e2a": {
    id: "task-5e2a", filename: "edm_remix.flac", model: "bs_roformer", user_email: "producer@studio.vn",
    duration_seconds: 180, file_size: "15.8 MB", credit: 1, status: "processing", progress: 67,
    created_at: "2025-12-11T09:00:01.234Z",
    steps: [
      { step: 1, name: "upload_received", label: "Upload received", status: "done", started_at: "2025-12-11T09:00:01.234Z", ended_at: "2025-12-11T09:00:01.280Z", duration_ms: 46, detail: "File validated: FLAC, 15.8MB, 3:00 duration" },
      { step: 2, name: "credit_check", label: "Credit check & deduct", status: "done", started_at: "2025-12-11T09:00:01.280Z", ended_at: "2025-12-11T09:00:01.312Z", duration_ms: 32, detail: "User u-7x9k: 7 credits → 6 credits (cost: 1)" },
      { step: 3, name: "file_storage", label: "Save to MinIO", status: "done", started_at: "2025-12-11T09:00:01.312Z", ended_at: "2025-12-11T09:00:02.145Z", duration_ms: 833, detail: "uploads/u-7x9k/task-5e2a/original.flac → bucket:audio-files" },
      { step: 4, name: "queue_task", label: "Push to Celery queue", status: "done", started_at: "2025-12-11T09:00:02.145Z", ended_at: "2025-12-11T09:00:02.198Z", duration_ms: 53, detail: "Queue: default, Priority: normal, ETA: immediate" },
      { step: 5, name: "worker_pickup", label: "Worker picks up task", status: "done", started_at: "2025-12-11T09:00:04.512Z", ended_at: "2025-12-11T09:00:04.520Z", duration_ms: 8, detail: "Worker: celery@worker-01, PID: 4821, Queue wait: 2.31s" },
      { step: 6, name: "download_file", label: "Download from MinIO", status: "done", started_at: "2025-12-11T09:00:04.520Z", ended_at: "2025-12-11T09:00:05.890Z", duration_ms: 1370, detail: "Downloaded to /tmp/task-5e2a/original.flac (15.8MB)" },
      { step: 7, name: "model_inference", label: "Model inference (BS-RoFormer)", status: "running", started_at: "2025-12-11T09:00:05.890Z", ended_at: null, duration_ms: null, detail: "GPU: cuda:0 (RTX 3060 12GB), VRAM: 6.2/12GB, Progress: 67%, Chunk 8/12", progress: 67 },
      { step: 8, name: "upload_results", label: "Upload separated stems", status: "pending", detail: "Vocal + Instrumental → MinIO" },
      { step: 9, name: "update_db", label: "Update task record", status: "pending", detail: "SET status='completed', paths, timestamps" },
      { step: 10, name: "notify_user", label: "Notify completion", status: "pending", detail: "WebSocket push + optional webhook" },
    ],
    worker_logs: [
      { ts: "09:00:04.512", level: "INFO", msg: "[worker-01] Task task-5e2a received, model=bs_roformer" },
      { ts: "09:00:04.520", level: "INFO", msg: "[worker-01] Downloading original file from MinIO..." },
      { ts: "09:00:05.890", level: "INFO", msg: "[worker-01] File downloaded: /tmp/task-5e2a/original.flac (15.8MB)" },
      { ts: "09:00:05.895", level: "INFO", msg: "[worker-01] Loading BS-RoFormer model (cached, 0.02s)" },
      { ts: "09:00:05.915", level: "INFO", msg: "[worker-01] Starting inference: 12 chunks, chunk_size=352800" },
      { ts: "09:00:08.234", level: "DEBUG", msg: "[worker-01] Chunk 1/12 completed (2.32s), VRAM: 5.8GB" },
      { ts: "09:00:10.567", level: "DEBUG", msg: "[worker-01] Chunk 2/12 completed (2.33s), VRAM: 5.9GB" },
      { ts: "09:00:12.890", level: "DEBUG", msg: "[worker-01] Chunk 3/12 completed (2.32s), VRAM: 5.8GB" },
      { ts: "09:00:15.210", level: "DEBUG", msg: "[worker-01] Chunk 4/12 completed (2.32s), VRAM: 6.0GB" },
      { ts: "09:00:17.543", level: "DEBUG", msg: "[worker-01] Chunk 5/12 completed (2.33s), VRAM: 5.9GB" },
      { ts: "09:00:19.876", level: "DEBUG", msg: "[worker-01] Chunk 6/12 completed (2.33s), VRAM: 6.1GB" },
      { ts: "09:00:22.200", level: "DEBUG", msg: "[worker-01] Chunk 7/12 completed (2.32s), VRAM: 6.0GB" },
      { ts: "09:00:24.534", level: "WARN", msg: "[worker-01] Chunk 8/12 completed (2.33s), VRAM: 6.2GB ⚠ approaching limit" },
      { ts: "09:00:24.535", level: "INFO", msg: "[worker-01] Progress: 67% (8/12 chunks)" },
    ],
  },
  "task-7f4b": {
    id: "task-7f4b", filename: "rock_ballad.wav", model: "bs_roformer", user_email: "musician@band.vn",
    duration_seconds: 412, file_size: "42.0 MB", credit: 2, status: "failed",
    created_at: "2025-12-11T08:50:00.000Z",
    steps: [
      { step: 1, name: "upload_received", label: "Upload received", status: "done", started_at: "2025-12-11T08:50:00.000Z", ended_at: "2025-12-11T08:50:00.120Z", duration_ms: 120, detail: "File validated: WAV, 42.0MB, 6:52 duration" },
      { step: 2, name: "credit_check", label: "Credit check & deduct", status: "done", started_at: "2025-12-11T08:50:00.120Z", ended_at: "2025-12-11T08:50:00.155Z", duration_ms: 35, detail: "User u-9p2q: 15 credits → 13 credits (cost: 2)" },
      { step: 3, name: "file_storage", label: "Save to MinIO", status: "done", started_at: "2025-12-11T08:50:00.155Z", ended_at: "2025-12-11T08:50:02.340Z", duration_ms: 2185, detail: "uploads/u-9p2q/task-7f4b/original.wav → bucket:audio-files" },
      { step: 4, name: "queue_task", label: "Push to Celery queue", status: "done", started_at: "2025-12-11T08:50:02.340Z", ended_at: "2025-12-11T08:50:02.398Z", duration_ms: 58, detail: "Queue: default, Priority: normal" },
      { step: 5, name: "worker_pickup", label: "Worker picks up task", status: "done", started_at: "2025-12-11T08:52:10.000Z", ended_at: "2025-12-11T08:52:10.010Z", duration_ms: 10, detail: "Worker: celery@worker-02, PID: 5102, Queue wait: 127.6s" },
      { step: 6, name: "download_file", label: "Download from MinIO", status: "done", started_at: "2025-12-11T08:52:10.010Z", ended_at: "2025-12-11T08:52:13.450Z", duration_ms: 3440, detail: "Downloaded to /tmp/task-7f4b/original.wav (42.0MB)" },
      { step: 7, name: "model_inference", label: "Model inference (BS-RoFormer)", status: "error", started_at: "2025-12-11T08:52:13.450Z", ended_at: "2025-12-11T08:52:18.900Z", duration_ms: 5450, detail: "CUDA OOM: tried to allocate 1.4GB, 7.8GB/8.0GB used", error: "RuntimeError: CUDA out of memory. Tried to allocate 1.40 GiB (GPU 0; 8.00 GiB total; 7.82 GiB already allocated)" },
      { step: 8, name: "refund_credit", label: "Refund credits", status: "done", started_at: "2025-12-11T08:52:18.910Z", ended_at: "2025-12-11T08:52:18.945Z", duration_ms: 35, detail: "Refunded 2 credits → User u-9p2q now has 15 credits" },
      { step: 9, name: "cleanup", label: "Cleanup temp files", status: "done", started_at: "2025-12-11T08:52:18.945Z", ended_at: "2025-12-11T08:52:19.012Z", duration_ms: 67, detail: "Removed /tmp/task-7f4b/ (42.0MB freed)" },
    ],
    worker_logs: [
      { ts: "08:52:10.000", level: "INFO", msg: "[worker-02] Task task-7f4b received, model=bs_roformer" },
      { ts: "08:52:10.010", level: "INFO", msg: "[worker-02] Downloading original file from MinIO..." },
      { ts: "08:52:13.450", level: "INFO", msg: "[worker-02] File downloaded: /tmp/task-7f4b/original.wav (42.0MB)" },
      { ts: "08:52:13.455", level: "INFO", msg: "[worker-02] Loading BS-RoFormer model (cached, 0.01s)" },
      { ts: "08:52:13.466", level: "INFO", msg: "[worker-02] Starting inference: 22 chunks, chunk_size=352800" },
      { ts: "08:52:15.800", level: "DEBUG", msg: "[worker-02] Chunk 1/22 completed (2.33s), VRAM: 7.1GB" },
      { ts: "08:52:18.100", level: "WARN", msg: "[worker-02] Chunk 2/22 completed (2.30s), VRAM: 7.8GB ⚠ critical" },
      { ts: "08:52:18.900", level: "ERROR", msg: "[worker-02] CUDA OOM: tried to allocate 1.40 GiB (7.82/8.00 GiB used)" },
      { ts: "08:52:18.901", level: "ERROR", msg: "[worker-02] torch.cuda.OutOfMemoryError at model_inference step" },
      { ts: "08:52:18.905", level: "INFO", msg: "[worker-02] Initiating credit refund for task-7f4b (2 credits)" },
      { ts: "08:52:18.945", level: "INFO", msg: "[worker-02] Credit refund successful: u-9p2q 13→15 credits" },
      { ts: "08:52:19.012", level: "INFO", msg: "[worker-02] Cleanup complete, task marked as failed" },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const fmtTime = (d) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
const fmtDate = (d) => new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const methodColors = { GET: "#22d3ee", POST: "#a78bfa", PUT: "#fbbf24", DELETE: "#f87171", PATCH: "#34d399" };
const statusColors = (s) => s >= 500 ? "#ef4444" : s >= 400 ? "#f59e0b" : s >= 300 ? "#3b82f6" : "#10b981";
const levelColors = { INFO: "#6ee7b7", DEBUG: "#818cf8", WARN: "#fcd34d", ERROR: "#fca5a5" };
const stepStatusIcon = { done: "✓", running: "◉", pending: "○", error: "✕" };
const stepStatusColor = { done: "#10b981", running: "#6366f1", pending: "#4b5563", error: "#ef4444" };

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminTracingDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [logFilter, setLogFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedStep, setExpandedStep] = useState(null);
  const [correlationMode, setCorrelationMode] = useState(false);
  const [correlatedTaskId, setCorrelatedTaskId] = useState(null);
  const logEndRef = useRef(null);

  const filteredRequests = useMemo(() => {
    let r = MOCK_REQUEST_LOGS;
    if (logFilter === "errors") r = r.filter(l => l.error);
    if (logFilter === "separate") r = r.filter(l => l.path.includes("/separate"));
    if (logFilter === "auth") r = r.filter(l => l.path.includes("/auth"));
    if (searchQuery) r = r.filter(l => JSON.stringify(l).toLowerCase().includes(searchQuery.toLowerCase()));
    if (correlatedTaskId) r = r.filter(l => l.task_id === correlatedTaskId);
    return r;
  }, [logFilter, searchQuery, correlatedTaskId]);

  const correlateTask = (taskId) => {
    if (!taskId) return;
    setCorrelationMode(true);
    setCorrelatedTaskId(taskId);
    setSelectedTask(MOCK_TASK_LOGS[taskId] || null);
  };

  const clearCorrelation = () => {
    setCorrelationMode(false);
    setCorrelatedTaskId(null);
    setSelectedTask(null);
    setSelectedRequest(null);
  };

  // ─── Inline Styles ────────────────────────────────────────────────────────
  const font = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";
  const fontUI = "'Satoshi', 'General Sans', system-ui, sans-serif";

  return (
    <div style={{ minHeight: "100vh", background: "#08080c", color: "#c8cad0", fontFamily: fontUI, fontSize: 13 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 3px; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes ripple { 0% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); } 100% { box-shadow: 0 0 0 12px rgba(99,102,241,0); } }
        .row-hover:hover { background: #111118 !important; }
        .tab-btn { background: transparent; border: none; color: #6b7280; padding: 10px 16px; cursor: pointer; font-size: 12px; font-weight: 500; border-bottom: 2px solid transparent; transition: all 0.2s; font-family: inherit; }
        .tab-btn:hover { color: #a5b4fc; }
        .tab-btn.active { color: #818cf8; border-bottom-color: #818cf8; }
        .filter-chip { background: #14141e; border: 1px solid #1e1e2e; border-radius: 6px; padding: 5px 12px; color: #9ca3af; cursor: pointer; font-size: 11px; font-family: inherit; transition: all 0.15s; }
        .filter-chip:hover { border-color: #3730a3; color: #c7d2fe; }
        .filter-chip.active { background: #1e1b4b; border-color: #4338ca; color: #a5b4fc; }
        .log-line { font-family: ${font}; font-size: 11.5px; line-height: 1.7; padding: 2px 0; }
        .glow-dot { width: 7px; height: 7px; border-radius: 50%; animation: ripple 2s infinite; }
      `}</style>

      {/* ─── Top Bar ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderBottom: "1px solid #151520", background: "#0a0a10" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "linear-gradient(135deg, #4338ca, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚡</div>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#e5e7eb", letterSpacing: -0.3 }}>SplitAudio</span>
            <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#1e1b4b", color: "#818cf8", fontWeight: 600 }}>ADMIN TRACING</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {correlationMode && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 8, background: "#1e1b4b", border: "1px solid #3730a3" }}>
              <span style={{ fontSize: 11, color: "#a5b4fc" }}>Correlating: <strong>{correlatedTaskId}</strong></span>
              <button onClick={clearCorrelation} style={{ background: "none", border: "none", color: "#818cf8", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>✕</button>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: autoRefresh ? "#6ee7b7" : "#6b7280" }}>
            <div className="glow-dot" style={{ background: autoRefresh ? "#10b981" : "#374151" }} />
            <span>Live</span>
          </div>
          <button onClick={() => setAutoRefresh(!autoRefresh)} style={{ background: "#14141e", border: "1px solid #1e1e2e", borderRadius: 6, padding: "5px 12px", color: "#9ca3af", cursor: "pointer", fontSize: 11 }}>
            {autoRefresh ? "Pause" : "Resume"}
          </button>
        </div>
      </div>

      {/* ─── Tabs ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", borderBottom: "1px solid #151520", padding: "0 24px", background: "#0a0a10" }}>
        {[
          { id: "overview", label: "Overview" },
          { id: "requests", label: "Request Logs" },
          { id: "tasks", label: "Task Pipeline" },
          { id: "correlation", label: "Log Correlation" },
        ].map(t => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ─── Content ─────────────────────────────────────────────────────── */}
      <div style={{ padding: 24 }}>

        {/* ════ OVERVIEW TAB ════ */}
        {activeTab === "overview" && (
          <div style={{ animation: "slideUp 0.3s ease" }}>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Total Requests", value: "1,847", sub: "last 24h", color: "#818cf8" },
                { label: "Error Rate", value: "4.2%", sub: "78 errors", color: "#fca5a5" },
                { label: "Avg Latency", value: "89ms", sub: "p99: 342ms", color: "#6ee7b7" },
                { label: "Active Tasks", value: "3", sub: "2 processing", color: "#fcd34d" },
                { label: "GPU Utilization", value: "72%", sub: "6.2/12 GB", color: "#a78bfa" },
              ].map((s, i) => (
                <div key={i} style={{ background: "#0e0e16", border: "1px solid #1a1a28", borderRadius: 10, padding: "16px 18px", animation: `slideUp 0.3s ease ${i * 0.05}s both` }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: font }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "#4b5563", marginTop: 4 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Recent errors + Active tasks side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Recent Errors */}
              <div style={{ background: "#0e0e16", border: "1px solid #1a1a28", borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444" }} />
                  Recent Errors
                </div>
                {MOCK_REQUEST_LOGS.filter(l => l.error).slice(0, 4).map(l => (
                  <div key={l.id} className="row-hover" style={{ padding: "10px 12px", borderRadius: 6, marginBottom: 4, cursor: "pointer", transition: "background 0.15s" }} onClick={() => { setSelectedRequest(l); setActiveTab("requests"); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: font, fontSize: 11, color: methodColors[l.method], fontWeight: 600 }}>{l.method}</span>
                        <span style={{ fontFamily: font, fontSize: 11, color: "#9ca3af" }}>{l.path}</span>
                      </div>
                      <span style={{ fontFamily: font, fontSize: 11, padding: "2px 8px", borderRadius: 4, background: `${statusColors(l.status)}15`, color: statusColors(l.status) }}>{l.status}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#4b5563", marginTop: 4 }}>{l.response?.error || "Error"} • {fmtTime(l.timestamp)}</div>
                  </div>
                ))}
              </div>

              {/* Active Tasks Pipeline */}
              <div style={{ background: "#0e0e16", border: "1px solid #1a1a28", borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="glow-dot" style={{ background: "#6366f1" }} />
                  Active Task Pipelines
                </div>
                {Object.values(MOCK_TASK_LOGS).map(task => (
                  <div key={task.id} className="row-hover" style={{ padding: "12px 14px", borderRadius: 8, marginBottom: 8, border: "1px solid #1a1a28", cursor: "pointer", transition: "all 0.15s" }} onClick={() => { correlateTask(task.id); setActiveTab("correlation"); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 12, color: "#e5e7eb" }}>{task.filename}</span>
                        <span style={{ marginLeft: 8, fontFamily: font, fontSize: 10, color: "#6b7280" }}>{task.id}</span>
                      </div>
                      <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: task.status === "failed" ? "#7f1d1d" : "#1e1b4b", color: task.status === "failed" ? "#fca5a5" : "#a5b4fc", fontWeight: 600 }}>
                        {task.status}
                      </span>
                    </div>
                    {/* Mini pipeline */}
                    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                      {task.steps.map((s, i) => (
                        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: s.status === "done" ? "#10b981" : s.status === "running" ? "#6366f1" : s.status === "error" ? "#ef4444" : "#1e1e2e", transition: "background 0.3s", animation: s.status === "running" ? "pulse 1.5s infinite" : "none" }} title={s.label} />
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: "#4b5563", marginTop: 6 }}>
                      {task.steps.filter(s => s.status === "done").length}/{task.steps.length} steps • {task.model} • {task.user_email}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════ REQUEST LOGS TAB ════ */}
        {activeTab === "requests" && (
          <div style={{ animation: "slideUp 0.3s ease" }}>
            {/* Filters */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { id: "all", label: "All" },
                  { id: "errors", label: "Errors only" },
                  { id: "separate", label: "/separate" },
                  { id: "auth", label: "/auth" },
                ].map(f => (
                  <button key={f.id} className={`filter-chip ${logFilter === f.id ? "active" : ""}`} onClick={() => setLogFilter(f.id)}>{f.label}</button>
                ))}
              </div>
              <div style={{ position: "relative" }}>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search logs..." style={{ background: "#14141e", border: "1px solid #1e1e2e", borderRadius: 6, padding: "6px 12px 6px 30px", color: "#c8cad0", fontSize: 11, fontFamily: "inherit", width: 260, outline: "none" }} />
                <span style={{ position: "absolute", left: 10, top: 7, fontSize: 12, color: "#4b5563" }}>⌕</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: selectedRequest ? "1fr 420px" : "1fr", gap: 16 }}>
              {/* Log Table */}
              <div style={{ background: "#0e0e16", border: "1px solid #1a1a28", borderRadius: 10, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#111118" }}>
                      {["Time", "Method", "Path", "Status", "Duration", "User", "Task"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.8, borderBottom: "1px solid #1a1a28" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((l, i) => (
                      <tr key={l.id} className="row-hover" style={{ cursor: "pointer", background: selectedRequest?.id === l.id ? "#151520" : "transparent", borderLeft: selectedRequest?.id === l.id ? "2px solid #818cf8" : "2px solid transparent", animation: `slideUp 0.2s ease ${i * 0.02}s both` }} onClick={() => setSelectedRequest(l)}>
                        <td style={{ padding: "10px 14px", fontFamily: font, fontSize: 11, color: "#6b7280", borderBottom: "1px solid #111118" }}>{fmtTime(l.timestamp)}</td>
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #111118" }}><span style={{ fontFamily: font, fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: `${methodColors[l.method]}15`, color: methodColors[l.method] }}>{l.method}</span></td>
                        <td style={{ padding: "10px 14px", fontFamily: font, fontSize: 11, color: "#c8cad0", borderBottom: "1px solid #111118" }}>{l.path}</td>
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #111118" }}><span style={{ fontFamily: font, fontSize: 11, fontWeight: 600, color: statusColors(l.status) }}>{l.status}</span></td>
                        <td style={{ padding: "10px 14px", fontFamily: font, fontSize: 11, color: l.duration_ms > 200 ? "#fcd34d" : "#6b7280", borderBottom: "1px solid #111118" }}>{l.duration_ms}ms</td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: "#6b7280", borderBottom: "1px solid #111118" }}>{l.user_email || "—"}</td>
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #111118" }}>
                          {l.task_id ? (
                            <button onClick={e => { e.stopPropagation(); correlateTask(l.task_id); setActiveTab("correlation"); }} style={{ fontFamily: font, fontSize: 10, color: "#818cf8", background: "#1e1b4b", border: "1px solid #3730a3", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>{l.task_id}</button>
                          ) : <span style={{ color: "#2a2a3a" }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Request Detail Panel */}
              {selectedRequest && (
                <div style={{ background: "#0e0e16", border: "1px solid #1a1a28", borderRadius: 10, padding: 20, animation: "slideUp 0.25s ease", position: "sticky", top: 24, maxHeight: "calc(100vh - 180px)", overflow: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Request Detail</span>
                    <button onClick={() => setSelectedRequest(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <span style={{ fontFamily: font, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: `${methodColors[selectedRequest.method]}15`, color: methodColors[selectedRequest.method] }}>{selectedRequest.method}</span>
                    <span style={{ fontFamily: font, fontSize: 11, color: "#c8cad0" }}>{selectedRequest.path}</span>
                    <span style={{ fontFamily: font, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: `${statusColors(selectedRequest.status)}15`, color: statusColors(selectedRequest.status) }}>{selectedRequest.status}</span>
                  </div>

                  {[
                    { label: "Request ID", value: selectedRequest.request_id },
                    { label: "Timestamp", value: fmtDate(selectedRequest.timestamp) },
                    { label: "Duration", value: `${selectedRequest.duration_ms}ms` },
                    { label: "User", value: selectedRequest.user_email || "Anonymous" },
                    { label: "IP", value: selectedRequest.ip },
                    selectedRequest.task_id && { label: "Task ID", value: selectedRequest.task_id },
                  ].filter(Boolean).map(f => (
                    <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #111118" }}>
                      <span style={{ fontSize: 11, color: "#6b7280" }}>{f.label}</span>
                      <span style={{ fontFamily: font, fontSize: 11, color: "#c8cad0" }}>{f.value}</span>
                    </div>
                  ))}

                  {selectedRequest.body && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Request Body</div>
                      <pre style={{ fontFamily: font, fontSize: 10.5, background: "#08080c", borderRadius: 6, padding: 12, color: "#a5b4fc", overflow: "auto", lineHeight: 1.6, border: "1px solid #1a1a28" }}>{JSON.stringify(selectedRequest.body, null, 2)}</pre>
                    </div>
                  )}

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Response</div>
                    <pre style={{ fontFamily: font, fontSize: 10.5, background: "#08080c", borderRadius: 6, padding: 12, color: selectedRequest.error ? "#fca5a5" : "#6ee7b7", overflow: "auto", lineHeight: 1.6, border: "1px solid #1a1a28" }}>{JSON.stringify(selectedRequest.response, null, 2)}</pre>
                  </div>

                  {selectedRequest.task_id && (
                    <button onClick={() => { correlateTask(selectedRequest.task_id); setActiveTab("correlation"); }} style={{ marginTop: 14, width: "100%", padding: "10px", borderRadius: 8, background: "#1e1b4b", border: "1px solid #3730a3", color: "#a5b4fc", cursor: "pointer", fontWeight: 600, fontSize: 12, fontFamily: "inherit" }}>
                      View Task Pipeline →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ TASK PIPELINE TAB ════ */}
        {activeTab === "tasks" && (
          <div style={{ animation: "slideUp 0.3s ease" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {Object.values(MOCK_TASK_LOGS).map(t => (
                <button key={t.id} className={`filter-chip ${selectedTask?.id === t.id ? "active" : ""}`} onClick={() => setSelectedTask(t)}>
                  {t.filename} <span style={{ color: t.status === "failed" ? "#fca5a5" : "#818cf8", marginLeft: 4 }}>({t.status})</span>
                </button>
              ))}
            </div>

            {selectedTask ? <TaskPipelineView task={selectedTask} expandedStep={expandedStep} setExpandedStep={setExpandedStep} levelFilter={levelFilter} setLevelFilter={setLevelFilter} /> : (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#4b5563" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⚙</div>
                <p>Select a task above to view its processing pipeline</p>
              </div>
            )}
          </div>
        )}

        {/* ════ LOG CORRELATION TAB ════ */}
        {activeTab === "correlation" && (
          <div style={{ animation: "slideUp 0.3s ease" }}>
            {correlatedTaskId && selectedTask ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "14px 18px", borderRadius: 10, background: "#0e0e16", border: "1px solid #1a1a28" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Correlation View:</span>
                  <span style={{ fontFamily: font, fontSize: 12, color: "#818cf8" }}>{correlatedTaskId}</span>
                  <span style={{ color: "#4b5563" }}>•</span>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>{selectedTask.filename}</span>
                  <span style={{ color: "#4b5563" }}>•</span>
                  <span style={{ fontSize: 12, color: selectedTask.status === "failed" ? "#fca5a5" : "#a5b4fc" }}>{selectedTask.status}</span>
                  <button onClick={clearCorrelation} style={{ marginLeft: "auto", background: "#1e1b4b", border: "1px solid #3730a3", borderRadius: 6, padding: "4px 12px", color: "#a5b4fc", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Clear</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Left: Request logs for this task */}
                  <div style={{ background: "#0e0e16", border: "1px solid #1a1a28", borderRadius: 10, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb", marginBottom: 14 }}>HTTP Request Logs <span style={{ fontWeight: 400, color: "#4b5563", fontSize: 11 }}>({filteredRequests.length} requests)</span></div>
                    {filteredRequests.map((l, i) => (
                      <div key={l.id} className="row-hover" style={{ padding: "10px 12px", borderRadius: 6, marginBottom: 4, borderLeft: `3px solid ${statusColors(l.status)}`, cursor: "pointer" }} onClick={() => setSelectedRequest(l)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontFamily: font, fontSize: 10, fontWeight: 600, color: methodColors[l.method] }}>{l.method}</span>
                            <span style={{ fontFamily: font, fontSize: 10, color: "#9ca3af" }}>{l.path}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: font, fontSize: 10, color: statusColors(l.status) }}>{l.status}</span>
                            <span style={{ fontFamily: font, fontSize: 10, color: "#4b5563" }}>{l.duration_ms}ms</span>
                          </div>
                        </div>
                        <div style={{ fontFamily: font, fontSize: 10, color: "#4b5563", marginTop: 3 }}>{fmtTime(l.timestamp)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Right: Task pipeline */}
                  <div style={{ background: "#0e0e16", border: "1px solid #1a1a28", borderRadius: 10, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb", marginBottom: 14 }}>Task Processing Pipeline</div>
                    <TaskPipelineView task={selectedTask} expandedStep={expandedStep} setExpandedStep={setExpandedStep} levelFilter={levelFilter} setLevelFilter={setLevelFilter} compact />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#4b5563" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}></div>
                <p style={{ marginBottom: 8 }}>Click a Task ID in Request Logs to correlate both log types</p>
                <p style={{ fontSize: 11 }}>This view shows HTTP requests alongside the background task pipeline, making it easy to trace issues end-to-end.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK PIPELINE VIEW — Reusable component
// ═══════════════════════════════════════════════════════════════════════════════
function TaskPipelineView({ task, expandedStep, setExpandedStep, levelFilter, setLevelFilter, compact = false }) {
  const font = "'JetBrains Mono', 'Fira Code', monospace";

  return (
    <div>
      {/* Step-by-step pipeline */}
      <div style={{ marginBottom: compact ? 16 : 24 }}>
        {!compact && <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb", marginBottom: 14 }}>Processing Steps</div>}
        <div style={{ position: "relative" }}>
          {/* Vertical line */}
          <div style={{ position: "absolute", left: 15, top: 20, bottom: 20, width: 2, background: "#1e1e2e" }} />

          {task.steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 14, marginBottom: 4, position: "relative", animation: `slideUp 0.2s ease ${i * 0.04}s both` }}>
              {/* Step dot */}
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: s.status === "running" ? "#1e1b4b" : s.status === "error" ? "#7f1d1d" : s.status === "done" ? "#052e16" : "#14141e", border: `2px solid ${stepStatusColor[s.status]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: stepStatusColor[s.status], fontWeight: 700, flexShrink: 0, zIndex: 1, animation: s.status === "running" ? "ripple 2s infinite" : "none" }}>
                {stepStatusIcon[s.status]}
              </div>

              {/* Step content */}
              <div style={{ flex: 1, padding: "4px 0", cursor: "pointer" }} onClick={() => setExpandedStep(expandedStep === i ? null : i)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: s.status === "error" ? "#fca5a5" : s.status === "running" ? "#a5b4fc" : s.status === "done" ? "#e5e7eb" : "#6b7280" }}>
                      {s.label}
                    </span>
                    {s.status === "running" && s.progress && (
                      <span style={{ fontFamily: font, fontSize: 10, color: "#818cf8", padding: "1px 6px", borderRadius: 3, background: "#1e1b4b" }}>{s.progress}%</span>
                    )}
                  </div>
                  {s.duration_ms !== null && s.duration_ms !== undefined && (
                    <span style={{ fontFamily: font, fontSize: 10, color: s.duration_ms > 2000 ? "#fcd34d" : "#4b5563" }}>{s.duration_ms}ms</span>
                  )}
                </div>

                {/* Progress bar for running step */}
                {s.status === "running" && s.progress && (
                  <div style={{ height: 3, borderRadius: 2, background: "#1e1e2e", marginTop: 6, overflow: "hidden" }}>
                    <div style={{ width: `${s.progress}%`, height: "100%", background: "linear-gradient(90deg, #4338ca, #818cf8)", borderRadius: 2, transition: "width 0.5s" }} />
                  </div>
                )}

                {/* Expanded detail */}
                {expandedStep === i && (
                  <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 6, background: "#08080c", border: "1px solid #1a1a28", animation: "slideUp 0.2s ease" }}>
                    <div style={{ fontFamily: font, fontSize: 10.5, color: "#9ca3af", lineHeight: 1.7 }}>{s.detail}</div>
                    {s.error && (
                      <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 4, background: "#7f1d1d20", border: "1px solid #7f1d1d", fontFamily: font, fontSize: 10.5, color: "#fca5a5", lineHeight: 1.6 }}>
                        {s.error}
                      </div>
                    )}
                    {s.started_at && <div style={{ fontFamily: font, fontSize: 10, color: "#4b5563", marginTop: 6 }}>Started: {fmtTime(s.started_at)}{s.ended_at ? ` → Ended: ${fmtTime(s.ended_at)}` : " → In progress..."}</div>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Worker Logs */}
      {task.worker_logs && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Worker Logs</div>
            <div style={{ display: "flex", gap: 4 }}>
              {["all", "INFO", "DEBUG", "WARN", "ERROR"].map(l => (
                <button key={l} className={`filter-chip ${levelFilter === l ? "active" : ""}`} onClick={() => setLevelFilter(l)} style={{ padding: "3px 8px", fontSize: 10 }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ background: "#08080c", borderRadius: 8, padding: "12px 14px", border: "1px solid #1a1a28", maxHeight: compact ? 260 : 340, overflow: "auto", fontFamily: font }}>
            {task.worker_logs.filter(l => levelFilter === "all" || l.level === levelFilter).map((l, i) => (
              <div key={i} className="log-line" style={{ animation: `slideUp 0.15s ease ${i * 0.02}s both` }}>
                <span style={{ color: "#4b5563" }}>{l.ts}</span>
                {" "}
                <span style={{ color: levelColors[l.level], fontWeight: 600, fontSize: 10 }}>[{l.level.padEnd(5)}]</span>
                {" "}
                <span style={{ color: l.level === "ERROR" ? "#fca5a5" : l.level === "WARN" ? "#fcd34d" : "#9ca3af" }}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}