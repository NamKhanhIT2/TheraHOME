const { Icon, Button } = window.TheraHOMEDesignSystem_787051;

function BrandMark({ size = 56, color = 'var(--color-primary)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M8 30 L32 10 L56 30" stroke={color} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 27 V54 H50 V27" stroke={color} strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M32 19 C25 25 25 35 32 42 C39 35 39 25 32 19 Z" fill={color} />
      <path d="M9 53 Q20.5 47 32 53 Q43.5 59 55 53" stroke={color} strokeWidth="4.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
Object.assign(window, { BrandMark });

function BackBar({ onBack, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '62px 20px 4px', gap: 12 }}>
      <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', background: 'var(--bg-card-alt)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
        <IconX name="chevron-left" size={20} color="var(--text-primary)" />
      </button>
      {title && <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 'var(--text-h2-weight)', color: 'var(--text-primary)' }}>{title}</div>}
    </div>
  );
}

function BottomNav({ active, onChange }) {
  const items = [['home', 'home', 'Trang chủ'], ['roadmap', 'calendar', 'Lộ trình'], ['store', 'shopping-bag', 'Cửa hàng'], ['community', 'message-circle', 'Cộng đồng']];
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', background: '#fff', borderTop: '1px solid var(--border-light)', boxShadow: 'var(--shadow-nav)', paddingBottom: 'env(safe-area-inset-bottom)', borderBottomLeftRadius: 48, borderBottomRightRadius: 48, zIndex: 30 }}>
      <div style={{ height: 76, display: 'flex', alignItems: 'center' }}>
        {items.map(([id, icon, label]) => (
          <button key={id} onClick={() => onChange(id)} style={{ flex: 1, height: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <IconX name={icon} size={23} color={active === id ? 'var(--color-primary)' : 'var(--text-muted)'} />
            <span style={{ fontSize: 11, fontWeight: 600, color: active === id ? 'var(--color-primary)' : 'var(--text-muted)' }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PathNode({ day, onClick }) {
  const isDone = day.status === 'done', isCurrent = day.status === 'current', isLocked = day.status === 'locked';
  if (day.type === 'rest') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 0', opacity: 0.6, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 19, top: -9, bottom: -9, width: 2, background: 'var(--border-light)', zIndex: 0 }} />
        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-full)', background: 'var(--bg-card-alt)', border: '2px dashed var(--border-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', zIndex: 1 }}>
          <IconX name="moon" size={15} color="var(--text-muted)" />
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-body-strong-size)', fontWeight: 'var(--text-body-strong-weight)', color: 'var(--text-secondary)' }}>Ngày {day.id}</div>
          <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>Ngày nghỉ · cách ly</div>
        </div>
      </div>
    );
  }
  const circleBg = isDone ? 'var(--success)' : isCurrent ? 'var(--color-primary)' : 'var(--bg-card)';
  const circleBorder = isDone ? 'var(--success)' : isCurrent ? 'var(--color-primary)' : 'var(--border-input)';
  return (
    <div onClick={() => !isLocked && onClick(day.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 0', cursor: isLocked ? 'default' : 'pointer', opacity: isLocked ? 0.55 : 1, position: 'relative' }}>
      <div style={{ position: 'absolute', left: 19, top: -9, bottom: -9, width: 2, background: 'var(--border-light)', zIndex: 0 }} />
      <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-full)', background: circleBg, border: '2px solid ' + circleBorder, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', zIndex: 1, boxShadow: isCurrent ? '0 0 0 5px var(--color-primary-tint-10)' : 'none' }}>
        {isDone ? <Icon name="check" size={17} color="#fff" /> : isLocked ? <IconX name="lock" size={15} color="var(--text-muted)" /> : <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{day.id}</span>}
      </div>
      <div>
        <div style={{ fontSize: 'var(--text-body-strong-size)', fontWeight: 'var(--text-body-strong-weight)', color: 'var(--text-primary)' }}>Ngày {day.id}</div>
        <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)' }}>{isDone ? 'Đã hoàn thành · 100%' : isCurrent ? 'Hôm nay' : 'Chưa mở khóa'}</div>
      </div>
    </div>
  );
}

Object.assign(window, { BackBar, BottomNav, PathNode });

function WaterCard({ value, goal, onChange }) {
  const pct = Math.min(100, Math.round((value / goal) * 100));
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconX name="droplet" size={20} color="var(--color-primary)" />
          <span style={{ fontSize: 'var(--text-h2-size)', fontWeight: 'var(--text-h2-weight)', color: 'var(--text-primary)' }}>Uống nước</span>
        </div>
        <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>Mục tiêu {goal} cốc</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26, margin: '22px 0 6px' }}>
        <button onClick={() => onChange(Math.max(0, value - 1))} style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-card-alt)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <IconX name="minus" size={20} color="var(--text-secondary)" />
        </button>
        <div style={{ width: 110, height: 110, borderRadius: '50%', background: 'conic-gradient(var(--color-primary) ' + pct + '%, var(--border-light) 0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 90, height: 90, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <IconX name="droplet" size={16} color="var(--color-primary)" />
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>/{goal} cốc</div>
          </div>
        </div>
        <button onClick={() => onChange(Math.min(goal + 4, value + 1))} style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-primary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Icon name="plus" size={20} color="#fff" />
        </button>
      </div>
      <div style={{ textAlign: 'center', fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', fontStyle: 'italic' }}>* Đừng quên nước rất tốt cho đĩa đệm</div>
    </div>
  );
}

function PersonalizationCard({ totalDays }) {
  return (
    <div style={{ background: 'var(--bg-card-alt)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconX name="lock" size={19} color="var(--text-muted)" />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.4px', color: 'var(--color-primary)', textTransform: 'uppercase' }}>Cá nhân hóa</div>
          <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 'var(--text-h2-weight)', color: 'var(--text-primary)', marginTop: 2 }}>Cá nhân hoá lộ trình hôm nay</div>
          <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 4 }}>Mở khóa vào ngày {totalDays + 1} sau khi hoàn thành ngày {totalDays}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.4px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Đang khóa</span>
        <IconX name="lock" size={16} color="var(--text-muted)" />
      </div>
    </div>
  );
}

Object.assign(window, { WaterCard, PersonalizationCard });

function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = 'M ' + pts[0][0] + ' ' + pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ' C ' + c1x + ' ' + c1y + ', ' + c2x + ' ' + c2y + ', ' + p2[0] + ' ' + p2[1];
  }
  return d;
}

function painColor(v) {
  if (v <= 3) return '#2BE98C';
  if (v <= 7) return '#FFDD31';
  return '#FF9F0A';
}

function RangeDropdown({ value, onChange, options }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-family)', fontSize: 'var(--text-caption-size)', fontWeight: 600, color: 'var(--color-primary)' }}>
        {value} ngày
        <IconX name="chevron-down" size={14} color="var(--color-primary)" />
      </button>
      {open && (
        <React.Fragment>
          <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', zIndex: 40, minWidth: 96 }}>
            {options.map(o => (
              <button key={o} onClick={() => { onChange(o); setOpen(false); }} style={{ display: 'block', width: '100%', padding: '10px 14px', background: o === value ? 'var(--bg-card-alt)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-family)', fontSize: 13, color: 'var(--text-primary)' }}>{o} ngày</button>
            ))}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function PainChart({ data }) {
  const [range, setRange] = React.useState(7);
  const total = data.length;
  const windowSize = Math.min(range, total);
  const start = total - windowSize;
  const windowData = data.slice(start);
  const labels = windowData.map((_, i) => 'N' + (start + i + 1));
  const scrollable = windowSize > 7;
  const H = 130, pad = 8;
  const max = 10;
  const step = scrollable ? 32 : (300 - pad * 2) / Math.max(windowData.length - 1, 1);
  const W = scrollable ? pad * 2 + step * (windowData.length - 1) : 300;
  const pts = windowData.map((v, i) => [pad + i * step, pad + (1 - v / max) * (H - pad * 2)]);
  const linePath = smoothPath(pts);
  const areaPath = linePath + ' L ' + pts[pts.length - 1][0] + ' ' + (H - pad) + ' L ' + pts[0][0] + ' ' + (H - pad) + ' Z';
  const scrollRef = React.useRef(null);
  React.useEffect(() => { if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth; }, [windowData.length, W, range]);
  const svg = (
    <svg viewBox={'0 0 ' + W + ' ' + H} width={scrollable ? W : undefined} style={{ width: scrollable ? W : '100%', height: 150, overflow: 'visible', flexShrink: 0, display: 'block' }}>
      <defs>
        <linearGradient id="painVGrad" x1="0" y1="0" x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF9F0A" />
          <stop offset="50%" stopColor="#FFDD31" />
          <stop offset="100%" stopColor="#2BE98C" />
        </linearGradient>
        <linearGradient id="painAreaGrad" x1="0" y1="0" x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF9F0A" stopOpacity="0.22" />
          <stop offset="50%" stopColor="#FFDD31" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#2BE98C" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      {[0, 2, 4, 6, 8, 10].map(g => {
        const y = pad + (1 - g / max) * (H - pad * 2);
        return <line key={g} x1={pad} x2={W - pad} y1={y} y2={y} stroke="var(--border-light)" strokeWidth="1" strokeDasharray="3,3" />;
      })}
      <path d={areaPath} fill="url(#painAreaGrad)" stroke="none" />
      <path d={linePath} fill="none" stroke="url(#painVGrad)" strokeWidth="3" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="5" fill="#fff" stroke={painColor(windowData[i])} strokeWidth="3" />
          <text x={p[0]} y={p[1] - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill={painColor(windowData[i])} fontFamily="var(--font-family)">{windowData[i]}</text>
        </g>
      ))}
    </svg>
  );
  const axisLabels = (
    <div style={{ display: 'flex', gap: 4, marginTop: -4, width: scrollable ? W : '100%', flexShrink: 0 }}>
      {labels.map((l, i) => <span key={i} style={{ width: scrollable ? step : undefined, flex: scrollable ? 'none' : 1, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>{l}</span>)}
    </div>
  );
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 'var(--text-h2-size)', fontWeight: 'var(--text-h2-weight)', color: 'var(--text-primary)' }}>Biểu đồ sức khoẻ</span>
        <RangeDropdown value={range} onChange={setRange} options={[7, 14]} />
      </div>
      <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', marginBottom: 10 }}>Thang điểm 0–10 · {windowSize} ngày{scrollable ? ' · Vuốt để xem toàn bộ' : ''}</div>
      {scrollable ? (
        <div style={{ position: 'relative' }}>
          <div ref={scrollRef} style={{ overflowX: 'auto' }}>
            {svg}
            {axisLabels}
          </div>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 20, width: 20, background: 'linear-gradient(90deg, var(--bg-card), transparent)', pointerEvents: 'none' }} />
        </div>
      ) : (
        <React.Fragment>
          <div style={{ position: 'relative' }}>{svg}</div>
          {axisLabels}
        </React.Fragment>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#2BE98C' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nhẹ (0–3)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#FFDD31' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Vừa (4–7)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#FF9F0A' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Khó chịu (8–10)</span>
        </div>
        <div style={{ flex: 1 }} />
      </div>
      <div style={{ textAlign: 'left', fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--color-primary)', marginTop: 12 }}>Bạn làm tốt lắm!</div>
    </div>
  );
}

function AssistantBubble({ onOpenAIChat, onOpenSupportChat }) {
  const size = 60;
  const [open, setOpen] = React.useState(false);
  return (
    <React.Fragment>
      <button onClick={() => setOpen(true)} style={{ position: 'absolute', right: 16, bottom: 96, width: size, height: size, borderRadius: 'var(--radius-full)', border: '3px solid #fff', boxShadow: 'var(--shadow-fab)', padding: 0, background: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconX name="message-circle" size={26} color="#fff" />
        <div style={{ position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: '#2BE98C', border: '2px solid #fff' }} />
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(20,24,34,0.45)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', width: '100%' }}>
            <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 'var(--text-h2-weight)', color: 'var(--text-primary)', marginBottom: 14 }}>Bạn muốn trò chuyện với ai?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => { setOpen(false); onOpenAIChat(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card-alt)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-family)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconX name="sparkles" size={18} color="#fff" /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Trợ lý AI TheraHOME</div>
                  <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>Trả lời tức thì, mọi lúc</div>
                </div>
                <IconX name="chevron-right" size={16} color="var(--text-muted)" />
              </button>
              <button onClick={() => { setOpen(false); onOpenSupportChat(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card-alt)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-family)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-full)', background: '#14161F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconX name="heart" size={17} color="#fff" /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Chuyên gia TheraHOME</div>
                  <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />Đang hoạt động</div>
                </div>
                <IconX name="chevron-right" size={16} color="var(--text-muted)" />
              </button>
            </div>
            <button onClick={() => setOpen(false)} style={{ width: '100%', marginTop: 14, border: 'none', background: 'none', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 0' }}>Hủy</button>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

function MoodFace({ value, size = 84 }) {
  const color = painColor(value);
  const band = value <= 3 ? 'low' : value <= 7 ? 'mid' : 'high';
  const t = 1 - (value / 10) * 2;
  const curve = t * 9;
  let mouthPath, leftEye, rightEye, leftBrow, rightBrow;
  if (band === 'low') {
    mouthPath = 'M24,42 Q36,' + (42 + curve) + ' 48,42';
    leftEye = <circle cx="27" cy="29" r="3.2" fill={color} />;
    rightEye = <circle cx="45" cy="29" r="3.2" fill={color} />;
    leftBrow = <path d="M22,21 Q26,18 31,20" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />;
    rightBrow = <path d="M41,20 Q46,18 50,21" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />;
  } else if (band === 'mid') {
    mouthPath = 'M24,44 Q36,' + (44 + curve) + ' 48,44';
    leftEye = <circle cx="27" cy="29" r="3" fill={color} />;
    rightEye = <circle cx="45" cy="29" r="3" fill={color} />;
    leftBrow = <path d="M22,21 L31,22" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />;
    rightBrow = <path d="M41,22 L50,21" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />;
  } else {
    mouthPath = 'M23,46 L28,50 L33,46 L38,50 L43,46 L48,50';
    leftEye = <path d="M23,29 Q27,25 31,29" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />;
    rightEye = <path d="M41,29 Q45,25 49,29" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />;
    leftBrow = <path d="M21,18 L31,23" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />;
    rightBrow = <path d="M51,18 L41,23" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 72 72">
      <circle cx="36" cy="36" r="34" fill={color} opacity="0.16" />
      <circle cx="36" cy="36" r="27" fill="none" stroke={color} strokeWidth="3" />
      {leftBrow}{rightBrow}{leftEye}{rightEye}
      <path d={mouthPath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function moodLabel(v) {
  if (v === 0) return 'Không khó chịu';
  if (v <= 3) return 'Khó chịu nhẹ';
  if (v <= 7) return 'Khó chịu vừa';
  return 'Khó chịu nhiều';
}

function PainScaleModal({ dayId, onConfirm, onCancel }) {
  const [value, setValue] = React.useState(3);
  const color = painColor(value);
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,24,34,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', width: '100%', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 'var(--text-h2-weight)', color: 'var(--text-primary)' }}>Ngày {dayId} · Mức độ khó chịu hôm nay</div>
        <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 4, marginBottom: 18 }}>Vuốt sang phải nếu bạn đang khó chịu nhiều hơn</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <MoodFace value={value} />
          <div style={{ fontSize: 'var(--text-h1-size)', fontWeight: 700, color }}>{value}</div>
          <div style={{ fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>{moodLabel(value)}</div>
        </div>
        <div style={{ marginTop: 20 }}>
          <input
            type="range" min="0" max="10" step="1" value={value}
            onChange={e => setValue(Number(e.target.value))}
            style={{ width: '100%', accentColor: color, height: 6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>0 · Không khó chịu</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>10 · Rất khó chịu</span>
          </div>
        </div>
        <Button style={{ width: '100%', marginTop: 18 }} onClick={() => onConfirm(value)}>Tiếp tục</Button>
      </div>
    </div>
  );
}

function ExternalLinkModal({ url, onClose }) {
  const host = url.replace(/^https?:\/\//, '').split('/')[0];
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,24,34,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', width: '100%', maxWidth: 340, boxShadow: 'var(--shadow-card)', textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-full)', background: 'var(--bg-card-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <IconX name="external-link" size={20} color="var(--text-secondary)" />
        </div>
        <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 'var(--text-h2-weight)', color: 'var(--text-primary)' }}>Rời khỏi TheraHOME?</div>
        <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 6 }}>Bạn sẽ được chuyển đến <strong>{host}</strong> trong trình duyệt để tiếp tục.</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'var(--bg-card-alt)', color: 'var(--text-primary)', border: 'none', borderRadius: 'var(--radius-md)', padding: '11px 0', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Hủy</button>
          <a href={url} target="_blank" rel="noopener" onClick={onClose} style={{ flex: 1, textAlign: 'center', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-md)', padding: '11px 0', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Tiếp tục</a>
        </div>
      </div>
    </div>
  );
}

function ShareStoryModal({ onClose, onSupport, onShare }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,24,34,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', width: '100%', boxShadow: 'var(--shadow-card)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: 'var(--radius-full)', background: 'var(--bg-card-alt)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <IconX name="x" size={14} color="var(--text-secondary)" />
        </button>
        <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 'var(--text-h2-weight)', color: 'var(--text-primary)', marginBottom: 8, paddingRight: 30 }}>Chia sẻ với cộng đồng</div>
        <div style={{ fontSize: 'var(--text-body-size)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Nếu bạn thấy hài lòng với lộ trình hiện tại thì bạn có thể chia sẻ câu chuyện cá nhân của mình để lan toả đến mọi người, còn nếu bạn chưa hài lòng bạn có thể liên hệ trực tiếp với chúng tôi để được hỗ trợ và tinh chỉnh thêm.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          <button onClick={onSupport} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-card-alt)', color: 'var(--text-primary)', border: 'none', borderRadius: 'var(--radius-md)', padding: 14, fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Tôi muốn hỗ trợ thêm</button>
          <Button style={{ width: '100%' }} onClick={onShare}>Chia sẻ</Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PainChart, AssistantBubble, PainScaleModal, ExternalLinkModal, ShareStoryModal, NotificationPermissionModal });

function NotificationPermissionModal({ onAllow, onDeny }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,24,34,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 55, padding: 32 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', width: '100%', overflow: 'hidden', textAlign: 'center' }}>
        <div style={{ padding: '24px 22px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><BrandMark size={36} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>Cho phép "TheraHOME" gửi thông báo?</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>Thông báo nhắc bạn tập đúng giờ mỗi ngày và cập nhật tiến trình lộ trình phục hồi.</div>
        </div>
        <div style={{ display: 'flex', borderTop: '1px solid var(--divider)' }}>
          <button onClick={onDeny} style={{ flex: 1, background: 'none', border: 'none', borderRight: '1px solid var(--divider)', padding: '14px 0', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 15, color: 'var(--text-secondary)', cursor: 'pointer' }}>Không cho phép</button>
          <button onClick={onAllow} style={{ flex: 1, background: 'none', border: 'none', padding: '14px 0', fontFamily: 'var(--font-family)', fontWeight: 700, fontSize: 15, color: 'var(--color-primary)', cursor: 'pointer' }}>Cho phép</button>
        </div>
      </div>
    </div>
  );
}
