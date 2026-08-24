const { Button } = window.TheraHOMEDesignSystem_787051;
const D = window.APP_DATA;

const NAV_ADMIN = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'exercises', label: 'Lộ trình', icon: 'route' },
  { id: 'products', label: 'Sản Phẩm', icon: 'box' },
  { id: 'notifications', label: 'Thông báo', icon: 'bell' },
  { id: 'community', label: 'Cộng đồng', icon: 'message-square' },
  { id: 'users', label: 'User', icon: 'users' },
  { id: 'ai', label: 'AI Prompts', icon: 'brain' }
];
const NAV_CARE = [
  { id: 'chat', label: 'Chat', icon: 'message-circle' },
  { id: 'notifications', label: 'Thông báo', icon: 'bell' },
  { id: 'users', label: 'User', icon: 'users' }
];
const USER_ROLE_OPTIONS = [['user', 'Người dùng'], ['collaborator', 'CTV chăm sóc'], ['restricted', 'Hạn chế']];

const SAMPLE_USERS = [
  { id: 1, name: 'Minh', contact: '090xxxxx01', area: 'Vùng cổ', day: 14, adherence: 86, status: 'active', joined: '01/08/2026', role: 'user', locked: false },
  { id: 2, name: 'Lan', avatarColor: '#C9BEFF', contact: '090xxxxx02', area: 'Vùng lưng dưới', day: 14, adherence: 92, status: 'active', joined: '28/07/2026', role: 'collaborator', locked: false },
  { id: 3, name: 'Huy', avatarColor: '#BFEAD0', contact: '090xxxxx03', area: 'Vùng vai', day: 5, adherence: 61, status: 'active', joined: '10/08/2026', role: 'user', locked: false },
  { id: 4, name: 'Mai', avatarColor: '#FFD9A0', contact: '090xxxxx04', area: 'Vùng gối', day: 9, adherence: 74, status: 'paused', joined: '05/08/2026', role: 'user', locked: false },
  { id: 5, name: 'Đức', avatarColor: '#BFEAD0', contact: '090xxxxx05', area: 'Vùng cổ', day: 2, adherence: 40, status: 'active', joined: '13/08/2026', role: 'user', locked: false },
  { id: 6, name: 'Thảo', avatarColor: '#FFB4B4', contact: '090xxxxx06', area: 'Vùng lưng dưới', day: 14, adherence: 55, status: 'inactive', joined: '20/07/2026', role: 'restricted', locked: true }
];
const ROLE_META = { user: ['Người dùng', 'var(--text-secondary)', 'var(--bg-card-alt)'], collaborator: ['CTV chăm sóc', 'var(--color-primary)', 'var(--color-primary-tint-10)'], restricted: ['Hạn chế', '#B9860B', 'rgba(185,134,11,0.12)'] };

const STAFF_ROLE_META = { admin: ['Admin', '#8B2FC9', 'rgba(139,47,201,0.12)', 'Toàn quyền quản trị hệ thống'], care: ['Chăm sóc khách hàng', 'var(--color-primary)', 'var(--color-primary-tint-10)', 'Chat, Thông báo, xem User (chỉ xem)'] };
const SAMPLE_STAFF = [
  { id: 1, name: 'Ngọc Anh', email: 'admin@therahome.vn', role: 'admin', status: 'active', joined: '01/06/2026' },
  { id: 2, name: 'Bảo Trân', email: 'cskh.baotran@therahome.vn', role: 'care', status: 'active', joined: '12/07/2026' },
  { id: 3, name: 'Quốc Huy', email: 'cskh.huy@therahome.vn', role: 'care', status: 'active', joined: '02/08/2026' },
  { id: 4, name: 'Thu Hà', email: 'cskh.thuha@therahome.vn', role: 'care', status: 'disabled', joined: '20/05/2026' }
];

function StatCard({ icon, label, value, delta, tint }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: 'var(--shadow-card)', flex: 1, minWidth: 200 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconX name={icon} size={19} color="var(--color-primary-dark)" />
        </div>
        {delta && <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: delta.startsWith('-') ? 'var(--error)' : '#1E9E5E' }}><IconX name="trending-up" size={13} color={delta.startsWith('-') ? 'var(--error)' : '#1E9E5E'} />{delta}</div>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginTop: 14 }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Avatar({ name, color, size = 34 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: color || 'var(--bg-card-alt)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.4, flexShrink: 0 }}>{name.charAt(0)}</div>;
}

function StatusPill({ status }) {
  const map = { active: ['Hoạt động', '#1E9E5E', 'rgba(30,158,94,0.12)'], paused: ['Tạm dừng', '#B9860B', 'rgba(185,134,11,0.12)'], inactive: ['Ngừng', '#8A93A3', 'rgba(138,147,163,0.12)'] };
  const [label, color, bg] = map[status] || map.active;
  return <span style={{ fontSize: 12, fontWeight: 700, color, background: bg, padding: '4px 10px', borderRadius: 999 }}>{label}</span>;
}

function WeekChart() {
  const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 140, marginTop: 18 }}>
      {D.weekAdherence.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ width: '100%', height: Math.max(v, 0.06) * 110, borderRadius: 6, background: v >= 1 ? 'var(--color-primary)' : v > 0 ? 'var(--color-primary-light)' : 'var(--bg-card-alt)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

const CHAT_THREADS = [
  { id: 'duc', user: 'Đức', avatarColor: '#BFEAD0', unread: true, time: '10 phút trước', messages: [
    { from: 'user', text: 'Chào chuyên gia, con đau nhiều hơn khi tập ngày 2, có nên tiếp tục không ạ?', time: '10:02' }
  ] },
  { id: 'mai', user: 'Mai', avatarColor: '#FFD9A0', unread: true, time: '35 phút trước', messages: [
    { from: 'user', text: 'Em bị lỗi không phát được video ngày 9.', time: '09:40' }
  ] },
  { id: 'huy', user: 'Huy', avatarColor: '#BFEAD0', unread: true, time: '1 giờ trước', messages: [
    { from: 'user', text: 'Thiết bị TheraNECK+ không rung nữa, có bảo hành không ạ?', time: '09:05' }
  ] },
  { id: 'minh', user: 'Minh', avatarColor: undefined, unread: false, time: 'Hôm qua', messages: [
    { from: 'user', text: 'Cho em hỏi lộ trình Giai đoạn 2 kéo dài bao lâu?', time: 'Hôm qua · 14:22' },
    { from: 'admin', text: 'Chào Minh, Giai đoạn 2 kéo dài 14 ngày, từ ngày 15–28 bạn nhé.', time: 'Hôm qua · 14:40' }
  ] },
  { id: 'lan', user: 'Lan', avatarColor: '#C9BEFF', unread: false, time: '2 ngày trước', messages: [
    { from: 'user', text: 'Cảm ơn đội ngũ đã hỗ trợ, mình đỡ đau lưng nhiều rồi.', time: '2 ngày trước' },
    { from: 'admin', text: 'Tuyệt vời quá Lan ơi, chúc bạn tiếp tục duy trì lộ trình nhé!', time: '2 ngày trước' }
  ] }
];
const SUPPORT_INBOX = CHAT_THREADS.filter(t => t.unread).map(t => ({ user: t.user, avatarColor: t.avatarColor, text: t.messages[t.messages.length - 1].text, time: t.time }));

function ChatView({ initialUser, onConsumeInitial }) {
  const [threads, setThreads] = React.useState(CHAT_THREADS);
  const [activeId, setActiveId] = React.useState(CHAT_THREADS[0].id);
  const [filter, setFilter] = React.useState('all');
  const [draft, setDraft] = React.useState('');
  React.useEffect(() => {
    if (initialUser) {
      const t = threads.find(x => x.user === initialUser);
      if (t) { setActiveId(t.id); setThreads(ts => ts.map(x => x.id === t.id ? { ...x, unread: false } : x)); }
      onConsumeInitial();
    }
  }, [initialUser]);
  const list = filter === 'unread' ? threads.filter(t => t.unread) : threads;
  const active = threads.find(t => t.id === activeId) || threads[0];
  function openThread(id) {
    setActiveId(id);
    setThreads(ts => ts.map(t => t.id === id ? { ...t, unread: false } : t));
  }
  function send() {
    if (!draft.trim()) return;
    setThreads(ts => ts.map(t => t.id === activeId ? { ...t, messages: [...t.messages, { from: 'admin', text: draft.trim(), time: 'Vừa gửi' }] } : t));
    setDraft('');
  }
  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 160px)' }}>
      <div style={{ width: 300, background: '#fff', borderRadius: 16, boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8, padding: 14, borderBottom: '1px solid var(--divider)' }}>
          {[['all', 'Tất cả'], ['unread', 'Chưa đọc']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{ flex: 1, border: filter === k ? 'none' : '1px solid var(--border-input)', background: filter === k ? 'var(--color-primary)' : 'none', color: filter === k ? '#fff' : 'var(--text-primary)', borderRadius: 999, padding: '7px 0', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {list.map(t => (
            <button key={t.id} onClick={() => openThread(t.id)} style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', border: 'none', borderBottom: '1px solid var(--divider)', background: t.id === activeId ? 'var(--color-primary-tint-10)' : 'none', cursor: 'pointer', textAlign: 'left' }}>
              <Avatar name={t.user} color={t.avatarColor} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{t.user}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.time}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.messages[t.messages.length - 1].text}</div>
              </div>
              {t.unread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, background: '#fff', borderRadius: 16, boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, borderBottom: '1px solid var(--divider)' }}>
          <Avatar name={active.user} color={active.avatarColor} size={36} />
          <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)' }}>{active.user}</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {active.messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.from === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '65%' }}>
              <div style={{ background: m.from === 'admin' ? 'var(--color-primary)' : 'var(--bg-card-alt)', color: m.from === 'admin' ? '#fff' : 'var(--text-primary)', borderRadius: 12, padding: '10px 14px', fontSize: 13.5 }}>{m.text}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, textAlign: m.from === 'admin' ? 'right' : 'left' }}>{m.time}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, padding: 16, borderTop: '1px solid var(--divider)' }}>
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Nhắn tin hỗ trợ..." style={{ flex: 1, border: '1px solid var(--border-input)', borderRadius: 999, padding: '10px 16px', fontFamily: 'var(--font-family)', fontSize: 13.5 }} />
          <button onClick={send} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><IconX name="send" size={16} color="#fff" /></button>
        </div>
      </div>
    </div>
  );
}

function DashboardView({ setActive }) {
  const quickLinks = [
    { id: 'exercises', label: 'Lộ trình', icon: 'route' },
    { id: 'products', label: 'Sản phẩm', icon: 'box' },
    { id: 'notifications', label: 'Thông báo', icon: 'bell' },
    { id: 'community', label: 'Cộng đồng', icon: 'message-square' }
  ];
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard icon="users" label="Tổng người dùng" value="2,481" delta="+8%" tint="var(--color-primary-tint-10)" />
        <StatCard icon="trending-up" label="Tuân thủ trung bình" value="78%" delta="+3%" tint="var(--color-primary-tint-10)" />
        <StatCard icon="message-square" label="Bài viết Cộng đồng" value={D.communityPosts.length} tint="var(--color-primary-tint-10)" />
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{ flex: '1.3 1 380px', background: '#fff', borderRadius: 16, padding: 22, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF9F0A' }} />
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Cần xử lý ngay</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>Không có việc gì cần xử lý gấp. 🎉</div>
        </div>
        <div style={{ flex: '1 1 280px', background: '#fff', borderRadius: 16, padding: 22, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 14 }}>Truy cập nhanh</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {quickLinks.map(q => (
              <button key={q.id} onClick={() => setActive(q.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border-input)', background: 'none', borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)', cursor: 'pointer' }}>
                <IconX name={q.icon} size={16} color="var(--color-primary)" />{q.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: 'var(--shadow-card)', marginTop: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Tuân thủ tuần này (toàn hệ thống)</div>
        <WeekChart />
      </div>
    </div>
  );
}

function UsersTable({ rows, compact, onOpenUser }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.03em' }}>
          <th style={{ padding: '0 8px 10px', fontWeight: 600 }}>Người dùng</th>
          <th style={{ padding: '0 8px 10px', fontWeight: 600 }}>Vùng tập</th>
          <th style={{ padding: '0 8px 10px', fontWeight: 600 }}>Ngày</th>
          <th style={{ padding: '0 8px 10px', fontWeight: 600 }}>Tuân thủ</th>
          <th style={{ padding: '0 8px 10px', fontWeight: 600 }}>Phân quyền</th>
          <th style={{ padding: '0 8px 10px', fontWeight: 600 }}>Trạng thái</th>
          {!compact && <th style={{ padding: '0 8px 10px', fontWeight: 600 }}></th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((u, i) => {
          const [rl, rc, rb] = ROLE_META[u.role] || ROLE_META.user;
          return (
          <tr key={i} style={{ borderTop: '1px solid var(--divider)' }}>
            <td style={{ padding: '12px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={u.name} color={u.avatarColor} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.contact}</div>
                </div>
              </div>
            </td>
            <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{u.area}</td>
            <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{u.day}/14</td>
            <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{u.adherence}%</td>
            <td style={{ padding: '12px 8px' }}><Badge color={rc} bg={rb}>{rl}</Badge></td>
            <td style={{ padding: '12px 8px' }}><StatusPill status={u.locked ? 'inactive' : u.status} /></td>
            {!compact && <td style={{ padding: '12px 8px', textAlign: 'right' }}>
              <button onClick={() => onOpenUser(u)} style={{ border: '1px solid var(--border-input)', background: 'none', borderRadius: 8, padding: '6px 12px', fontFamily: 'var(--font-family)', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>Xem hồ sơ</button>
            </td>}
          </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function UserModal({ user, onClose, onSave, roleOptionsOnly }) {
  const isNew = !user;
  const [name, setName] = React.useState(user ? user.name : '');
  const [contact, setContact] = React.useState(user ? user.contact : '');
  const [area, setArea] = React.useState(user ? user.area : 'Vùng cổ');
  const [role, setRole] = React.useState(user ? user.role : 'user');
  function submit() {
    if (!name.trim() || !contact.trim()) return;
    onSave({ name: name.trim(), contact: contact.trim(), area, role });
  }
  return (
    <Modal title="Thêm người dùng mới" onClose={onClose} width={420} footer={<React.Fragment><GhostBtn onClick={onClose}>Hủy</GhostBtn><PrimaryBtn onClick={submit}>Thêm người dùng</PrimaryBtn></React.Fragment>}>
      <FieldLabel>Họ tên</FieldLabel>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Ví dụ: Nguyễn Văn A" style={{ ...inputStyle, marginBottom: 14 }} />
      <FieldLabel>Số điện thoại / email</FieldLabel>
      <input value={contact} onChange={e => setContact(e.target.value)} placeholder="090xxxxxxx" style={{ ...inputStyle, marginBottom: 14 }} />
      <FieldLabel>Vùng tập</FieldLabel>
      <select value={area} onChange={e => setArea(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }}>
        {['Vùng cổ', 'Vùng vai', 'Vùng lưng dưới', 'Vùng gối'].map(a => <option key={a} value={a}>{a}</option>)}
      </select>
      <FieldLabel>Phân quyền</FieldLabel>
      <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
        {USER_ROLE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </Modal>
  );
}

function UsersView({ role }) {
  const readOnly = role === 'care';
  const [subTab, setSubTab] = React.useState('users');
  const [users, setUsers] = React.useState(SAMPLE_USERS);
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [openId, setOpenId] = React.useState(null);
  const [creatingUser, setCreatingUser] = React.useState(false);
  const rows = users.filter(u => (status === 'all' || u.status === status) && u.name.toLowerCase().includes(q.toLowerCase()));
  const openUser = users.find(u => u.id === openId);
  function updateUser(id, patch) { setUsers(us => us.map(u => u.id === id ? { ...u, ...patch } : u)); }
  function addUser(patch) { setUsers(us => [{ id: Date.now(), day: 1, adherence: 0, status: 'active', joined: new Date().toLocaleDateString('vi-VN'), locked: false, ...patch }, ...us]); setCreatingUser(false); pushToast('Đã thêm người dùng ' + patch.name); }
  return (
    <div>
      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['users', 'Người dùng app'], ['staff', 'Tài khoản nội bộ']].map(([k, l]) => (
            <button key={k} onClick={() => setSubTab(k)} style={{ border: subTab === k ? 'none' : '1px solid var(--border-input)', background: subTab === k ? 'var(--color-primary)' : '#fff', color: subTab === k ? '#fff' : 'var(--text-primary)', borderRadius: 999, padding: '9px 18px', fontFamily: 'var(--font-family)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
      )}
      {subTab === 'staff' && !readOnly ? <StaffAccountsView /> : (
      <div style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: 'var(--shadow-card)' }}>
      {readOnly && <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card-alt)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: 'var(--text-secondary)' }}><IconX name="eye" size={14} color="var(--text-secondary)" />Chế độ chỉ xem — thông tin cơ bản người dùng</div>}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border-input)', borderRadius: 10, padding: '9px 12px' }}>
          <IconX name="search" size={16} color="var(--text-muted)" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tên..." style={{ border: 'none', outline: 'none', flex: 1, fontFamily: 'var(--font-family)', fontSize: 13.5 }} />
        </div>
        {[['all', 'Tất cả'], ['active', 'Hoạt động'], ['paused', 'Tạm dừng'], ['inactive', 'Ngừng']].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} style={{ border: status === k ? 'none' : '1px solid var(--border-input)', background: status === k ? 'var(--color-primary)' : 'none', color: status === k ? '#fff' : 'var(--text-primary)', borderRadius: 999, padding: '9px 16px', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{l}</button>
        ))}
        {!readOnly && <PrimaryBtn icon="plus" onClick={() => setCreatingUser(true)}>Thêm người dùng</PrimaryBtn>}
      </div>
      <UsersTable rows={rows} onOpenUser={u => setOpenId(u.id)} />
      {openUser && <UserDrawer user={openUser} readOnly={readOnly} onSave={patch => updateUser(openUser.id, patch)} onClose={() => setOpenId(null)} />}
      {creatingUser && <UserModal onClose={() => setCreatingUser(false)} onSave={addUser} />}
      </div>
      )}
    </div>
  );
}

function Stars({ n }) {
  return <div style={{ display: 'flex', gap: 2 }}>{Array.from({ length: 5 }).map((_, i) => <IconX key={i} name="star" size={14} color={i < n ? '#FF9F0A' : 'var(--border-input)'} />)}</div>;
}

let __toastListeners = [];
function pushToast(msg) { __toastListeners.forEach(fn => fn(msg)); }
function ToastHost() {
  const [toast, setToast] = React.useState(null);
  React.useEffect(() => {
    const fn = msg => { setToast(msg); clearTimeout(fn._t); fn._t = setTimeout(() => setToast(null), 2600); };
    __toastListeners.push(fn);
    return () => { __toastListeners = __toastListeners.filter(x => x !== fn); };
  }, []);
  if (!toast) return null;
  return <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--text-primary)', color: '#fff', borderRadius: 10, padding: '12px 20px', fontSize: 13.5, fontWeight: 600, boxShadow: 'var(--shadow-card)', zIndex: 200 }}>{toast}</div>;
}

function Modal({ title, onClose, width = 460, children, footer }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,30,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width, maxWidth: '92vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{title}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><IconX name="x" size={18} color="var(--text-secondary)" /></button>
        </div>
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: '14px 22px', borderTop: '1px solid var(--divider)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{footer}</div>}
      </div>
    </div>
  );
}

function FieldLabel({ children }) { return <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>{children}</div>; }
const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-input)', borderRadius: 10, padding: '10px 12px', fontFamily: 'var(--font-family)', fontSize: 13.5, color: 'var(--text-primary)' };

function UserDrawer({ user, onClose, readOnly, onSave }) {
  const [permRole, setPermRole] = React.useState(user.role || 'user');
  const product = D.products.find(p => user.area && user.area.includes('cổ') ? p.id.startsWith('neck') : p.id.startsWith('back')) || D.products[0];
  const trend = product.painLevels.slice(0, 7);
  const roleDirty = permRole !== user.role;
  function toggleLock() {
    onSave({ locked: !user.locked });
    pushToast(user.locked ? 'Đã mở khóa tài khoản ' + user.name : 'Đã khóa tài khoản ' + user.name);
  }
  function saveRole() {
    onSave({ role: permRole });
    pushToast('Đã cập nhật phân quyền cho ' + user.name + ': ' + (ROLE_META[permRole] || ROLE_META.user)[0]);
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,30,0.4)', zIndex: 90, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 420, maxWidth: '92vw', height: '100%', background: 'var(--bg-app)', boxShadow: '-8px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px', borderBottom: '1px solid var(--divider)', background: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Hồ sơ người dùng{readOnly && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--bg-card-alt)', padding: '3px 8px', borderRadius: 999 }}>Chỉ xem</span>}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><IconX name="x" size={18} color="var(--text-secondary)" /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Avatar name={user.name} color={user.avatarColor} size={64} />
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{user.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{user.contact} · Tham gia {user.joined}</div>
            <StatusPill status={user.locked ? 'inactive' : user.status} />
            <Badge color={(ROLE_META[user.role] || ROLE_META.user)[1]} bg={(ROLE_META[user.role] || ROLE_META.user)[2]}>{(ROLE_META[user.role] || ROLE_META.user)[0]}</Badge>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: 14, textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{user.day}/14</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>ngày lộ trình</div>
            </div>
            <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: 14, textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{user.adherence}%</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>tuân thủ</div>
            </div>
            <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: 14, textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{user.area}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>vùng tập</div>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: 'var(--shadow-card)', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Xu hướng mức đau ({product.name.split('·')[1] || product.name})</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 70 }}>
              {trend.map((v, i) => (
                <div key={i} style={{ flex: 1, height: (v / 10) * 60 + 4, borderRadius: 4, background: 'var(--color-primary)' }} />
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>Ngày 1 → {trend.length} · thang điểm 0–10</div>
          </div>
          {!readOnly && <React.Fragment>
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: 'var(--shadow-card)', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Phân quyền tài khoản</div>
              <select value={permRole} onChange={e => setPermRole(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
                {USER_ROLE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <button onClick={saveRole} disabled={!roleDirty} style={{ width: '100%', border: 'none', background: roleDirty ? 'var(--color-primary)' : 'var(--color-primary-tint-10)', color: roleDirty ? '#fff' : 'var(--color-primary)', borderRadius: 10, padding: '9px 0', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 13, cursor: roleDirty ? 'pointer' : 'default' }}>{roleDirty ? 'Lưu phân quyền' : 'Đang áp dụng'}</button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button onClick={toggleLock} style={{ flex: 1, border: '1px solid var(--border-input)', background: 'none', color: 'var(--error)', borderRadius: 10, padding: '11px 0', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>{user.locked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}</button>
            </div>
          </React.Fragment>}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ item }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '64px 24px', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--color-primary-tint-10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconX name={item.icon} size={26} color="var(--color-primary)" />
      </div>
      <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>{item.label}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 320 }}>Mục quản lý này đang được thiết kế chi tiết. Cho tôi biết bạn cần những thao tác cụ thể nào ở đây.</div>
    </div>
  );
}

function SectionCard({ title, action, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function PrimaryBtn({ children, onClick, icon }) {
  return <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: 10, padding: '9px 16px', fontFamily: 'var(--font-family)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{icon && <IconX name={icon} size={14} color="#fff" />}{children}</button>;
}
function GhostBtn({ children, onClick, color }) {
  return <button onClick={onClick} style={{ border: '1px solid var(--border-input)', background: 'none', color: color || 'var(--text-primary)', borderRadius: 8, padding: '6px 12px', fontFamily: 'var(--font-family)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{children}</button>;
}
function Badge({ children, color, bg }) {
  return <span style={{ fontSize: 11.5, fontWeight: 700, color, background: bg, padding: '3px 9px', borderRadius: 999 }}>{children}</span>;
}

function RoutineView() {
  const [productId, setProductId] = React.useState(D.products[0].id);
  const product = D.products.find(p => p.id === productId);
  const storeItem = D.storeCategories.flatMap(c => c.items).find(it => it.id === productId);
  const [infoDrafts, setInfoDrafts] = React.useState(() => Object.fromEntries(D.products.map(p => [p.id, { name: p.name, link: (D.storeCategories.flatMap(c => c.items).find(it => it.id === p.id) || {}).link || '' }])));
  const [days, setDays] = React.useState(() => Object.fromEntries(D.products.map(p => [p.id, p.days])));
  const [editInfo, setEditInfo] = React.useState(false);
  const [dayModal, setDayModal] = React.useState(null);
  const [phase, setPhase] = React.useState('');
  const [type, setType] = React.useState('train');
  const [video, setVideo] = React.useState('');
  const info = infoDrafts[productId];
  const dayList = days[productId];
  function saveInfo() {
    setInfoDrafts(d => ({ ...d, [productId]: { ...d[productId] } }));
    setEditInfo(false);
    pushToast('Đã lưu thông tin ' + info.name);
  }
  function openNewDay() { setDayModal('new'); setPhase(product.phases[0].name); setType('train'); setVideo(''); }
  function openEditDay(d) { setDayModal(d.id); setPhase(d.phase); setType(d.type); setVideo(d.video); }
  function saveDay() {
    setDays(ds => {
      const list = ds[productId];
      if (dayModal === 'new') {
        const id = list.length ? Math.max(...list.map(d => d.id)) + 1 : 1;
        return { ...ds, [productId]: [...list, { id, phase, type, video: video.trim(), status: 'locked' }] };
      }
      return { ...ds, [productId]: list.map(d => d.id === dayModal ? { ...d, phase, type, video: video.trim() } : d) };
    });
    pushToast(dayModal === 'new' ? 'Đã thêm ngày mới' : 'Đã lưu Ngày ' + dayModal);
    setDayModal(null);
  }
  function deleteDay(id) {
    setDays(ds => ({ ...ds, [productId]: ds[productId].filter(d => d.id !== id) }));
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {D.products.map(p => (
          <button key={p.id} onClick={() => setProductId(p.id)} style={{ border: productId === p.id ? 'none' : '1px solid var(--border-input)', background: productId === p.id ? 'var(--color-primary)' : '#fff', color: productId === p.id ? '#fff' : 'var(--text-primary)', borderRadius: 999, padding: '9px 18px', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>{p.name.split('·')[1] ? p.name.split('·')[1].trim() : p.name}</button>
        ))}
      </div>
      <SectionCard title={info.name} action={<GhostBtn onClick={() => setEditInfo(true)}>Sửa thông tin</GhostBtn>}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13.5, color: 'var(--text-secondary)' }}>
          <div><strong style={{ color: 'var(--text-primary)' }}>{product.totalDays}</strong> ngày · {product.phases.length} giai đoạn</div>
          <div>Giá: <strong style={{ color: 'var(--text-primary)' }}>{storeItem ? storeItem.price : '—'}</strong></div>
          <div>Link sản phẩm: {info.link ? <a href={info.link} target="_blank" rel="noopener">Xem trang sản phẩm ↗</a> : <span style={{ color: 'var(--text-muted)' }}>Chưa có link</span>}</div>
        </div>
      </SectionCard>
      <SectionCard title={'Lịch trình ' + product.totalDays + ' ngày'} action={<PrimaryBtn icon="plus" onClick={openNewDay}>Thêm ngày mới</PrimaryBtn>}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase' }}>
            <th style={{ padding: '0 8px 10px' }}>Ngày</th><th style={{ padding: '0 8px 10px' }}>Giai đoạn</th><th style={{ padding: '0 8px 10px' }}>Loại</th><th style={{ padding: '0 8px 10px' }}>Video</th><th></th>
          </tr></thead>
          <tbody>
            {dayList.slice(0, 14).map(d => (
              <tr key={d.id} style={{ borderTop: '1px solid var(--divider)' }}>
                <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>Ngày {d.id}</td>
                <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{d.phase}</td>
                <td style={{ padding: '10px 8px' }}>{d.type === 'rest' ? <Badge color="#B9860B" bg="rgba(185,134,11,0.12)">Nghỉ</Badge> : <Badge color="#1E9E5E" bg="rgba(30,158,94,0.12)">Tập</Badge>}</td>
                <td style={{ padding: '10px 8px' }}>{d.video ? <a href={d.video} target="_blank" rel="noopener" style={{ fontSize: 13 }}>Xem video ↗</a> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}><div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button onClick={() => openEditDay(d)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><IconX name="pencil" size={16} color="var(--color-primary)" /></button><button onClick={() => deleteDay(d.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><IconX name="trash-2" size={16} color="var(--error)" /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10 }}>Hiển thị 14/{dayList.length} ngày</div>
      </SectionCard>
      {editInfo && (
        <Modal title={'Sửa thông tin ' + product.name} onClose={() => setEditInfo(false)} width={440} footer={<React.Fragment><GhostBtn onClick={() => setEditInfo(false)}>Hủy</GhostBtn><PrimaryBtn onClick={saveInfo}>Lưu thay đổi</PrimaryBtn></React.Fragment>}>
          <FieldLabel>Tên hiển thị</FieldLabel>
          <input value={info.name} onChange={e => setInfoDrafts(d => ({ ...d, [productId]: { ...d[productId], name: e.target.value } }))} style={{ ...inputStyle, marginBottom: 14 }} />
          <FieldLabel>Link trang sản phẩm</FieldLabel>
          <input value={info.link} onChange={e => setInfoDrafts(d => ({ ...d, [productId]: { ...d[productId], link: e.target.value } }))} placeholder="https://..." style={inputStyle} />
        </Modal>
      )}
      {dayModal !== null && (
        <Modal title={dayModal === 'new' ? 'Thêm ngày mới' : 'Sửa Ngày ' + dayModal} onClose={() => setDayModal(null)} width={420} footer={<React.Fragment><GhostBtn onClick={() => setDayModal(null)}>Hủy</GhostBtn><PrimaryBtn onClick={saveDay}>{dayModal === 'new' ? 'Thêm ngày' : 'Lưu thay đổi'}</PrimaryBtn></React.Fragment>}>
          <FieldLabel>Giai đoạn</FieldLabel>
          <select value={phase} onChange={e => setPhase(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }}>
            {product.phases.map(ph => <option key={ph.name} value={ph.name}>{ph.name}</option>)}
          </select>
          <FieldLabel>Loại ngày</FieldLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[['train', 'Tập'], ['rest', 'Nghỉ']].map(([k, l]) => (
              <button key={k} onClick={() => setType(k)} style={{ flex: 1, border: type === k ? 'none' : '1px solid var(--border-input)', background: type === k ? 'var(--color-primary)' : 'none', color: type === k ? '#fff' : 'var(--text-primary)', borderRadius: 10, padding: '9px 0', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
          <FieldLabel>Link video</FieldLabel>
          <input value={video} onChange={e => setVideo(e.target.value)} placeholder="https://..." style={inputStyle} />
        </Modal>
      )}
    </div>
  );
}

function ProductsView() {
  const [cats, setCats] = React.useState(D.storeCategories);
  const [modal, setModal] = React.useState(null);
  const [name, setName] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [link, setLink] = React.useState('');
  function openNew(catId) { setModal({ catId, itemId: 'new' }); setName(''); setDesc(''); setPrice(''); setLink(''); }
  function openEdit(catId, it) { setModal({ catId, itemId: it.id }); setName(it.name); setDesc(it.desc); setPrice(it.price); setLink(it.link || ''); }
  function save() {
    setCats(cs => cs.map(c => {
      if (c.id !== modal.catId) return c;
      if (modal.itemId === 'new') {
        return { ...c, items: [...c.items, { id: 'p' + Date.now(), name: name.trim(), desc: desc.trim(), price: price.trim(), accent: 'var(--color-primary)', link: link.trim() }] };
      }
      return { ...c, items: c.items.map(it => it.id === modal.itemId ? { ...it, name: name.trim(), desc: desc.trim(), price: price.trim(), link: link.trim() } : it) };
    }));
    pushToast(modal.itemId === 'new' ? 'Đã thêm sản phẩm mới' : 'Đã lưu sản phẩm');
    setModal(null);
  }
  function remove(catId, itemId) {
    setCats(cs => cs.map(c => c.id === catId ? { ...c, items: c.items.filter(it => it.id !== itemId) } : c));
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {cats.map(cat => (
        <SectionCard key={cat.id} title={cat.title} action={<PrimaryBtn icon="plus" onClick={() => openNew(cat.id)}>Thêm sản phẩm</PrimaryBtn>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {cat.items.map((it, i) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: i > 0 ? '1px solid var(--divider)' : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, border: '2px solid ' + it.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconX name="box" size={16} color={it.accent} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{it.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{it.desc}</div>
                  {it.link && <a href={it.link} target="_blank" rel="noopener" style={{ fontSize: 12 }}>Xem trang sản phẩm ↗</a>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{it.price}</div>
                <div style={{ display: 'flex', gap: 10 }}><button onClick={() => openEdit(cat.id, it)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><IconX name="pencil" size={16} color="var(--color-primary)" /></button><button onClick={() => remove(cat.id, it.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><IconX name="trash-2" size={16} color="var(--error)" /></button></div>
              </div>
            ))}
          </div>
        </SectionCard>
      ))}
      {modal !== null && (
        <Modal title={modal.itemId === 'new' ? 'Thêm sản phẩm mới' : 'Sửa sản phẩm'} onClose={() => setModal(null)} width={440} footer={<React.Fragment><GhostBtn onClick={() => setModal(null)}>Hủy</GhostBtn><PrimaryBtn onClick={save}>{modal.itemId === 'new' ? 'Thêm sản phẩm' : 'Lưu thay đổi'}</PrimaryBtn></React.Fragment>}>
          <FieldLabel>Tên sản phẩm</FieldLabel>
          <input value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
          <FieldLabel>Mô tả</FieldLabel>
          <input value={desc} onChange={e => setDesc(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
          <FieldLabel>Giá</FieldLabel>
          <input value={price} onChange={e => setPrice(e.target.value)} placeholder="Ví dụ: 1.490.000₫" style={{ ...inputStyle, marginBottom: 14 }} />
          <FieldLabel>Link trang sản phẩm</FieldLabel>
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." style={inputStyle} />
        </Modal>
      )}
    </div>
  );
}

function AIPromptsView() {
  const [prompt, setPrompt] = React.useState('Bạn là Trợ lý AI của TheraHOME. Trả lời thân thiện, ngắn gọn, dựa trên lộ trình phục hồi của người dùng. Không đưa ra chẩn đoán y khoa; khi người dùng mô tả triệu chứng bất thường, khuyên họ liên hệ đội ngũ hỗ trợ hoặc bác sĩ.');
  const [replies, setReplies] = React.useState([
    'Cảm ơn bạn đã chia sẻ. Chuyên gia TheraHOME sẽ xem xét và điều chỉnh lộ trình phù hợp hơn cho bạn trong 24h.',
    'Xin chào! Tôi có thể giúp gì cho lộ trình tập của bạn hôm nay?'
  ]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionCard title="System prompt — Trợ lý AI" action={<PrimaryBtn onClick={() => pushToast('Đã lưu system prompt')}>Lưu thay đổi</PrimaryBtn>}>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} style={{ width: '100%', minHeight: 110, border: '1px solid var(--border-input)', borderRadius: 10, padding: 14, fontFamily: 'var(--font-family)', fontSize: 13.5, lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' }} />
      </SectionCard>
      <SectionCard title="Phản hồi mẫu" action={<PrimaryBtn icon="plus" onClick={() => pushToast('Đã thêm phản hồi mẫu')}>Thêm mẫu</PrimaryBtn>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {replies.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: i > 0 ? '1px solid var(--divider)' : 'none' }}>
              <div style={{ flex: 1, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r}</div>
              <GhostBtn color="var(--error)" onClick={() => setReplies(rs => rs.filter((_, idx) => idx !== i))}>Xóa</GhostBtn>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function TableShell({ subtitle, action, searchPlaceholder, filterOptions, columns, children }) {
  return (
    <div>
      {(subtitle || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{subtitle}</div>
          {action}
        </div>
      )}
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        {(searchPlaceholder || filterOptions) && (
          <div style={{ display: 'flex', gap: 12, padding: 20, borderBottom: '1px solid var(--divider)' }}>
            {searchPlaceholder && <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border-input)', borderRadius: 10, padding: '10px 14px' }}>
              <IconX name="search" size={16} color="var(--text-muted)" />
              <input placeholder={searchPlaceholder} style={{ border: 'none', outline: 'none', flex: 1, fontFamily: 'var(--font-family)', fontSize: 13.5 }} />
            </div>}
            {filterOptions && <select style={{ border: '1px solid var(--border-input)', borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--font-family)', fontSize: 13.5, color: 'var(--text-primary)', minWidth: 200 }}>
              {filterOptions.map(o => <option key={o}>{o}</option>)}
            </select>}
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase' }}>
            {columns.map(c => <th key={c} style={{ padding: '14px 20px' }}>{c}</th>)}
          </tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function CommunityView() {
  const [items, setItems] = React.useState(D.communityPosts.map(p => ({ ...p, pinned: false })));
  const [modal, setModal] = React.useState(null);
  const [commentsFor, setCommentsFor] = React.useState(null);
  const [meta, setMeta] = React.useState('');
  const [text, setText] = React.useState('');
  const [badge, setBadge] = React.useState('');
  function openNew() { setModal('new'); setMeta(''); setText(''); setBadge(''); }
  function openEdit(it) { setModal(it.id); setMeta(it.meta || ''); setText(it.text); setBadge(it.badge || ''); }
  function save() {
    if (modal === 'new') {
      setItems(its => [{ id: Date.now(), official: true, name: 'TheraHOME', meta: meta.trim() || 'Hướng dẫn', text: text.trim(), badge: badge.trim(), likes: 0, comments: 0, commentsList: [], pinned: false }, ...its]);
      pushToast('Đã đăng bài viết mới lên Cộng đồng');
    } else {
      setItems(its => its.map(it => it.id === modal ? { ...it, meta: meta.trim(), text: text.trim(), badge: badge.trim() } : it));
      pushToast('Đã lưu bài viết');
    }
    setModal(null);
  }
  function togglePin(id) {
    setItems(its => its.map(it => it.id === id ? { ...it, pinned: !it.pinned } : it));
  }
  const sorted = [...items].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const commentPost = items.find(it => it.id === commentsFor);
  return (
    <TableShell subtitle="Quản lý bài viết, ghim bài quan trọng và kiểm duyệt bình luận trong tab Cộng đồng của app." action={<PrimaryBtn icon="plus" onClick={openNew}>Đăng bài viết mới</PrimaryBtn>} searchPlaceholder="Tìm theo nội dung..." filterOptions={['Tất cả', 'Bài của TheraHOME', 'Bài của người dùng']} columns={['', 'Tác giả', 'Nhãn', 'Nội dung', 'Lượt thích', 'Bình luận', 'Thao tác']}>
      {sorted.map(it => (
        <tr key={it.id} style={{ borderTop: '1px solid var(--divider)', background: it.pinned ? 'var(--color-primary-tint-10)' : 'none' }}>
          <td style={{ padding: '14px 0 14px 20px' }}><button onClick={() => togglePin(it.id)} title={it.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><IconX name={it.pinned ? 'bookmark' : 'bookmark'} size={16} color={it.pinned ? 'var(--color-primary)' : 'var(--text-muted)'} /></button></td>
          <td style={{ padding: '14px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar name={it.name} color={it.avatarColor} size={32} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{it.name}{it.official && <span style={{ color: 'var(--color-primary)' }}> ✓</span>}</div>
            </div>
          </td>
          <td style={{ padding: '14px 20px' }}>{it.meta && <Badge color="var(--color-primary)" bg="var(--color-primary-tint-10)">{it.meta}</Badge>}</td>
          <td style={{ padding: '14px 20px', color: 'var(--text-secondary)', maxWidth: 320 }}>{it.text}</td>
          <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>{it.likes}</td>
          <td style={{ padding: '14px 20px' }}><button onClick={() => setCommentsFor(it.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 13 }}>{it.comments}</button></td>
          <td style={{ padding: '14px 20px' }}><div style={{ display: 'flex', gap: 10 }}><button onClick={() => openEdit(it)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><IconX name="pencil" size={16} color="var(--color-primary)" /></button><button onClick={() => setItems(its => its.filter(x => x.id !== it.id))} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><IconX name="trash-2" size={16} color="var(--error)" /></button></div></td>
        </tr>
      ))}
      {modal !== null && (
        <Modal title={modal === 'new' ? 'Đăng bài viết mới' : 'Sửa bài viết'} onClose={() => setModal(null)} width={480} footer={<React.Fragment><GhostBtn onClick={() => setModal(null)}>Hủy</GhostBtn><PrimaryBtn onClick={save}>{modal === 'new' ? 'Đăng bài' : 'Lưu thay đổi'}</PrimaryBtn></React.Fragment>}>
          <FieldLabel>Nhãn (tùy chọn)</FieldLabel>
          <input value={meta} onChange={e => setMeta(e.target.value)} placeholder="Ví dụ: Hướng dẫn" style={{ ...inputStyle, marginBottom: 14 }} />
          <FieldLabel>Nội dung</FieldLabel>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Nội dung bài viết đăng lên Cộng đồng..." style={{ ...inputStyle, minHeight: 100, resize: 'vertical', marginBottom: 14 }} />
          <FieldLabel>Badge (tùy chọn, ví dụ thành tích)</FieldLabel>
          <input value={badge} onChange={e => setBadge(e.target.value)} placeholder="Ví dụ: Hoàn thành Giai đoạn 1" style={inputStyle} />
        </Modal>
      )}
      {commentPost && (
        <Modal title={'Bình luận · ' + commentPost.name} onClose={() => setCommentsFor(null)} width={460}>
          {(!commentPost.commentsList || commentPost.commentsList.length === 0) && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chưa có bình luận nào.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {(commentPost.commentsList || []).map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '12px 0', borderTop: i > 0 ? '1px solid var(--divider)' : 'none' }}>
                <Avatar name={c.name} color={c.avatarColor} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}{c.official && <span style={{ color: 'var(--color-primary)' }}> ✓</span>} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {c.time}</span></div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{c.text}</div>
                </div>
                <button onClick={() => setItems(its => its.map(it => it.id === commentPost.id ? { ...it, commentsList: it.commentsList.filter((_, idx) => idx !== i), comments: it.comments - 1 } : it))} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignSelf: 'flex-start' }}><IconX name="trash-2" size={14} color="var(--error)" /></button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </TableShell>
  );
}

function LandingOrdersView() {
  const [items, setItems] = React.useState(D.landingOrders);
  const [modal, setModal] = React.useState(null);
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [product, setProduct] = React.useState(D.products[0].id);
  function openNew() { setModal('new'); setPhone(''); setEmail(''); setProduct(D.products[0].id); }
  function openEdit(it) { setModal(it.id); setPhone(it.phone); setEmail(it.email); setProduct(D.products.find(p => p.name === it.product) ? D.products.find(p => p.name === it.product).id : D.products[0].id); }
  function save() {
    const productName = D.products.find(p => p.id === product).name;
    if (modal === 'new') {
      setItems(its => [{ id: Date.now(), phone: phone.trim(), email: email.trim(), product: productName, status: 'pending', code: 'TH-' + product.toUpperCase().slice(0, 4) + '-' + Math.floor(1000 + Math.random() * 8999), orderDate: '15/08/2026' }, ...its]);
      pushToast('Đã thêm đơn hàng mới');
    } else {
      setItems(its => its.map(it => it.id === modal ? { ...it, phone: phone.trim(), email: email.trim(), product: productName } : it));
      pushToast('Đã lưu đơn hàng');
    }
    setModal(null);
  }
  function toggleStatus(it) {
    setItems(its => its.map(x => x.id === it.id ? { ...x, status: x.status === 'activated' ? 'pending' : 'activated' } : x));
  }
  return (
    <TableShell subtitle="Quản lý mã kích hoạt, đối chiếu SĐT/email đặt hàng trên landing page để cho phép kích hoạt thiết bị trong app." action={<PrimaryBtn icon="plus" onClick={openNew}>Thêm đơn hàng</PrimaryBtn>} searchPlaceholder="Tìm theo SĐT hoặc email..." filterOptions={['Tất cả trạng thái', 'Đã kích hoạt', 'Chưa kích hoạt']} columns={['SĐT', 'Email', 'Sản phẩm', 'Mã', 'Trạng thái', 'Ngày đặt', 'Thao tác']}>
      {items.map(it => (
        <tr key={it.id} style={{ borderTop: '1px solid var(--divider)' }}>
          <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-primary)' }}>{it.phone}</td>
          <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>{it.email}</td>
          <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>{it.product}</td>
          <td style={{ padding: '14px 20px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{it.code}</td>
          <td style={{ padding: '14px 20px' }}><button onClick={() => toggleStatus(it)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>{it.status === 'activated' ? <Badge color="#1E9E5E" bg="rgba(30,158,94,0.12)">Đã kích hoạt</Badge> : <Badge color="#B9860B" bg="rgba(185,134,11,0.12)">Chưa kích hoạt</Badge>}</button></td>
          <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>{it.orderDate}</td>
          <td style={{ padding: '14px 20px' }}><div style={{ display: 'flex', gap: 10 }}><button onClick={() => openEdit(it)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><IconX name="pencil" size={16} color="var(--color-primary)" /></button><button onClick={() => setItems(its => its.filter(x => x.id !== it.id))} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><IconX name="trash-2" size={16} color="var(--error)" /></button></div></td>
        </tr>
      ))}
      {modal !== null && (
        <Modal title={modal === 'new' ? 'Thêm đơn hàng' : 'Sửa đơn hàng'} onClose={() => setModal(null)} width={440} footer={<React.Fragment><GhostBtn onClick={() => setModal(null)}>Hủy</GhostBtn><PrimaryBtn onClick={save}>{modal === 'new' ? 'Thêm đơn hàng' : 'Lưu thay đổi'}</PrimaryBtn></React.Fragment>}>
          <FieldLabel>Số điện thoại đặt hàng</FieldLabel>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="090xxxxxxx" style={{ ...inputStyle, marginBottom: 14 }} />
          <FieldLabel>Email</FieldLabel>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="ten@email.com" style={{ ...inputStyle, marginBottom: 14 }} />
          <FieldLabel>Sản phẩm đã mua</FieldLabel>
          <select value={product} onChange={e => setProduct(e.target.value)} style={inputStyle}>
            {D.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Modal>
      )}
    </TableShell>
  );
}

function NotificationsAdminView() {
  const typeMeta = { schedule: ['Lịch tập', '#0066AD', 'var(--color-primary-tint-10)', 'calendar'], ad: ['Ưu đãi', '#B9860B', 'rgba(185,134,11,0.12)', 'megaphone'], blog: ['Bài viết', '#1E9E5E', 'rgba(30,158,94,0.12)', 'book'] };
  const targetMeta = { all: 'Tất cả người dùng', 'neck-plus': 'Người dùng TheraNECK+', 'neck-pro': 'Người dùng TheraNECK PRO', 'back-plus': 'Người dùng TheraBACK+', 'back-pro': 'Người dùng TheraBACK PRO' };
  const [items, setItems] = React.useState(D.notifications.map(n => ({ ...n, target: 'all', status: 'sent' })));
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [type, setType] = React.useState('schedule');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [target, setTarget] = React.useState('all');
  const [when, setWhen] = React.useState('now');
  const [scheduleAt, setScheduleAt] = React.useState('');
  function resetCompose() { setTitle(''); setBody(''); setTarget('all'); setWhen('now'); setScheduleAt(''); setType('schedule'); }
  function send() {
    const isScheduled = when === 'later' && scheduleAt;
    setItems(ns => [{ id: Date.now(), type, title: title.trim(), body: body.trim(), time: isScheduled ? scheduleAt : 'Vừa gửi', read: false, target, status: isScheduled ? 'scheduled' : 'sent' }, ...ns]);
    setComposeOpen(false); resetCompose();
    pushToast(isScheduled ? 'Đã lên lịch thông báo' : 'Đã gửi thông báo tới ' + targetMeta[target]);
  }
  function cancelScheduled(id) {
    setItems(ns => ns.filter(n => n.id !== id));
    pushToast('Đã hủy lịch thông báo');
  }
  function sendNow(id) {
    setItems(ns => ns.map(n => n.id === id ? { ...n, status: 'sent', time: 'Vừa gửi' } : n));
    pushToast('Đã gửi thông báo ngay');
  }
  const meta = typeMeta[type];
  return (
    <SectionCard title="Thông báo" action={<PrimaryBtn icon="plus" onClick={() => setComposeOpen(true)}>Tạo thông báo mới</PrimaryBtn>}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase' }}>
          <th style={{ padding: '0 8px 10px' }}>Loại</th><th style={{ padding: '0 8px 10px' }}>Nội dung</th><th style={{ padding: '0 8px 10px' }}>Đối tượng</th><th style={{ padding: '0 8px 10px' }}>Thời gian</th><th style={{ padding: '0 8px 10px' }}>Trạng thái</th><th></th>
        </tr></thead>
        <tbody>
          {items.map(n => {
            const [label, color, bg] = typeMeta[n.type] || typeMeta.schedule;
            return (
              <tr key={n.id} style={{ borderTop: '1px solid var(--divider)' }}>
                <td style={{ padding: '10px 8px' }}><Badge color={color} bg={bg}>{label}</Badge></td>
                <td style={{ padding: '10px 8px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{n.body}</div>
                </td>
                <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{targetMeta[n.target] || 'Tất cả người dùng'}</td>
                <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{n.time}</td>
                <td style={{ padding: '10px 8px' }}>{n.status === 'scheduled' ? <Badge color="#B9860B" bg="rgba(185,134,11,0.12)">Đã lên lịch</Badge> : <Badge color="#1E9E5E" bg="rgba(30,158,94,0.12)">Đã gửi</Badge>}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{n.status === 'scheduled' && <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><GhostBtn onClick={() => sendNow(n.id)}>Gửi ngay</GhostBtn><GhostBtn color="var(--error)" onClick={() => cancelScheduled(n.id)}>Hủy</GhostBtn></div>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {composeOpen && (
        <Modal title="Tạo thông báo mới" onClose={() => setComposeOpen(false)} width={480} footer={<React.Fragment><GhostBtn onClick={() => setComposeOpen(false)}>Hủy</GhostBtn><PrimaryBtn onClick={send} disabled={!title.trim() || (when === 'later' && !scheduleAt)}>{when === 'later' ? 'Lên lịch gửi' : 'Gửi thông báo'}</PrimaryBtn></React.Fragment>}>
          <FieldLabel>Loại thông báo</FieldLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {Object.keys(typeMeta).map(k => (
              <button key={k} onClick={() => setType(k)} style={{ flex: 1, border: type === k ? 'none' : '1px solid var(--border-input)', background: type === k ? typeMeta[k][1] : 'none', color: type === k ? '#fff' : 'var(--text-primary)', borderRadius: 10, padding: '9px 0', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{typeMeta[k][0]}</button>
            ))}
          </div>
          <FieldLabel>Đối tượng nhận</FieldLabel>
          <select value={target} onChange={e => setTarget(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }}>
            {Object.keys(targetMeta).map(k => <option key={k} value={k}>{targetMeta[k]}</option>)}
          </select>
          <FieldLabel>Tiêu đề</FieldLabel>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ví dụ: Đến giờ tập hôm nay" style={{ ...inputStyle, marginBottom: 14 }} />
          <FieldLabel>Nội dung</FieldLabel>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Ví dụ: Ngày 14 · Duy trì đang chờ bạn" style={{ ...inputStyle, minHeight: 70, resize: 'vertical', marginBottom: 14 }} />
          <FieldLabel>Thời điểm gửi</FieldLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[['now', 'Gửi ngay'], ['later', 'Lên lịch']].map(([k, l]) => (
              <button key={k} onClick={() => setWhen(k)} style={{ flex: 1, border: when === k ? 'none' : '1px solid var(--border-input)', background: when === k ? 'var(--color-primary)' : 'none', color: when === k ? '#fff' : 'var(--text-primary)', borderRadius: 10, padding: '9px 0', fontFamily: 'var(--font-family)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
          {when === 'later' && <input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }} />}
          <FieldLabel>Xem trước (giống chuông thông báo trong app)</FieldLabel>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', background: 'var(--bg-card-alt)', borderRadius: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: meta[2], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconX name={meta[3]} size={17} color={meta[1]} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{title || '(Tiêu đề thông báo)'}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{body || '(Nội dung thông báo)'}</div>
            </div>
          </div>
        </Modal>
      )}
    </SectionCard>
  );
}

