function CareApp() {
  const [active, setActive] = React.useState('chat');
  const NAV = NAV_CARE;
  const item = NAV.find(n => n.id === active) || NAV[0];
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'var(--font-family)', background: 'var(--bg-app)' }}>
      <div style={{ width: 260, flexShrink: 0, background: '#fff', borderRight: '1px solid var(--divider)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '22px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)' }}>TheraHOME</div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-tint-10)', padding: '2px 8px', borderRadius: 999 }}>CSKH</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px' }}>
          {NAV.map(n => {
            const isActive = n.id === active;
            return (
              <button key={n.id} onClick={() => setActive(n.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, border: 'none', background: isActive ? 'var(--color-primary-tint-10)' : 'none', color: isActive ? 'var(--color-primary)' : 'var(--text-primary)', borderRadius: 10, padding: '10px 12px', fontFamily: 'var(--font-family)', fontSize: 14, fontWeight: isActive ? 700 : 500, cursor: 'pointer', textAlign: 'left', marginBottom: 2 }}>
                <IconX name={n.icon} size={18} color={isActive ? 'var(--color-primary)' : 'var(--text-secondary)'} />
                {n.label}
              </button>
            );
          })}
        </div>
        <div style={{ borderTop: '1px solid var(--divider)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--color-primary-tint-10)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>C</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>cskh@therahome.vn</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chăm sóc khách hàng</div>
            </div>
          </div>
          <button onClick={() => pushToast('Đang đăng xuất...')} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', color: 'var(--error)', fontFamily: 'var(--font-family)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            <IconX name="log-out" size={16} color="var(--error)" />Đăng xuất
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--bg-app)', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 32px 16px' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border-input)', borderRadius: 10, padding: '8px 12px', width: 240 }}>
              <IconX name="search" size={15} color="var(--text-muted)" />
              <input placeholder="Tìm kiếm..." style={{ border: 'none', outline: 'none', flex: 1, fontFamily: 'var(--font-family)', fontSize: 13 }} />
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fff', border: '1px solid var(--border-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconX name="bell" size={16} color="var(--text-secondary)" />
            </div>
          </div>
        </div>
        <div style={{ padding: '0 32px 40px' }}>
          {active === 'chat' && <ChatView />}
          {active === 'notifications' && <NotificationsAdminView />}
          {active === 'users' && <UsersView role="care" />}
        </div>
      </div>
      <ToastHost />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<CareApp />);
