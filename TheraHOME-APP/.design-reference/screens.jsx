const { Icon, Button, ListItem, FormField } = window.TheraHOMEDesignSystem_787051;
const D = window.APP_DATA;

function AvatarImg({ size = 44, editable = false }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div style={{ width: size, height: size, borderRadius: 'var(--radius-full)', background: 'var(--bg-card-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="user" size={size * 0.5} color="var(--text-muted)" />
      </div>
      {editable && (
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: size * 0.32, height: size * 0.32, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-card)' }}>
          <Icon name="pencil" size={size * 0.15} color="#fff" />
        </div>
      )}
    </div>
  );
}

function ProgressDots({ total, current }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '20px 20px 0' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 4, borderRadius: 'var(--radius-full)', background: i <= current ? 'var(--color-primary)' : 'var(--border-light)' }} />
      ))}
    </div>
  );
}

function IntakeWelcome({ onNext }) {
  const [legalDoc, setLegalDoc] = React.useState(null);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 26, padding: '0 32px', background: 'radial-gradient(circle at 50% 20%, var(--color-primary-tint-10), var(--bg-app) 62%)' }}>
      <BrandMark size={64} />
      <div>
        <div style={{ fontSize: 'var(--text-display-size)', fontWeight: 'var(--text-display-weight)', color: 'var(--text-primary)' }}>TheraHOME</div>
        <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 600, color: 'var(--color-primary)', marginTop: 6 }}>Lộ trình dành riêng cho bạn</div>
        <div style={{ fontSize: 'var(--text-body-size)', color: 'var(--text-secondary)', marginTop: 10 }}>Trả lời vài câu hỏi để chúng tôi thiết kế lộ trình phục hồi riêng cho bạn</div>
      </div>
      <Button style={{ width: '100%' }} onClick={onNext}>Bắt đầu</Button>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>Bằng việc tiếp tục, bạn đồng ý với <span onClick={() => setLegalDoc('terms')} style={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}>Điều khoản sử dụng</span> và <span onClick={() => setLegalDoc('privacy')} style={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}>Chính sách quyền riêng tư</span></div>
      {legalDoc && <LegalOverlay docKey={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
  );
}

function QuestionScreen({ q, index, total, selected, onSelect, onNext, onBack }) {
  const isMulti = !!q.multi;
  const list = isMulti ? (selected || []) : selected;
  const canContinue = isMulti ? list.length > 0 : !!list;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <BackBar onBack={onBack} />
      <ProgressDots total={total} current={index} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 20px' }}>
        <div style={{ fontSize: 'var(--text-h1-size)', fontWeight: 'var(--text-h1-weight)', color: 'var(--text-primary)', marginBottom: 6 }}>{q.title}</div>
        {q.subtitle && <div style={{ fontSize: 'var(--text-body-size)', color: 'var(--text-secondary)', marginBottom: 22 }}>{q.subtitle}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: q.subtitle ? 0 : 22 }}>
          {q.options.map(opt => {
            const active = isMulti ? list.includes(opt) : list === opt;
            return (
              <button key={opt} onClick={() => onSelect(opt)} style={{ textAlign: 'left', width: '100%', border: active ? '2px solid var(--color-primary)' : '1px solid var(--border-input)', background: active ? 'var(--color-primary-tint-10)' : 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '15px 16px', fontFamily: 'var(--font-family)', fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: active ? 'var(--color-primary)' : 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {opt}
                {isMulti ? <IconX name={active ? 'check-square' : 'square'} size={19} color={active ? 'var(--color-primary)' : 'var(--text-muted)'} /> : (active && <Icon name="check" size={18} color="var(--color-primary)" />)}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ padding: 20 }}>
        <Button style={{ width: '100%' }} disabled={!canContinue} onClick={onNext}>Tiếp tục</Button>
      </div>
    </div>
  );
}

function ConsentScreen({ onFinish }) {
  const [legalDoc, setLegalDoc] = React.useState(null);
  return (
    <div style={{ height: '100%', position: 'relative', background: 'radial-gradient(circle at 50% 15%, var(--color-primary-tint-10), var(--bg-app) 60%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-5)', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <BrandMark size={44} />
        </div>
        <div style={{ fontSize: 'var(--text-h1-size)', fontWeight: 'var(--text-h1-weight)', color: 'var(--text-primary)', textAlign: 'center' }}>Trước khi bắt đầu</div>
        <div style={{ fontSize: 'var(--text-body-size)', color: 'var(--text-secondary)', marginTop: 4, textAlign: 'center' }}>Lộ trình của bạn đã sẵn sàng</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--divider)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>Chúng tôi thu thập thông tin sức khỏe bạn cung cấp (mức độ đau, vùng phục hồi) chỉ để cá nhân hóa lộ trình tập, không chia sẻ cho bên thứ ba.</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>TheraHOME là ứng dụng hỗ trợ vận động, không thay thế chẩn đoán hay điều trị y khoa. Vui lòng tham khảo ý kiến bác sĩ trước khi bắt đầu.</div>
        </div>
        <Button style={{ width: '100%', marginTop: 20 }} onClick={onFinish}>Đồng ý và tiếp tục</Button>
        <div onClick={() => setLegalDoc('privacy')} style={{ display: 'block', textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}>Xem chính sách quyền riêng tư</div>
      </div>
      {legalDoc && <LegalOverlay docKey={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
  );
}

function LoginScreen({ onSubmit, onBack }) {
  const [legalDoc, setLegalDoc] = React.useState(null);
  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden', background: 'var(--bg-app)' }}>
      <image-slot id="login-bg-photo" shape="rect" src="uploads/pexels-alin-serban-1867310-19527536.jpg" placeholder="Ảnh nền: người tập thư giãn / phục hồi tại nhà" style={{ position: 'absolute', inset: 0 }}></image-slot>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,14,22,0.15) 0%, rgba(10,14,22,0.35) 55%, rgba(10,14,22,0.82) 100%)' }} />
      <button onClick={onBack} style={{ position: 'absolute', top: 56, left: 20, width: 36, height: 36, borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
        <IconX name="chevron-left" size={20} color="var(--text-primary)" />
      </button>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 28px calc(36px + env(safe-area-inset-bottom))', boxSizing: 'border-box', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 18 }}>
        <BrandMark size={52} color="#ffffff" />
        <div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#fff' }}>TheraHOME</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', opacity: 0.92, marginTop: 4 }}>Lộ trình dành riêng cho bạn</div>
        </div>
        <button onClick={onSubmit} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#fff', border: 'none', borderRadius: 'var(--radius-full)', padding: '15px 0', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 16, color: 'var(--text-primary)', cursor: 'pointer' }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#4285F4', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>G</span>
          Đăng nhập với Google
        </button>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>Bằng cách đăng nhập, bạn đồng ý với <span onClick={() => setLegalDoc('terms')} style={{ color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Điều khoản sử dụng</span> và <span onClick={() => setLegalDoc('security')} style={{ color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Chính sách bảo mật</span></div>
      </div>
      {legalDoc && <LegalOverlay docKey={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
  );
}

function ActivationScreen({ onContinue, onBack }) {
  const [mode, setMode] = React.useState('order');
  const [code, setCode] = React.useState('');
  const [contact, setContact] = React.useState('');
  const [scanning, setScanning] = React.useState(false);
  const [orderError, setOrderError] = React.useState('');
  function scan() {
    setScanning(true);
    setTimeout(onContinue, 900);
  }
  function confirmOrder() {
    if (!contact.trim()) return;
    setOrderError('');
    onContinue();
  }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <BackBar onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 40px', display: 'flex', alignItems: 'center' }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-5)', width: '100%' }}>
          <div style={{ fontSize: 'var(--text-h1-size)', fontWeight: 'var(--text-h1-weight)', color: 'var(--text-primary)' }}>Kích hoạt thiết bị Thera</div>
          <div style={{ fontSize: 'var(--text-body-size)', color: 'var(--text-secondary)', marginTop: 6 }}>Nhập số điện thoại hoặc email theo đơn hàng bạn đã đặt trên website TheraHOME.</div>
          {mode === 'order' && (
            <React.Fragment>
              <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Số điện thoại hoặc email đặt hàng" autoFocus style={{ width: '100%', boxSizing: 'border-box', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)', fontFamily: 'var(--font-family)', fontSize: 16, background: 'var(--bg-card)', marginTop: 20 }} />
              {orderError && <div style={{ color: 'var(--error)', fontSize: 12.5, marginTop: 8 }}>{orderError}</div>}
              <Button style={{ width: '100%', marginTop: 16 }} disabled={!contact.trim()} onClick={confirmOrder}>Xác nhận</Button>
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13.5, color: 'var(--text-secondary)' }}>
                Chưa đặt hàng? <a href={window.APP_DATA.landingPage} target="_blank" rel="noopener" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Xem trên website TheraHOME</a>
              </div>
            </React.Fragment>
          )}
          {mode === 'manual' && (
            <React.Fragment>
              <div style={{ background: 'var(--bg-card-alt)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
                Mã kích hoạt kèm theo ở trong hộp sản phẩm. Nếu bạn không thấy, vui lòng nhắn tin Zalo: <strong style={{ color: 'var(--text-primary)' }}>0364263552</strong>
              </div>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="Nhập mã kích hoạt" autoFocus style={{ width: '100%', boxSizing: 'border-box', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)', fontFamily: 'var(--font-family)', fontSize: 16, background: 'var(--bg-card)', marginTop: 16, textAlign: 'center', letterSpacing: '2px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
                <Button style={{ width: '100%' }} disabled={!code.trim()} onClick={onContinue}>Xác nhận</Button>
                <button onClick={() => setMode('order')} style={{ width: '100%', background: 'none', border: 'none', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 0' }}>Quay lại</button>
              </div>
            </React.Fragment>
          )}
        </div>
      </div>
    </div>
  );
}

function HomeScreen({ onGoToday, onSeeRoadmap, onSeeBlog, onOpenProfile, onOpenNotifications, unreadCount, darkMode, onToggleDark, water, onWaterChange, productPainLevels, waterGoal }) {
  const u = D.user;
  const today = D.products[0].days.find(d => d.id === u.currentDay);
  const [chartProductId, setChartProductId] = React.useState(D.products[0].id);
  const chartProduct = D.products.find(p => p.id === chartProductId);
  const chartData = productPainLevels[chartProductId] || chartProduct.painLevels;
  const [pendingUrl, setPendingUrl] = React.useState(null);
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg-app)', padding: '0 20px calc(100px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '60px 0 4px' }}>
        <div style={{ fontSize: 'var(--text-display-size)', fontWeight: 'var(--text-display-weight)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Chào, {u.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button onClick={onOpenNotifications} style={{ position: 'relative', width: 36, height: 36, borderRadius: 'var(--radius-full)', background: 'var(--bg-card-alt)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IconX name="bell" size={18} color="var(--text-primary)" />
            {unreadCount > 0 && <span style={{ position: 'absolute', top: 6, right: 7, width: 8, height: 8, borderRadius: '50%', background: 'var(--error)', border: '1.5px solid var(--bg-card-alt)' }} />}
          </button>
          <button onClick={onOpenProfile} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: 'var(--radius-full)' }}>
            <AvatarImg size={44} />
          </button>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <ProductDropdown product={chartProduct} products={D.products} onSelect={setChartProductId} />
        <div style={{ marginTop: 8 }}><PainChart data={chartData} /></div>
      </div>
      <div style={{ marginTop: 20, background: 'var(--color-primary)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', color: '#fff' }}>
        <div style={{ fontSize: 'var(--text-caption-size)', opacity: 0.85 }}>Lộ trình {D.products[0].totalDays} ngày · {D.products[0].name}</div>
        <div style={{ fontSize: 'var(--text-h1-size)', fontWeight: 700, margin: '4px 0 14px' }}>Hôm nay là Ngày {today.id} — {today.phase}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={D.introVideo} target="_blank" rel="noopener" style={{ flex: 1, whiteSpace: 'nowrap', textAlign: 'center', color: '#fff', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 'var(--radius-md)', padding: '12px 10px', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Hướng dẫn nhanh</a>
          <button onClick={onGoToday} style={{ flex: 1, whiteSpace: 'nowrap', background: '#fff', color: 'var(--color-primary)', border: 'none', borderRadius: 'var(--radius-md)', padding: '12px 10px', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Bắt đầu hôm nay</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
      </div>
      <WaterCard value={water} goal={waterGoal || u.waterGoal} onChange={onWaterChange} />
      <div onClick={onSeeRoadmap} style={{ marginTop: 16, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', boxShadow: 'var(--shadow-card)', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 'var(--text-h2-weight)', color: 'var(--text-primary)' }}>Lộ trình phục hồi</div>
          <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--color-primary)', fontWeight: 600 }}>Xem tất cả</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {D.products[0].days.map(d => (
            <div key={d.id} style={{ width: 8, height: 8, borderRadius: '50%', background: d.status === 'locked' ? 'var(--border-light)' : (d.status === 'current' ? 'var(--color-primary)' : 'var(--success)') }} />
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 'var(--text-h2-weight)', color: 'var(--text-primary)' }}>Bài viết từ TheraHOME</div>
          <button onClick={onSeeBlog} style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'var(--font-family)', fontSize: 'var(--text-caption-size)', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer' }}>Xem tất cả</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {D.articles.slice(0, 3).map((a, i) => (
            <div key={i} onClick={() => setPendingUrl(D.landingPage)} style={{ cursor: 'pointer', padding: i === 0 ? '0 0 12px' : '12px 0', borderBottom: i < 2 ? '1px solid var(--divider)' : 'none' }}>
              <div style={{ display: 'inline-block', background: 'var(--color-primary-tint-10)', color: 'var(--color-primary-dark)', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-sm)', marginBottom: 4 }}>{a.tag}</div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-body-strong-size)', color: 'var(--text-primary)' }}>{a.title}</div>
              <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', marginTop: 4 }}>{a.readTime}</div>
            </div>
          ))}
        </div>
      </div>
      {pendingUrl && <ExternalLinkModal url={pendingUrl} onClose={() => setPendingUrl(null)} />}
    </div>
  );
}

function NotificationInboxScreen({ notifications, onBack, onRead, onOpenDay }) {
  const [pendingUrl, setPendingUrl] = React.useState(null);
  const groups = [['schedule', 'Lịch tập'], ['ad', 'Ưu đãi'], ['blog', 'Bài viết']];
  const typeStyle = {
    schedule: { icon: 'calendar', color: 'var(--color-primary)', bg: 'var(--color-primary-tint-10)' },
    ad: { icon: 'megaphone', color: '#FF9F0A', bg: 'rgba(255,159,10,0.12)' },
    blog: { icon: 'book', color: '#2BB673', bg: 'rgba(43,182,115,0.12)' }
  };
  function handleTap(n) {
    onRead(n.id);
    if (n.type === 'schedule' && n.dayId) onOpenDay(n.dayId, n.productId);
    else if (n.type === 'ad' || n.type === 'blog') setPendingUrl(D.landingPage);
  }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <BackBar onBack={onBack} title="Thông báo" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 40px' }}>
        {notifications.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, marginTop: 60 }}>Không có thông báo mới</div>
        )}
        {groups.map(([key, label]) => {
          const items = notifications.filter(n => n.type === key);
          if (!items.length) return null;
          const s = typeStyle[key];
          return (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.4px', margin: '14px 0 8px' }}>{label}</div>
              <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
                {items.map((n, i) => (
                  <div key={n.id} onClick={() => handleTap(n)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderBottom: i < items.length - 1 ? '1px solid var(--divider)' : 'none', cursor: 'pointer', background: n.read ? 'none' : 'var(--color-primary-tint-10)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <IconX name={s.icon} size={17} color={s.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{n.title}</div>
                        {!n.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{n.body}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {pendingUrl && <ExternalLinkModal url={pendingUrl} onClose={() => setPendingUrl(null)} />}
    </div>
  );
}

function ProductDropdown({ product, products, onSelect }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-md)', padding: '10px 14px', cursor: 'pointer', width: '100%' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: product.accent, flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left', fontFamily: 'var(--font-family)', fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>{product.name}</span>
        <IconX name="chevron-down" size={18} color="var(--text-secondary)" />
      </button>
      {open && (
        <React.Fragment>
          <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', zIndex: 40 }}>
            {products.map(p => (
              <button key={p.id} onClick={() => { onSelect(p.id); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', background: p.id === product.id ? 'var(--bg-card-alt)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.accent, flexShrink: 0 }} />
                <span style={{ flex: 1, fontFamily: 'var(--font-family)', fontSize: 'var(--text-body-size)', color: 'var(--text-primary)' }}>{p.name}</span>
                {p.id === product.id && <Icon name="check" size={16} color={p.accent} />}
              </button>
            ))}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function RoadmapScreen({ onOpenDay }) {
  let lastPhase = null;
  const [productId, setProductId] = React.useState(D.products[0].id);
  const product = D.products.find(p => p.id === productId);
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg-app)', padding: '0 20px calc(100px + env(safe-area-inset-bottom))', boxSizing: 'border-box', position: 'relative' }}>
      <div style={{ padding: '60px 0 4px' }}>
        <div style={{ fontSize: 'var(--text-display-size)', fontWeight: 'var(--text-display-weight)', color: 'var(--text-primary)' }}>Lộ trình phục hồi</div>
        <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 2 }}>Chọn sản phẩm để xem lộ trình tương ứng</div>
      </div>
      <div style={{ marginTop: 12 }}>
        <ProductDropdown product={product} products={D.products} onSelect={setProductId} />
      </div>
      <div style={{ marginTop: 8 }}>
        {product.days.map(d => {
          const showPhase = d.phase !== lastPhase; lastPhase = d.phase;
          return (
            <React.Fragment key={d.id}>
              {showPhase && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.4px', padding: '18px 0 8px' }}>{d.phase}</div>}
              <PathNode day={d} onClick={id => onOpenDay(id, productId, d.status)} />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function DayDetailScreen({ dayId, productId, onBack }) {
  const product = (productId && D.products.find(p => p.id === productId)) || D.products[0];
  const d = product.days.find(x => x.id === dayId);
  const locked = d.status === 'locked';
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <BackBar onBack={onBack} title={'Ngày ' + d.id} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 40px' }}>
        <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginBottom: 16 }}>{d.phase}</div>
        <div style={{ height: 200, borderRadius: 'var(--radius-lg)', background: 'var(--bg-card-alt)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20, position: 'relative' }}>
          {locked ? (
            <React.Fragment>
              <IconX name="lock" size={28} color="var(--text-muted)" />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chưa mở khóa</span>
            </React.Fragment>
          ) : (
            <a href={d.video} target="_blank" rel="noopener" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconX name="play" size={22} color="#fff" />
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Xem video hướng dẫn Ngày {d.id}</span>
            </a>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <a href={locked ? undefined : d.video} target="_blank" rel="noopener" style={{ opacity: locked ? 0.5 : 1, pointerEvents: locked ? 'none' : 'auto', textDecoration: 'none', width: '100%', boxSizing: 'border-box', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: 15, fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <IconX name="play" size={18} color="#fff" />Xem video hướng dẫn
          </a>
          <a href={D.landingPage} target="_blank" rel="noopener" style={{ textDecoration: 'none', width: '100%', boxSizing: 'border-box', background: 'var(--bg-card)', color: 'var(--color-primary)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-md)', padding: 15, fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <IconX name="external-link" size={18} color="var(--color-primary)" />Dụng cụ hỗ trợ tập luyện
          </a>
        </div>
      </div>
    </div>
  );
}

function StoreScreen() {
  const [pendingUrl, setPendingUrl] = React.useState(null);
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg-app)', padding: '0 20px calc(100px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
      <div style={{ padding: '60px 0 4px' }}>
        <div style={{ fontSize: 'var(--text-display-size)', fontWeight: 'var(--text-display-weight)', color: 'var(--text-primary)' }}>Cửa hàng</div>
        <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 2 }}>Hệ sinh thái sản phẩm TheraHOME</div>
      </div>
      {D.storeCategories.map(cat => (
        <div key={cat.id} style={{ marginTop: 20 }}>
          <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 'var(--text-h2-weight)', color: 'var(--text-primary)', marginBottom: 10 }}>{cat.title}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cat.items.map(item => (
              <div key={item.id} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', border: '2px solid ' + item.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconX name="activity" size={20} color={item.accent} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                    <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 2 }}>{item.desc}</div>
                    <div style={{ fontSize: 'var(--text-body-strong-size)', fontWeight: 700, color: item.accent, marginTop: 6 }}>{item.price}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {cat.hasTrial && (
                    <button onClick={() => setPendingUrl(D.landingPage)} style={{ flex: 1, textAlign: 'center', border: '1px solid ' + item.accent, color: item.accent, background: 'none', borderRadius: 'var(--radius-md)', padding: '10px 0', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Xem thử</button>
                  )}
                  <button onClick={() => setPendingUrl(D.landingPage)} style={{ flex: 1, textAlign: 'center', background: item.accent, color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 0', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Mua ngay</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => setPendingUrl(D.landingPage)} style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 20, background: 'none', border: 'none', fontSize: 'var(--text-caption-size)', color: 'var(--color-primary)', cursor: 'pointer' }}>Xem tất cả tại therahomeai.com</button>
      {pendingUrl && <ExternalLinkModal url={pendingUrl} onClose={() => setPendingUrl(null)} />}
    </div>
  );
}

function CreatePostScreen({ onClose, onSubmit }) {
  const u = D.user;
  const [text, setText] = React.useState('');
  const [tagPhase, setTagPhase] = React.useState(true);
  const [showImage, setShowImage] = React.useState(false);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '62px 20px 12px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ width: 32 }} />
        <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 'var(--text-h2-weight)', color: 'var(--text-primary)' }}>Tạo bài viết</div>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', background: 'var(--bg-card-alt)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <IconX name="x" size={16} color="var(--text-primary)" />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AvatarImg size={40} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{u.name}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-card-alt)', borderRadius: 'var(--radius-full)', padding: '4px 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Công khai <IconX name="chevron-down" size={12} color="var(--text-secondary)" /></div>
              <button onClick={() => setTagPhase(t => !t)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: tagPhase ? 'var(--color-primary-tint-10)' : 'var(--bg-card-alt)', border: 'none', borderRadius: 'var(--radius-full)', padding: '4px 10px', fontSize: 12, fontWeight: 600, color: tagPhase ? 'var(--color-primary-dark)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-family)' }}>{tagPhase ? 'Gắn Giai đoạn 2' : 'Không gắn giai đoạn'} <IconX name="chevron-down" size={12} color={tagPhase ? 'var(--color-primary-dark)' : 'var(--text-secondary)'} /></button>
            </div>
          </div>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder={u.name + ' ơi, bạn đang nghĩ gì thế?'} style={{ width: '100%', minHeight: 140, border: 'none', outline: 'none', resize: 'none', background: 'none', fontFamily: 'var(--font-family)', fontSize: 20, color: 'var(--text-primary)', marginTop: 16, boxSizing: 'border-box' }} />
        {showImage && <div style={{ height: 160, marginBottom: 12 }}><image-slot id="community-post-image" shape="rounded" radius="12" placeholder="Thêm ảnh cho bài viết"></image-slot></div>}
      </div>
      <div style={{ padding: '0 20px calc(16px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Thêm vào bài viết của bạn</span>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setShowImage(s => !s)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}><IconX name="image" size={20} color="#2BB673" /></button>
            <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}><IconX name="user-plus" size={20} color="var(--color-primary)" /></button>
            <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}><IconX name="smile" size={20} color="#FF9F0A" /></button>
            <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}><IconX name="map-pin" size={20} color="#FF4D4D" /></button>
            <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}><IconX name="more-horizontal" size={20} color="var(--text-secondary)" /></button>
          </div>
        </div>
        <Button style={{ width: '100%', opacity: text.trim() ? 1 : 0.4, pointerEvents: text.trim() ? 'auto' : 'none' }} onClick={() => onSubmit(text.trim(), showImage)}>Tiếp</Button>
      </div>
    </div>
  );
}

function CommentsScreen({ post, onBack, onAddComment, onLikeComment }) {
  const [text, setText] = React.useState('');
  const [replyTo, setReplyTo] = React.useState(null);
  const inputRef = React.useRef(null);
  function startReply(i, name) {
    setReplyTo({ index: i, name });
    setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
  }
  function submit() {
    if (!text.trim()) return;
    onAddComment(text.trim(), replyTo ? replyTo.index : undefined);
    setText('');
    setReplyTo(null);
  }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <BackBar onBack={onBack} title="Bình luận" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px' }}>
        <div style={{ display: 'flex', gap: 10, paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--divider)' }}>
          {post.official ? (
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: '#14161F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconX name="heart" size={16} color="#fff" /></div>
          ) : (
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-full)', background: post.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{post.name.charAt(0)}</div>
          )}
          <div>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{post.name}</span>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{post.text}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {(post.commentsList || []).map((c, i) => (
            <div key={i}>
              <div style={{ display: 'flex', gap: 10 }}>
                {c.official ? (
                  <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-md)', background: '#14161F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconX name="heart" size={14} color="#fff" /></div>
                ) : (
                  <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-full)', background: c.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{c.name.charAt(0)}</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '8px 12px', boxShadow: 'var(--shadow-card)' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>{c.text}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4, marginLeft: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.time}</span>
                    <button onClick={() => onLikeComment(i)} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-family)', fontSize: 11, fontWeight: 700, color: c.likedByMe ? 'var(--error)' : 'var(--text-muted)' }}>
                      <IconX name="heart" size={12} color={c.likedByMe ? 'var(--error)' : 'var(--text-muted)'} />{c.likes > 0 ? c.likes : ''}
                    </button>
                    <button onClick={() => startReply(i, c.name)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-family)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Trả lời</button>
                  </div>
                </div>
              </div>
              {(c.replies || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, marginLeft: 40, paddingLeft: 12, borderLeft: '2px solid var(--border-light)' }}>
                  {c.replies.map((r, j) => (
                    <div key={j} style={{ display: 'flex', gap: 8 }}>
                      {r.official ? (
                        <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', background: '#14161F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconX name="heart" size={11} color="#fff" /></div>
                      ) : (
                        <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-full)', background: r.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10, flexShrink: 0 }}>{r.name.charAt(0)}</div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '7px 10px', boxShadow: 'var(--shadow-card)' }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>{r.name}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginTop: 2 }}>{r.text}</div>
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, marginLeft: 4 }}>{r.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {replyTo && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px', background: 'var(--color-primary-tint-10)' }}><span style={{ fontSize: 12, color: 'var(--color-primary-dark)', fontWeight: 600 }}>Đang trả lời {replyTo.name}</span><button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}><IconX name="x" size={14} color="var(--color-primary-dark)" /></button></div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px calc(14px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--divider)' }}>
        <AvatarImg size={32} />
        <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder={replyTo ? 'Trả lời ' + replyTo.name + '...' : 'Viết bình luận...'} style={{ flex: 1, border: '1px solid var(--border-input)', borderRadius: 'var(--radius-full)', padding: '9px 14px', fontFamily: 'var(--font-family)', fontSize: 14, outline: 'none' }} />
        <button onClick={submit} style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <IconX name="send" size={15} color="#fff" />
        </button>
      </div>
    </div>
  );
}

function AIChatScreen({ onBack, onEscalate }) {
  const suggestions = ['Tôi bị đau khi tập', 'Đổi lịch nhắc tập', 'Lộ trình của tôi thế nào?'];
  const [messages, setMessages] = React.useState([
    { from: 'ai', text: 'Xin chào! Tôi là Trợ lý AI TheraHOME. Tôi có thể giúp gì cho lộ trình phục hồi của bạn hôm nay?' }
  ]);
  const [text, setText] = React.useState('');
  const [typing, setTyping] = React.useState(false);
  const listRef = React.useRef(null);
  React.useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages, typing]);
  function reply(userText) {
    const t = userText.toLowerCase();
    let r = 'Cảm ơn bạn đã chia sẻ. Bạn có thể mô tả rõ hơn để tôi hỗ trợ chính xác hơn không?';
    if (t.includes('đau')) r = 'Đau nhẹ trong 2-3 ngày đầu là bình thường khi cơ thể làm quen. Nếu đau tăng dần hoặc kéo dài, bạn nên giảm cường độ và báo với đội ngũ hỗ trợ để được tư vấn kỹ hơn.';
    else if (t.includes('lịch') || t.includes('nhắc')) r = 'Bạn có thể đổi khung giờ nhắc tập trong Hồ sơ > Thông báo. Bạn muốn nhắc vào khung giờ nào?';
    else if (t.includes('lộ trình')) r = 'Lộ trình của bạn đang ở Giai đoạn hiện tại, tiến độ được cập nhật mỗi ngày trong tab Lộ trình. Bạn muốn xem chi tiết ngày nào?';
    setTyping(true);
    setTimeout(() => { setTyping(false); setMessages(m => [...m, { from: 'ai', text: r }]); }, 900);
  }
  function send(t) {
    const value = (t || text).trim();
    if (!value) return;
    setMessages(m => [...m, { from: 'user', text: value }]);
    setText('');
    reply(value);
  }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '62px 20px 12px', borderBottom: '1px solid var(--divider)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}><IconX name="chevron-left" size={22} color="var(--text-primary)" /></button>
        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconX name="sparkles" size={17} color="#fff" /></div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Trợ lý AI TheraHOME</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Trả lời tức thì · Không thay thế bác sĩ</div>
        </div>
      </div>
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start', maxWidth: '78%', background: m.from === 'user' ? 'var(--color-primary)' : 'var(--bg-card)', color: m.from === 'user' ? '#fff' : 'var(--text-primary)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 14, lineHeight: 1.4, boxShadow: m.from === 'user' ? 'none' : 'var(--shadow-card)' }}>{m.text}</div>
        ))}
        {typing && <div style={{ alignSelf: 'flex-start', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '10px 14px', boxShadow: 'var(--shadow-card)', display: 'flex', gap: 4 }}>
          {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block', opacity: 0.5 }} />)}
        </div>}
        {messages.length <= 2 && !typing && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {suggestions.map(s => <button key={s} onClick={() => send(s)} style={{ border: '1px solid var(--border-input)', background: 'var(--bg-card)', borderRadius: 'var(--radius-full)', padding: '8px 14px', fontFamily: 'var(--font-family)', fontSize: 12.5, fontWeight: 600, color: 'var(--color-primary)', cursor: 'pointer' }}>{s}</button>)}
          </div>
        )}
        <button onClick={onEscalate} style={{ alignSelf: 'center', marginTop: 8, border: 'none', background: 'none', fontFamily: 'var(--font-family)', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}>Cần hỗ trợ trực tiếp? Chat với Chuyên gia TheraHOME</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px calc(14px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--divider)' }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Nhập câu hỏi..." style={{ flex: 1, border: '1px solid var(--border-input)', borderRadius: 'var(--radius-full)', padding: '10px 14px', fontFamily: 'var(--font-family)', fontSize: 14, outline: 'none' }} />
        <button onClick={() => send()} style={{ width: 38, height: 38, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <IconX name="send" size={16} color="#fff" />
        </button>
      </div>
    </div>
  );
}

function AdminChatScreen({ onBack }) {
  const [messages, setMessages] = React.useState([
    { from: 'user', text: 'Tôi muốn được hỗ trợ thêm về lộ trình hiện tại.' },
    { from: 'admin', text: 'Chào Minh, mình là đội ngũ hỗ trợ TheraHOME. Bạn đang gặp khó khăn gì với lộ trình hiện tại?' }
  ]);
  const [text, setText] = React.useState('');
  const listRef = React.useRef(null);
  React.useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages]);
  function send() {
    if (!text.trim()) return;
    setMessages(m => [...m, { from: 'user', text: text.trim() }]);
    setText('');
    setTimeout(() => setMessages(m => [...m, { from: 'admin', text: 'Cảm ơn bạn đã chia sẻ. Chuyên gia TheraHOME sẽ xem xét và điều chỉnh lộ trình phù hợp hơn cho bạn trong 24h.' }]), 900);
  }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '62px 20px 12px', borderBottom: '1px solid var(--divider)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}><IconX name="chevron-left" size={22} color="var(--text-primary)" /></button>
        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', background: '#14161F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconX name="heart" size={16} color="#fff" /></div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Chuyên gia TheraHOME</div>
          <div style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />Đang hoạt động</div>
        </div>
      </div>
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start', maxWidth: '78%', background: m.from === 'user' ? 'var(--color-primary)' : 'var(--bg-card)', color: m.from === 'user' ? '#fff' : 'var(--text-primary)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 14, lineHeight: 1.4, boxShadow: m.from === 'user' ? 'none' : 'var(--shadow-card)' }}>{m.text}</div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px calc(14px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--divider)' }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Nhập tin nhắn..." style={{ flex: 1, border: '1px solid var(--border-input)', borderRadius: 'var(--radius-full)', padding: '10px 14px', fontFamily: 'var(--font-family)', fontSize: 14, outline: 'none' }} />
        <button onClick={send} style={{ width: 38, height: 38, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <IconX name="send" size={16} color="#fff" />
        </button>
      </div>
    </div>
  );
}

function CommunityScreen({ posts, savedPostIds, onCongratulate, onToggleLike, onToggleSave, onDeletePost, onOpenComments, onOpenCreatePost, onOpenChat }) {
  const [filter, setFilter] = React.useState('all');
  const [showShare, setShowShare] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [openMenuId, setOpenMenuId] = React.useState(null);
  const u = D.user;
  const chips = [['all', 'Tất cả'], ['story', 'Câu chuyện'], ['official', 'Từ TheraHOME'], ['saved', 'Đã lưu']];
  const filteredPosts = posts.filter(p => filter === 'all' || (filter === 'official' && p.official) || (filter === 'story' && p.tag === 'story') || (filter === 'saved' && savedPostIds.includes(p.id)));

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2000); }
  function congratulate(post) {
    if (post.congratulatedByMe) return;
    onCongratulate(post.id);
    showToast('Đã gửi lời chúc mừng tới ' + post.name + '!');
  }
  function handleMenuAction(post, action) {
    setOpenMenuId(null);
    if (action === 'save') { onToggleSave(post.id); showToast(savedPostIds.includes(post.id) ? 'Đã bỏ lưu bài viết' : 'Đã lưu bài viết'); }
    else if (action === 'report') showToast('Đã gửi báo cáo, cảm ơn bạn');
    else if (action === 'delete') { onDeletePost(post.id); showToast('Đã xóa bài viết'); }
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg-app)', padding: '0 20px calc(100px + env(safe-area-inset-bottom))', boxSizing: 'border-box', position: 'relative' }}>
      <div style={{ padding: '60px 0 4px', fontSize: 'var(--text-display-size)', fontWeight: 'var(--text-display-weight)', color: 'var(--text-primary)' }}>Cộng đồng</div>
      <div onClick={() => setShowShare(true)} style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card)', borderRadius: 'var(--radius-full)', padding: '10px 16px', boxShadow: 'var(--shadow-card)', cursor: 'pointer' }}>
        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', background: '#C9BEFF', color: '#4A3F8C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{u.name.charAt(0)}</div>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-body-size)' }}>Chia sẻ hành trình hôm nay của bạn...</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16, overflowX: 'auto', paddingBottom: 2 }}>
        {chips.map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{ flexShrink: 0, border: filter === key ? 'none' : '1px solid var(--border-input)', background: filter === key ? 'var(--color-primary)' : 'var(--bg-card)', color: filter === key ? '#fff' : 'var(--text-primary)', borderRadius: 'var(--radius-full)', padding: '9px 16px', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {filteredPosts.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, marginTop: 40 }}>Chưa có bài viết nào</div>}
        {filteredPosts.map(p => (
          <div key={p.id} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', boxShadow: 'var(--shadow-card)', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              {p.official ? (
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: '#14161F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconX name="heart" size={17} color="#fff" />
                </div>
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', background: p.avatarColor, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{p.name.charAt(0)}</div>
              )}
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{p.name}</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}> · {p.meta}</span>
              </div>
              <button onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', flexShrink: 0 }}><IconX name="more-horizontal" size={18} color="var(--text-muted)" /></button>
              {openMenuId === p.id && (
                <React.Fragment>
                  <div onClick={() => setOpenMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 39 }} />
                  <div style={{ position: 'absolute', top: 40, right: 16, background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', zIndex: 40, minWidth: 160 }}>
                    <button onClick={() => handleMenuAction(p, 'save')} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'none', padding: '11px 14px', fontFamily: 'var(--font-family)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}><IconX name="bookmark" size={15} color="var(--text-secondary)" />{savedPostIds.includes(p.id) ? 'Bỏ lưu' : 'Lưu bài viết'}</button>
                    {p.name === u.name ? (
                      <button onClick={() => handleMenuAction(p, 'delete')} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'none', padding: '11px 14px', fontFamily: 'var(--font-family)', fontSize: 13, fontWeight: 600, color: 'var(--error)', cursor: 'pointer', textAlign: 'left', borderTop: '1px solid var(--divider)' }}><IconX name="x" size={15} color="var(--error)" />Xóa bài viết</button>
                    ) : (
                      <button onClick={() => handleMenuAction(p, 'report')} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'none', padding: '11px 14px', fontFamily: 'var(--font-family)', fontSize: 13, fontWeight: 600, color: 'var(--error)', cursor: 'pointer', textAlign: 'left', borderTop: '1px solid var(--divider)' }}><IconX name="x" size={15} color="var(--error)" />Báo cáo bài viết</button>
                    )}
                  </div>
                </React.Fragment>
              )}
            </div>
            <div style={{ fontSize: p.official ? 16 : 14, fontWeight: p.official ? 700 : 400, color: 'var(--text-primary)', lineHeight: 1.45 }}>{p.text}</div>
            {p.image && <div style={{ height: 160, marginTop: 10 }}><image-slot id={'community-post-img-' + p.id} shape="rounded" radius="12" placeholder="Ảnh bài viết"></image-slot></div>}
            {p.badge && <div style={{ display: 'inline-block', marginTop: 10, background: 'var(--color-primary-tint-10)', color: 'var(--color-primary-dark)', fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 'var(--radius-sm)' }}>{p.badge}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <button onClick={() => onToggleLike(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, color: p.likedByMe ? 'var(--error)' : 'var(--text-muted)', fontSize: 13, fontWeight: p.likedByMe ? 700 : 400, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-family)' }}><IconX name="heart" size={16} color={p.likedByMe ? 'var(--error)' : 'var(--text-muted)'} />{p.likes}</button>
              <button onClick={() => onOpenComments(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-family)' }}><IconX name="message-circle" size={16} color="var(--text-muted)" />{p.comments}</button>
              <button onClick={() => onToggleSave(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, color: savedPostIds.includes(p.id) ? 'var(--color-primary)' : 'var(--text-muted)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-family)' }}><IconX name="bookmark" size={16} color={savedPostIds.includes(p.id) ? 'var(--color-primary)' : 'var(--text-muted)'} /></button>
              {p.action && <button onClick={() => congratulate(p)} style={{ marginLeft: 'auto', border: p.congratulatedByMe ? 'none' : '1px solid var(--border-input)', background: p.congratulatedByMe ? 'var(--color-primary)' : 'none', borderRadius: 'var(--radius-full)', padding: '7px 14px', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 12, color: p.congratulatedByMe ? '#fff' : 'var(--text-primary)', cursor: p.congratulatedByMe ? 'default' : 'pointer' }}>{p.congratulatedByMe ? 'Đã chúc mừng ✓' : p.action}</button>}
            </div>
          </div>
        ))}
      </div>
      {showShare && <ShareStoryModal onClose={() => setShowShare(false)} onSupport={() => { setShowShare(false); onOpenChat(); }} onShare={() => { setShowShare(false); onOpenCreatePost(); }} />}
      {toast && <div style={{ position: 'absolute', left: 20, right: 20, bottom: 90, background: 'var(--text-primary)', color: '#fff', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>{toast}</div>}
    </div>
  );
}

function ProfileScreen({ onBack, darkMode, onToggleDark, initialSub, onOpenAIChat, onOpenSupportChat }) {
  const u = D.user;
  const [sub, setSub] = React.useState(initialSub || null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const menu = [
    ['pencil', 'Chỉnh sửa hồ sơ', 'edit'],
    ['bell', 'Thông báo', 'notifications'],
    ['settings', 'Cài đặt tài khoản', 'settings'],
    ['circle', 'Trợ giúp & hỗ trợ', 'help']
  ];
  if (sub === 'edit') return <EditProfileScreen onBack={() => setSub(null)} />;
  if (sub === 'notifications') return <NotificationsScreen onBack={() => setSub(null)} />;
  if (sub === 'settings') return <AccountSettingsScreen onBack={() => setSub(null)} />;
  if (sub === 'help') return <HelpSupportScreen onBack={() => setSub(null)} onOpenAIChat={onOpenAIChat} onOpenSupportChat={onOpenSupportChat} />;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <BackBar onBack={onBack} title="Hồ sơ" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, margin: '8px 0 22px' }}>
          <AvatarImg size={84} editable />
          <div style={{ fontSize: 'var(--text-h1-size)', fontWeight: 'var(--text-h1-weight)', color: 'var(--text-primary)' }}>{u.name}</div>
          <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>Ngày {u.currentDay}/14 · {u.streak} ngày liên tiếp</div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, background: 'var(--bg-card-alt)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{u.streak}</div>
            <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 2 }}>ngày liên tiếp</div>
          </div>
          <div style={{ flex: 1, background: 'var(--bg-card-alt)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{u.adherence}%</div>
            <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 2 }}>tuân thủ</div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', marginBottom: 20 }}>
          <div onClick={onToggleDark} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--divider)', cursor: 'pointer' }}>
            <IconX name={darkMode ? 'sun' : 'moon'} size={20} color="var(--color-primary)" />
            <div style={{ flex: 1, fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Chế độ {darkMode ? 'sáng' : 'tối'}</div>
            <div style={{ width: 44, height: 26, borderRadius: 'var(--radius-full)', background: darkMode ? 'var(--color-primary)' : 'var(--border-input)', position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: darkMode ? 21 : 3, transition: 'left 150ms ease-out' }} />
            </div>
          </div>
          {menu.map(([icon, label, key], i) => (
            <div key={label} onClick={() => setSub(key)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: i < menu.length - 1 ? '1px solid var(--divider)' : 'none', cursor: 'pointer' }}>
              <Icon name={icon} size={20} color="var(--text-secondary)" />
              <div style={{ flex: 1, fontSize: 'var(--text-body-strong-size)', color: 'var(--text-primary)' }}>{label}</div>
              <IconX name="chevron-right" size={16} color="var(--text-muted)" />
            </div>
          ))}
        </div>
        <a href={D.privacyPolicy} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', marginBottom: 12, textDecoration: 'none' }}>
          <IconX name="lock" size={20} color="var(--text-secondary)" />
          <div style={{ flex: 1, fontSize: 'var(--text-body-strong-size)', color: 'var(--text-primary)' }}>Chính sách quyền riêng tư</div>
          <IconX name="external-link" size={16} color="var(--text-muted)" />
        </a>
        <button style={{ width: '100%', background: 'var(--error-tint)', color: 'var(--error)', border: 'none', borderRadius: 'var(--radius-md)', padding: 14, fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <IconX name="log-out" size={18} color="var(--error)" />Đăng xuất
        </button>
        <button onClick={() => setConfirmDelete(true)} style={{ width: '100%', background: 'none', color: 'var(--text-muted)', border: 'none', padding: 14, fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginTop: 4 }}>Xoá tài khoản</button>
      </div>
      {confirmDelete && <DeleteAccountModal onCancel={() => setConfirmDelete(false)} onConfirm={() => setConfirmDelete(false)} />}
    </div>
  );
}

Object.assign(window, { IntakeWelcome, QuestionScreen, ConsentScreen, LoginScreen, ActivationScreen, HomeScreen, NotificationInboxScreen, RoadmapScreen, DayDetailScreen, StoreScreen, CommunityScreen, ProfileScreen, AvatarImg, AIChatScreen, AdminChatScreen });
