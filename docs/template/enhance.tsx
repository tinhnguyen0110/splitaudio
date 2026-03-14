import { useState, useRef, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Data
// ═══════════════════════════════════════════════════════════════════════════════
const MOCK_TASK = {
    id: "task-5e2a",
    filename: "test_5s.mp3",
    model: "bs_roformer",
    duration: 5,
    credit: 1,
    status: "completed",
    created_at: "2026-03-14T17:15:09.000Z",
    processing_at: "2026-03-14T17:15:11.000Z",
    completed_at: "2026-03-14T17:15:11.800Z",
};

// ═══════════════════════════════════════════════════════════════════════════════
// Audio Waveform Visualizer
// ═══════════════════════════════════════════════════════════════════════════════
function WaveformPlayer({ label, color, icon, isPlaying, onToggle, progress, onSeek, duration }) {
    const barsRef = useRef(null);
    const bars = 64;
    const barData = useRef(Array.from({ length: bars }, (_, i) => 0.15 + Math.abs(Math.sin(i * 0.5)) * 0.55 + Math.cos(i * 0.8) * 0.2 + Math.random() * 0.1));

    const fmtTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${String(sec).padStart(2, "0")}`;
    };

    return (
        <div style={{ background: "#0e0e16", border: "1px solid #1e1e30", borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e0ec" }}>{label}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <button onClick={onToggle} style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: color, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "transform 0.15s" }}>
                    {isPlaying ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></svg>
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><polygon points="6,4 20,12 6,20" /></svg>
                    )}
                </button>
                <div style={{ flex: 1, cursor: "pointer", position: "relative", height: 40 }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek((e.clientX - r.left) / r.width); }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 1.5, height: 40 }}>
                        {barData.current.map((h, i) => {
                            const filled = i / bars <= progress;
                            return <div key={i} style={{ width: 3, height: `${h * 100}%`, borderRadius: 1.5, background: filled ? color : "#1e1e30", transition: "background 0.1s", opacity: filled ? 1 : 0.5 }} />;
                        })}
                    </div>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6b7280", minWidth: 80, textAlign: "right" }}>
                    {fmtTime(progress * duration)} / {fmtTime(duration)}
                </span>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Enhance Step Toggle
// ═══════════════════════════════════════════════════════════════════════════════
function StepToggle({ step, enabled, onToggle, onConfigChange }) {
    const [expanded, setExpanded] = useState(false);
    const paramCount = step.params?.length || 0;

    return (
        <div style={{ borderRadius: 12, border: `1px solid ${enabled ? "#2e2456" : "#1a1a28"}`, background: enabled ? "rgba(99,102,241,0.04)" : "#0a0a12", transition: "all 0.25s", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
                {/* Toggle switch */}
                <div onClick={(e) => { e.stopPropagation(); onToggle(); }} style={{ width: 40, height: 22, borderRadius: 11, background: enabled ? "#6366f1" : "#1e1e30", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: enabled ? 21 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 15 }}>{step.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: enabled ? "#e2e0ec" : "#6b7280" }}>{step.name}</span>
                        {step.tag && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: step.tagColor || "#1e1b4b", color: step.tagTextColor || "#a5b4fc", fontWeight: 700, letterSpacing: 0.3 }}>{step.tag}</span>}
                        {paramCount > 0 && enabled && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "#14141e", color: "#6b7280" }}>{paramCount} params</span>}
                    </div>
                    <p style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>{step.desc}</p>
                </div>
                {paramCount > 0 && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>}
            </div>

            {/* Config panel */}
            {expanded && enabled && step.params && step.params.length > 0 && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid #14142a", paddingTop: 14 }}>
                    {step.params.map((p, pi) => (
                        <div key={p.key} style={{ marginBottom: pi < step.params.length - 1 ? 16 : 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <label style={{ fontSize: 11, color: "#8a879a", fontWeight: 500 }}>{p.label}</label>
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#a5b4fc", fontWeight: 600 }}>
                                    {p.type === "select" ? (p.options.find(o => o.value === p.value)?.label || p.value) : (typeof p.value === "number" ? (Number.isInteger(p.step) || p.step >= 1 ? p.value : p.value.toFixed(2)) : p.value)}{p.unit || ""}
                                </span>
                            </div>
                            {p.type === "slider" && (
                                <div>
                                    <input type="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => onConfigChange(step.id, p.key, parseFloat(e.target.value))} style={{ width: "100%", accentColor: "#6366f1", height: 4, cursor: "pointer" }} />
                                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                                        <span style={{ fontSize: 9, color: "#2a2a3e", fontFamily: "'JetBrains Mono', monospace" }}>{p.min}{p.unit || ""}</span>
                                        <span style={{ fontSize: 9, color: "#2a2a3e", fontFamily: "'JetBrains Mono', monospace" }}>{p.max}{p.unit || ""}</span>
                                    </div>
                                </div>
                            )}
                            {p.type === "select" && (
                                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                    {p.options.map(o => (
                                        <button key={o.value} onClick={() => onConfigChange(step.id, p.key, o.value)} style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid ${p.value === o.value ? "#4338ca" : "#1e1e30"}`, background: p.value === o.value ? "#1e1b4b" : "transparent", color: p.value === o.value ? "#c4b5fd" : "#6b7280", cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s", whiteSpace: "nowrap" }}>{o.label}</button>
                                    ))}
                                </div>
                            )}
                            {p.hint && <p style={{ fontSize: 10, color: "#333347", marginTop: 5, lineHeight: 1.4, fontStyle: "italic" }}>{p.hint}</p>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════
export default function TaskDetailWithEnhance() {
    const task = MOCK_TASK;
    const [playingTrack, setPlayingTrack] = useState(null);
    const [progress, setProgress] = useState({});
    const [selectedStem, setSelectedStem] = useState("vocals");
    const [processing, setProcessing] = useState(false);
    const [processProgress, setProcessProgress] = useState(0);
    const [currentProcessStep, setCurrentProcessStep] = useState("");
    const [enhancedReady, setEnhancedReady] = useState(false);
    const [enhancedPlaying, setEnhancedPlaying] = useState(false);
    const [enhancedProgress, setEnhancedProgress] = useState(0);
    const [toast, setToast] = useState(null);

    // Enhancement steps config — full params per step
    const [steps, setSteps] = useState([
        {
            id: "silence_gate", name: "Silence Gate", icon: "",
            desc: "Giảm nhiễu trong đoạn im lặng bằng energy threshold",
            tag: "~0.5s", tagColor: "#052e16", tagTextColor: "#6ee7b7",
            enabled: true,
            params: [
                { key: "threshold_db", label: "Threshold (ngưỡng energy)", type: "slider", min: -70, max: -25, step: 1, value: -50, unit: " dB", hint: "Thấp hơn = ít gate hơn, giữ nhiều reverb tail" },
                { key: "attack_ms", label: "Attack time", type: "slider", min: 1, max: 50, step: 1, value: 5, unit: " ms", hint: "Thời gian gate mở khi có tín hiệu" },
                { key: "release_ms", label: "Release time", type: "slider", min: 10, max: 500, step: 10, value: 50, unit: " ms", hint: "Thời gian gate đóng khi hết tín hiệu" },
                { key: "floor_gain", label: "Floor gain", type: "slider", min: 0, max: 0.2, step: 0.01, value: 0.05, hint: "Mức âm thanh tối thiểu khi gate đóng (0=silence, 0.2=nhẹ)" },
                { key: "frame_ms", label: "Frame length", type: "select", value: "25", options: [{ value: "10", label: "10ms (sharp)" }, { value: "25", label: "25ms (default)" }, { value: "50", label: "50ms (smooth)" }] },
            ],
        },
        {
            id: "spectral_denoise", name: "Spectral Denoise", icon: "",
            desc: "Spectral gating loại bỏ musical noise & background artifacts",
            tag: "~1-2s", tagColor: "#052e16", tagTextColor: "#6ee7b7",
            enabled: true,
            params: [
                { key: "stationary", label: "Mode", type: "select", value: "auto", options: [{ value: "auto", label: "Auto (dựa trên stem type)" }, { value: "stationary", label: "Stationary (nhiễu đều)" }, { value: "nonstationary", label: "Non-stationary (nhiễu biến đổi)" }], hint: "Vocal nên dùng non-stationary, instrumental dùng stationary" },
                { key: "prop_decrease", label: "Noise reduction strength", type: "slider", min: 0.0, max: 1.0, step: 0.05, value: 0.6, hint: "0.0 = không giảm, 1.0 = giảm tối đa (có thể mất detail)" },
                { key: "n_fft", label: "FFT size", type: "select", value: "2048", options: [{ value: "1024", label: "1024 (fast, less precise)" }, { value: "2048", label: "2048 (balanced)" }, { value: "4096", label: "4096 (precise, slower)" }], hint: "Lớn hơn = chính xác hơn về tần số nhưng chậm hơn" },
                { key: "freq_mask_smooth_hz", label: "Freq mask smoothing", type: "slider", min: 0, max: 500, step: 50, value: 200, unit: " Hz", hint: "Smooth mask theo tần số, giảm musical noise artifacts" },
                { key: "time_mask_smooth_ms", label: "Time mask smoothing", type: "slider", min: 0, max: 200, step: 10, value: 50, unit: " ms", hint: "Smooth mask theo thời gian, giảm flutter/gurgling" },
                { key: "n_std_thresh", label: "Noise threshold (std)", type: "slider", min: 0.5, max: 4.0, step: 0.1, value: 1.5, hint: "Số std trên noise floor để coi là tín hiệu. Thấp = aggressive" },
            ],
        },
        {
            id: "highfreq_restore", name: "High-Freq Restore", icon: "",
            desc: "Khôi phục tần số cao bị mất (sibilance, air, shimmer)",
            tag: "~0.5s", tagColor: "#052e16", tagTextColor: "#6ee7b7",
            enabled: true,
            params: [
                { key: "detect_threshold_db", label: "Cutoff detection threshold", type: "slider", min: -60, max: -20, step: 5, value: -40, unit: " dB", hint: "Ngưỡng phát hiện bandwidth bị cắt so với low-freq average" },
                { key: "mirror_gain_db", label: "Restore gain", type: "slider", min: -24, max: 0, step: 1, value: -12, unit: " dB", hint: "Gain của tần số khôi phục. -12dB tự nhiên, 0dB rõ nhất" },
                { key: "mirror_from_khz", label: "Mirror source range", type: "select", value: "auto", options: [{ value: "auto", label: "Auto detect" }, { value: "12", label: "12-16 kHz" }, { value: "14", label: "14-18 kHz" }, { value: "10", label: "10-14 kHz" }], hint: "Dải tần nguồn để mirror lên high-end" },
                { key: "filter_order", label: "Bandpass filter order", type: "select", value: "4", options: [{ value: "2", label: "2nd order (gentle)" }, { value: "4", label: "4th order (default)" }, { value: "6", label: "6th order (sharp)" }], hint: "Order cao hơn = transition band hẹp hơn" },
            ],
        },
        {
            id: "artifact_smooth", name: "Artifact Smoothing", icon: "✨",
            desc: "Median filter trên spectrogram loại bỏ musical noise còn sót",
            tag: "~1s", tagColor: "#052e16", tagTextColor: "#6ee7b7",
            enabled: false,
            params: [
                { key: "filter_size", label: "Median filter size", type: "select", value: "5", options: [{ value: "3", label: "3×3 (nhẹ)" }, { value: "5", label: "5×5 (vừa)" }, { value: "7", label: "7×7 (mạnh)" }, { value: "9", label: "9×9 (rất mạnh)" }], hint: "Lớn hơn = mịn hơn nhưng mất transient detail" },
                { key: "n_fft", label: "STFT window size", type: "select", value: "2048", options: [{ value: "1024", label: "1024" }, { value: "2048", label: "2048" }, { value: "4096", label: "4096" }] },
                { key: "hop_length", label: "Hop length", type: "select", value: "512", options: [{ value: "256", label: "256 (overlap 87.5%)" }, { value: "512", label: "512 (overlap 75%)" }, { value: "1024", label: "1024 (overlap 50%)" }], hint: "Nhỏ hơn = overlap nhiều hơn, mịn hơn ở chunk boundary" },
                { key: "mask_type", label: "Mask type", type: "select", value: "soft", options: [{ value: "soft", label: "Soft mask (mịn)" }, { value: "hard", label: "Hard mask (sắc nét)" }, { value: "wiener", label: "Wiener (adaptive)" }], hint: "Soft mask ít artifact nhất, Wiener adaptive tốt nhất cho mixed content" },
                { key: "mask_smooth_passes", label: "Mask smoothing passes", type: "slider", min: 0, max: 5, step: 1, value: 1, hint: "Số lần smooth mask sau median filter" },
            ],
        },
        {
            id: "mixture_consistency", name: "Mixture Consistency", icon: "⚖️",
            desc: "Đảm bảo vocal + instrumental ≈ original sau xử lý",
            tag: "~0.5s", tagColor: "#052e16", tagTextColor: "#6ee7b7",
            enabled: true,
            params: [
                { key: "method", label: "Residual allocation method", type: "select", value: "energy_ratio", options: [{ value: "energy_ratio", label: "Energy ratio (default)" }, { value: "equal", label: "Equal split" }, { value: "target_only", label: "Target stem only" }], hint: "Energy ratio phân bổ residual theo năng lượng mỗi stem" },
                { key: "max_correction_db", label: "Max correction", type: "slider", min: 0.5, max: 6.0, step: 0.5, value: 3.0, unit: " dB", hint: "Giới hạn correction để tránh distortion. Nếu residual lớn hơn = skip" },
                { key: "apply_to", label: "Apply to", type: "select", value: "both", options: [{ value: "both", label: "Cả vocal & instrumental" }, { value: "selected", label: "Chỉ stem đang chọn" }], hint: "Nếu chỉ enhance 1 stem, có thể chỉ correct stem đó" },
            ],
        },
        {
            id: "loudness_norm", name: "Loudness Normalize", icon: "",
            desc: "Chuẩn hóa loudness theo ITU-R BS.1770 (LUFS)",
            tag: "~0.3s", tagColor: "#052e16", tagTextColor: "#6ee7b7",
            enabled: true,
            params: [
                { key: "target_lufs", label: "Target loudness", type: "slider", min: -24, max: -6, step: 1, value: -14, unit: " LUFS", hint: "Spotify/YouTube: -14 LUFS, Apple Music: -16 LUFS, CD: -9 LUFS" },
                { key: "peak_limit_db", label: "True peak limit", type: "slider", min: -3.0, max: 0.0, step: 0.1, value: -1.0, unit: " dBTP", hint: "Giới hạn true peak để tránh clipping. -1.0 dBTP an toàn cho streaming" },
                { key: "method", label: "Normalization method", type: "select", value: "integrated", options: [{ value: "integrated", label: "Integrated (toàn bài)" }, { value: "momentary", label: "Momentary (từng đoạn)" }], hint: "Integrated chuẩn hơn cho cả bài, momentary cho dynamic content" },
                { key: "fallback", label: "Fallback nếu silence", type: "select", value: "peak", options: [{ value: "peak", label: "Peak normalize (0.95)" }, { value: "skip", label: "Skip (giữ nguyên)" }], hint: "Nếu audio quá nhỏ (<-70 LUFS), dùng fallback" },
            ],
        },
        {
            id: "ai_denoise", name: "AI Denoise Model", icon: "易",
            desc: "MelBand RoFormer Denoise — deep neural network denoising",
            tag: "GPU", tagColor: "#4c1d95", tagTextColor: "#c4b5fd",
            enabled: false,
            params: [
                { key: "model", label: "Model variant", type: "select", value: "denoise_standard", options: [{ value: "denoise_standard", label: "Standard (SDR 27.99 dB)" }, { value: "denoise_aggressive", label: "Aggressive (SDR 27.97 dB)" }], hint: "Aggressive loại nhiều noise hơn nhưng có thể mất subtle detail" },
                { key: "chunk_size", label: "Chunk size", type: "select", value: "352800", options: [{ value: "176400", label: "4s (ít VRAM)" }, { value: "352800", label: "8s (default)" }, { value: "705600", label: "16s (chất lượng cao, tốn VRAM)" }], hint: "Chunk lớn hơn = ít seam artifact nhưng tốn VRAM" },
                { key: "overlap", label: "Overlap ratio", type: "slider", min: 0.1, max: 0.5, step: 0.05, value: 0.25, hint: "Overlap giữa chunks. 0.25 = 25% overlap, cao hơn = mịn hơn" },
                { key: "precision", label: "Precision", type: "select", value: "fp16", options: [{ value: "fp32", label: "FP32 (chính xác)" }, { value: "fp16", label: "FP16 (nhanh, ít VRAM)" }], hint: "FP16 nhanh gấp ~1.5x và tiết kiệm 50% VRAM, chất lượng gần như tương đương" },
                { key: "denoise_strength", label: "Denoise blend", type: "slider", min: 0.0, max: 1.0, step: 0.05, value: 1.0, hint: "Blend giữa original và denoised. 0.5 = 50% denoise, giữ lại texture gốc" },
            ],
        },
    ]);

    useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

    // Simulate playback progress
    useEffect(() => {
        if (!playingTrack) return;
        const iv = setInterval(() => {
            setProgress(p => {
                const cur = (p[playingTrack] || 0) + 0.02;
                if (cur >= 1) { setPlayingTrack(null); return { ...p, [playingTrack]: 0 }; }
                return { ...p, [playingTrack]: cur };
            });
        }, 100);
        return () => clearInterval(iv);
    }, [playingTrack]);

    useEffect(() => {
        if (!enhancedPlaying) return;
        const iv = setInterval(() => {
            setEnhancedProgress(p => { if (p >= 1) { setEnhancedPlaying(false); return 0; } return p + 0.02; });
        }, 100);
        return () => clearInterval(iv);
    }, [enhancedPlaying]);

    const toggleStep = (id) => {
        setSteps(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
        setEnhancedReady(false);
    };

    const updateConfig = (stepId, key, value) => {
        setSteps(prev => prev.map(s => s.id === stepId ? { ...s, params: s.params.map(p => p.key === key ? { ...p, value } : p) } : s));
        setEnhancedReady(false);
    };

    const enabledSteps = steps.filter(s => s.enabled);
    const estimatedTime = enabledSteps.reduce((acc, s) => {
        const tagMatch = s.tag?.match(/([\d.]+)/);
        return acc + (tagMatch ? parseFloat(tagMatch[1]) : 0);
    }, 0);

    const runEnhance = () => {
        if (enabledSteps.length === 0) { setToast({ msg: "Chưa bật step nào!", type: "warning" }); return; }
        setProcessing(true);
        setProcessProgress(0);
        setEnhancedReady(false);
        setCurrentProcessStep(enabledSteps[0]?.name || "");

        let stepIdx = 0;
        const iv = setInterval(() => {
            setProcessProgress(p => {
                const next = p + (0.8 / enabledSteps.length) * (0.3 + Math.random() * 0.4);
                const newStepIdx = Math.min(Math.floor(next * enabledSteps.length), enabledSteps.length - 1);
                if (newStepIdx !== stepIdx) { stepIdx = newStepIdx; setCurrentProcessStep(enabledSteps[stepIdx]?.name || ""); }
                if (next >= 1) {
                    clearInterval(iv);
                    setProcessing(false);
                    setProcessProgress(1);
                    setEnhancedReady(true);
                    setCurrentProcessStep("");
                    setToast({ msg: `Enhanced ${selectedStem} thành công! ${enabledSteps.length} steps applied.`, type: "success" });
                    return 1;
                }
                return next;
            });
        }, 200);
    };

    const presetApply = (preset) => {
        const presets = {
            light: ["silence_gate", "spectral_denoise", "loudness_norm"],
            medium: ["silence_gate", "spectral_denoise", "highfreq_restore", "mixture_consistency", "loudness_norm"],
            aggressive: ["silence_gate", "spectral_denoise", "highfreq_restore", "artifact_smooth", "mixture_consistency", "loudness_norm", "ai_denoise"],
        };
        const active = presets[preset] || [];
        setSteps(prev => prev.map(s => ({ ...s, enabled: active.includes(s.id) })));
        setEnhancedReady(false);
    };

    const fmtDate = (d) => new Date(d).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const fmtDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

    return (
        <div style={{ minHeight: "100vh", background: "#08080c", color: "#e2e0ec", fontFamily: "'Outfit', 'DM Sans', system-ui, sans-serif", fontSize: 13 }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 3px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(16px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        input[type="range"] { -webkit-appearance: none; appearance: none; background: #1e1e30; border-radius: 4px; height: 4px; outline: none; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #818cf8; cursor: pointer; border: 2px solid #0e0e16; }
      `}</style>

            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, animation: "fadeUp 0.4s ease" }}>
                    <button style={{ background: "#14141e", border: "1px solid #1e1e30", borderRadius: 10, padding: "8px 14px", color: "#8a879a", cursor: "pointer", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                        Back
                    </button>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Task Detail</h1>
                    </div>
                    <span style={{ padding: "5px 14px", borderRadius: 20, background: "#052e16", color: "#6ee7b7", fontSize: 12, fontWeight: 600 }}>✓ Completed</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 440px", gap: 24, alignItems: "start" }}>

                    {/* ─── Left Column ──────────────────────────────────────────── */}
                    <div>
                        {/* Task Info */}
                        <div style={{ background: "#0e0e16", border: "1px solid #1e1e30", borderRadius: 16, padding: "24px", marginBottom: 20, animation: "fadeUp 0.4s ease 0.05s both" }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "#8a879a" }}>Task Information</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                                {[
                                    { label: "Filename", value: task.filename },
                                    { label: "Model", value: task.model === "bs_roformer" ? "BS-RoFormer" : "Demucs v4" },
                                    { label: "Duration", value: fmtDuration(task.duration) },
                                    { label: "Credits Used", value: task.credit },
                                    { label: "Created", value: fmtDate(task.created_at) },
                                    { label: "Completed", value: fmtDate(task.completed_at) },
                                ].map(f => (
                                    <div key={f.label}>
                                        <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 4 }}>{f.label}</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: typeof f.value === "number" ? "'JetBrains Mono', monospace" : "inherit" }}>{f.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Timeline */}
                        <div style={{ background: "#0e0e16", border: "1px solid #1e1e30", borderRadius: 16, padding: "24px", marginBottom: 20, animation: "fadeUp 0.4s ease 0.1s both" }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "#8a879a" }}>Timeline</h3>
                            <div style={{ position: "relative", paddingLeft: 24 }}>
                                <div style={{ position: "absolute", left: 7, top: 8, bottom: 8, width: 2, background: "#1e1e30" }} />
                                {[
                                    { label: "Created", time: task.created_at, color: "#6366f1" },
                                    { label: "Processing", time: task.processing_at, color: "#f59e0b" },
                                    { label: "Completed", time: task.completed_at, color: "#10b981" },
                                ].map((t, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: i < 2 ? 16 : 0, position: "relative" }}>
                                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: t.color, border: "3px solid #0e0e16", position: "absolute", left: -24, zIndex: 1 }} />
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e0ec" }}>{t.label}</div>
                                            <div style={{ fontSize: 11, color: "#4b5563", fontFamily: "'JetBrains Mono', monospace" }}>{fmtDate(t.time)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Audio Players */}
                        <div style={{ animation: "fadeUp 0.4s ease 0.15s both" }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#8a879a" }}>Original Audio</h3>
                            <WaveformPlayer label="original" icon="" color="#6366f1" isPlaying={playingTrack === "original"} onToggle={() => setPlayingTrack(playingTrack === "original" ? null : "original")} progress={progress.original || 0} onSeek={(p) => setProgress(prev => ({ ...prev, original: p }))} duration={task.duration} />
                        </div>

                        <div style={{ marginTop: 16, animation: "fadeUp 0.4s ease 0.2s both" }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#8a879a" }}>Output Stems</h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <WaveformPlayer label="vocals" icon="" color="#a78bfa" isPlaying={playingTrack === "vocals"} onToggle={() => setPlayingTrack(playingTrack === "vocals" ? null : "vocals")} progress={progress.vocals || 0} onSeek={(p) => setProgress(prev => ({ ...prev, vocals: p }))} duration={task.duration} />
                                <WaveformPlayer label="instrumental" icon="" color="#22d3ee" isPlaying={playingTrack === "instrumental"} onToggle={() => setPlayingTrack(playingTrack === "instrumental" ? null : "instrumental")} progress={progress.instrumental || 0} onSeek={(p) => setProgress(prev => ({ ...prev, instrumental: p }))} duration={task.duration} />
                            </div>
                        </div>

                        {/* Enhanced Result — appears after processing */}
                        {enhancedReady && (
                            <div style={{ marginTop: 20, animation: "fadeUp 0.4s ease" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "#a78bfa", display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#a78bfa" }} />
                                        Enhanced Result
                                    </h3>
                                    <button onClick={() => setToast({ msg: `Downloading enhanced_${selectedStem}.wav...`, type: "success" })} style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #7c3aed, #6366f1)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                                        Download
                                    </button>
                                </div>
                                <div style={{ background: "#0e0e16", border: "2px solid #2e2456", borderRadius: 14, padding: "16px 20px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                        <span style={{ fontSize: 16 }}>✨</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "#c4b5fd" }}>enhanced_{selectedStem}.wav</span>
                                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#1e1b4b", color: "#a5b4fc", fontFamily: "'JetBrains Mono', monospace" }}>{enabledSteps.length} steps applied</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                        <button onClick={() => setEnhancedPlaying(!enhancedPlaying)} style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "linear-gradient(135deg, #7c3aed, #6366f1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            {enhancedPlaying ? (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></svg>
                                            ) : (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><polygon points="6,4 20,12 6,20" /></svg>
                                            )}
                                        </button>
                                        <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#1e1e30", overflow: "hidden" }}>
                                            <div style={{ width: `${enhancedProgress * 100}%`, height: "100%", background: "linear-gradient(90deg, #7c3aed, #a78bfa)", borderRadius: 2, transition: "width 0.1s" }} />
                                        </div>
                                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6b7280", minWidth: 80, textAlign: "right" }}>
                                            {Math.floor(enhancedProgress * task.duration / 60)}:{String(Math.floor(enhancedProgress * task.duration % 60)).padStart(2, "0")} / {fmtDuration(task.duration)}
                                        </span>
                                    </div>
                                </div>

                                {/* Before/After comparison hint */}
                                <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 10, background: "rgba(99,102,241,0.05)", border: "1px solid #1e1b4b", display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 14 }}></span>
                                    <span style={{ fontSize: 11, color: "#8a879a" }}>Tip: Play cả "{selectedStem}" gốc ở trên và "enhanced" để so sánh A/B chất lượng.</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ─── Right Column: Enhance Panel ─────────────────────────── */}
                    <div style={{ position: "sticky", top: 24, animation: "fadeUp 0.4s ease 0.15s both" }}>
                        <div style={{ background: "#0e0e16", border: "1px solid #1e1e30", borderRadius: 16, padding: "24px", overflow: "hidden" }}>
                            {/* Title */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #4338ca, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✨</div>
                                <div>
                                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>Audio Enhance</h3>
                                    <p style={{ fontSize: 11, color: "#4b5563" }}>Post-processing tùy chỉnh</p>
                                </div>
                            </div>

                            {/* Stem selector */}
                            <div style={{ marginBottom: 18 }}>
                                <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Input stem</label>
                                <div style={{ display: "flex", gap: 8 }}>
                                    {[
                                        { id: "vocals", label: "Vocals", icon: "", color: "#a78bfa" },
                                        { id: "instrumental", label: "Instrumental", icon: "", color: "#22d3ee" },
                                    ].map(s => (
                                        <button key={s.id} onClick={() => { setSelectedStem(s.id); setEnhancedReady(false); }} style={{ flex: 1, padding: "12px", borderRadius: 12, border: `2px solid ${selectedStem === s.id ? s.color : "#1e1e30"}`, background: selectedStem === s.id ? `${s.color}10` : "transparent", cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit" }}>
                                            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: selectedStem === s.id ? s.color : "#6b7280" }}>{s.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Presets */}
                            <div style={{ marginBottom: 18 }}>
                                <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Preset</label>
                                <div style={{ display: "flex", gap: 6 }}>
                                    {[
                                        { id: "light", label: "Light", desc: "3 steps" },
                                        { id: "medium", label: "Medium", desc: "5 steps" },
                                        { id: "aggressive", label: "Max", desc: "7 steps" },
                                    ].map(p => (
                                        <button key={p.id} onClick={() => presetApply(p.id)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: "1px solid #1e1e30", background: "transparent", color: "#8a879a", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s" }}>
                                            <div>{p.label}</div>
                                            <div style={{ fontSize: 9, color: "#4b5563", marginTop: 2 }}>{p.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Steps */}
                            <div style={{ marginBottom: 18 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                    <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Pipeline steps</label>
                                    <span style={{ fontSize: 10, color: "#4b5563" }}>{enabledSteps.length}/{steps.length} active</span>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
                                    {steps.map(s => (
                                        <StepToggle key={s.id} step={s} enabled={s.enabled} onToggle={() => toggleStep(s.id)} onConfigChange={updateConfig} />
                                    ))}
                                </div>
                            </div>

                            {/* Summary & Process */}
                            <div style={{ padding: "14px 16px", borderRadius: 12, background: "#08080c", border: "1px solid #14142a", marginBottom: 16 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                                    <span style={{ color: "#6b7280" }}>Input</span>
                                    <span style={{ fontWeight: 600, color: selectedStem === "vocals" ? "#a78bfa" : "#22d3ee" }}>{selectedStem}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                                    <span style={{ color: "#6b7280" }}>Steps enabled</span>
                                    <span style={{ fontWeight: 600 }}>{enabledSteps.length}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                                    <span style={{ color: "#6b7280" }}>Estimated time</span>
                                    <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>~{estimatedTime.toFixed(1)}s</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                    <span style={{ color: "#6b7280" }}>Credit cost</span>
                                    <span style={{ fontWeight: 600, color: "#6ee7b7" }}>Free</span>
                                </div>
                            </div>

                            {/* Progress bar during processing */}
                            {processing && (
                                <div style={{ marginBottom: 16, animation: "fadeUp 0.3s ease" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                        <span style={{ fontSize: 11, color: "#a5b4fc", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                                            <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                                            {currentProcessStep}
                                        </span>
                                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#818cf8" }}>{Math.round(processProgress * 100)}%</span>
                                    </div>
                                    <div style={{ height: 4, borderRadius: 2, background: "#1e1e30", overflow: "hidden" }}>
                                        <div style={{ width: `${processProgress * 100}%`, height: "100%", background: "linear-gradient(90deg, #4338ca, #818cf8)", borderRadius: 2, transition: "width 0.2s" }} />
                                    </div>
                                </div>
                            )}

                            <button onClick={runEnhance} disabled={processing || enabledSteps.length === 0} style={{
                                width: "100%", padding: "14px", borderRadius: 12, border: "none",
                                background: processing ? "#1e1b4b" : enabledSteps.length === 0 ? "#14141e" : "linear-gradient(135deg, #7c3aed, #6366f1)",
                                color: enabledSteps.length === 0 ? "#4b5563" : "#fff",
                                cursor: processing || enabledSteps.length === 0 ? "not-allowed" : "pointer",
                                fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                                boxShadow: !processing && enabledSteps.length > 0 ? "0 8px 32px rgba(99, 102, 241, 0.2)" : "none",
                                transition: "all 0.25s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            }}>
                                {processing ? (
                                    <>
                                        <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <span style={{ fontSize: 16 }}>⚡</span>
                                        Enhance {selectedStem}
                                    </>
                                )}
                            </button>

                            {enabledSteps.length === 0 && (
                                <p style={{ fontSize: 11, color: "#4b5563", textAlign: "center", marginTop: 8 }}>Bật ít nhất 1 step để bắt đầu</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div style={{ position: "fixed", bottom: 24, right: 24, padding: "14px 24px", borderRadius: 12, background: toast.type === "warning" ? "#92400e" : toast.type === "error" ? "#991b1b" : "#065f46", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 12px 40px rgba(0,0,0,0.4)", zIndex: 100, animation: "toastIn 0.3s cubic-bezier(0.16,1,0.3,1)", maxWidth: 400, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{toast.type === "success" ? "✓" : toast.type === "warning" ? "⚠" : "✕"}</span>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}