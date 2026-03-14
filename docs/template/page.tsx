import { useState, useEffect, useRef, useCallback } from "react";

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_USER = { id: "u1", email: "demo@inmobi.vn", name: "Nguyen Van A", credits: 7, storage_used: "1.2 GB", role: "user", created_at: "2025-12-01" };
const MOCK_ADMIN = { id: "a1", email: "admin@inmobi.vn", name: "Admin Master", credits: 999, storage_used: "0 GB", role: "admin", created_at: "2025-01-01" };

const MOCK_TASKS = [
    { id: "t1", filename: "ballad_love.mp3", duration: 234, status: "completed", model: "bs_roformer", credit: 1, created_at: "2025-12-10T14:30:00", completed_at: "2025-12-10T14:31:12", vocal_url: "#", instrumental_url: "#", size: "8.2 MB" },
    { id: "t2", filename: "rock_anthem.wav", duration: 412, status: "completed", model: "demucs_v4", credit: 2, created_at: "2025-12-09T10:15:00", completed_at: "2025-12-09T10:16:45", vocal_url: "#", instrumental_url: "#", size: "42.1 MB" },
    { id: "t3", filename: "edm_remix.flac", duration: 180, status: "processing", model: "bs_roformer", credit: 1, created_at: "2025-12-11T09:00:00", progress: 67, size: "15.8 MB" },
    { id: "t4", filename: "jazz_night.mp3", duration: 298, status: "pending", model: "demucs_v4", credit: 1, created_at: "2025-12-11T09:05:00", size: "6.4 MB" },
    { id: "t5", filename: "classical_piano.wav", duration: 540, status: "failed", model: "bs_roformer", credit: 2, created_at: "2025-12-08T16:20:00", error: "GPU out of memory", size: "52.3 MB" },
    { id: "t6", filename: "pop_hit_2024.mp3", duration: 195, status: "completed", model: "demucs_v4", credit: 1, created_at: "2025-12-07T11:00:00", completed_at: "2025-12-07T11:01:30", vocal_url: "#", instrumental_url: "#", size: "4.8 MB" },
];

const MOCK_TRANSACTIONS = [
    { id: "tx1", type: "initial", amount: 10, description: "Welcome bonus", date: "2025-12-01T00:00:00" },
    { id: "tx2", type: "deduct", amount: -1, description: "ballad_love.mp3", date: "2025-12-10T14:30:00", task_id: "t1" },
    { id: "tx3", type: "deduct", amount: -2, description: "rock_anthem.wav", date: "2025-12-09T10:15:00", task_id: "t2" },
    { id: "tx4", type: "refund", amount: 2, description: "Refund: classical_piano.wav (GPU error)", date: "2025-12-08T16:25:00", task_id: "t5" },
    { id: "tx5", type: "deduct", amount: -1, description: "edm_remix.flac", date: "2025-12-11T09:00:00", task_id: "t3" },
    { id: "tx6", type: "deduct", amount: -1, description: "pop_hit_2024.mp3", date: "2025-12-07T11:00:00", task_id: "t6" },
];

const MOCK_ALL_USERS = [
    { id: "u1", email: "demo@inmobi.vn", name: "Nguyen Van A", credits: 7, tasks: 6, storage: "1.2 GB", status: "active", created_at: "2025-12-01" },
    { id: "u2", email: "producer@studio.com", name: "Tran B", credits: 3, tasks: 24, storage: "4.8 GB", status: "active", created_at: "2025-11-15" },
    { id: "u3", email: "dj_mix@gmail.com", name: "Le C", credits: 0, tasks: 10, storage: "2.1 GB", status: "active", created_at: "2025-11-20" },
    { id: "u4", email: "spam@fake.com", name: "Spammer", credits: 10, tasks: 0, storage: "0 GB", status: "banned", created_at: "2025-12-10" },
    { id: "u5", email: "musician@band.vn", name: "Pham D", credits: 15, tasks: 42, storage: "8.7 GB", status: "active", created_at: "2025-10-01" },
];

const ADMIN_STATS = { total_users: 156, active_today: 23, total_tasks: 1847, completed_tasks: 1690, failed_tasks: 89, pending_tasks: 68, credits_consumed: 2340, storage_total: "187.4 GB", avg_processing_time: "42s", models: { bs_roformer: 1102, demucs_v4: 745 } };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (s) => { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`; };
const fmtDate = (d) => new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const statusColor = { completed: "#10b981", processing: "#6366f1", pending: "#f59e0b", failed: "#ef4444" };
const statusLabel = { completed: "Hoàn thành", processing: "Đang xử lý", pending: "Chờ xử lý", failed: "Thất bại" };

// ─── Icons (inline SVG) ──────────────────────────────────────────────────────
const Icon = ({ d, size = 18, color = "currentColor", ...p }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d={d} /></svg>
);
const Icons = {
    upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
    music: "M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z",
    clock: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
    download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
    user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z",
    users: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 7a4 4 0 100 8 4 4 0 000-8z",
    credit: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    chart: "M18 20V10M12 20V4M6 20v-6",
    settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
    history: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
    zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    trash: "M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2",
    check: "M20 6L9 17l-5-5",
    x: "M18 6L6 18M6 6l12 12",
    play: "M5 3l14 9-14 9V3z",
    pause: "M6 4h4v16H6zM14 4h4v16h-4z",
    menu: "M3 12h18M3 6h18M3 18h18",
    search: "M11 3a8 8 0 100 16 8 8 0 000-16zM21 21l-4.35-4.35",
    sun: "M12 3v1m0 16v1m-8-9H3m18 0h-1m-2.636-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z",
    moon: "M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z",
    wave: "M2 12c1.5-3 3-6 5-6s3.5 6 5 6 3.5-6 5-6 3.5 6 5 6",
    logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
};

// ─── Waveform Component ──────────────────────────────────────────────────────
const Waveform = ({ progress = 0, playing = false }) => {
    const bars = 48;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 1.5, height: 40 }}>
            {Array.from({ length: bars }, (_, i) => {
                const h = 8 + Math.sin(i * 0.7) * 14 + Math.cos(i * 1.3) * 8 + Math.random() * 4;
                const filled = i / bars <= progress / 100;
                return <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: filled ? "var(--accent)" : "var(--border)", transition: "background 0.2s, height 0.3s", animation: playing && filled ? `pulse 0.6s ease ${i * 0.02}s infinite alternate` : "none" }} />;
            })}
        </div>
    );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function AudioSeparationApp() {
    const [darkMode, setDarkMode] = useState(true);
    const [role, setRole] = useState("user");
    const [page, setPage] = useState("upload");
    const [user, setUser] = useState(MOCK_USER);
    const [tasks, setTasks] = useState(MOCK_TASKS);
    const [dragging, setDragging] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadModel, setUploadModel] = useState("bs_roformer");
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [playingId, setPlayingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [mobileMenu, setMobileMenu] = useState(false);
    const [toast, setToast] = useState(null);
    const fileRef = useRef();

    useEffect(() => { setUser(role === "admin" ? MOCK_ADMIN : MOCK_USER); setPage(role === "admin" ? "dashboard" : "upload"); }, [role]);
    useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

    const showToast = (msg, type = "success") => setToast({ msg, type });

    const simulateUpload = () => {
        if (!uploadFile) return;
        setUploading(true); setUploadProgress(0);
        const iv = setInterval(() => {
            setUploadProgress(p => {
                if (p >= 100) {
                    clearInterval(iv); setUploading(false); setUploadFile(null);
                    const newTask = { id: `t${Date.now()}`, filename: uploadFile.name, duration: 180 + Math.random() * 300, status: "pending", model: uploadModel, credit: 1, created_at: new Date().toISOString(), size: `${(uploadFile.size / 1024 / 1024).toFixed(1)} MB` };
                    setTasks(prev => [newTask, ...prev]); showToast("Upload thành công! Task đã được thêm vào hàng đợi.");
                    return 0;
                } return p + 3 + Math.random() * 5;
            });
        }, 100);
    };

    // ─── Theme ──────────────────────────────────────────────────────────────────
    const theme = darkMode ? {
        "--bg": "#0a0a0f", "--bg2": "#12121a", "--bg3": "#1a1a28", "--bg4": "#222236",
        "--text": "#e8e6f0", "--text2": "#9896a8", "--text3": "#5c5a6e",
        "--accent": "#8b5cf6", "--accent2": "#6d28d9", "--accent-glow": "rgba(139,92,246,0.15)",
        "--green": "#10b981", "--red": "#ef4444", "--amber": "#f59e0b", "--blue": "#3b82f6",
        "--border": "#2a2a3e", "--border2": "#3a3a52",
        "--glass": "rgba(18,18,26,0.85)", "--shadow": "0 8px 32px rgba(0,0,0,0.4)",
    } : {
        "--bg": "#f8f7fc", "--bg2": "#ffffff", "--bg3": "#f0eef8", "--bg4": "#e8e5f5",
        "--text": "#1a1630", "--text2": "#6b6585", "--text3": "#9e98b5",
        "--accent": "#7c3aed", "--accent2": "#6d28d9", "--accent-glow": "rgba(124,58,237,0.08)",
        "--green": "#059669", "--red": "#dc2626", "--amber": "#d97706", "--blue": "#2563eb",
        "--border": "#e5e2f0", "--border2": "#d4d0e5",
        "--glass": "rgba(255,255,255,0.9)", "--shadow": "0 8px 32px rgba(0,0,0,0.08)",
    };

    const css = Object.entries(theme).map(([k, v]) => `${k}:${v}`).join(";");

    // ─── Sidebar Nav ────────────────────────────────────────────────────────────
    const userNav = [
        { id: "upload", label: "Tách nhạc", icon: Icons.wave },
        { id: "history", label: "Lịch sử", icon: Icons.history },
        { id: "credits", label: "Credits", icon: Icons.credit },
        { id: "profile", label: "Tài khoản", icon: Icons.user },
    ];
    const adminNav = [
        { id: "dashboard", label: "Dashboard", icon: Icons.chart },
        { id: "users", label: "Quản lý Users", icon: Icons.users },
        { id: "tasks_admin", label: "Quản lý Tasks", icon: Icons.music },
        { id: "settings", label: "Cài đặt", icon: Icons.settings },
    ];
    const nav = role === "admin" ? adminNav : userNav;

    // ─── Styles (CSS-in-JS) ────────────────────────────────────────────────────
    const S = {
        app: { minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", display: "flex", transition: "all 0.3s", fontSize: 14 },
        sidebar: { width: 240, background: "var(--bg2)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "0", position: "relative", zIndex: 10, flexShrink: 0 },
        logo: { padding: "24px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" },
        logoText: { fontSize: 18, fontWeight: 700, background: "linear-gradient(135deg, var(--accent), #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
        navItem: (active) => ({ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", cursor: "pointer", color: active ? "var(--accent)" : "var(--text2)", background: active ? "var(--accent-glow)" : "transparent", borderRight: active ? "3px solid var(--accent)" : "3px solid transparent", transition: "all 0.2s", fontSize: 13, fontWeight: active ? 600 : 400 }),
        main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "auto" },
        header: { padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", background: "var(--bg2)", position: "sticky", top: 0, zIndex: 5, backdropFilter: "blur(12px)" },
        content: { padding: "32px", flex: 1 },
        card: { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px", marginBottom: 16 },
        statCard: { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 24px", flex: 1, minWidth: 160 },
        btn: (variant = "primary") => ({
            padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s", display: "inline-flex", alignItems: "center", gap: 8,
            ...(variant === "primary" ? { background: "var(--accent)", color: "#fff" } :
                variant === "danger" ? { background: "var(--red)", color: "#fff" } :
                    variant === "ghost" ? { background: "transparent", color: "var(--text2)", border: "1px solid var(--border)" } :
                        { background: "var(--bg3)", color: "var(--text)" }),
        }),
        badge: (color) => ({ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${color}18`, color }),
        input: { padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text)", fontSize: 13, outline: "none", width: "100%", transition: "border 0.2s" },
        dropzone: (active) => ({ border: `2px dashed ${active ? "var(--accent)" : "var(--border2)"}`, borderRadius: 20, padding: "48px 32px", textAlign: "center", cursor: "pointer", transition: "all 0.3s", background: active ? "var(--accent-glow)" : "var(--bg3)" }),
        table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
        th: { padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)", borderBottom: "1px solid var(--border)" },
        td: { padding: "14px 16px", borderBottom: "1px solid var(--border)", fontSize: 13 },
        progressBar: (pct, color = "var(--accent)") => ({ height: 4, borderRadius: 4, background: "var(--border)", position: "relative", overflow: "hidden", width: "100%", __inner: { position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(pct, 100)}%`, borderRadius: 4, background: color, transition: "width 0.5s" } }),
    };

    // ─── Upload Page ────────────────────────────────────────────────────────────
    const UploadPage = () => (
        <div>
            <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Tách nhạc AI</h2>
                <p style={{ color: "var(--text2)", fontSize: 14 }}>Upload file âm thanh để tách Vocal và Instrumental</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
                <div>
                    <div style={S.dropzone(dragging)} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); setUploadFile(e.dataTransfer.files[0]); }} onClick={() => fileRef.current?.click()}>
                        <input ref={fileRef} type="file" accept="audio/*" hidden onChange={e => setUploadFile(e.target.files[0])} />
                        {uploadFile ? (
                            <div>
                                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                                    <Icon d={Icons.music} size={24} color="var(--accent)" />
                                </div>
                                <p style={{ fontWeight: 600, fontSize: 16 }}>{uploadFile.name}</p>
                                <p style={{ color: "var(--text2)", marginTop: 4 }}>{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
                                <button style={{ ...S.btn("ghost"), marginTop: 16, fontSize: 12 }} onClick={e => { e.stopPropagation(); setUploadFile(null); }}>Chọn file khác</button>
                            </div>
                        ) : (
                            <div>
                                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--bg4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                                    <Icon d={Icons.upload} size={28} color="var(--text3)" />
                                </div>
                                <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Kéo thả file vào đây</p>
                                <p style={{ color: "var(--text3)", fontSize: 13 }}>hoặc click để chọn file</p>
                                <p style={{ color: "var(--text3)", fontSize: 12, marginTop: 12 }}>Hỗ trợ: MP3, WAV, FLAC, OGG • Tối đa 50MB • Dưới 10 phút</p>
                            </div>
                        )}
                    </div>

                    {uploading && (
                        <div style={{ ...S.card, marginTop: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>Đang upload...</span>
                                <span style={{ fontSize: 13, color: "var(--accent)" }}>{Math.min(Math.round(uploadProgress), 100)}%</span>
                            </div>
                            <div style={S.progressBar(uploadProgress)}>
                                <div style={S.progressBar(uploadProgress).__inner} />
                            </div>
                        </div>
                    )}

                    {tasks.filter(t => t.status === "processing").length > 0 && (
                        <div style={{ ...S.card, marginTop: 16 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse 1.5s infinite" }} />
                                Đang xử lý
                            </h3>
                            {tasks.filter(t => t.status === "processing").map(t => (
                                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontWeight: 500, fontSize: 13 }}>{t.filename}</p>
                                        <p style={{ color: "var(--text3)", fontSize: 12, marginTop: 2 }}>Model: {t.model === "bs_roformer" ? "BS-RoFormer (Quality)" : "Demucs v4 (Fast)"}</p>
                                    </div>
                                    <div style={{ width: 120 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                            <span style={{ fontSize: 11, color: "var(--text3)" }}>{t.progress}%</span>
                                        </div>
                                        <div style={S.progressBar(t.progress)}>
                                            <div style={S.progressBar(t.progress).__inner} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <div style={S.card}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Cài đặt</h3>
                        <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 6 }}>Model AI</label>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                            {[
                                { id: "bs_roformer", name: "BS-RoFormer", desc: "Chất lượng cao nhất", badge: "12.39 dB SDR", speed: "3.4x RT", credit: "1-2" },
                                { id: "demucs_v4", name: "Demucs v4", desc: "Nhanh nhất, 4 stems", badge: "9.08 dB SDR", speed: "24.6x RT", credit: "1-2" },
                            ].map(m => (
                                <div key={m.id} onClick={() => setUploadModel(m.id)} style={{ padding: "14px 16px", borderRadius: 12, border: `2px solid ${uploadModel === m.id ? "var(--accent)" : "var(--border)"}`, cursor: "pointer", transition: "all 0.2s", background: uploadModel === m.id ? "var(--accent-glow)" : "transparent" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</span>
                                        <span style={S.badge(uploadModel === m.id ? "var(--accent)" : "var(--text3)")}>{m.badge}</span>
                                    </div>
                                    <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>{m.desc} • {m.speed}</p>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--bg3)", marginBottom: 20 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                <span style={{ color: "var(--text2)" }}>Chi phí ước tính</span>
                                <span style={{ fontWeight: 600 }}>1 Credit</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 8 }}>
                                <span style={{ color: "var(--text2)" }}>Credits còn lại</span>
                                <span style={{ fontWeight: 600, color: user.credits > 2 ? "var(--green)" : "var(--red)" }}>{user.credits}</span>
                            </div>
                        </div>
                        <button style={{ ...S.btn("primary"), width: "100%", justifyContent: "center", padding: "12px 20px", opacity: uploadFile ? 1 : 0.5 }} onClick={simulateUpload} disabled={!uploadFile || uploading}>
                            <Icon d={Icons.zap} size={16} />
                            {uploading ? "Đang upload..." : "Bắt đầu tách nhạc"}
                        </button>
                    </div>

                    <div style={{ ...S.card, background: "linear-gradient(135deg, var(--accent2), #7c3aed)", border: "none", color: "#fff" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Credit Rules</p>
                        <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.8 }}>
                            <div>• Dưới 5 phút → 1 credit</div>
                            <div>• 5–10 phút → 2 credits</div>
                            <div>• Trên 10 phút → Không hỗ trợ</div>
                            <div>• Lỗi xử lý → Hoàn credit</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // ─── History Page ───────────────────────────────────────────────────────────
    const HistoryPage = () => (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Lịch sử xử lý</h2>
                    <p style={{ color: "var(--text2)", fontSize: 14 }}>{tasks.length} tasks</p>
                </div>
                <div style={{ position: "relative" }}>
                    <Icon d={Icons.search} size={16} color="var(--text3)" style={{ position: "absolute", left: 12, top: 11 }} />
                    <input style={{ ...S.input, paddingLeft: 36, width: 240 }} placeholder="Tìm kiếm..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
            </div>
            <div style={S.card}>
                <table style={S.table}>
                    <thead>
                        <tr>
                            <th style={S.th}>File</th>
                            <th style={S.th}>Model</th>
                            <th style={S.th}>Thời lượng</th>
                            <th style={S.th}>Trạng thái</th>
                            <th style={S.th}>Credit</th>
                            <th style={S.th}>Ngày</th>
                            <th style={S.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {tasks.filter(t => !searchQuery || t.filename.toLowerCase().includes(searchQuery.toLowerCase())).map(t => (
                            <tr key={t.id} style={{ transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                <td style={S.td}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            <Icon d={Icons.music} size={16} color="var(--accent)" />
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 500 }}>{t.filename}</p>
                                            <p style={{ color: "var(--text3)", fontSize: 11 }}>{t.size}</p>
                                        </div>
                                    </div>
                                </td>
                                <td style={S.td}><span style={{ fontSize: 12, color: "var(--text2)" }}>{t.model === "bs_roformer" ? "RoFormer" : "Demucs"}</span></td>
                                <td style={S.td}>{fmt(t.duration)}</td>
                                <td style={S.td}><span style={S.badge(statusColor[t.status])}><div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor[t.status] }} />{statusLabel[t.status]}</span></td>
                                <td style={S.td}><span style={{ fontWeight: 500 }}>{t.credit}</span></td>
                                <td style={S.td}><span style={{ fontSize: 12, color: "var(--text2)" }}>{fmtDate(t.created_at)}</span></td>
                                <td style={S.td}>
                                    {t.status === "completed" && (
                                        <div style={{ display: "flex", gap: 6 }}>
                                            <button style={{ ...S.btn("ghost"), padding: "6px 10px", fontSize: 11 }} onClick={() => setPlayingId(playingId === t.id ? null : t.id)} title="Preview">
                                                <Icon d={playingId === t.id ? Icons.pause : Icons.play} size={12} />
                                            </button>
                                            <button style={{ ...S.btn("ghost"), padding: "6px 10px", fontSize: 11 }} title="Download Vocal" onClick={() => showToast("Downloading vocal...")}><Icon d={Icons.download} size={12} /> V</button>
                                            <button style={{ ...S.btn("ghost"), padding: "6px 10px", fontSize: 11 }} title="Download Instrumental" onClick={() => showToast("Downloading instrumental...")}><Icon d={Icons.download} size={12} /> I</button>
                                        </div>
                                    )}
                                    {t.status === "failed" && <button style={{ ...S.btn("ghost"), padding: "6px 10px", fontSize: 11 }} onClick={() => showToast("Retrying task...")}>Retry</button>}
                                    {t.status === "pending" && <button style={{ ...S.btn("ghost"), padding: "6px 10px", fontSize: 11, color: "var(--red)" }} onClick={() => showToast("Task cancelled, credit refunded.", "info")}>Hủy</button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {playingId && (
                <div style={{ position: "fixed", bottom: 0, left: 240, right: 0, background: "var(--bg2)", borderTop: "1px solid var(--border)", padding: "16px 32px", display: "flex", alignItems: "center", gap: 20, zIndex: 20 }}>
                    <button style={{ ...S.btn("primary"), borderRadius: "50%", width: 40, height: 40, padding: 0, justifyContent: "center" }} onClick={() => setPlayingId(null)}><Icon d={Icons.pause} size={16} color="#fff" /></button>
                    <div style={{ flex: 1 }}><Waveform progress={45} playing /></div>
                    <span style={{ fontSize: 12, color: "var(--text2)" }}>1:23 / 3:54</span>
                    <div style={{ display: "flex", gap: 8 }}>
                        <span style={S.badge("var(--accent)")}>Vocal</span>
                        <span style={S.badge("var(--text3)")}>Instrumental</span>
                    </div>
                </div>
            )}
        </div>
    );

    // ─── Credits Page ───────────────────────────────────────────────────────────
    const CreditsPage = () => (
        <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Credits</h2>
            <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
                <div style={{ ...S.statCard, background: "linear-gradient(135deg, var(--accent2), #7c3aed)", border: "none", color: "#fff" }}>
                    <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Số dư hiện tại</p>
                    <p style={{ fontSize: 32, fontWeight: 700 }}>{user.credits}</p>
                    <p style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>credits</p>
                </div>
                <div style={S.statCard}>
                    <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>Đã sử dụng</p>
                    <p style={{ fontSize: 32, fontWeight: 700 }}>{MOCK_TRANSACTIONS.filter(t => t.type === "deduct").reduce((a, t) => a + Math.abs(t.amount), 0)}</p>
                    <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>credits</p>
                </div>
                <div style={S.statCard}>
                    <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>Đã hoàn</p>
                    <p style={{ fontSize: 32, fontWeight: 700, color: "var(--green)" }}>{MOCK_TRANSACTIONS.filter(t => t.type === "refund").reduce((a, t) => a + t.amount, 0)}</p>
                    <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>credits</p>
                </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
                <div style={S.card}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Lịch sử giao dịch</h3>
                    {MOCK_TRANSACTIONS.map(tx => (
                        <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: tx.amount > 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Icon d={tx.amount > 0 ? Icons.check : Icons.x} size={16} color={tx.amount > 0 ? "var(--green)" : "var(--red)"} />
                                </div>
                                <div>
                                    <p style={{ fontWeight: 500, fontSize: 13 }}>{tx.description}</p>
                                    <p style={{ fontSize: 11, color: "var(--text3)" }}>{fmtDate(tx.date)} • {tx.type}</p>
                                </div>
                            </div>
                            <span style={{ fontWeight: 700, color: tx.amount > 0 ? "var(--green)" : "var(--red)" }}>{tx.amount > 0 ? "+" : ""}{tx.amount}</span>
                        </div>
                    ))}
                </div>
                <div>
                    <div style={S.card}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Mua thêm Credits</h3>
                        {[{ credits: 10, price: "29.000đ", popular: false }, { credits: 50, price: "99.000đ", popular: true }, { credits: 200, price: "299.000đ", popular: false }].map(p => (
                            <div key={p.credits} style={{ padding: "14px 16px", borderRadius: 12, border: `2px solid ${p.popular ? "var(--accent)" : "var(--border)"}`, marginBottom: 10, cursor: "pointer", position: "relative", transition: "all 0.2s" }} onClick={() => showToast(`Mock: Purchased ${p.credits} credits!`)}>
                                {p.popular && <span style={{ position: "absolute", top: -10, right: 12, ...S.badge("var(--accent)"), background: "var(--accent)", color: "#fff" }}>Popular</span>}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: 18 }}>{p.credits} <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text2)" }}>credits</span></p>
                                    </div>
                                    <p style={{ fontWeight: 600, color: "var(--accent)" }}>{p.price}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={S.card}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Nhập Promo Code</h3>
                        <div style={{ display: "flex", gap: 8 }}>
                            <input style={S.input} placeholder="PROMO-CODE" />
                            <button style={S.btn("primary")} onClick={() => showToast("Invalid promo code", "error")}>Áp dụng</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // ─── Profile Page ───────────────────────────────────────────────────────────
    const ProfilePage = () => (
        <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Tài khoản</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div style={S.card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), #ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff" }}>{user.name[0]}</div>
                        <div>
                            <p style={{ fontSize: 18, fontWeight: 700 }}>{user.name}</p>
                            <p style={{ color: "var(--text2)" }}>{user.email}</p>
                        </div>
                    </div>
                    {[
                        { label: "Display Name", value: user.name },
                        { label: "Email", value: user.email },
                    ].map(f => (
                        <div key={f.label} style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 6 }}>{f.label}</label>
                            <input style={S.input} defaultValue={f.value} />
                        </div>
                    ))}
                    <button style={S.btn("primary")} onClick={() => showToast("Profile updated!")}>Lưu thay đổi</button>
                </div>
                <div>
                    <div style={S.card}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Thông tin tài khoản</h3>
                        {[
                            { label: "Credits", value: user.credits, color: "var(--accent)" },
                            { label: "Dung lượng đã dùng", value: user.storage_used },
                            { label: "Ngày tạo", value: user.created_at },
                            { label: "Vai trò", value: user.role },
                        ].map(i => (
                            <div key={i.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                                <span style={{ color: "var(--text2)", fontSize: 13 }}>{i.label}</span>
                                <span style={{ fontWeight: 600, fontSize: 13, color: i.color }}>{i.value}</span>
                            </div>
                        ))}
                    </div>
                    <div style={S.card}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Đổi mật khẩu</h3>
                        <div style={{ marginBottom: 12 }}><input style={S.input} type="password" placeholder="Mật khẩu hiện tại" /></div>
                        <div style={{ marginBottom: 12 }}><input style={S.input} type="password" placeholder="Mật khẩu mới" /></div>
                        <button style={S.btn("ghost")} onClick={() => showToast("Password changed!")}>Đổi mật khẩu</button>
                    </div>
                    <div style={{ ...S.card, borderColor: "var(--red)" }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--red)" }}>Danger Zone</h3>
                        <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 12 }}>Xóa tài khoản sẽ xóa toàn bộ dữ liệu. Hành động không thể hoàn tác.</p>
                        <button style={S.btn("danger")} onClick={() => showToast("Mock: Account deleted", "error")}><Icon d={Icons.trash} size={14} /> Xóa tài khoản</button>
                    </div>
                </div>
            </div>
        </div>
    );

    // ─── Admin Dashboard ────────────────────────────────────────────────────────
    const AdminDashboard = () => (
        <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Admin Dashboard</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                {[
                    { label: "Total Users", value: ADMIN_STATS.total_users, icon: Icons.users, color: "var(--accent)" },
                    { label: "Active Today", value: ADMIN_STATS.active_today, icon: Icons.zap, color: "var(--green)" },
                    { label: "Total Tasks", value: ADMIN_STATS.total_tasks, icon: Icons.music, color: "var(--blue)" },
                    { label: "Credits Consumed", value: ADMIN_STATS.credits_consumed, icon: Icons.credit, color: "var(--amber)" },
                ].map(s => (
                    <div key={s.label} style={S.statCard}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: "var(--text3)" }}>{s.label}</span>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${s.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={s.icon} size={16} color={s.color} /></div>
                        </div>
                        <p style={{ fontSize: 28, fontWeight: 700 }}>{s.value.toLocaleString()}</p>
                    </div>
                ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <div style={S.card}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Task Status Overview</h3>
                    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                        {[
                            { label: "Completed", value: ADMIN_STATS.completed_tasks, color: "var(--green)", pct: 91.5 },
                            { label: "Failed", value: ADMIN_STATS.failed_tasks, color: "var(--red)", pct: 4.8 },
                            { label: "Pending", value: ADMIN_STATS.pending_tasks, color: "var(--amber)", pct: 3.7 },
                        ].map(s => (
                            <div key={s.label} style={{ flex: 1, textAlign: "center" }}>
                                <p style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</p>
                                <p style={{ fontSize: 11, color: "var(--text3)" }}>{s.label} ({s.pct}%)</p>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: "flex", height: 8, borderRadius: 8, overflow: "hidden" }}>
                        <div style={{ width: "91.5%", background: "var(--green)" }} />
                        <div style={{ width: "4.8%", background: "var(--red)" }} />
                        <div style={{ width: "3.7%", background: "var(--amber)" }} />
                    </div>
                </div>
                <div style={S.card}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Model Usage</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                        <div style={{ width: 100, height: 100, borderRadius: "50%", background: `conic-gradient(var(--accent) 0% ${(ADMIN_STATS.models.bs_roformer / ADMIN_STATS.total_tasks * 100).toFixed(0)}%, var(--blue) ${(ADMIN_STATS.models.bs_roformer / ADMIN_STATS.total_tasks * 100).toFixed(0)}% 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--bg2)" }} />
                        </div>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <div style={{ width: 12, height: 12, borderRadius: 3, background: "var(--accent)" }} />
                                <span style={{ fontSize: 13 }}>BS-RoFormer: {ADMIN_STATS.models.bs_roformer} ({(ADMIN_STATS.models.bs_roformer / ADMIN_STATS.total_tasks * 100).toFixed(1)}%)</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 12, height: 12, borderRadius: 3, background: "var(--blue)" }} />
                                <span style={{ fontSize: 13 }}>Demucs v4: {ADMIN_STATS.models.demucs_v4} ({(ADMIN_STATS.models.demucs_v4 / ADMIN_STATS.total_tasks * 100).toFixed(1)}%)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div style={S.card}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>System Health</h3>
                <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 16 }}>Avg processing time: {ADMIN_STATS.avg_processing_time} • Storage: {ADMIN_STATS.storage_total}</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                    {[
                        { label: "API Server", status: "healthy", uptime: "99.9%" },
                        { label: "Worker", status: "healthy", uptime: "99.7%" },
                        { label: "Model Serving", status: "healthy", uptime: "98.5%" },
                        { label: "Redis", status: "healthy", uptime: "99.99%" },
                    ].map(s => (
                        <div key={s.label} style={{ padding: "12px 16px", borderRadius: 10, background: "var(--bg3)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)" }} />
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</span>
                            </div>
                            <span style={{ fontSize: 11, color: "var(--text3)" }}>Uptime: {s.uptime}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    // ─── Admin Users Page ───────────────────────────────────────────────────────
    const AdminUsersPage = () => (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h2 style={{ fontSize: 24, fontWeight: 700 }}>Quản lý Users</h2>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ position: "relative" }}>
                        <Icon d={Icons.search} size={16} color="var(--text3)" style={{ position: "absolute", left: 12, top: 11 }} />
                        <input style={{ ...S.input, paddingLeft: 36, width: 240 }} placeholder="Tìm user..." />
                    </div>
                </div>
            </div>
            <div style={S.card}>
                <table style={S.table}>
                    <thead>
                        <tr>
                            <th style={S.th}>User</th>
                            <th style={S.th}>Credits</th>
                            <th style={S.th}>Tasks</th>
                            <th style={S.th}>Storage</th>
                            <th style={S.th}>Status</th>
                            <th style={S.th}>Ngày tạo</th>
                            <th style={S.th}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {MOCK_ALL_USERS.map(u => (
                            <tr key={u.id} onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                <td style={S.td}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{u.name[0]}</div>
                                        <div>
                                            <p style={{ fontWeight: 500, fontSize: 13 }}>{u.name}</p>
                                            <p style={{ fontSize: 11, color: "var(--text3)" }}>{u.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td style={S.td}><span style={{ fontWeight: 600 }}>{u.credits}</span></td>
                                <td style={S.td}>{u.tasks}</td>
                                <td style={S.td}>{u.storage}</td>
                                <td style={S.td}><span style={S.badge(u.status === "active" ? "var(--green)" : "var(--red)")}>{u.status}</span></td>
                                <td style={S.td}><span style={{ fontSize: 12, color: "var(--text2)" }}>{u.created_at}</span></td>
                                <td style={S.td}>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <button style={{ ...S.btn("ghost"), padding: "6px 10px", fontSize: 11 }} onClick={() => showToast(`Credits adjusted for ${u.name}`)}><Icon d={Icons.credit} size={12} /> Credits</button>
                                        <button style={{ ...S.btn("ghost"), padding: "6px 10px", fontSize: 11, color: u.status === "active" ? "var(--red)" : "var(--green)" }} onClick={() => showToast(`${u.status === "active" ? "Banned" : "Unbanned"} ${u.name}`)}>{u.status === "active" ? "Ban" : "Unban"}</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // ─── Admin Tasks Page ───────────────────────────────────────────────────────
    const AdminTasksPage = () => (
        <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Quản lý Tasks</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {["all", "pending", "processing", "completed", "failed"].map(f => (
                    <button key={f} style={{ ...S.btn("ghost"), fontSize: 12, padding: "6px 14px", textTransform: "capitalize" }}>{f === "all" ? "Tất cả" : statusLabel[f] || f}</button>
                ))}
            </div>
            <div style={S.card}>
                <table style={S.table}>
                    <thead>
                        <tr>
                            <th style={S.th}>Task ID</th>
                            <th style={S.th}>File</th>
                            <th style={S.th}>User</th>
                            <th style={S.th}>Model</th>
                            <th style={S.th}>Status</th>
                            <th style={S.th}>Credit</th>
                            <th style={S.th}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tasks.map(t => (
                            <tr key={t.id} onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                <td style={S.td}><code style={{ fontSize: 11, color: "var(--text3)" }}>{t.id}</code></td>
                                <td style={S.td}><span style={{ fontWeight: 500, fontSize: 13 }}>{t.filename}</span></td>
                                <td style={S.td}><span style={{ fontSize: 12 }}>demo@inmobi.vn</span></td>
                                <td style={S.td}><span style={{ fontSize: 12 }}>{t.model === "bs_roformer" ? "RoFormer" : "Demucs"}</span></td>
                                <td style={S.td}><span style={S.badge(statusColor[t.status])}>{statusLabel[t.status]}</span></td>
                                <td style={S.td}>{t.credit}</td>
                                <td style={S.td}>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        {t.status === "failed" && <button style={{ ...S.btn("ghost"), padding: "6px 10px", fontSize: 11 }} onClick={() => showToast("Task retried + credit refunded")}>Retry & Refund</button>}
                                        {t.status === "pending" && <button style={{ ...S.btn("ghost"), padding: "6px 10px", fontSize: 11, color: "var(--red)" }} onClick={() => showToast("Task cancelled")}>Cancel</button>}
                                        <button style={{ ...S.btn("ghost"), padding: "6px 10px", fontSize: 11 }} onClick={() => showToast("Viewing task details...")}>Detail</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // ─── Admin Settings ─────────────────────────────────────────────────────────
    const AdminSettings = () => (
        <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Cài đặt hệ thống</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div style={S.card}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Credit Configuration</h3>
                    {[
                        { label: "Credits cho user mới", value: "10" },
                        { label: "Credit < 5 phút", value: "1" },
                        { label: "Credit 5-10 phút", value: "2" },
                        { label: "Max file duration (phút)", value: "10" },
                        { label: "Max file size (MB)", value: "50" },
                    ].map(f => (
                        <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <label style={{ fontSize: 13, color: "var(--text2)" }}>{f.label}</label>
                            <input style={{ ...S.input, width: 80, textAlign: "center" }} defaultValue={f.value} />
                        </div>
                    ))}
                    <button style={{ ...S.btn("primary"), marginTop: 8 }} onClick={() => showToast("Settings saved!")}>Lưu thay đổi</button>
                </div>
                <div style={S.card}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Rate Limiting</h3>
                    {[
                        { label: "/separate (req/min)", value: "5" },
                        { label: "/auth/login (req/min)", value: "10" },
                        { label: "/auth/register (req/hour)", value: "3" },
                        { label: "General API (req/min)", value: "100" },
                    ].map(f => (
                        <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <label style={{ fontSize: 13, color: "var(--text2)" }}>{f.label}</label>
                            <input style={{ ...S.input, width: 80, textAlign: "center" }} defaultValue={f.value} />
                        </div>
                    ))}
                    <button style={{ ...S.btn("primary"), marginTop: 8 }} onClick={() => showToast("Rate limits updated!")}>Lưu thay đổi</button>
                </div>
                <div style={S.card}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Model Serving</h3>
                    {[
                        { label: "Default Model", value: "bs_roformer", type: "select" },
                        { label: "Worker Concurrency", value: "2" },
                        { label: "Task Timeout (seconds)", value: "600" },
                        { label: "GPU Memory Limit (GB)", value: "8" },
                    ].map(f => (
                        <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <label style={{ fontSize: 13, color: "var(--text2)" }}>{f.label}</label>
                            <input style={{ ...S.input, width: 120, textAlign: "center" }} defaultValue={f.value} />
                        </div>
                    ))}
                    <button style={{ ...S.btn("primary"), marginTop: 8 }} onClick={() => showToast("Model config saved!")}>Lưu thay đổi</button>
                </div>
                <div style={S.card}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Storage</h3>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ fontSize: 13, color: "var(--text2)" }}>Đã sử dụng</span>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{ADMIN_STATS.storage_total} / 500 GB</span>
                        </div>
                        <div style={S.progressBar(37.5, "var(--accent)")}>
                            <div style={S.progressBar(37.5, "var(--accent)").__inner} />
                        </div>
                    </div>
                    <button style={S.btn("ghost")} onClick={() => showToast("Cleanup completed: freed 12.4 GB")}><Icon d={Icons.trash} size={14} /> Cleanup old files</button>
                </div>
            </div>
        </div>
    );

    // ─── Render Page ────────────────────────────────────────────────────────────
    const pages = { upload: UploadPage, history: HistoryPage, credits: CreditsPage, profile: ProfilePage, dashboard: AdminDashboard, users: AdminUsersPage, tasks_admin: AdminTasksPage, settings: AdminSettings };
    const CurrentPage = pages[page] || UploadPage;

    return (
        <div style={{ ...{ style: css }, ...S.app }}>
            <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root { ${css} }
        body { background: var(--bg); }
        @keyframes pulse { 0% { opacity: 1; } 100% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        input:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px var(--accent-glow); }
        button:hover { filter: brightness(1.1); }
        button:active { transform: scale(0.97); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg); }
        ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
      `}</style>

            {/* Sidebar */}
            <div style={S.sidebar}>
                <div style={S.logo}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, var(--accent), #ec4899)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon d={Icons.wave} size={18} color="#fff" />
                    </div>
                    <span style={S.logoText}>SplitAudio</span>
                </div>

                {/* Role Switcher */}
                <div style={{ padding: "16px 16px 8px" }}>
                    <div style={{ display: "flex", borderRadius: 10, background: "var(--bg3)", padding: 3 }}>
                        {["user", "admin"].map(r => (
                            <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s", background: role === r ? "var(--accent)" : "transparent", color: role === r ? "#fff" : "var(--text3)" }}>{r === "user" ? "User" : "Admin"}</button>
                        ))}
                    </div>
                </div>

                <nav style={{ padding: "8px 0", flex: 1 }}>
                    {nav.map(n => (
                        <div key={n.id} onClick={() => setPage(n.id)} style={S.navItem(page === n.id)}>
                            <Icon d={n.icon} size={18} />
                            <span>{n.label}</span>
                        </div>
                    ))}
                </nav>

                <div style={{ padding: "16px", borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{user.name[0]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</p>
                            <p style={{ fontSize: 10, color: "var(--text3)" }}>{user.credits} credits</p>
                        </div>
                        <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 4 }} onClick={() => showToast("Logged out")} title="Logout"><Icon d={Icons.logout} size={16} /></button>
                    </div>
                </div>
            </div>

            {/* Main */}
            <div style={S.main}>
                <div style={S.header}>
                    <div>
                        <h1 style={{ fontSize: 16, fontWeight: 600 }}>{nav.find(n => n.id === page)?.label || "Page"}</h1>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {role === "user" && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: "var(--accent-glow)" }}>
                                <Icon d={Icons.credit} size={14} color="var(--accent)" />
                                <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: 13 }}>{user.credits}</span>
                                <span style={{ color: "var(--text3)", fontSize: 12 }}>credits</span>
                            </div>
                        )}
                        <button onClick={() => setDarkMode(!darkMode)} style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                            <Icon d={darkMode ? Icons.sun : Icons.moon} size={16} color="var(--text2)" />
                        </button>
                    </div>
                </div>

                <div style={S.content}>
                    <div style={{ animation: "fadeIn 0.4s ease" }}>
                        <CurrentPage />
                    </div>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div style={{ position: "fixed", bottom: 24, right: 24, padding: "14px 24px", borderRadius: 12, background: toast.type === "error" ? "var(--red)" : toast.type === "info" ? "var(--blue)" : "var(--green)", color: "#fff", fontSize: 13, fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", zIndex: 100, animation: "toastIn 0.3s ease", maxWidth: 360, display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon d={toast.type === "error" ? Icons.x : Icons.check} size={16} color="#fff" />
                    {toast.msg}
                </div>
            )}
        </div>
    );
}