const { Icon, Button } = window.TheraHOMEDesignSystem_787051;
const D2 = window.APP_DATA;

function FieldRow({ label, value, onChange, type = 'text' }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} type={type} style={{ width: '100%', boxSizing: 'border-box', padding: 13, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)', fontFamily: 'var(--font-family)', fontSize: 15, background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
    </div>
  );
}

function SelectRow({ label, value, options, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(opt => {
          const active = value === opt;
          return (
            <button key={opt} onClick={() => onChange(opt)} style={{ border: active ? '2px solid var(--color-primary)' : '1px solid var(--border-input)', background: active ? 'var(--color-primary-tint-10)' : 'var(--bg-card)', color: active ? 'var(--color-primary)' : 'var(--text-primary)', borderRadius: 'var(--radius-full)', padding: '8px 14px', fontFamily: 'var(--font-family)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{opt}</button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({ icon, title, sub, value, onChange, isLast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: isLast ? 'none' : '1px solid var(--divider)' }}>
      {icon && <IconX name={icon} size={20} color="var(--color-primary)" />}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        {sub && <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div onClick={() => onChange(!value)} style={{ width: 44, height: 26, borderRadius: 'var(--radius-full)', background: value ? 'var(--color-primary)' : 'var(--border-input)', position: 'relative', flexShrink: 0, cursor: 'pointer' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: value ? 21 : 3, transition: 'left 150ms ease-out' }} />
      </div>
    </div>
  );
}

function LegalDocBody({ docKey }) {
  const doc = window.LEGAL_CONTENT[docKey];
  const lines = doc.text.split('\n');
  return (
    <div>
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return null;
        if (i === 0) return <div key={i} style={{ fontSize: 'var(--text-h1-size)', fontWeight: 'var(--text-h1-weight)', color: 'var(--text-primary)', marginBottom: 4 }}>{line}</div>;
        if (i === 1) return <div key={i} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>{line}</div>;
        if (i === 2) return <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{line}</div>;
        if (i === 3) return <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, background: 'var(--bg-card-alt)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 18 }}>{line}</div>;
        if (/^\d+(\.\d+)?\.\s/.test(line)) return <div key={i} style={{ fontSize: 'var(--text-body-strong-size)', fontWeight: 700, color: 'var(--text-primary)', marginTop: 20, marginBottom: 6 }}>{line}</div>;
        if (raw.startsWith('\t') || line.startsWith('•')) return <div key={i} style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: 16, position: 'relative', marginBottom: 6 }}><span style={{ position: 'absolute', left: 0 }}>•</span>{line.replace(/^•\s*/, '')}</div>;
        return <div key={i} style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 8 }}>{line}</div>;
      })}
    </div>
  );
}

function LegalScreen({ docKey, onBack }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <BackBar onBack={onBack} title={window.LEGAL_CONTENT[docKey].title} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 40px' }}>
        <LegalDocBody docKey={docKey} />
      </div>
    </div>
  );
}

function LegalOverlay({ docKey, onClose }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-app)', zIndex: 100 }}>
      <LegalScreen docKey={docKey} onBack={onClose} />
    </div>
  );
}

function EditProfileScreen({ onBack }) {
  const u = D2.user;
  const [name, setName] = React.useState(u.name);
  const [contact, setContact] = React.useState('minh@example.com');
  const [area, setArea] = React.useState(D2.questions[0].options[3]);
  const [goal, setGoal] = React.useState(D2.questions[3].options[1]);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <BackBar onBack={onBack} title="Chỉnh sửa hồ sơ" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 20px' }}>
          <AvatarImg size={84} editable />
        </div>
        <FieldRow label="Tên" value={name} onChange={setName} />
        <FieldRow label="Số điện thoại hoặc email" value={contact} onChange={setContact} />
        <SelectRow label="Vùng đang tập" value={area} options={D2.questions[0].options} onChange={setArea} />
        <SelectRow label="Mục tiêu tập luyện" value={goal} options={D2.questions[3].options} onChange={setGoal} />
        <Button style={{ width: '100%', marginTop: 8 }} onClick={onBack}>Lưu thay đổi</Button>
      </div>
    </div>
  );
}

function TimeRow({ icon, title, sub, value, onChange, isLast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: isLast ? 'none' : '1px solid var(--divider)' }}>
      {icon && <IconX name={icon} size={20} color="var(--color-primary)" />}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        {sub && <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
      </div>
      <label style={{ background: 'var(--color-primary-tint-10)', color: 'var(--color-primary-dark)', fontWeight: 700, fontSize: 14, borderRadius: 'var(--radius-md)', padding: '8px 12px', cursor: 'pointer' }}>
        {value}
        <input type="time" value={value} onChange={e => onChange(e.target.value)} style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} />
      </label>
    </div>
  );
}

function NotificationsScreen({ onBack }) {
  const [remind, setRemind] = React.useState(true);
  const [remindTime, setRemindTime] = React.useState('08:00');
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <BackBar onBack={onBack} title="Thông báo" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 40px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '.4px', margin: '10px 0 8px' }}>Thông báo</div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
          <ToggleRow icon="activity" title="Nhắc tập hàng ngày" sub="Nhận thông báo khi đến giờ tập" value={remind} onChange={setRemind} isLast={!remind} />
          {remind && <TimeRow icon="clock" title="Giờ nhắc nhở" value={remindTime} onChange={setRemindTime} isLast />}
        </div>
      </div>
    </div>
  );
}

function AccountSettingsScreen({ onBack }) {
  const [lang, setLang] = React.useState('Tiếng Việt');
  const [shareData, setShareData] = React.useState(false);
  const [changingPw, setChangingPw] = React.useState(false);
  const [legalDoc, setLegalDoc] = React.useState(null);
  if (legalDoc) return <LegalScreen docKey={legalDoc} onBack={() => setLegalDoc(null)} />;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <BackBar onBack={onBack} title="Cài đặt tài khoản" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 40px' }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', marginBottom: 20 }}>
          <div onClick={() => setChangingPw(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--divider)', cursor: 'pointer' }}>
            <IconX name="lock" size={20} color="var(--color-primary)" />
            <div style={{ flex: 1, fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Đổi mật khẩu</div>
            <IconX name={changingPw ? 'chevron-down' : 'chevron-right'} size={16} color="var(--text-muted)" />
          </div>
          {changingPw && (
            <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid var(--divider)' }}>
              <input placeholder="Mật khẩu hiện tại" type="password" style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)', fontFamily: 'var(--font-family)', fontSize: 14 }} />
              <input placeholder="Mật khẩu mới" type="password" style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-input)', fontFamily: 'var(--font-family)', fontSize: 14 }} />
              <Button style={{ width: '100%' }} onClick={() => setChangingPw(false)}>Xác nhận đổi mật khẩu</Button>
            </div>
          )}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--divider)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <IconX name="book" size={20} color="var(--color-primary)" />
              <div style={{ fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Ngôn ngữ</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Tiếng Việt', 'English'].map(l => (
                <button key={l} onClick={() => setLang(l)} style={{ flex: 1, border: lang === l ? '2px solid var(--color-primary)' : '1px solid var(--border-input)', background: lang === l ? 'var(--color-primary-tint-10)' : 'var(--bg-card)', color: lang === l ? 'var(--color-primary)' : 'var(--text-primary)', borderRadius: 'var(--radius-md)', padding: '10px 0', fontFamily: 'var(--font-family)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
          </div>
          <ToggleRow icon="external-link" title="Chia sẻ dữ liệu để cải thiện trải nghiệm" sub="Dữ liệu ẩn danh, không dùng cho quảng cáo" value={shareData} onChange={setShareData} isLast />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '.4px', margin: '10px 0 8px' }}>Pháp lý</div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
          {[['terms', 'file-text', 'Điều khoản sử dụng'], ['privacy', 'lock', 'Chính sách quyền riêng tư'], ['security', 'shield', 'Chính sách bảo mật thông tin']].map(([key, icon, title], i, arr) => (
            <div key={key} onClick={() => setLegalDoc(key)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--divider)' : 'none', cursor: 'pointer' }}>
              <IconX name={icon} size={20} color="var(--color-primary)" />
              <div style={{ flex: 1, fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
              <IconX name="chevron-right" size={16} color="var(--text-muted)" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--divider)' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' }}>
        <div style={{ flex: 1, fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>{q}</div>
        <IconX name={open ? 'chevron-down' : 'chevron-right'} size={16} color="var(--text-muted)" />
      </div>
      {open && <div style={{ padding: '0 16px 14px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{a}</div>}
    </div>
  );
}

function HelpSupportScreen({ onBack, onOpenAIChat, onOpenSupportChat }) {
  const faqs = [
    { q: 'Làm sao để mở khóa ngày tiếp theo?', a: 'Hoàn thành bài tập của ngày hiện tại để mở khóa ngày kế tiếp trong lộ trình.' },
    { q: 'Tôi có thể đổi vùng tập không?', a: 'Có, vào Chỉnh sửa hồ sơ để thay đổi vùng đang tập bất cứ lúc nào.' },
    { q: 'Ứng dụng có thay thế bác sĩ không?', a: 'Không. TheraHOME hỗ trợ vận động, không thay thế chẩn đoán hay điều trị y khoa.' },
  ];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <BackBar onBack={onBack} title="Trợ giúp & hỗ trợ" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 40px' }}>
        <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 'var(--text-h2-weight)', color: 'var(--text-primary)', marginBottom: 10 }}>Câu hỏi thường gặp</div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', marginBottom: 24 }}>
          {faqs.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
        </div>
        <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 'var(--text-h2-weight)', color: 'var(--text-primary)', marginBottom: 10 }}>Liên hệ hỗ trợ</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={onOpenAIChat} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '14px 16px', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-family)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconX name="sparkles" size={16} color="#fff" /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Trợ lý AI TheraHOME</div>
              <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>Trả lời tức thì, mọi lúc</div>
            </div>
            <IconX name="chevron-right" size={16} color="var(--text-muted)" />
          </button>
          <button onClick={onOpenSupportChat} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '14px 16px', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-family)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', background: '#14161F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconX name="heart" size={16} color="#fff" /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Chuyên gia TheraHOME</div>
              <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />Đang hoạt động</div>
            </div>
            <IconX name="chevron-right" size={16} color="var(--text-muted)" />
          </button>
          <a href="tel:19001234" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '14px 16px', textDecoration: 'none' }}>
            <IconX name="external-link" size={20} color="var(--color-primary)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Hotline hỗ trợ</div>
              <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>1900 1234 · 8:00–21:00</div>
            </div>
          </a>
          <a href="mailto:support@therahomeai.com" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '14px 16px', textDecoration: 'none' }}>
            <IconX name="external-link" size={20} color="var(--color-primary)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-body-strong-size)', fontWeight: 600, color: 'var(--text-primary)' }}>Email hỗ trợ</div>
              <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>support@therahomeai.com</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountModal({ onCancel, onConfirm }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,24,34,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--error-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <IconX name="lock" size={20} color="var(--error)" />
        </div>
        <div style={{ fontSize: 'var(--text-h2-size)', fontWeight: 'var(--text-h2-weight)', color: 'var(--text-primary)' }}>Xoá tài khoản?</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>Toàn bộ dữ liệu lộ trình, tiến độ và thông tin cá nhân của bạn sẽ bị xoá vĩnh viễn. Hành động này không thể hoàn tác.</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onCancel} style={{ flex: 1, background: 'var(--bg-card-alt)', color: 'var(--text-primary)', border: 'none', borderRadius: 'var(--radius-md)', padding: '11px 0', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Hủy</button>
          <button onClick={onConfirm} style={{ flex: 1, background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '11px 0', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Xoá</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EditProfileScreen, NotificationsScreen, AccountSettingsScreen, HelpSupportScreen, DeleteAccountModal, LegalScreen, LegalOverlay });
