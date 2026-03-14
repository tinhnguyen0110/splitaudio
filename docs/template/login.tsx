import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// SplitAudio — Landing + Auth Page
// Aesthetic: Cinematic dark, audio-waveform motifs, editorial typography
// ═══════════════════════════════════════════════════════════════════════════════

const PLANS = [
    { id: "free", name: "Starter", price: "0", period: "forever", credits: 10, badge: null, features: ["10 credits miễn phí", "BS-RoFormer & Demucs v4", "Vocal + Instrumental", "File tối đa 50MB", "Hỗ trợ MP3, WAV, FLAC", "Kết quả WAV 44.1kHz"], cta: "Bắt đầu miễn phí", popular: false },
    { id: "pro", name: "Producer", price: "199k", period: "/tháng", credits: 100, badge: "Popular", features: ["100 credits/tháng", "Ưu tiên hàng đợi", "Tất cả tính năng Starter", "API access", "Batch upload (5 files)", "Webhook notifications", "Lưu trữ 30 ngày"], cta: "Dùng thử 7 ngày", popular: true },
    { id: "studio", name: "Studio", price: "499k", period: "/tháng", credits: 500, badge: "Best value", features: ["500 credits/tháng", "Priority GPU queue", "Tất cả tính năng Producer", "4-stem separation (Demucs)", "Custom model fine-tuning", "Dedicated support", "Lưu trữ không giới hạn", "Team sharing (5 seats)"], cta: "Liên hệ sales", popular: false },
];

const TESTIMONIALS = [
    { name: "Minh Tú", role: "Music Producer, Saigon Beats", text: "Chất lượng vocal separation tốt hơn hẳn LALAL.ai. BS-RoFormer tách sạch đến kinh ngạc.", avatar: "MT" },
    { name: "David Chen", role: "DJ & Remixer", text: "Demucs fast mode xử lý trong vài giây, perfect cho live remixing. API integration cũng rất smooth.", avatar: "DC" },
    { name: "Hà Linh", role: "Vocal Coach", text: "Dùng để tách instrumental cho học viên luyện hát. Credit system rất fair, lỗi là hoàn credit ngay.", avatar: "HL" },
];

const STATS = [
    { value: "12.39", unit: "dB SDR", label: "Vocal separation quality" },
    { value: "24.6x", unit: "realtime", label: "Fastest processing" },
    { value: "99.7%", unit: "uptime", label: "Service reliability" },
    { value: "50k+", unit: "tracks", label: "Processed monthly" },
];

// ─── Animated Waveform Background ─────────────────────────────────────────────
function WaveformBg() {
    const canvasRef = useRef(null);
    useEffect(() => {
        const c = canvasRef.current; if (!c) return;
        const ctx = c.getContext("2d");
        let raf;
        const resize = () => { c.width = c.offsetWidth * 2; c.height = c.offsetHeight * 2; ctx.scale(2, 2); };
        resize(); window.addEventListener("resize", resize);
        let t = 0;
        const draw = () => {
            const w = c.offsetWidth, h = c.offsetHeight;
            ctx.clearRect(0, 0, w, h);
            for (let wave = 0; wave < 3; wave++) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(99, 102, 241, ${0.06 - wave * 0.015})`;
                ctx.lineWidth = 1.5;
                for (let x = 0; x <= w; x += 3) {
                    const y = h / 2 + Math.sin(x * 0.008 + t + wave * 1.2) * (40 + wave * 20) * Math.sin(x * 0.002 + t * 0.3);
                    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            t += 0.012;
            raf = requestAnimationFrame(draw);
        };
        draw();
        return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
    }, []);
    return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

// ─── Floating Particles ───────────────────────────────────────────────────────
function Particles() {
    return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            {Array.from({ length: 20 }, (_, i) => (
                <div key={i} style={{
                    position: "absolute",
                    width: 2 + Math.random() * 3,
                    height: 2 + Math.random() * 3,
                    borderRadius: "50%",
                    background: `rgba(139, 92, 246, ${0.15 + Math.random() * 0.2})`,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animation: `float ${8 + Math.random() * 12}s ease-in-out ${Math.random() * 5}s infinite alternate`,
                }} />
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function LandingPage() {
    const [authMode, setAuthMode] = useState(null); // null | 'login' | 'register'
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeSection, setActiveSection] = useState("hero");
    const [scrollY, setScrollY] = useState(0);
    const [mobileMenu, setMobileMenu] = useState(false);
    const [billingCycle, setBillingCycle] = useState("monthly");

    useEffect(() => {
        const onScroll = () => setScrollY(window.scrollY);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => { setLoading(false); alert(authMode === "login" ? "Mock: Đăng nhập thành công!" : "Mock: Đăng ký thành công! Bạn nhận 10 credits miễn phí."); setAuthMode(null); }, 1500);
    };

    const scrollTo = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); setMobileMenu(false); };

    return (
        <div style={{ background: "#050508", color: "#e2e0ec", fontFamily: "'Outfit', 'General Sans', system-ui, sans-serif", overflowX: "hidden" }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(139, 92, 246, 0.3); }
        @keyframes float { 0% { transform: translateY(0) translateX(0); } 100% { transform: translateY(-30px) translateX(15px); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes pulse2 { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes waveBar { 0%, 100% { height: 12px; } 50% { height: 28px; } }
        .nav-link { color: #8a879a; text-decoration: none; font-size: 13px; font-weight: 500; transition: color 0.2s; cursor: pointer; }
        .nav-link:hover { color: #c4b5fd; }
        .glow-btn { position: relative; overflow: hidden; }
        .glow-btn::before { content: ''; position: absolute; inset: -2px; background: linear-gradient(135deg, #7c3aed, #6366f1, #8b5cf6); border-radius: inherit; z-index: -1; opacity: 0; transition: opacity 0.3s; }
        .glow-btn:hover::before { opacity: 1; }
        .feature-card { background: rgba(14, 14, 22, 0.6); border: 1px solid #18182a; border-radius: 16px; padding: 32px 28px; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); backdrop-filter: blur(8px); }
        .feature-card:hover { border-color: #2e2456; transform: translateY(-4px); box-shadow: 0 20px 60px rgba(99, 102, 241, 0.08); }
        .pricing-card { background: #0a0a12; border: 1px solid #18182a; border-radius: 20px; padding: 36px 32px; transition: all 0.4s; position: relative; overflow: hidden; }
        .pricing-card.popular { border-color: #4c1d95; background: linear-gradient(180deg, #0f0a1a 0%, #0a0a12 100%); }
        .pricing-card:hover { transform: translateY(-6px); box-shadow: 0 24px 80px rgba(99, 102, 241, 0.1); }
        .auth-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgba(5, 5, 8, 0.85); backdrop-filter: blur(20px); animation: fadeIn 0.3s ease; }
        .auth-card { background: #0c0c14; border: 1px solid #1e1e32; border-radius: 24px; padding: 40px; width: 420px; max-width: 90vw; animation: scaleIn 0.35s cubic-bezier(0.16, 1, 0.3, 1); position: relative; }
        .input-field { width: 100%; padding: 14px 16px; border-radius: 12px; border: 1px solid #1e1e32; background: #08080e; color: #e2e0ec; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
        .input-field:focus { border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1); }
        .input-field::placeholder { color: #3a384a; }
        .step-num { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; flex-shrink: 0; }
        .testimonial-card { background: #0a0a12; border: 1px solid #18182a; border-radius: 16px; padding: 28px; transition: all 0.3s; }
        .testimonial-card:hover { border-color: #2e2456; }
      `}</style>

            {/* ─── Navbar ────────────────────────────────────────────────────────── */}
            <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "0 40px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", background: scrollY > 50 ? "rgba(5, 5, 8, 0.9)" : "transparent", backdropFilter: scrollY > 50 ? "blur(16px)" : "none", borderBottom: scrollY > 50 ? "1px solid #12121e" : "1px solid transparent", transition: "all 0.3s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Animated waveform logo */}
                    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 28 }}>
                        {[0, 1, 2, 3, 4].map(i => (
                            <div key={i} style={{ width: 3, borderRadius: 2, background: "linear-gradient(180deg, #8b5cf6, #6366f1)", animation: `waveBar 1.2s ease ${i * 0.15}s infinite` }} />
                        ))}
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>
                        <span style={{ color: "#e2e0ec" }}>Split</span><span style={{ color: "#8b5cf6" }}>Audio</span>
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
                    {["features", "how-it-works", "pricing"].map(s => (
                        <span key={s} className="nav-link" onClick={() => scrollTo(s)}>{s === "how-it-works" ? "Cách hoạt động" : s === "features" ? "Tính năng" : "Bảng giá"}</span>
                    ))}
                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => setAuthMode("login")} style={{ padding: "8px 20px", borderRadius: 10, border: "1px solid #2a2840", background: "transparent", color: "#c4b5fd", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all 0.2s" }}>Đăng nhập</button>
                        <button onClick={() => setAuthMode("register")} className="glow-btn" style={{ padding: "8px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #7c3aed, #6366f1)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all 0.2s", position: "relative", zIndex: 1 }}>Đăng ký miễn phí</button>
                    </div>
                </div>
            </nav>

            {/* ─── Hero ──────────────────────────────────────────────────────────── */}
            <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 40px 80px", overflow: "hidden" }}>
                <WaveformBg />
                <Particles />
                {/* Gradient orbs */}
                <div style={{ position: "absolute", top: "10%", left: "15%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", bottom: "10%", right: "10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

                <div style={{ textAlign: "center", maxWidth: 900, position: "relative", zIndex: 1 }}>
                    <div style={{ animation: "fadeUp 0.8s ease 0.1s both" }}>
                        <span style={{ display: "inline-block", padding: "6px 16px", borderRadius: 20, background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.2)", fontSize: 12, fontWeight: 600, color: "#a78bfa", marginBottom: 28, letterSpacing: 0.5 }}>
                            ⚡ Powered by BS-RoFormer & Demucs v4
                        </span>
                    </div>

                    <h1 style={{ fontSize: "clamp(42px, 7vw, 80px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: -2, marginBottom: 24, animation: "fadeUp 0.8s ease 0.2s both" }}>
                        <span style={{ color: "#e2e0ec" }}>Tách nhạc bằng </span>
                        <br />
                        <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, background: "linear-gradient(135deg, #a78bfa, #818cf8, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundSize: "200% 200%", animation: "gradientShift 4s ease infinite" }}>trí tuệ nhân tạo</span>
                    </h1>

                    <p style={{ fontSize: 18, lineHeight: 1.7, color: "#6b6580", maxWidth: 600, margin: "0 auto 40px", fontWeight: 400, animation: "fadeUp 0.8s ease 0.35s both" }}>
                        Upload bài hát — nhận lại Vocal và Instrumental chất lượng studio trong vài giây. Không cần cài đặt, không cần GPU.
                    </p>

                    <div style={{ display: "flex", gap: 14, justifyContent: "center", animation: "fadeUp 0.8s ease 0.5s both" }}>
                        <button onClick={() => setAuthMode("register")} style={{ padding: "16px 36px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #7c3aed, #6366f1)", color: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 700, fontFamily: "inherit", transition: "all 0.25s", boxShadow: "0 8px 40px rgba(99, 102, 241, 0.3)" }}>
                            Bắt đầu miễn phí →
                        </button>
                        <button onClick={() => scrollTo("how-it-works")} style={{ padding: "16px 32px", borderRadius: 14, border: "1px solid #2a2840", background: "rgba(14, 14, 22, 0.6)", color: "#a09cb2", cursor: "pointer", fontSize: 16, fontWeight: 500, fontFamily: "inherit", backdropFilter: "blur(8px)" }}>
                            Xem demo
                        </button>
                    </div>

                    {/* Stats bar */}
                    <div style={{ display: "flex", justifyContent: "center", gap: 48, marginTop: 72, animation: "fadeUp 0.8s ease 0.65s both" }}>
                        {STATS.map((s, i) => (
                            <div key={i} style={{ textAlign: "center" }}>
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700, color: "#c4b5fd" }}>{s.value}<span style={{ fontSize: 14, fontWeight: 400, color: "#6b6580", marginLeft: 4 }}>{s.unit}</span></div>
                                <div style={{ fontSize: 12, color: "#4a4660", marginTop: 4 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Features ──────────────────────────────────────────────────────── */}
            <section id="features" style={{ padding: "120px 40px", maxWidth: 1200, margin: "0 auto" }}>
                <div style={{ textAlign: "center", marginBottom: 64 }}>
                    <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1, marginBottom: 16 }}>
                        Tại sao chọn <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: "#a78bfa" }}>SplitAudio</span>?
                    </h2>
                    <p style={{ color: "#6b6580", fontSize: 16, maxWidth: 500, margin: "0 auto" }}>Công nghệ tách nhạc mới nhất từ nghiên cứu AI, đóng gói thành dịch vụ đơn giản</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                    {[
                        { icon: "", title: "SOTA Quality", desc: "BS-RoFormer đạt 12.39 dB SDR — vượt trội Spleeter, LALAL.ai và hầu hết dịch vụ thương mại", tag: "SDX23 Winner" },
                        { icon: "⚡", title: "Siêu nhanh", desc: "Demucs v4 xử lý nhanh gấp 24.6x realtime. Bài 3 phút xong trong ~7 giây trên GPU", tag: "24.6x RT" },
                        { icon: "", title: "Multi-stem", desc: "Tách 2 stems (vocal/instrumental) hoặc 4 stems (vocal, drums, bass, other) tùy model", tag: "2 & 4 stems" },
                        { icon: "", title: "Credit công bằng", desc: "Lỗi xử lý = hoàn credit tự động. Mọi giao dịch được log minh bạch trong credit history", tag: "Auto refund" },
                        { icon: "", title: "REST API", desc: "Tích hợp vào workflow của bạn qua API. Upload, check status, download — tất cả qua HTTP", tag: "Developer friendly" },
                        { icon: "", title: "Self-host ready", desc: "Toàn bộ hệ thống đóng gói Docker Compose. Deploy lên server riêng trong 5 phút", tag: "Open architecture" },
                    ].map((f, i) => (
                        <div key={i} className="feature-card" style={{ animation: `fadeUp 0.6s ease ${0.1 + i * 0.08}s both` }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                                <span style={{ fontSize: 32 }}>{f.icon}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "rgba(139, 92, 246, 0.1)", color: "#a78bfa", fontFamily: "'JetBrains Mono', monospace" }}>{f.tag}</span>
                            </div>
                            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: "#e2e0ec" }}>{f.title}</h3>
                            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#6b6580" }}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ─── How It Works ──────────────────────────────────────────────────── */}
            <section id="how-it-works" style={{ padding: "120px 40px", background: "linear-gradient(180deg, #050508 0%, #08070e 50%, #050508 100%)" }}>
                <div style={{ maxWidth: 900, margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: 64 }}>
                        <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1, marginBottom: 16 }}>
                            3 bước <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: "#a78bfa" }}>đơn giản</span>
                        </h2>
                        <p style={{ color: "#6b6580", fontSize: 16 }}>Không cần cài đặt phần mềm, không cần kiến thức kỹ thuật</p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                        {[
                            { num: "01", title: "Upload file âm thanh", desc: "Kéo thả file MP3, WAV, FLAC hoặc OGG. Hệ thống tự detect thời lượng và tính credit.", color: "#6366f1", bg: "rgba(99, 102, 241, 0.08)" },
                            { num: "02", title: "Chọn model AI", desc: "BS-RoFormer cho chất lượng cao nhất, hoặc Demucs v4 cho tốc độ nhanh nhất. Hệ thống xử lý hoàn toàn trên GPU cloud.", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.08)" },
                            { num: "03", title: "Download kết quả", desc: "Nhận file Vocal và Instrumental chất lượng WAV 44.1kHz. Preview ngay trên trình duyệt trước khi tải.", color: "#a78bfa", bg: "rgba(167, 139, 250, 0.08)" },
                        ].map((s, i) => (
                            <div key={i} style={{ display: "flex", gap: 24, alignItems: "flex-start", padding: "32px 36px", borderRadius: 20, background: "rgba(14, 14, 22, 0.4)", border: "1px solid #14142a", transition: "all 0.3s", animation: `fadeUp 0.6s ease ${0.1 + i * 0.12}s both` }}>
                                <div className="step-num" style={{ background: s.bg, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.num}</div>
                                <div>
                                    <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#e2e0ec" }}>{s.title}</h3>
                                    <p style={{ fontSize: 15, lineHeight: 1.7, color: "#6b6580" }}>{s.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Pricing ───────────────────────────────────────────────────────── */}
            <section id="pricing" style={{ padding: "120px 40px", maxWidth: 1200, margin: "0 auto" }}>
                <div style={{ textAlign: "center", marginBottom: 48 }}>
                    <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1, marginBottom: 16 }}>
                        Bảng <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: "#a78bfa" }}>giá</span>
                    </h2>
                    <p style={{ color: "#6b6580", fontSize: 16, marginBottom: 24 }}>Bắt đầu miễn phí. Nâng cấp khi cần.</p>
                    {/* Billing toggle */}
                    <div style={{ display: "inline-flex", padding: 4, borderRadius: 12, background: "#0e0e16", border: "1px solid #1e1e32" }}>
                        {["monthly", "yearly"].map(b => (
                            <button key={b} onClick={() => setBillingCycle(b)} style={{ padding: "8px 20px", borderRadius: 9, border: "none", background: billingCycle === b ? "#1e1b4b" : "transparent", color: billingCycle === b ? "#c4b5fd" : "#6b6580", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all 0.2s" }}>
                                {b === "monthly" ? "Tháng" : "Năm"}{b === "yearly" && <span style={{ marginLeft: 6, fontSize: 10, color: "#10b981", fontWeight: 700 }}>-20%</span>}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, alignItems: "start" }}>
                    {PLANS.map((p, i) => (
                        <div key={p.id} className={`pricing-card ${p.popular ? "popular" : ""}`} style={{ animation: `fadeUp 0.6s ease ${0.1 + i * 0.1}s both` }}>
                            {p.badge && (
                                <div style={{ position: "absolute", top: -1, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #7c3aed, #6366f1, #8b5cf6)", borderRadius: "20px 20px 0 0" }} />
                            )}
                            {p.badge && (
                                <span style={{ display: "inline-block", marginBottom: 16, padding: "4px 12px", borderRadius: 6, background: "rgba(139, 92, 246, 0.15)", color: "#a78bfa", fontSize: 11, fontWeight: 700 }}>{p.badge}</span>
                            )}
                            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#e2e0ec" }}>{p.name}</h3>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                                <span style={{ fontSize: 42, fontWeight: 800, color: "#e2e0ec", fontFamily: "'JetBrains Mono', monospace" }}>{billingCycle === "yearly" && p.price !== "0" ? Math.round(parseInt(p.price) * 0.8) + "k" : p.price === "0" ? "Miễn phí" : p.price}</span>
                                {p.price !== "0" && <span style={{ fontSize: 14, color: "#6b6580" }}>VNĐ{p.period}</span>}
                            </div>
                            <p style={{ fontSize: 13, color: "#8b5cf6", fontWeight: 600, marginBottom: 24 }}>{p.credits} credits{p.price !== "0" ? "/tháng" : ""}</p>

                            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
                                {p.features.map((f, fi) => (
                                    <div key={fi} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#8a879a" }}>
                                        <span style={{ color: "#8b5cf6", flexShrink: 0, marginTop: 2, fontSize: 12 }}>✓</span>
                                        {f}
                                    </div>
                                ))}
                            </div>

                            <button onClick={() => setAuthMode("register")} style={{
                                width: "100%", padding: "14px", borderRadius: 12, border: p.popular ? "none" : "1px solid #2a2840", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit", transition: "all 0.25s",
                                background: p.popular ? "linear-gradient(135deg, #7c3aed, #6366f1)" : "transparent",
                                color: p.popular ? "#fff" : "#a09cb2",
                                boxShadow: p.popular ? "0 8px 32px rgba(99, 102, 241, 0.25)" : "none",
                            }}>
                                {p.cta}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Credit explanation */}
                <div style={{ marginTop: 48, padding: "28px 36px", borderRadius: 16, background: "rgba(14, 14, 22, 0.5)", border: "1px solid #18182a", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
                    {[
                        { label: "File < 5 phút", cost: "1 credit", icon: "" },
                        { label: "File 5–10 phút", cost: "2 credits", icon: "" },
                        { label: "File > 10 phút", cost: "Không hỗ trợ", icon: "" },
                    ].map((c, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <span style={{ fontSize: 24 }}>{c.icon}</span>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e0ec" }}>{c.label}</div>
                                <div style={{ fontSize: 12, color: "#6b6580" }}>{c.cost}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ─── Testimonials ──────────────────────────────────────────────────── */}
            <section style={{ padding: "100px 40px", background: "linear-gradient(180deg, #050508 0%, #08070e 100%)" }}>
                <div style={{ maxWidth: 1000, margin: "0 auto" }}>
                    <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: -0.5, textAlign: "center", marginBottom: 48 }}>
                        Được tin dùng bởi <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: "#a78bfa" }}>producers</span>
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                        {TESTIMONIALS.map((t, i) => (
                            <div key={i} className="testimonial-card" style={{ animation: `fadeUp 0.6s ease ${0.1 + i * 0.1}s both` }}>
                                <p style={{ fontSize: 14, lineHeight: 1.8, color: "#8a879a", marginBottom: 20, fontStyle: "italic" }}>"{t.text}"</p>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #4c1d95, #6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#c4b5fd" }}>{t.avatar}</div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e0ec" }}>{t.name}</div>
                                        <div style={{ fontSize: 11, color: "#4a4660" }}>{t.role}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CTA ───────────────────────────────────────────────────────────── */}
            <section style={{ padding: "100px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(99, 102, 241, 0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                    <h2 style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1, marginBottom: 16 }}>
                        Sẵn sàng <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontWeight: 400, color: "#a78bfa" }}>tách nhạc</span>?
                    </h2>
                    <p style={{ color: "#6b6580", fontSize: 16, marginBottom: 36 }}>10 credits miễn phí. Không cần thẻ tín dụng.</p>
                    <button onClick={() => setAuthMode("register")} style={{ padding: "18px 48px", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #7c3aed, #6366f1)", color: "#fff", cursor: "pointer", fontSize: 18, fontWeight: 700, fontFamily: "inherit", boxShadow: "0 12px 48px rgba(99, 102, 241, 0.35)" }}>
                        Tạo tài khoản miễn phí
                    </button>
                </div>
            </section>

            {/* ─── Footer ────────────────────────────────────────────────────────── */}
            <footer style={{ padding: "48px 40px 32px", borderTop: "1px solid #12121e" }}>
                <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <span style={{ fontSize: 16, fontWeight: 800 }}><span style={{ color: "#e2e0ec" }}>Split</span><span style={{ color: "#8b5cf6" }}>Audio</span></span>
                        <p style={{ fontSize: 12, color: "#3a384a", marginTop: 6 }}>Powered by BS-RoFormer & Demucs v4</p>
                    </div>
                    <div style={{ display: "flex", gap: 24 }}>
                        {["API Docs", "GitHub", "Terms", "Privacy"].map(l => (
                            <span key={l} style={{ fontSize: 12, color: "#4a4660", cursor: "pointer", transition: "color 0.2s" }}>{l}</span>
                        ))}
                    </div>
                    <p style={{ fontSize: 11, color: "#2a2840" }}>© 2025 InMobi — Everyone Can Sing</p>
                </div>
            </footer>

            {/* ─── Auth Modal ────────────────────────────────────────────────────── */}
            {authMode && (
                <div className="auth-overlay" onClick={(e) => { if (e.target === e.currentTarget) setAuthMode(null); }}>
                    <div className="auth-card">
                        {/* Close */}
                        <button onClick={() => setAuthMode(null)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "#4a4660", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>✕</button>

                        {/* Logo */}
                        <div style={{ textAlign: "center", marginBottom: 28 }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 2, marginBottom: 12 }}>
                                {[0, 1, 2, 3, 4].map(i => (
                                    <div key={i} style={{ width: 3, height: 12 + Math.sin(i) * 8, borderRadius: 2, background: "linear-gradient(180deg, #8b5cf6, #6366f1)", animation: `waveBar 1.2s ease ${i * 0.15}s infinite` }} />
                                ))}
                            </div>
                            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
                                {authMode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
                            </h2>
                            <p style={{ fontSize: 13, color: "#6b6580" }}>
                                {authMode === "login" ? "Chào mừng trở lại!" : "Nhận 10 credits miễn phí ngay"}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {authMode === "register" && (
                                <div style={{ marginBottom: 14 }}>
                                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b6580", marginBottom: 6 }}>Họ tên</label>
                                    <input className="input-field" type="text" placeholder="Nguyen Van A" value={name} onChange={e => setName(e.target.value)} required />
                                </div>
                            )}

                            <div style={{ marginBottom: 14 }}>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b6580", marginBottom: 6 }}>Email</label>
                                <input className="input-field" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                            </div>

                            <div style={{ marginBottom: 24 }}>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b6580", marginBottom: 6 }}>Mật khẩu</label>
                                <div style={{ position: "relative" }}>
                                    <input className="input-field" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingRight: 44 }} />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#4a4660", cursor: "pointer", fontSize: 13 }}>
                                        {showPassword ? "" : ""}
                                    </button>
                                </div>
                                {authMode === "login" && (
                                    <div style={{ textAlign: "right", marginTop: 8 }}>
                                        <span style={{ fontSize: 12, color: "#6366f1", cursor: "pointer" }}>Quên mật khẩu?</span>
                                    </div>
                                )}
                            </div>

                            <button type="submit" disabled={loading} style={{
                                width: "100%", padding: "14px", borderRadius: 12, border: "none",
                                background: loading ? "#2e2456" : "linear-gradient(135deg, #7c3aed, #6366f1)",
                                color: "#fff", cursor: loading ? "wait" : "pointer", fontSize: 15, fontWeight: 700, fontFamily: "inherit",
                                boxShadow: "0 8px 32px rgba(99, 102, 241, 0.25)", transition: "all 0.2s",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            }}>
                                {loading && <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
                                {loading ? "Đang xử lý..." : authMode === "login" ? "Đăng nhập" : "Đăng ký miễn phí"}
                            </button>

                            {authMode === "register" && (
                                <p style={{ fontSize: 11, color: "#3a384a", textAlign: "center", marginTop: 14, lineHeight: 1.6 }}>
                                    Bằng việc đăng ký, bạn đồng ý với <span style={{ color: "#6366f1", cursor: "pointer" }}>Điều khoản</span> và <span style={{ color: "#6366f1", cursor: "pointer" }}>Chính sách bảo mật</span>
                                </p>
                            )}
                        </form>

                        {/* Divider */}
                        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "24px 0" }}>
                            <div style={{ flex: 1, height: 1, background: "#1e1e32" }} />
                            <span style={{ fontSize: 11, color: "#3a384a" }}>hoặc</span>
                            <div style={{ flex: 1, height: 1, background: "#1e1e32" }} />
                        </div>

                        {/* OAuth buttons */}
                        <div style={{ display: "flex", gap: 10 }}>
                            {[
                                { label: "Google", bg: "#1a1a28", icon: "G" },
                                { label: "GitHub", bg: "#1a1a28", icon: "⌘" },
                            ].map(o => (
                                <button key={o.label} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #1e1e32", background: o.bg, color: "#8a879a", cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}>
                                    <span style={{ fontSize: 16 }}>{o.icon}</span> {o.label}
                                </button>
                            ))}
                        </div>

                        {/* Switch mode */}
                        <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#6b6580" }}>
                            {authMode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}
                            <span onClick={() => setAuthMode(authMode === "login" ? "register" : "login")} style={{ color: "#a78bfa", cursor: "pointer", fontWeight: 600, marginLeft: 6 }}>
                                {authMode === "login" ? "Đăng ký" : "Đăng nhập"}
                            </span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}