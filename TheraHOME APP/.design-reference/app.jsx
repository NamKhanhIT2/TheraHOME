function App() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "startTab": "home",
    "showAssistant": true,
    "defaultDarkMode": false,
    "waterGoal": 8
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [stage, setStage] = React.useState('welcome');
  const [qIndex, setQIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState({});
  const [tab, setTab] = React.useState(t.startTab);
  const [view, setView] = React.useState(null);
  const [darkMode, setDarkMode] = React.useState(t.defaultDarkMode);
  const [water, setWater] = React.useState(4);
  const [productPainLevels, setProductPainLevels] = React.useState(() => { const m = {}; D.products.forEach(p => { m[p.id] = p.painLevels.slice(); }); return m; });
  const [loggedDays, setLoggedDays] = React.useState({});
  const [pendingDay, setPendingDay] = React.useState(null);
  const [pendingProductId, setPendingProductId] = React.useState(null);
  const [communityPosts, setCommunityPosts] = React.useState(D.communityPosts);
  const [savedPostIds, setSavedPostIds] = React.useState([]);
  const [showNotifPrompt, setShowNotifPrompt] = React.useState(false);
  const [notifications, setNotifications] = React.useState(D.notifications);
  const unreadCount = notifications.filter(n => !n.read).length;
  function markNotificationRead(id) { setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n)); }
  const questions = APP_DATA.questions;

  function congratulate(postId) {
    setCommunityPosts(ps => ps.map(p => p.id === postId && !p.congratulatedByMe ? { ...p, likes: p.likes + 1, congratulatedByMe: true } : p));
  }
  function toggleLikePost(postId) {
    setCommunityPosts(ps => ps.map(p => p.id === postId ? { ...p, likedByMe: !p.likedByMe, likes: p.likes + (p.likedByMe ? -1 : 1) } : p));
  }
  function toggleSavePost(postId) {
    setSavedPostIds(s => s.includes(postId) ? s.filter(id => id !== postId) : [...s, postId]);
  }
  function deletePost(postId) {
    setCommunityPosts(ps => ps.filter(p => p.id !== postId));
  }
  function addComment(postId, text, parentIndex) {
    setCommunityPosts(ps => ps.map(p => {
      if (p.id !== postId) return p;
      if (parentIndex == null) {
        const newComment = { name: D.user.name, avatarColor: '#C9BEFF', text, time: 'Vừa xong', likes: 0, replies: [] };
        return { ...p, comments: p.comments + 1, commentsList: [...(p.commentsList || []), newComment] };
      }
      const list = (p.commentsList || []).slice();
      const target = { ...list[parentIndex] };
      target.replies = [...(target.replies || []), { name: D.user.name, avatarColor: '#C9BEFF', text, time: 'Vừa xong' }];
      list[parentIndex] = target;
      return { ...p, comments: p.comments + 1, commentsList: list };
    }));
  }
  function likeComment(postId, commentIndex) {
    setCommunityPosts(ps => ps.map(p => {
      if (p.id !== postId) return p;
      const list = (p.commentsList || []).slice();
      const c = { ...list[commentIndex] };
      c.likedByMe = !c.likedByMe;
      c.likes = (c.likes || 0) + (c.likedByMe ? 1 : -1);
      list[commentIndex] = c;
      return { ...p, commentsList: list };
    }));
  }
  function submitPost(text, hasImage) {
    setCommunityPosts(ps => [{ id: Date.now(), name: D.user.name, avatarColor: '#C9BEFF', meta: 'Ngày ' + D.user.currentDay, text, image: !!hasImage, likes: 0, comments: 0, tag: 'story', commentsList: [] }, ...ps]);
    setView(null);
  }

  function logPain(productId, dayId, v) {
    setProductPainLevels(prev => {
      const arr = (prev[productId] || []).slice();
      const idx = dayId - 1;
      while (arr.length <= idx) arr.push(v);
      arr[idx] = v;
      return { ...prev, [productId]: arr };
    });
  }
  function requestDay(dayId, productId, status) {
    const pid = productId || D.products[0].id;
    if (status && status !== 'current') { openDay(dayId, pid); return; }
    if (loggedDays[pid + '-' + dayId]) { openDay(dayId, pid); return; }
    setPendingDay(dayId); setPendingProductId(pid);
  }
  function confirmPain(v) {
    logPain(pendingProductId, pendingDay, v);
    setLoggedDays(prev => ({ ...prev, [pendingProductId + '-' + pendingDay]: true }));
    openDay(pendingDay, pendingProductId);
    setPendingDay(null); setPendingProductId(null);
  }
  function cancelPain() { setPendingDay(null); setPendingProductId(null); }

  function selectAnswer(v) {
    const q = questions[qIndex];
    if (q.multi) {
      setAnswers(prev => {
        const cur = prev[q.key] || [];
        const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
        return { ...prev, [q.key]: next };
      });
    } else {
      setAnswers({ ...answers, [q.key]: v });
    }
  }
  function nextQuestion() {
    if (qIndex < questions.length - 1) setQIndex(qIndex + 1);
    else setStage('consent');
  }
  function backQuestion() {
    if (qIndex > 0) setQIndex(qIndex - 1);
    else setStage('welcome');
  }
  function openDay(dayId, productId) { setView({ type: 'day', dayId, productId }); }
  function goTab(t) { setTab(t); setView(null); }

  let content, showNav = false;
  if (stage === 'welcome') content = <IntakeWelcome onNext={() => setStage('question')} />;
  else if (stage === 'question') content = <QuestionScreen q={questions[qIndex]} index={qIndex} total={questions.length} selected={answers[questions[qIndex].key]} onSelect={selectAnswer} onNext={nextQuestion} onBack={backQuestion} />;
  else if (stage === 'consent') content = <ConsentScreen onFinish={() => setStage('login')} />;
  else if (stage === 'login') content = <LoginScreen onSubmit={() => setStage('activate')} onBack={() => setStage('consent')} />;
  else if (stage === 'activate') content = <ActivationScreen onContinue={() => { setStage('app'); setShowNotifPrompt(true); }} onBack={() => setStage('login')} />;
  else if (view && view.type === 'day') content = <DayDetailScreen dayId={view.dayId} productId={view.productId} onBack={() => setView(null)} />;
  else if (view && view.type === 'profile') content = <ProfileScreen onBack={() => setView(null)} darkMode={darkMode} onToggleDark={() => setDarkMode(!darkMode)} initialSub={view.initialSub} onOpenAIChat={() => setView({ type: 'aiChat' })} onOpenSupportChat={() => setView({ type: 'chat' })} />;
  else if (view && view.type === 'createPost') content = <CreatePostScreen onClose={() => setView(null)} onSubmit={submitPost} />;
  else if (view && view.type === 'chat') content = <AdminChatScreen onBack={() => setView(null)} />;
  else if (view && view.type === 'aiChat') content = <AIChatScreen onBack={() => setView(null)} onEscalate={() => setView({ type: 'chat' })} />;
  else if (view && view.type === 'comments') content = <CommentsScreen post={communityPosts.find(p => p.id === view.postId)} onBack={() => setView(null)} onAddComment={(text, parentIndex) => addComment(view.postId, text, parentIndex)} onLikeComment={commentIndex => likeComment(view.postId, commentIndex)} />;
  else if (view && view.type === 'notifications') content = <NotificationInboxScreen notifications={notifications} onBack={() => setView(null)} onRead={markNotificationRead} onOpenDay={(dayId, productId) => requestDay(dayId, productId, 'current')} />;
  else {
    showNav = true;
    if (tab === 'home') content = <HomeScreen onGoToday={() => requestDay(APP_DATA.user.currentDay, D.products[0].id)} onSeeRoadmap={() => goTab('roadmap')} onSeeBlog={() => goTab('community')} onOpenProfile={() => setView({ type: 'profile' })} onOpenNotifications={() => setView({ type: 'notifications' })} unreadCount={unreadCount} water={water} onWaterChange={setWater} productPainLevels={productPainLevels} waterGoal={t.waterGoal} />;
    else if (tab === 'roadmap') content = <RoadmapScreen onOpenDay={requestDay} />;
    else if (tab === 'store') content = <StoreScreen />;
    else content = <CommunityScreen posts={communityPosts} savedPostIds={savedPostIds} onCongratulate={congratulate} onToggleLike={toggleLikePost} onToggleSave={toggleSavePost} onDeletePost={deletePost} onOpenComments={postId => setView({ type: 'comments', postId })} onOpenCreatePost={() => setView({ type: 'createPost' })} onOpenChat={() => setView({ type: 'chat' })} />;
  }

  return (
    <React.Fragment>
    <IOSDevice dark={darkMode}>
      <div className={darkMode ? 'theme-dark' : ''} style={{ height: '100%', position: 'relative' }}>
        {content}
        {showNav && t.showAssistant && <AssistantBubble onOpenAIChat={() => setView({ type: 'aiChat' })} onOpenSupportChat={() => setView({ type: 'chat' })} />}
        {showNav && <BottomNav active={tab} onChange={goTab} />}
        {pendingDay !== null && <PainScaleModal dayId={pendingDay} onCancel={cancelPain} onConfirm={confirmPain} />}
        {showNotifPrompt && <NotificationPermissionModal onAllow={() => setShowNotifPrompt(false)} onDeny={() => setShowNotifPrompt(false)} />}
      </div>
    </IOSDevice>
    <TweaksPanel>
      <TweakSection label="Khởi động" />
      <TweakRadio label="Tab mở đầu" value={t.startTab} options={['home', 'roadmap', 'store', 'community']} onChange={v => setTweak('startTab', v)} />
      <TweakToggle label="Bật chế độ tối mặc định" value={t.defaultDarkMode} onChange={v => setTweak('defaultDarkMode', v)} />
      <TweakSection label="Tính năng" />
      <TweakToggle label="Hiển thị bọt trò chuyện (FAB)" value={t.showAssistant} onChange={v => setTweak('showAssistant', v)} />
      <TweakSlider label="Mục tiêu uống nước mặc định" value={t.waterGoal} min={4} max={12} unit=" cốc" onChange={v => setTweak('waterGoal', v)} />
    </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
