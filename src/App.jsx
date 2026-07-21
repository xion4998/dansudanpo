/* eslint-disable */
import { useState, useMemo, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBr-Vq8kDPrxNv8RojdrPa_GUgXth2tHmg",
  authDomain: "teamnight-d909b.firebaseapp.com",
  databaseURL: "https://teamnight-d909b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "teamnight-d909b",
  storageBucket: "teamnight-d909b.firebasestorage.app",
  messagingSenderId: "440378727824",
  appId: "1:440378727824:web:2c4bf51c6c57f8f7d96715"
};

let fdb = null;
try { fdb = getDatabase(initializeApp(firebaseConfig)); } catch (e) {}
const dbSet = (p, val) => { try { if (fdb) set(ref(fdb, p), val); } catch (e) {} };

const EDIT_PASSWORD = "002"; // 수정 비밀번호

const ZONES = ["상부", "하부", "B", "C", "D", "P", "T", "W", "Z"];
const WONBOX_ZONES = ["상부", "하부", "P", "Z"]; // 원박스 전용 존
const getZones = (t) => t === "원박스" ? WONBOX_ZONES : ZONES;
const ZONE_COLORS = {
  "상부": "#7c3aed", "하부": "#2563eb", "B": "#ea580c", "C": "#0891b2",
  "D": "#dc2626", "P": "#059669", "T": "#db2777", "W": "#65a30d", "Z": "#d97706",
};
const TYPES = ["단수", "단포", "원박스"];
const DAYS = ["당일", "일반"];
const TYPE_COLORS = { "단수": "#7c3aed", "단포": "#0891b2", "원박스": "#ea580c" };
const DAY_COLORS = { "당일": "#dc2626", "일반": "#059669" };

try {
  const fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css";
  document.head.appendChild(fontLink);
} catch (e) {}

const initData = () => {
  try {
    const saved = localStorage.getItem("dansu_v2_data");
    if (saved) {
      const d = JSON.parse(saved);
      // B2 없으면 추가 (마이그레이션)
      const allZones = [...new Set([...ZONES, ...WONBOX_ZONES])];
      allZones.forEach(z => {
        if (!d[z]) {
          d[z] = {};
          TYPES.forEach(t => { d[z][t] = {}; DAYS.forEach(dy => { d[z][t][dy] = false; }); });
        } else {
          TYPES.forEach(t => {
            if (!d[z][t]) { d[z][t] = {}; DAYS.forEach(dy => { d[z][t][dy] = false; }); }
            else { DAYS.forEach(dy => { if (d[z][t][dy] === undefined) d[z][t][dy] = false; }); }
          });
        }
      });
      return d;
    }
  } catch (e) {}
  const d = {};
  ZONES.forEach(z => {
    d[z] = {};
    TYPES.forEach(t => {
      d[z][t] = {};
      DAYS.forEach(dy => { d[z][t][dy] = false; });
    });
  });
  return d;
};

function CircleProgress({ percent, color, size = 80 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.4s ease" }} />
    </svg>
  );
}

export default function App() {
  const [data, setData] = useState(initData);
  const [activeType, setActiveType] = useState("단수");
  const [activeDay, setActiveDay] = useState("당일");
  const [copied, setCopied] = useState(false);
  const [editable, setEditable] = useState(() => {
    try { return localStorage.getItem("dansu_editable") === "true"; } catch (e) { return false; }
  });
  const [showPwInput, setShowPwInput] = useState(false);
  const [pwValue, setPwValue] = useState("");

  const tryUnlock = () => {
    if (pwValue === EDIT_PASSWORD) {
      setEditable(true);
      try { localStorage.setItem("dansu_editable", "true"); } catch (e) {}
      setShowPwInput(false); setPwValue("");
    } else {
      setPwValue("");
    }
  };

  const lockEdit = () => {
    setEditable(false);
    try { localStorage.setItem("dansu_editable", "false"); } catch (e) {}
  };

  const [enabledCats, setEnabledCats] = useState(() => {
    try { const s = localStorage.getItem("dansu_enabled_cats"); if (s) return JSON.parse(s); } catch (e) {}
    return { "당일": true, "일반": true, "원박스": true };
  });

  const toggleCat = (c) => {
    const next = { ...enabledCats, [c]: !enabledCats[c] };
    setEnabledCats(next);
    try { localStorage.setItem("dansu_enabled_cats", JSON.stringify(next)); } catch (e) {}
  };

  const saveData = (newData) => { if (!editable) return;
    setData(newData);
    try { localStorage.setItem("dansu_v2_data", JSON.stringify(newData)); } catch (e) {} dbSet("dansu/data", newData);
  };

  const toggle = (zone, type, dy) => {
    saveData({
      ...data,
      [zone]: { ...data[zone], [type]: { ...data[zone][type], [dy]: !data[zone][type][dy] } }
    });
  };

  const [resetConfirm, setResetConfirm] = useState(false);

  const resetAll = () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      setTimeout(() => setResetConfirm(false), 3000);
      return;
    }
    const d = {};
    ZONES.forEach(z => {
      d[z] = {};
      TYPES.forEach(t => { d[z][t] = {}; DAYS.forEach(dy => { d[z][t][dy] = false; }); });
    });
    saveData(d);
    setResetConfirm(false);
  };


  // Firebase 실시간 구독
  useEffect(() => {
    if (!fdb) return;
    const subs = [];
    subs.push(onValue(ref(fdb, "dansu/data"), snap => {
      const v = snap.val();
      if (v) {
        setData(v);
        try { localStorage.setItem("dansu_v2_data", JSON.stringify(v)); } catch (e) {}
      }
    }));
    return () => subs.forEach(u => u());
  }, []);

  const grandStats = useMemo(() => {
    const out = {};
    TYPES.forEach(t => {
      const zones = getZones(t);
      out[t] = {};
      DAYS.forEach(dy => {
        const done = zones.filter(z => (data[z]||{})[t]?.[dy]).length;
        out[t][dy] = { done, total: zones.length, pct: Math.round((done / zones.length) * 100) };
      });
    });
    return out;
  }, [data]);

  // 대시보드용 요약 실시간 전송
  useEffect(() => {
    let totalPct = 0, count = 0;
    TYPES.forEach(t => DAYS.forEach(dy => { totalPct += grandStats[t][dy].pct; count += 1; }));
    const pct = count > 0 ? Math.round(totalPct / count) : 0;
    dbSet("summary/dansu", { pct, ts: Date.now() });
  }, [grandStats]);

  const activeColor = TYPE_COLORS[activeType];
  const activeDayColor = DAY_COLORS[activeDay];
  const g = grandStats[activeType][activeDay];

  const getSummaryText = () => {
    const now = new Date();
    const timeStr = `${now.getHours()}시${now.getMinutes().toString().padStart(2,"0")}분`;
    const month = now.getMonth() + 1;
    const dateNum = now.getDate();
    const lines = [`단수단포 (${timeStr})`, `${month}월${dateNum}일자`, `──────────────`];
    TYPES.forEach(t => {
      if (t === "원박스" && !enabledCats["원박스"]) return;
      DAYS.forEach(dy => {
        if (!enabledCats[dy]) return;
        const zones = getZones(t);
        const done = zones.filter(z => (data[z]||{})[t]?.[dy]);
        const notDone = zones.filter(z => !(data[z]||{})[t]?.[dy]);
        const label = `${t} ${dy}`;
        if (done.length === ZONES.length) {
          lines.push(`${label} : 완료`);
        } else if (done.length === 0) {
          lines.push(`${label} : 미시작`);
        } else {
          lines.push(`${label} : ${notDone.map(z => z.length<=1?z+"존":z).join("/")} 미완료`);
        }
      });
    });
    lines.push(`──────────────`);
    return lines.join("\n");
  };

  const S = {
    bg: "#f0f4f8", card: "#ffffff", border: "#e2e8f0",
    text: "#0f172a", textSub: "#64748b", inputBg: "#f8fafc",
    shadow: "0 1px 8px rgba(0,0,0,0.08)", shadowMd: "0 2px 16px rgba(0,0,0,0.10)",
  };

  return (
    <div style={{ minHeight: "100vh", background: S.bg, color: S.text, fontFamily: "'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif", padding: "20px 16px" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, background: "linear-gradient(135deg,#7c3aed,#0891b2,#ea580c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>단수단포</h1>
        <div style={{ fontSize: 11, letterSpacing: "0.3em", color: S.textSub, textTransform: "uppercase", marginTop: 4, fontWeight: 500 }}>피킹 진행 현황</div>
        {/* 잠금 상태 */}
        <div style={{ marginTop: 10 }}>
          {editable ? (
            <button onClick={lockEdit} style={{ fontSize: 11, fontWeight: 700, padding: "5px 16px", borderRadius: 20, cursor: "pointer", background: "#dcfce7", border: "1px solid #86efac", color: "#15803d", fontFamily: "inherit" }}>
              🔓 수정 가능 · 탭하여 잠금
            </button>
          ) : showPwInput ? (
            <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center" }}>
              <input type="password" inputMode="numeric" value={pwValue} autoFocus
                onChange={e => setPwValue(e.target.value)}
                onKeyDown={e => e.key === "Enter" && tryUnlock()}
                placeholder="비밀번호"
                style={{ width: 100, background: "#fff", border: "1.5px solid #7c3aed", borderRadius: 10, padding: "6px 10px", fontSize: 14, fontWeight: 700, outline: "none", textAlign: "center", fontFamily: "inherit" }} />
              <button onClick={tryUnlock} style={{ fontSize: 12, fontWeight: 800, padding: "7px 14px", borderRadius: 10, cursor: "pointer", background: "#7c3aed", border: "none", color: "#fff", fontFamily: "inherit" }}>확인</button>
              <button onClick={() => { setShowPwInput(false); setPwValue(""); }} style={{ fontSize: 12, fontWeight: 700, padding: "7px 10px", borderRadius: 10, cursor: "pointer", background: "#f8fafc", border: "1px solid #e2e8f0", color: "#94a3b8", fontFamily: "inherit" }}>취소</button>
            </div>
          ) : (
            <button onClick={() => setShowPwInput(true)} style={{ fontSize: 11, fontWeight: 700, padding: "5px 16px", borderRadius: 20, cursor: "pointer", background: "#f8fafc", border: "1px solid #e2e8f0", color: "#94a3b8", fontFamily: "inherit" }}>
              🔒 보기 전용 · 탭하여 잠금해제
            </button>
          )}
        </div>
      </div>

      {/* 단수/단포/원박스 탭 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {TYPES.map(t => (
          <button key={t} onClick={() => setActiveType(t)} style={{
            flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
            background: activeType === t ? TYPE_COLORS[t] : S.card,
            border: `1.5px solid ${TYPE_COLORS[t]}`,
            color: activeType === t ? "#fff" : TYPE_COLORS[t],
            fontSize: 13, fontWeight: 800, transition: "all 0.2s",
            boxShadow: activeType === t ? `0 2px 12px ${TYPE_COLORS[t]}44` : S.shadow,
          }}>{t}</button>
        ))}
      </div>

      {/* 당일/일반 탭 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {DAYS.map(dy => (
          <button key={dy} onClick={() => setActiveDay(dy)} style={{
            flex: 1, padding: "8px 0", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
            background: activeDay === dy ? DAY_COLORS[dy] : S.card,
            border: `1.5px solid ${DAY_COLORS[dy]}`,
            color: activeDay === dy ? "#fff" : DAY_COLORS[dy],
            fontSize: 13, fontWeight: 700, transition: "all 0.2s", boxShadow: S.shadow,
          }}>{dy}</button>
        ))}
      </div>

      {/* 토탈 도넛 */}
      {(() => {
        let totalPct = 0, count = 0;
        TYPES.forEach(t => DAYS.forEach(dy => { totalPct += grandStats[t][dy].pct; count += 1; }));
        const pct = count > 0 ? Math.round(totalPct / count) : 0;
        return (
          <div style={{ background: "linear-gradient(135deg,#7c3aed,#ea580c)", borderRadius: 16, padding: "16px 20px", marginBottom: 12, display: "flex", alignItems: "center", gap: 16, boxShadow: "0 4px 20px rgba(124,58,237,0.3)" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <CircleProgress percent={pct} color="#ffffff" size={80} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{pct}%</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 4 }}>전체 토탈 진행률</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{pct}%</div>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {TYPES.map(t => DAYS.map(dy => {
                  const gs = grandStats[t][dy];
                  return (
                    <span key={`${t}_${dy}`} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 20, background: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>
                      {t} {dy} {gs.pct}%
                    </span>
                  );
                }))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Grand Total */}
      <div style={{ background: `linear-gradient(135deg,${activeColor},${activeDayColor})`, borderRadius: 16, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16, boxShadow: `0 4px 20px ${activeColor}33` }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <CircleProgress percent={g.pct} color="#ffffff" size={80} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{g.pct}%</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 4 }}>{activeType} {activeDay} 진행률</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{g.done} / {g.total} 존 완료</div>
          <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
            {getZones(activeType).map(z => (
              <span key={z} style={{
                fontSize: 9, padding: "2px 6px", borderRadius: 20,
                background: (data[z]||{})[activeType]?.[activeDay] ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)",
                color: "#fff", border: "1px solid rgba(255,255,255,0.3)"
              }}>
                {(data[z]||{})[activeType]?.[activeDay] ? "✓" : "·"} {z}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 존별 체크 */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: S.shadow }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: S.text, marginBottom: 12 }}>
          <span style={{ color: activeColor }}>{activeType}</span>
          <span style={{ color: S.textSub, margin: "0 6px" }}>·</span>
          <span style={{ color: activeDayColor }}>{activeDay}</span>
          <span style={{ color: S.textSub, marginLeft: 6, fontWeight: 500 }}>완료 체크</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {(() => {
            const activeZones = getZones(activeType);
            const lockedZones = activeType === "원박스" ? ZONES.filter(z => !activeZones.includes(z)) : [];
            return [...activeZones, ...lockedZones].map(z => {
              const isLocked = lockedZones.includes(z);
              const done = (data[z]||{})[activeType]?.[activeDay];
              const color = ZONE_COLORS[z] || "#94a3b8";
              return (
                <button key={z} onClick={() => !isLocked && toggle(z, activeType, activeDay)} style={{
                  background: isLocked ? "#f1f5f9" : done ? color+"15" : S.inputBg,
                  border: `2px solid ${isLocked ? "#e2e8f0" : done ? color : S.border}`,
                  borderRadius: 12, padding: "14px 8px", cursor: isLocked ? "default" : "pointer",
                  textAlign: "center", transition: "all 0.2s", fontFamily: "inherit",
                  opacity: isLocked ? 0.4 : 1,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isLocked ? "#94a3b8" : color, marginBottom: 6 }}>{z} 존</div>
                  <div style={{ fontSize: 22 }}>{isLocked ? "🔒" : done ? "✅" : "⬜"}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isLocked ? "#94a3b8" : done ? color : S.textSub, marginTop: 5 }}>
                    {isLocked ? "미운영" : done ? "완료" : "미완료"}
                  </div>
                </button>
              );
            });
          })()}
        </div>
      </div>

      {/* 전체 요약 */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 16, padding: 16, boxShadow: S.shadow }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>전체 요약</div>
          <div style={{ display: "flex", gap: 4 }}>
            {["당일", "일반", "원박스"].map(c => (
              <button key={c} onClick={() => toggleCat(c)} style={{
                fontSize: 10, fontWeight: 800, padding: "4px 8px", borderRadius: 8, cursor: "pointer",
                background: enabledCats[c] ? (c==="당일"?"#dc2626":c==="일반"?"#059669":"#ea580c") : "#f8fafc",
                border: `1px solid ${c==="당일"?"#dc2626":c==="일반"?"#059669":"#ea580c"}`,
                color: enabledCats[c] ? "#fff" : "#94a3b8",
                fontFamily: "inherit", transition: "all 0.15s"
              }}>
                {c} {enabledCats[c] ? "ON" : "OFF"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
          {TYPES.map(t => DAYS.map(dy => {
            const gs = grandStats[t][dy];
            return (
              <div key={`${t}-${dy}`} style={{
                background: S.inputBg,
                border: `1px solid ${activeType===t&&activeDay===dy ? TYPE_COLORS[t] : S.border}`,
                borderRadius: 10, padding: "8px 6px", textAlign: "center"
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 3 }}>
                  <span style={{ color: TYPE_COLORS[t] }}>{t}</span>
                  <br />
                  <span style={{ color: DAY_COLORS[dy] }}>{dy}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: S.text }}>{gs.pct}%</div>
                <div style={{ fontSize: 10, color: S.textSub }}>{gs.done}/{gs.total}</div>
                <div style={{ height: 3, background: "#e2e8f0", borderRadius: 2, marginTop: 4 }}>
                  <div style={{ height: 3, borderRadius: 2, background: TYPE_COLORS[t], width: `${gs.pct}%`, transition: "width 0.4s" }} />
                </div>
              </div>
            );
          }))}
        </div>
        <div style={{ background: S.inputBg, borderRadius: 10, padding: "12px 14px", marginBottom: 10, fontSize: 12, lineHeight: 1.8, color: S.textSub, fontFamily: "monospace", whiteSpace: "pre-wrap", border: `1px solid ${S.border}` }}>
          {getSummaryText()}
        </div>
        <button onClick={() => { navigator.clipboard.writeText(getSummaryText()).then(() => setCopied(true)); setTimeout(() => setCopied(false), 2000); }}
          style={{ width: "100%", background: copied ? "#059669" : "linear-gradient(135deg,#7c3aed,#0891b2,#ea580c)", border: "none", borderRadius: 8, padding: "10px 0", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
          {copied ? "✓ 복사됨!" : "📤 현황 공유"}
        </button>
      </div>

      <button onClick={resetAll} style={{ width: "100%", background: resetConfirm ? "#fee2e2" : S.card, border: `1px solid ${resetConfirm ? "#dc2626" : "#fecaca"}`, borderRadius: 12, padding: "12px 0", cursor: "pointer", color: "#dc2626", fontSize: 13, fontWeight: 700, marginTop: 16, boxShadow: S.shadow, fontFamily: "inherit" }}>
        {resetConfirm ? "한 번 더 탭하면 초기화됩니다" : "🔄 전체 초기화"}
      </button>
    </div>
  );
}
