/* =====================================================
   WorkBuddy · 森系像素工作台 · 应用逻辑
   ===================================================== */

// ============= 数据层 =============
const DB = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};
const STORE = {
  todos:     () => DB.get('wb_todos', []),
  setTodos:  (v) => DB.set('wb_todos', v),
  records:   () => DB.get('wb_records', []),
  setRecords:(v) => DB.set('wb_records', v),
  recordTypes:() => DB.get('wb_record_types', []),
  setRecordTypes:(v) => DB.set('wb_record_types', v),
  journal:   () => DB.get('wb_journal', []),
  setJournal:(v) => DB.set('wb_journal', v),
  notes:     () => DB.get('wb_notes', []),
  setNotes:  (v) => DB.set('wb_notes', v),
  reminders: () => DB.get('wb_reminders', []),
  setReminders:(v) => DB.set('wb_reminders', v),
  coins:     () => DB.get('wb_coins', { balance: 0, history: [] }),
  setCoins:  (v) => DB.set('wb_coins', v),
  setting:   () => DB.get('wb_setting', { pushEnabled: false, dailyBudget: 30 }),
  setSetting:(v) => DB.set('wb_setting', v),
  todayKey:  () => new Date().toISOString().slice(0, 10),
  weekKey:   () => {
    const d = new Date();
    const year = d.getFullYear();
    const onejan = new Date(year, 0, 1);
    const wk = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return `${year}-W${wk}`;
  }
};

// ============= 考公数据层 =============
const STORE_GK = {
  gkReads:    () => DB.get('wb_gk_reads', {}),           // {dateKey: [commonId...]}
  setGkReads: (v) => DB.set('wb_gk_reads', v),
  gkProgress: () => DB.get('wb_gk_progress', { wrong: {}, correct: {} }), // {quizId: count}
  setGkProgress:(v) => DB.set('wb_gk_progress', v),
  gkReward:   () => DB.get('wb_gk_reward', {}),          // {dateKey: 当日已奖题数}
  setGkReward:(v) => DB.set('wb_gk_reward', v),
  gkFav:      () => DB.get('wb_gk_fav', []),             // [{id,type:'common'|'quiz',refId,favDate}]
  setGkFav:   (v) => DB.set('wb_gk_fav', v),
  cycle:      () => DB.get('wb_cycle', { periods: [], settings: { cycleLen: 28, periodLen: 5 } }),
  setCycle:   (v) => DB.set('wb_cycle', v),
  // 常识池缓存:每次拉取的条目累积存储,供离线/收藏回显
  gkPool:     () => DB.get('wb_gk_pool', []),
  setGkPool:  (v) => DB.set('wb_gk_pool', v),
  // 图推题池缓存
  gkQuizPool: () => DB.get('wb_gk_quizpool', []),
  setGkQuizPool:(v) => DB.set('wb_gk_quizpool', v),
  gkDailyCache:(d) => DB.get('wb_gk_daily_' + d, null),
  setGkDailyCache:(d, v) => DB.set('wb_gk_daily_' + d, v),
};

// ============= 每日常识:远程拉取(每日由爬虫自动生成) =============
// 当天: daily.json ;历史日期: daily/daily-YYYY-MM-DD.json
async function fetchGkDaily(dateStr) {
  // 1) 本地缓存(上次成功拉取过)
  const cached = STORE_GK.gkDailyCache(dateStr);
  // 2) 远程拉取
  const path = dateStr === STORE.todayKey() ? 'daily.json' : `daily/daily-${dateStr}.json`;
  try {
    const resp = await fetch(path, { cache: 'no-store' });
    if (resp.ok) {
      const data = await resp.json();
      if (data && (data.items?.length || data.quiz?.length)) {
        STORE_GK.setGkDailyCache(dateStr, data);
        // 累积到常识池(去重)
        if (data.items) {
          const pool = STORE_GK.gkPool();
          const ids = new Set(pool.map(p => p.id));
          data.items.forEach(it => { if (!ids.has(it.id)) { pool.push(it); ids.add(it.id); } });
          STORE_GK.setGkPool(pool);
        }
        // 图推题入池
        if (data.quiz) {
          const qp = STORE_GK.gkQuizPool();
          const qids = new Set(qp.map(q => q.id));
          data.quiz.forEach(q => { if (!qids.has(q.id)) { qp.push(q); qids.add(q.id); } });
          STORE_GK.setGkQuizPool(qp);
        }
        return data;
      }
    }
  } catch (e) { /* 离线或未生成,走缓存 */ }
  return cached || null;
}

// ============= 工具 =============
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const fmtDate = (d) => new Date(d).toLocaleDateString('zh-CN', { month:'long', day:'numeric' });
const todayStr = () => new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit' }).replace(/\//g, '-');
const weekDay = () => ['日','一','二','三','四','五','六'][new Date().getDay()];
const daysSince = (dateStr) => Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);

function toast(msg, duration=2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), duration);
}

function celebrate(title, msg) {
  const m = document.createElement('div');
  m.className = 'celebrate';
  const colors = ['#D64550','#E8A87C','#F0D58C','#7DBF8A','#5A7A4A','#C4A882'];
  let confetti = '';
  for (let i = 0; i < 30; i++) {
    const c = colors[i % colors.length];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.4;
    confetti += `<div class="confetti" style="left:${left}%;top:-10px;background:${c};animation-delay:${delay}s"></div>`;
  }
  m.innerHTML = `
    <div class="celebrate-box">
      ${confetti}
      <div class="celebrate-emoji">🎉</div>
      <div class="celebrate-title">${title}</div>
      <div class="celebrate-msg">${msg}</div>
      <button class="btn" onclick="this.closest('.celebrate').remove()">收下啦</button>
    </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
}

// ============= 模态框 =============
function showModal({ title, content, onSave, saveText='保存' }) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-mask">
      <div class="modal">
        <div class="modal-hd">
          <div class="modal-title">${title}</div>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">${content}</div>
        ${onSave ? `<div class="form-actions">
          <button class="btn btn-ghost modal-cancel">取消</button>
          <button class="btn modal-save">${saveText}</button>
        </div>` : ''}
      </div>
    </div>`;
  const close = () => root.innerHTML = '';
  $('.modal-close', root).onclick = close;
  $('.modal-cancel', root)?.addEventListener('click', close);
  $('.modal-save', root)?.addEventListener('click', () => {
    const data = {};
    $$('input,textarea,select', root).forEach(el => {
      if (el.name) data[el.name] = el.value;
    });
    if (onSave(data) !== false) close();
  });
  $('.modal-mask', root).addEventListener('click', e => {
    if (e.target === e.currentTarget) close();
  });
}

// ============= 金币系统 =============
function addCoin(amount, reason) {
  const c = STORE.coins();
  c.balance += amount;
  c.history.unshift({ amount, reason, date: new Date().toISOString() });
  c.history = c.history.slice(0, 200);
  STORE.setCoins(c);

  // 庆祝弹窗
  if (c.balance === 10 || c.balance === 20 || c.balance === 50 || c.balance === 100) {
    setTimeout(() => celebrate(`🎉 金币达到 ${c.balance}!`, '恭喜!可以购买旭哥平衡首饰啦!'), 400);
  }
  return c.balance;
}

function checkDailyCoinReward() {
  const today = STORE.todayKey();
  const gkReads = STORE_GK.gkReads();
  const todayReads = gkReads[today] || [];
  const todos = STORE.todos().filter(t => t.date === today);

  // 每日考公学习奖励(学习 4 条常识)
  if (todayReads.length >= 4) {
    const c = STORE.coins();
    if (!c.history.some(h => h.reason === '今日学习完成' && h.date.startsWith(today))) {
      addCoin(0.5, '今日学习完成');
    }
  }
  // 待办全完成奖励
  if (todos.length > 0 && todos.every(t => t.done)) {
    const c = STORE.coins();
    if (!c.history.some(h => h.reason === '今日待办完成' && h.date.startsWith(today))) {
      addCoin(1, '今日待办完成');
    }
  }
}

// ============= 视图:今日中枢 =============
function viewToday() {
  const today = STORE.todayKey();
  const todos = STORE.todos();
  const c = STORE.coins();

  $('#page-title').innerHTML = '🏠 今日中枢';
  $('#page-sub').textContent = `${today} · 周${weekDay()}`;

  const gkReads = STORE_GK.gkReads();
  const learnCount = (gkReads[today] || []).length;
  const pendingReminders = STORE.reminders().filter(r => !r.done).length;
  const daySpent = STORE.records().filter(r => r.date === today && r.type !== 'income').reduce((s, r) => s + Number(r.amount), 0);

  $('#page-actions').innerHTML = `
    <button class="btn-icon" onclick="requestPush()">🔔</button>
    <button class="btn btn-sm" onclick="showTodoModal()">+ 待办</button>`;

  $('#page-body').innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="num">${todos.filter(t => !t.done).length}</div><div class="lbl">待办</div></div>
      <div class="stat-card green"><div class="num">${c.balance}</div><div class="lbl">金币</div></div>
      <div class="stat-card"><div class="num">${pendingReminders}</div><div class="lbl">提醒</div></div>
      <div class="stat-card"><div class="num">¥${daySpent}</div><div class="lbl">今日支出</div></div>
    </div>

    <div class="card">
      <div class="card-hd">📋 待办列表 <span class="badge">${todos.filter(t => !t.done).length} 待办</span></div>
      <div class="todo-list" id="todo-list"></div>
      <div class="todo-add">
        <input type="text" id="todo-input" placeholder="添加待办...">
        <button class="btn" onclick="addTodo()">+ 添加</button>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">🎯 每日考公学习 <span class="badge">${learnCount}/4</span></div>
      <p style="font-size:12px;color:var(--leaf);margin-bottom:10px;">今日学习 4 条常识,可获得 0.5 金币;专项训练答对 5 题再得 1 金币</p>
      <button class="btn btn-ghost" onclick="gotoView('gk')">前往学习 →</button>
    </div>`;

  renderTodoList();
}

function renderTodoList() {
  const todos = STORE.todos().filter(t => !t.auto);
  const list = $('#todo-list');
  list.innerHTML = todos.map(t => `
    <div class="todo-item ${t.done?'done':''}">
      <div class="todo-cb" onclick="toggleTodo('${t.id}')">${t.done?'✓':''}</div>
      <div class="todo-text">
        ${esc(t.text)}
        ${t.time ? `<div class="todo-meta">${t.date} · ${t.time}</div>` : `<div class="todo-meta">${t.date}</div>`}
      </div>
      <button class="todo-del" onclick="deleteTodo('${t.id}')">✕</button>
    </div>`).join('') || '<div class="empty"><div class="empty-icon">✨</div>暂无待办,享受当下</div>';
}

window.toggleTodo = function(id) {
  const todos = STORE.todos();
  const t = todos.find(x => x.id === id);
  if (t) {
    t.done = !t.done;
    STORE.setTodos(todos);
    checkDailyCoinReward();
    viewToday();
  }
};

window.deleteTodo = function(id) {
  STORE.setTodos(STORE.todos().filter(t => t.id !== id));
  viewToday();
};

window.addTodo = function() {
  const input = $('#todo-input');
  const text = input.value.trim();
  if (!text) return;
  const todos = STORE.todos();
  todos.push({
    id: 't-' + Date.now(),
    text,
    date: STORE.todayKey(),
    done: false
  });
  STORE.setTodos(todos);
  input.value = '';
  viewToday();
};

window.showTodoModal = function() {
  showModal({
    title: '添加待办',
    content: `
      <div class="form-row"><label>内容</label><input type="text" name="text" placeholder="要做的事..."></div>
      <div class="form-row"><label>日期</label><input type="date" name="date" value="${STORE.todayKey()}"></div>
      <div class="form-row"><label>时间(可选)</label><input type="time" name="time"></div>`,
    onSave: (d) => {
      if (!d.text) { toast('请输入内容'); return false; }
      const todos = STORE.todos();
      todos.push({ id:'t-'+Date.now(), text:d.text, date:d.date||STORE.todayKey(), time:d.time||'', done:false });
      STORE.setTodos(todos);
      viewToday();
      toast('已添加');
    }
  });
};

// ============= 视图:考公专项 =============
let _gkTab = 'common';       // common | quiz | review
let _gkField = 'all';        // 常识领域筛选
let _gkSection = '行测';     // 训练方向
let _gkCat = 'all';          // 训练分类
let _gkDate = null;          // 常识日期浏览
let _gkPage = 1;             // 分页
let _gkReviewTab = 'wrong';  // wrong | fav
const PAGE_SIZE = 5;

// 日期工具
function dateStr(date) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function shiftDate(str, days) {
  const dt = new Date(str + 'T00:00:00');
  dt.setDate(dt.getDate() + days);
  return dateStr(dt);
}

// 常识:已学列表 / 收藏判定
function isCommonLearned(id) {
  const gkReads = STORE_GK.gkReads();
  return Object.values(gkReads).some(arr => arr.includes(id));
}
function isFav(type, refId) {
  return STORE_GK.gkFav().some(f => f.type === type && f.refId === refId);
}

window.toggleGkFav = function(type, refId) {
  const fav = STORE_GK.gkFav();
  const idx = fav.findIndex(f => f.type === type && f.refId === refId);
  if (idx >= 0) {
    fav.splice(idx, 1);
    toast('已取消收藏');
  } else {
    fav.unshift({ id: 'fav-'+Date.now(), type, refId, favDate: STORE.todayKey() });
    toast('⭐ 已收藏');
  }
  STORE_GK.setGkFav(fav);
  if (_gkTab === 'review') viewGk(); else if (_gkTab === 'quiz') renderGkQuiz(); else renderGkCommon();
};

// 常识学习(不再单条发金币,由每日完成统一奖励)
window.markCommonLearned = function(id) {
  const today = STORE.todayKey();
  const gkReads = STORE_GK.gkReads();
  gkReads[today] = gkReads[today] || [];
  if (!gkReads[today].includes(id)) {
    gkReads[today].push(id);
    STORE_GK.setGkReads(gkReads);
    toast('已学习 ✓');
    checkDailyCoinReward();
    viewGk();
  }
};

// 移除错题
window.removeWrong = function(qid) {
  const progress = STORE_GK.gkProgress();
  delete progress.wrong[qid];
  STORE_GK.setGkProgress(progress);
  viewGk();
  toast('已从错题集移除');
};

function viewGk() {
  $('#page-title').innerHTML = '🎯 考公专项';
  $('#page-sub').textContent = '常识积累 · 专项训练 · 错题复习';
  $('#page-actions').innerHTML = '';

  $('#page-body').innerHTML = `
    <div class="tabs" id="gk-tabs"></div>
    <div id="gk-body"></div>`;

  const tabs = [
    { k:'common', n:'📖 日常常识' },
    { k:'quiz',   n:'🎯 专项训练' },
    { k:'review', n:'📝 复习中心' },
  ];
  $('#gk-tabs').innerHTML = tabs.map(t =>
    `<div class="tab ${_gkTab===t.k?'active':''}" data-k="${t.k}">${t.n}</div>`).join('');
  $$('#gk-tabs .tab').forEach(t => t.onclick = () => {
    _gkTab = t.dataset.k;
    _gkPage = 1;
    viewGk();
  });

  if (_gkTab === 'common') renderGkCommon();
  else if (_gkTab === 'quiz') renderGkQuiz();
  else renderGkReview();
}

// ---------- 常识子页(每日远程拉取) ----------
async function renderGkCommon() {
  const today = STORE.todayKey();
  if (!_gkDate) _gkDate = today;
  const gkReads = STORE_GK.gkReads();
  const todayLearned = (gkReads[_gkDate] || []);

  // 领域筛选 tabs + 日期导航(先渲染框架)
  const fields = ['all','时政','法律','经济','人文历史','科技'];
  $('#gk-body').innerHTML = `
    <div class="tabs" style="margin-bottom:8px;">
      ${fields.map(f => `<div class="tab ${_gkField===f?'active':''}" data-f="${f}">${f==='all'?'全部':f}</div>`).join('')}
    </div>
    <div class="date-nav">
      <button class="btn btn-sm btn-ghost" onclick="gkShiftDate(-1)">← 前一天</button>
      <div class="date-nav-center">
        <div class="date-nav-day">${_gkDate}</div>
        <button class="btn btn-sm" onclick="gkShiftDate(0)">回到今天</button>
      </div>
      <button class="btn btn-sm btn-ghost" onclick="gkShiftDate(1)">后一天 →</button>
    </div>
    <div id="gk-common-loading" style="text-align:center;padding:30px;color:var(--oak);font-size:13px;">🌿 正在获取今日内容...</div>
    <div id="gk-common-list"></div>
    <div class="gk-pager" id="gk-common-pager"></div>`;

  $$('#gk-body .tab[data-f]').forEach(t => t.onclick = () => {
    _gkField = t.dataset.f;
    _gkPage = 1;
    renderGkCommon();
  });

  // 远程拉取当天/历史日期的常识
  const data = await fetchGkDaily(_gkDate);
  const loading = $('#gk-common-loading');
  if (loading) loading.style.display = 'none';

  if (!data || !data.items || !data.items.length) {
    $('#gk-common-list').innerHTML = `
      <div class="empty">
        <div class="empty-icon">🔍</div>
        ${_gkDate === today ? '今日内容尚未生成,请稍后刷新(每日自动更新)' : '这一天暂无内容记录'}
      </div>`;
    return;
  }

  // 领域筛选
  let list = data.items;
  if (_gkField !== 'all') {
    const filtered = list.filter(c => c.field === _gkField || (c.field === '常识真题' && _gkField !== '时政'));
    if (filtered.length) list = filtered;
  }

  // 分页
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (_gkPage > pages) _gkPage = pages;
  const pageList = list.slice((_gkPage-1)*PAGE_SIZE, _gkPage*PAGE_SIZE);

  const listEl = $('#gk-common-list');
  listEl.innerHTML = pageList.map(c => {
    const learned = todayLearned.includes(c.id);
    const faved = isFav('common', c.id);
    // 真题类型:渲染为题干+选项+答题交互,来源标在题头
    if (c.type === 'zhen') {
      return `
        <div class="quiz-card zhen-card">
          <div class="quiz-head">
            <span class="zhen-badge">📝 真题·常识判断</span>
            <span class="quiz-cat">${esc(c.source)}</span>
            <button class="fav-star ${faved?'active':''}" onclick="toggleGkFav('common','${c.id}')">${faved?'★':'☆'}</button>
          </div>
          <div class="quiz-question">${esc(c.stem)}</div>
          <div class="quiz-options" id="zhen-opt-${c.id}">
            ${c.options.map(o => {
              const letter = o[0];
              return `<div class="quiz-option" data-q="${c.id}" data-p="${letter}" data-a="${c.answer}" data-correct="${letter===c.answer}">
                <span class="quiz-opt-letter">${letter}</span><span>${esc(o.slice(2))}</span>
              </div>`;
            }).join('')}
          </div>
          <div class="quiz-explain" id="zhen-exp-${c.id}" style="display:none;"></div>
          <div class="feed-actions" style="margin-top:10px;">
            <span class="left">${_gkDate} · ${esc(c.source)}</span>
            ${learned ? '<span style="color:var(--moss);font-size:11px;font-weight:700;">✓ 已学习</span>' :
              `<button class="btn btn-sm" onclick="markCommonLearned('${c.id}')">标记已学</button>`}
          </div>
        </div>`;
    }
    // 普通条目(时政等)
    const sourceLink = c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener" style="color:var(--leaf);">${esc(c.source)} ↗</a>` : esc(c.source);
    return `
      <div class="feed-item" style="position:relative;">
        <div class="feed-cat">${esc(c.field)}</div>
        <div class="feed-title">${esc(c.title)}</div>
        <div class="feed-text">${esc(c.brief)}</div>
        <div class="common-src">📎 ${sourceLink}</div>
        ${c.detail ? `<details class="common-detail"><summary>查看详解</summary>${esc(c.detail)}</details>` : ''}
        <div class="feed-actions">
          <span class="left">${_gkDate}</span>
          <span>
            <button class="btn btn-sm btn-ghost" onclick="toggleGkFav('common','${c.id}')">${faved?'★ 已收藏':'☆ 收藏'}</button>
            ${learned ? '<span style="color:var(--moss);font-size:11px;font-weight:700;">✓ 已学习</span>' :
              `<button class="btn btn-sm" onclick="markCommonLearned('${c.id}')">标记已学</button>`}
          </span>
        </div>
      </div>`;
  }).join('');

  // 绑定真题答题事件
  $$('.quiz-option[data-q^="g"]').forEach(opt => {
    if (opt.closest('#zhen-opt-' + opt.dataset.q)) {
      opt.onclick = () => {
        const qid = opt.dataset.q, pick = opt.dataset.p;
        answerZhen(qid, pick);
      };
    }
  });

  // 分页
  const pager = $('#gk-common-pager');
  pager.innerHTML = pages > 1 ? Array.from({length: pages}, (_, i) =>
    `<button class="btn btn-sm" style="${_gkPage===i+1?'background:var(--deep);color:var(--cream);':''}" onclick="_gkPage=${i+1};renderGkCommon()">${i+1}</button>`).join('') : '';
}

// 常识真题答题
window.answerZhen = function(id, pick) {
  const pool = STORE_GK.gkPool();
  const item = pool.find(x => x.id === id);
  if (!item) return;
  const correct = pick === item.answer;
  const optEls = $$(`#zhen-opt-${id} .quiz-option`);
  optEls.forEach(o => { o.style.pointerEvents = 'none'; });
  optEls.forEach(o => {
    if (o.dataset.p === item.answer) o.classList.add('correct');
    else if (o.dataset.p === pick) o.classList.add('wrong');
  });
  const exp = $('#zhen-exp-' + id);
  if (exp) {
    exp.style.display = 'block';
    exp.innerHTML = correct
      ? `✅ 回答正确!答案:${item.answer} | 来源:${esc(item.source)}`
      : `❌ 回答错误。正确答案:${item.answer} | 来源:${esc(item.source)}`;
  }
  const progress = STORE_GK.gkProgress();
  if (correct) {
    progress.correct[id] = (progress.correct[id] || 0) + 1;
    // 答对奖励:0.2/题,每日封顶 5 题
    const today = STORE.todayKey();
    const reward = STORE_GK.gkReward();
    const count = reward[today] || 0;
    if (count < 5) {
      reward[today] = count + 1;
      STORE_GK.setGkReward(reward);
      addCoin(0.2, '答对常识真题');
      toast('✅ 回答正确 +0.2 金币');
    } else {
      toast('✅ 回答正确(今日奖励已达上限)');
    }
  } else {
    progress.wrong[id] = (progress.wrong[id] || 0) + 1;
    toast('❌ 回答错误,已收入错题集');
  }
  STORE_GK.setGkProgress(progress);
};

window.gkShiftDate = function(days) {
  _gkDate = days === 0 ? STORE.todayKey() : shiftDate(_gkDate, days);
  _gkPage = 1;
  renderGkCommon();
};

// ---------- 训练子页(图形推理真题,每天2道) ----------
async function renderGkQuiz() {
  const today = STORE.todayKey();
  $('#gk-body').innerHTML = `
    <div style="text-align:center;padding:30px;color:var(--oak);font-size:13px;">🎯 正在加载今日图推真题...</div>`;

  const data = await fetchGkDaily(today);
  const quiz = (data && data.quiz) || [];
  const progress = STORE_GK.gkProgress();

  if (!quiz.length) {
    $('#gk-body').innerHTML = `
      <div class="card">
        <div class="card-hd">🎯 图形推理真题(每日 2 道)</div>
        <div class="empty"><div class="empty-icon">🔍</div>今日图推题尚未生成,请稍后刷新</div>
      </div>`;
    return;
  }

  $('#gk-body').innerHTML = `
    <div class="card">
      <div class="card-hd">🎯 图形推理真题 <span class="badge">每日 2 道</span></div>
      <p style="font-size:12px;color:var(--leaf);margin-bottom:12px;">📌 真题来源已标注在每道题顶部,点击选项即判对错,答错自动进错题集</p>
      <div id="gk-quiz-list"></div>
    </div>`;

  const listEl = $('#gk-quiz-list');
  listEl.innerHTML = quiz.map(q => {
    const faved = isFav('quiz', q.id);
    const answered = progress.correct[q.id] || progress.wrong[q.id] || 0;
    return `
      <div class="quiz-card">
        <div class="quiz-head">
          <span class="zhen-badge">🧩 图推真题</span>
          <span class="quiz-cat">${esc(q.source)}</span>
          <button class="fav-star ${faved?'active':''}" onclick="toggleGkFav('quiz','${q.id}')">${faved?'★':'☆'}</button>
        </div>
        <div class="quiz-question">${esc(q.stem)}</div>
        <div class="tuxing-img"><img src="${esc(q.image)}" alt="图形推理题" loading="lazy" /></div>
        <div class="quiz-options" id="quiz-opt-${q.id}">
          ${['A','B','C','D'].map(letter => `
            <div class="quiz-option" data-q="${q.id}" data-p="${letter}" data-a="${q.answer}" data-correct="${letter===q.answer}">
              <span class="quiz-opt-letter">${letter}</span><span>选项 ${letter}</span>
            </div>`).join('')}
        </div>
        <div class="quiz-explain" id="quiz-exp-${q.id}" style="display:none;"></div>
        <div class="feed-actions" style="margin-top:10px;">
          <span class="left">📌 来源:${esc(q.source)}</span>
          <span>${answered ? '<span style="color:var(--moss);font-size:11px;">已作答</span>' : ''}</span>
        </div>
      </div>`;
  }).join('');

  // 绑定答题
  $$('#gk-quiz-list .quiz-option').forEach(opt => {
    opt.onclick = () => {
      const qid = opt.dataset.q, pick = opt.dataset.p;
      answerTuxing(qid, pick);
    };
  });
}

// 图推题答题
window.answerTuxing = function(id, pick) {
  const qp = STORE_GK.gkQuizPool();
  const q = qp.find(x => x.id === id);
  if (!q) return;
  const correct = pick === q.answer;
  const optEls = $$(`#quiz-opt-${id} .quiz-option`);
  optEls.forEach(o => { o.style.pointerEvents = 'none'; });
  optEls.forEach(o => {
    if (o.dataset.p === q.answer) o.classList.add('correct');
    else if (o.dataset.p === pick) o.classList.add('wrong');
  });
  const exp = $('#quiz-exp-' + id);
  if (exp) {
    exp.style.display = 'block';
    exp.innerHTML = correct
      ? `✅ 回答正确!答案:${q.answer} | 来源:${esc(q.source)}`
      : `❌ 回答错误。正确答案:${q.answer} | 来源:${esc(q.source)}`;
  }
  const progress = STORE_GK.gkProgress();
  if (correct) {
    progress.correct[id] = (progress.correct[id] || 0) + 1;
    const today = STORE.todayKey();
    const reward = STORE_GK.gkReward();
    const count = reward[today] || 0;
    if (count < 5) {
      reward[today] = count + 1;
      STORE_GK.setGkReward(reward);
      addCoin(0.2, '答对图推真题');
      toast('✅ 回答正确 +0.2 金币');
    } else {
      toast('✅ 回答正确(今日奖励已达上限)');
    }
  } else {
    progress.wrong[id] = (progress.wrong[id] || 0) + 1;
    toast('❌ 回答错误,已收入错题集');
  }
  STORE_GK.setGkProgress(progress);
};

// ---------- 复习子页 ----------
function renderGkReview() {
  const progress = STORE_GK.gkProgress();
  const fav = STORE_GK.gkFav();
  const qp = STORE_GK.gkQuizPool();   // 图推池
  const pool = STORE_GK.gkPool();     // 常识池(含真题)
  const wrongIds = Object.keys(progress.wrong);
  // 错题可能来自:图推(qp)或常识真题(pool)
  const wrongList = wrongIds.map(id => {
    const fromQp = qp.find(x => x.id === id);
    if (fromQp) return { ...fromQp, kind: 'tuxing' };
    const fromPool = pool.find(x => x.id === id);
    if (fromPool) return { ...fromPool, kind: 'zhen' };
    return null;
  }).filter(Boolean);
  const favCommon = fav.filter(f => f.type === 'common');
  const favQuiz = fav.filter(f => f.type === 'quiz');

  $('#gk-body').innerHTML = `
    <div class="tabs" style="margin-bottom:10px;">
      <div class="tab ${_gkReviewTab==='wrong'?'active':''}" data-r="wrong">❌ 错题集 (${wrongList.length})</div>
      <div class="tab ${_gkReviewTab==='fav'?'active':''}" data-r="fav">⭐ 我的收藏 (${favCommon.length+favQuiz.length})</div>
    </div>
    <div id="gk-review-list"></div>`;

  $$('#gk-body .tab[data-r]').forEach(t => t.onclick = () => {
    _gkReviewTab = t.dataset.r;
    renderGkReview();
  });

  const listEl = $('#gk-review-list');

  if (_gkReviewTab === 'wrong') {
    if (!wrongList.length) {
      listEl.innerHTML = '<div class="empty"><div class="empty-icon">🎉</div>太棒了,暂无错题</div>';
      return;
    }
    listEl.innerHTML = wrongList.map(q => `
      <div class="quiz-card">
        <div class="quiz-head">
          <span class="zhen-badge">${q.kind === 'tuxing' ? '🧩 图推真题' : '📝 常识真题'}</span>
          <span class="quiz-cat">${esc(q.source || '')}</span>
          <span style="color:var(--red);font-size:11px;">❌ ${progress.wrong[q.id]} 次</span>
        </div>
        <div class="quiz-question">${esc(q.stem || q.title || '')}</div>
        ${q.image ? `<div class="tuxing-img"><img src="${esc(q.image)}" alt="图推题" loading="lazy" /></div>` : ''}
        <div class="quiz-options" id="quiz-opt-${q.id}">
          ${(q.options && q.options.length ? q.options : ['A','B','C','D'].map(l => l + '、')).map(o => {
            const letter = (o || 'A')[0];
            return `<div class="quiz-option ${letter===q.answer?'correct':''}" style="pointer-events:none;">
              <span class="quiz-opt-letter">${letter}</span><span>${esc((o||'选项').slice(2) || '选项')}</span>
              ${letter===q.answer?'<span class="quiz-tick">✓</span>':''}
            </div>`;
          }).join('')}
        </div>
        <div class="quiz-explain" style="display:block;">💡 正确答案:${q.answer} | 来源:${esc(q.source || '')}</div>
        <div class="feed-actions" style="margin-top:10px;">
          <span class="left">正确答案:${q.answer}</span>
          <button class="btn btn-sm btn-ghost" onclick="removeWrong('${q.id}')">从错题集移除</button>
        </div>
      </div>`).join('');
  } else {
    let html = '';
    const commons = favCommon.map(f => pool.find(c => c.id === f.refId)).filter(Boolean);
    if (commons.length) {
      html += `<div class="card"><div class="card-hd">📖 收藏的常识</div>${commons.map(c => `
        <div class="feed-item">
          <div class="feed-cat">${esc(c.field)}</div>
          <div class="feed-title">${esc(c.title || '真题·常识')}</div>
          <div class="feed-text">${esc(c.stem || c.brief || '')}</div>
          <div class="feed-actions">
            <span class="left">${esc(c.source || '')}</span>
            <button class="btn btn-sm btn-ghost" onclick="toggleGkFav('common','${c.id}')">取消收藏</button>
          </div>
        </div>`).join('')}</div>`;
    }
    const quizs = favQuiz.map(f => {
      const fromQp = qp.find(q => q.id === f.refId);
      return fromQp ? { ...fromQp, kind: 'tuxing' } : null;
    }).filter(Boolean);
    if (quizs.length) {
      html += `<div class="card"><div class="card-hd">🎯 收藏的图推真题</div>${quizs.map(q => `
        <div class="quiz-card">
          <div class="quiz-head">
            <span class="zhen-badge">🧩 图推真题</span>
            <span class="quiz-cat">${esc(q.source || '')}</span>
          </div>
          <div class="quiz-question">${esc(q.stem || '')}</div>
          <div class="tuxing-img"><img src="${esc(q.image)}" alt="图推题" loading="lazy" /></div>
          <div class="quiz-explain" style="display:block;">💡 正确答案:${q.answer} | 来源:${esc(q.source || '')}</div>
          <div class="feed-actions" style="margin-top:10px;">
            <span class="left">正确答案:${q.answer}</span>
            <button class="btn btn-sm btn-ghost" onclick="toggleGkFav('quiz','${q.id}')">取消收藏</button>
          </div>
        </div>`).join('')}</div>`;
    }
    listEl.innerHTML = html || '<div class="empty"><div class="empty-icon">⭐</div>还没有收藏,去常识/训练里点收藏吧</div>';
  }
}

// ============= 视图:生理周期 =============
let _cycleMonth = null; // 日历浏览月份 'YYYY-MM'

// ---- 周期算法 ----
function cycleData() { return STORE_GK.cycle(); }

function calcCycleLen() {
  const cd = cycleData();
  const periods = [...cd.periods].sort((a, b) => a.startDate < b.startDate ? -1 : 1);
  if (periods.length < 2) return cd.settings.cycleLen || 28;
  const diffs = [];
  for (let i = 1; i < periods.length; i++) {
    const diff = Math.round((new Date(periods[i].startDate) - new Date(periods[i-1].startDate)) / 86400000);
    if (diff >= 15 && diff <= 60) diffs.push(diff);
  }
  if (!diffs.length) return cd.settings.cycleLen || 28;
  const recent = diffs.slice(-3);
  return Math.round(recent.reduce((s, d) => s + d, 0) / recent.length);
}

function cycleLastStart() {
  const cd = cycleData();
  if (!cd.periods.length) return null;
  return cd.periods.reduce((max, p) => p.startDate > max ? p.startDate : max, cd.periods[0].startDate);
}

function cycleNextStart() {
  const last = cycleLastStart();
  const len = calcCycleLen();
  if (!last) {
    // 无记录:默认按今天推
    return shiftDate(STORE.todayKey(), len);
  }
  return shiftDate(last, len);
}

function cycleOvulation() {
  return shiftDate(cycleNextStart(), -14);
}

function cycleFertile() {
  const ov = cycleOvulation();
  return { start: shiftDate(ov, -5), end: shiftDate(ov, 4) };
}

function cyclePredict3m() {
  const start = cycleNextStart();
  const len = calcCycleLen();
  const periodLen = cycleData().settings.periodLen || 5;
  const list = [];
  for (let i = 0; i < 3; i++) {
    const s = shiftDate(start, len * i);
    list.push({ start: s, end: shiftDate(s, periodLen - 1) });
  }
  return list;
}

function cycleIrregular() {
  const periods = [...cycleData().periods].sort((a, b) => a.startDate < b.startDate ? -1 : 1);
  if (periods.length < 2) return false;
  for (let i = 1; i < periods.length; i++) {
    const diff = Math.round((new Date(periods[i].startDate) - new Date(periods[i-1].startDate)) / 86400000);
    if (diff < 21 || diff > 35) return true;
  }
  return false;
}

// 当天状态分类:'period' | 'fertile' | 'predict-period' | 'predict-fertile' | 'normal'
function cycleClassifyDay(dateStr) {
  const cd = cycleData();
  const periodLen = cd.settings.periodLen || 5;
  const today = dateStr;

  // 1. 历史经期(实际记录)
  for (const p of cd.periods) {
    if (today >= p.startDate && today <= (p.endDate || shiftDate(p.startDate, periodLen - 1))) return 'period';
  }
  // 2. 预测经期(未来3个月)
  const preds = cyclePredict3m();
  for (const p of preds) {
    if (today >= p.start && today <= p.end) return 'predict-period';
  }
  // 3. 易孕期(基于预测)
  const f = cycleFertile();
  if (today >= f.start && today <= f.end) return 'fertile';
  return 'normal';
}

// 当前周期第几天
function cycleDayInCycle() {
  const last = cycleLastStart();
  if (!last) return null;
  const days = Math.round((new Date(STORE.todayKey()) - new Date(last)) / 86400000) + 1;
  return days > 0 ? days : 1;
}

// ---- 视图 ----
function viewCycle() {
  const cd = cycleData();

  // 首次引导
  if (cd.periods.length === 0 && !localStorage.getItem('wb_cycle_guide')) {
    localStorage.setItem('wb_cycle_guide', '1');
    setTimeout(() => showCycleSettingsModal(true), 300);
  }

  $('#page-title').innerHTML = '🩸 生理周期';
  $('#page-sub').textContent = '记录 · 预测 · 关爱自己';
  $('#page-actions').innerHTML = `
    <button class="btn btn-sm" onclick="showCycleRecordModal()">+ 记录经期</button>
    <button class="btn btn-sm btn-ghost" onclick="showCycleSettingsModal()">⚙ 设置</button>`;

  const last = cycleLastStart();
  const next = cycleNextStart();
  const ov = cycleOvulation();
  const f = cycleFertile();
  const dayInCycle = cycleDayInCycle();
  const nextDays = Math.ceil((new Date(next) - new Date()) / 86400000);
  const todayClass = cycleClassifyDay(STORE.todayKey());
  const todayStateMap = {
    'period': '经期中',
    'fertile': '易孕期',
    'predict-period': '预计经期',
    'normal': '安全期'
  };

  // 环形图:当前周期进度
  const cycleLen = calcCycleLen();
  const periodLen = cd.settings.periodLen || 5;
  const ringDeg = dayInCycle ? Math.min(360, (dayInCycle / cycleLen) * 360) : 0;

  // 异常提醒
  const irregular = cycleIrregular();

  $('#page-body').innerHTML = `
    ${irregular ? `
      <div style="background:var(--honey);border-radius:var(--r-sm);padding:10px 14px;margin-bottom:12px;font-size:12px;color:var(--text);font-weight:700;">
        ⚠️ 近期周期不规律(短于21天或长于35天),建议关注身体状态
      </div>` : ''}

    <div class="stat-grid">
      <div class="stat-card">
        <div class="cycle-ring" style="--p-period:${Math.min(0.5, periodLen / cycleLen)};">
          <div class="cycle-ring-inner">
            <div class="cycle-ring-day">${dayInCycle ? '第 '+dayInCycle+' 天' : '—'}</div>
            <div class="cycle-ring-sub">${nextDays > 0 ? '距下次 '+nextDays+' 天' : '预计经期'}</div>
          </div>
        </div>
        <div class="lbl">当前周期</div>
      </div>
      <div class="stat-card green">
        <div class="num" style="font-size:15px;">${next}</div>
        <div class="lbl">下次经期</div>
        <div style="font-size:10px;color:var(--oak);margin-top:2px;">${nextDays>0?'还有 '+nextDays+' 天':'已到/已过'}</div>
      </div>
      <div class="stat-card">
        <div class="num" style="font-size:15px;">${ov}</div>
        <div class="lbl">预计排卵日</div>
      </div>
      <div class="stat-card">
        <div class="num" style="font-size:13px;color:${todayClass==='period'?'var(--red)':(todayClass==='fertile'?'var(--orange)':'var(--moss)')};">${todayStateMap[todayClass]}</div>
        <div class="lbl">今日状态</div>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">📅 日历热力图
        <span style="display:flex;gap:8px;font-size:11px;">
          <button class="btn btn-sm btn-ghost" onclick="cycleShiftMonth(-1)">←</button>
          <button class="btn btn-sm btn-ghost" onclick="cycleShiftMonth(0)">本月</button>
          <button class="btn btn-sm btn-ghost" onclick="cycleShiftMonth(1)">→</button>
        </span>
      </div>
      <div class="cycle-month" id="cycle-month-title"></div>
      <div class="cycle-calendar" id="cycle-calendar"></div>
      <div class="cycle-legend">
        <span><i style="background:var(--red)"></i>经期</span>
        <span><i style="background:var(--orange)"></i>易孕期</span>
        <span><i style="border:1.5px dashed var(--honey);background:transparent;"></i>预测经期</span>
        <span><i style="background:var(--bright)"></i>今天</span>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">💌 未来 3 个月预测</div>
      <div id="cycle-predict"></div>
    </div>

    <div class="card">
      <div class="card-hd">📋 历史记录</div>
      <div id="cycle-record-list"></div>
    </div>`;

  renderCycleCalendar();
  renderCyclePredict();
  renderCycleRecords();
}

window.cycleShiftMonth = function(delta) {
  const now = _cycleMonth || STORE.todayKey().slice(0, 7);
  let d = new Date(now + '-01T00:00:00');
  if (delta !== 0) {
    d.setMonth(d.getMonth() + delta);
  } else {
    d = new Date();
  }
  _cycleMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  renderCycleCalendar();
};

function renderCycleCalendar() {
  const month = _cycleMonth || STORE.todayKey().slice(0, 7);
  const [year, m] = month.split('-').map(Number);
  $('#cycle-month-title').textContent = `${year} 年 ${m} 月`;
  const firstDay = new Date(year, m - 1, 1).getDay();
  const lastDate = new Date(year, m, 0).getDate();
  const todayStrKey = STORE.todayKey();
  let html = '';
  ['日','一','二','三','四','五','六'].forEach(d => html += `<div class="cycle-cel cycle-dow">${d}</div>`);
  for (let i = 0; i < firstDay; i++) html += '<div class="cycle-cel"></div>';
  for (let d = 1; d <= lastDate; d++) {
    const ds = `${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cls = cycleClassifyDay(ds);
    const isToday = ds === todayStrKey;
    const isPast = ds < todayStrKey;
    let cellClass = 'cycle-cel';
    if (cls === 'period') cellClass += ' is-period';
    else if (cls === 'fertile') cellClass += ' is-fertile';
    else if (cls === 'predict-period') cellClass += ' is-predict';
    else if (isPast) cellClass += ' is-past';
    if (isToday) cellClass += ' is-today';
    html += `<div class="${cellClass}">${d}</div>`;
  }
  $('#cycle-calendar').innerHTML = html;
}

function renderCyclePredict() {
  const preds = cyclePredict3m();
  const el = $('#cycle-predict');
  el.innerHTML = preds.map((p, i) => `
    <div class="record-item">
      <div class="record-left">
        <div class="record-cat">🩸</div>
        <div class="record-info">
          <div class="name">第 ${i+1} 次经期</div>
          <div class="meta">${p.start} ~ ${p.end}</div>
        </div>
      </div>
      <div class="record-amt" style="font-size:11px;color:var(--leaf);">预计</div>
    </div>`).join('');
}

function renderCycleRecords() {
  const cd = cycleData();
  const el = $('#cycle-record-list');
  const sorted = [...cd.periods].sort((a, b) => a.startDate < b.startDate ? 1 : -1);
  el.innerHTML = sorted.length ? sorted.map(p => `
    <div class="record-item">
      <div class="record-left">
        <div class="record-cat">🩸</div>
        <div class="record-info">
          <div class="name">${p.startDate} ~ ${p.endDate || shiftDate(p.startDate, (cd.settings.periodLen||5)-1)}</div>
          <div class="meta">${p.weight ? '体重 '+p.weight+'kg' : ''} ${p.temp ? '· 体温 '+p.temp+'°C' : ''} ${p.note ? '· '+esc(p.note) : ''}</div>
        </div>
      </div>
      <button class="btn btn-sm btn-danger" onclick="deleteCycleRecord('${p.id}')">✕</button>
    </div>`).join('') : '<div class="empty"><div class="empty-icon">🩸</div>点击右上角「+ 记录经期」开始记录</div>';
}

window.deleteCycleRecord = function(id) {
  const cd = cycleData();
  cd.periods = cd.periods.filter(p => p.id !== id);
  STORE_GK.setCycle(cd);
  viewCycle();
  toast('已删除');
};

window.showCycleRecordModal = function() {
  const cd = cycleData();
  const last = cycleLastStart();
  const defaultStart = last ? shiftDate(last, calcCycleLen()) : STORE.todayKey();
  showModal({
    title: '记录经期',
    content: `
      <div class="form-row"><label>开始日期</label><input type="date" name="startDate" value="${defaultStart}"></div>
      <div class="form-row"><label>结束日期(默认 ${cd.settings.periodLen||5} 天)</label><input type="date" name="endDate" value="${shiftDate(defaultStart, (cd.settings.periodLen||5)-1)}"></div>
      <div class="form-row"><label>体重 kg(选填)</label><input type="number" name="weight" step="0.1" placeholder="如 52.5"></div>
      <div class="form-row"><label>基础体温 °C(选填)</label><input type="number" name="temp" step="0.1" placeholder="如 36.5"></div>
      <div class="form-row"><label>备注</label><textarea name="note" rows="2" placeholder="身体感受、情绪等"></textarea></div>`,
    onSave: (d) => {
      if (!d.startDate) { toast('请选择开始日期'); return false; }
      const cd = cycleData();
      // 防重复:同日期已存在则提示
      if (cd.periods.some(p => p.startDate === d.startDate)) { toast('该日期已记录'); return false; }
      cd.periods.push({ id:'cyc-'+Date.now(), startDate:d.startDate, endDate:d.endDate||'', weight:d.weight, temp:d.temp, note:d.note });
      STORE_GK.setCycle(cd);
      addCoin(0.5, '记录生理周期');
      viewCycle();
      toast('已记录 +0.5 金币');
    }
  });
};

window.showCycleSettingsModal = function(firstTime) {
  const cd = cycleData();
  showModal({
    title: '周期设置',
    content: `
      <p style="font-size:12px;color:var(--leaf);margin-bottom:12px;">${firstTime ? '欢迎使用生理周期记录!请设置你的默认周期参数,之后可根据记录自动调整。' : '设置默认周期参数,有足够历史记录后将自动取平均值。'}</p>
      <div class="form-row"><label>平均周期长度(天)</label><input type="number" name="cycleLen" value="${cd.settings.cycleLen || 28}" min="15" max="60"></div>
      <div class="form-row"><label>经期长度(天)</label><input type="number" name="periodLen" value="${cd.settings.periodLen || 5}" min="2" max="10"></div>`,
    onSave: (d) => {
      const cd = cycleData();
      cd.settings.cycleLen = Number(d.cycleLen) || 28;
      cd.settings.periodLen = Number(d.periodLen) || 5;
      STORE_GK.setCycle(cd);
      viewCycle();
      toast('已保存');
    }
  });
};

// ============= 账单:内置类别 =============
const MONEY_BUILTIN_TYPES = {
  'var':    ['餐饮', '交通', '日用品', '娱乐'],
  'fixed':  ['房租', '水电', '网费', '订阅'],
  'income': ['工资', '兼职', '投资', '红包', '其他'],
};
// 合并内置 + 用户自定义类别
function allMoneyTypes(typeKey) {
  const builtin = MONEY_BUILTIN_TYPES[typeKey] || [];
  const custom = STORE.recordTypes();
  const merged = [...builtin];
  custom.forEach(c => { if (!merged.includes(c)) merged.push(c); });
  return merged;
}
// 账单状态变量
let _moneyFilter = 'all';   // 'all' | 'YYYY-MM'
let _moneyPage = 1;         // 加载更多页码
let _moneyMonth = null;     // 图表浏览月份 'YYYY-MM'

// ============= 视图:财富工坊 =============
function viewMoney() {
  $('#page-title').innerHTML = '💰 财富工坊';
  $('#page-sub').textContent = '五账户独立 · 严禁混合';
  $('#page-actions').innerHTML = `
    <button class="btn btn-sm" onclick="showRecordModal()">+ 记账</button>`;

  const records = STORE.records();
  const today = STORE.todayKey();
  const curMonth = today.slice(0, 7);
  if (!_moneyMonth) _moneyMonth = curMonth;

  const todaySpent = records.filter(r => r.date === today && r.type !== 'income').reduce((s, r) => s + Number(r.amount), 0);
  const monthSpent = records.filter(r => r.date.startsWith(curMonth) && r.type !== 'income').reduce((s, r) => s + Number(r.amount), 0);
  const fixedSpent = records.filter(r => r.date.startsWith(curMonth) && r.type === 'fixed').reduce((s, r) => s + Number(r.amount), 0);
  const income = records.filter(r => r.date.startsWith(curMonth) && r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
  // 历史累计
  const totalSpent = records.filter(r => r.type !== 'income').reduce((s, r) => s + Number(r.amount), 0);
  const totalIncome = records.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
  const coins = STORE.coins();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();
  const budget = STORE.setting().dailyBudget || 30;
  const monthBudget = budget * daysInMonth;
  const remaining = Math.max(0, monthBudget - monthSpent);

  // 今日省钱奖励
  let savedCoinToday = 0;
  if (todaySpent === 0) savedCoinToday = 0;
  else if (todaySpent <= 15) savedCoinToday = 2;
  else if (todaySpent <= 30) savedCoinToday = 1;
  else savedCoinToday = 0;

  // 周图表(保留)
  const weekData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dk = d.toISOString().slice(0,10);
    const s = records.filter(r => r.date === dk && r.type !== 'income').reduce((s, r) => s + Number(r.amount), 0);
    weekData.push({ day: ['日','一','二','三','四','五','六'][d.getDay()], amount: s });
  }
  const maxAmt = Math.max(...weekData.map(d => d.amount), 1);

  // ===== 月度分析数据 =====
  const monthRecords = records.filter(r => r.date.startsWith(_moneyMonth) && r.type !== 'income');
  const monthSpentTotal = monthRecords.reduce((s, r) => s + Number(r.amount), 0);
  const monthIncome = records.filter(r => r.date.startsWith(_moneyMonth) && r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
  // 近6月柱状图
  const barData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(_moneyMonth + '-01T00:00:00');
    d.setMonth(d.getMonth() - i);
    const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const s = records.filter(r => r.date.startsWith(mk) && r.type !== 'income').reduce((s, r) => s + Number(r.amount), 0);
    barData.push({ month: mk, label: `${d.getMonth()+1}月`, amount: s, isCur: mk === _moneyMonth });
  }
  const maxBar = Math.max(...barData.map(b => b.amount), 1);
  // 分类占比(所选月,Top6+其他)
  const catMap = {};
  monthRecords.forEach(r => { catMap[r.name] = (catMap[r.name] || 0) + Number(r.amount); });
  const catSorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const catTop = catSorted.slice(0, 6);
  const catOther = catSorted.slice(6);
  const catOtherTotal = catOther.reduce((s, c) => s + c[1], 0);
  if (catOtherTotal > 0) catTop.push(['其他', catOtherTotal]);
  const catColors = ['#D64550','#E8A87C','#F0D58C','#7DBF8A','#5A7A4A','#C4A882','#9AB0B3'];
  // 环形图 conic-gradient
  let donutCss = '', legendHtml = '';
  if (monthSpentTotal > 0) {
    let acc = 0;
    donutCss = catTop.map((c, i) => {
      const start = acc / monthSpentTotal * 360;
      acc += c[1];
      const end = acc / monthSpentTotal * 360;
      return `${catColors[i % catColors.length]} ${start}deg ${end}deg`;
    }).join(',');
    legendHtml = catTop.map((c, i) => `
      <div class="legend-item">
        <i style="background:${catColors[i % catColors.length]}"></i>
        <span class="legend-name">${esc(c[0])}</span>
        <span class="legend-amt">¥${c[1].toFixed(0)}</span>
        <span class="legend-pct">${(c[1] / monthSpentTotal * 100).toFixed(1)}%</span>
      </div>`).join('');
  }

  // ===== 账单列表数据 =====
  const months = [...new Set(records.map(r => r.date.slice(0, 7)))].sort().reverse();
  let list = records;
  if (_moneyFilter !== 'all') list = list.filter(r => r.date.startsWith(_moneyFilter));
  list = [...list].sort((a, b) => (b.date < a.date ? -1 : (b.date > a.date ? 1 : 0)));
  const totalCount = list.length;
  if (_moneyPage * 10 > totalCount && _moneyPage > 1) _moneyPage = Math.max(1, Math.ceil(totalCount / 10));
  const shown = list.slice(0, _moneyPage * 10);
  const filterLabel = _moneyFilter === 'all' ? '全部账单' : `${_moneyFilter.slice(0,4)}年${Number(_moneyFilter.slice(5,7))}月`;

  $('#page-body').innerHTML = `
    <div class="money-grid">
      <div class="money-account">
        <div class="lbl">日常账户(可变)</div>
        <div class="amt">¥${remaining.toFixed(2)}</div>
        <div style="font-size:10px;color:var(--oak);margin-top:4px;">月预算 ¥${monthBudget}</div>
      </div>
      <div class="money-account fixed">
        <div class="lbl">固定支出</div>
        <div class="amt">¥${fixedSpent.toFixed(2)}</div>
        <div style="font-size:10px;color:var(--oak);margin-top:4px;">本月已扣</div>
      </div>
      <div class="money-account coin">
        <div class="lbl">金币账户</div>
        <div class="amt" style="color:var(--red);">${coins.balance}</div>
        <div style="font-size:10px;color:var(--oak);margin-top:4px;">1 金币 = 1 元</div>
      </div>
    </div>

    <div class="total-line">
      <span>📊 历史累计支出 <b>¥${totalSpent.toFixed(2)}</b></span>
      <span>历史累计收入 <b style="color:var(--moss);">¥${totalIncome.toFixed(2)}</b></span>
    </div>

    <div class="card">
      <div class="card-hd">💰 今日可变支出 <span class="badge" style="background:var(--bright);color:var(--deep);">今日 ¥${todaySpent}</span></div>
      <p style="font-size:12px;color:var(--leaf);margin-bottom:10px;">
        ${todaySpent===0?'🌳 今日零开支!奖励 0 金币':''}
        ${todaySpent>0 && todaySpent<=15?'🌿 节省!今日可获 2 金币':''}
        ${todaySpent>15 && todaySpent<=30?'🌱 一般,可获 1 金币':''}
        ${todaySpent>30?'🍂 超支,无奖励':''}
      </p>
    </div>

    <div class="card">
      <div class="card-hd">📊 近 7 天支出趋势</div>
      <div class="bar-chart" id="week-chart"></div>
    </div>

    <div class="card">
      <div class="card-hd">📈 月度分析
        <span class="money-month-nav">
          <button class="btn btn-sm btn-ghost" onclick="moneyShiftMonth(-1)">←</button>
          <span class="money-month-label">${_moneyMonth.slice(0,4)}年${Number(_moneyMonth.slice(5,7))}月</span>
          <button class="btn btn-sm btn-ghost" onclick="moneyShiftMonth(1)">→</button>
        </span>
      </div>
      <div class="month-summary">
        <div>支出 <b style="color:var(--red);">¥${monthSpentTotal.toFixed(2)}</b></div>
        <div>收入 <b style="color:var(--moss);">¥${monthIncome.toFixed(2)}</b></div>
        <div>结余 <b style="color:var(--deep);">¥${(monthIncome - monthSpentTotal).toFixed(2)}</b></div>
      </div>
      <div class="bar-chart bar-chart-month" id="month-bar">
        ${barData.map(b => `
          <div class="bar ${b.isCur?'cur':''}" style="height:${(b.amount/maxBar*100)}%;" onclick="moneyFilterMonth('${b.month}')" title="点击查看该月账单">
            <div class="val">${b.amount ? '¥' + b.amount.toFixed(0) : ''}</div>
            <div class="lbl">${b.label}</div>
          </div>`).join('')}
      </div>
      <div class="donut-wrap">
        ${monthSpentTotal > 0 ? `
          <div class="donut-chart" style="background:conic-gradient(${donutCss});">
            <div class="donut-inner">
              <div class="donut-total">¥${monthSpentTotal.toFixed(0)}</div>
              <div class="donut-sub">${_moneyMonth.slice(0,4)}.${Number(_moneyMonth.slice(5,7))} 支出</div>
            </div>
          </div>
          <div class="chart-legend">${legendHtml}</div>` : `
          <div class="empty" style="padding:20px;"><div class="empty-icon">🍃</div>本月暂无支出记录</div>`}
      </div>
      <div class="chart-src">数据来源:本地账单记录(wb_records · ${filterLabel} · 共 ${records.length} 笔)</div>
    </div>

    <div class="card">
      <div class="card-hd">🎯 心愿兑换清单</div>
      <div class="wish-grid">
        <div class="wish-card"><div class="amt">10</div><div class="lbl">小小心愿</div></div>
        <div class="wish-card"><div class="amt">20</div><div class="lbl">日常愿望</div></div>
        <div class="wish-card"><div class="amt">50</div><div class="lbl">中级心愿</div></div>
        <div class="wish-card"><div class="amt">100</div><div class="lbl">终极奖励 🎉</div></div>
      </div>
      <p style="font-size:11px;color:var(--leaf);margin-top:10px;text-align:center;">凑齐金币即可兑换!</p>
    </div>

    <div class="card">
      <div class="card-hd">📋 账单记录 <span class="badge">${filterLabel}</span></div>
      <div class="tabs money-filter-tabs" id="money-filter-tabs">
        <div class="tab ${_moneyFilter==='all'?'active':''}" data-m="all">全部</div>
        ${months.map(m => `<div class="tab ${_moneyFilter===m?'active':''}" data-m="${m}">${Number(m.slice(5,7))}月</div>`).join('')}
      </div>
      <div class="record-list" id="record-list"></div>
      <div id="money-loadmore" style="text-align:center;margin-top:12px;"></div>
    </div>`;

  // 周图表
  $('#week-chart').innerHTML = weekData.map(d => `
    <div class="bar" style="height:${(d.amount/maxAmt*100)}%;">
      <div class="val">${d.amount||''}</div>
      <div class="lbl">${d.day}</div>
    </div>`).join('');

  // 月份筛选 tabs
  $$('#money-filter-tabs .tab').forEach(t => t.onclick = () => {
    _moneyFilter = t.dataset.m;
    _moneyPage = 1;
    viewMoney();
  });

  // 账单列表
  const listEl = $('#record-list');
  listEl.innerHTML = shown.length ? shown.map(r => `
    <div class="record-item">
      <div class="record-left">
        <div class="record-cat">${r.type==='income'?'💵':(r.type==='fixed'?'📌':'💸')}</div>
        <div class="record-info">
          <div class="name">${esc(r.name)}</div>
          <div class="meta">${r.date} · ${r.type==='income'?'收入':(r.type==='fixed'?'固定':'可变')}</div>
        </div>
      </div>
      <div class="record-right">
        <div class="record-amt ${r.type==='income'?'inc':'exp'}">${r.type==='income'?'+':'-'}¥${Number(r.amount).toFixed(2)}</div>
        <div class="record-ops">
          <button class="record-op" title="编辑" onclick="editRecord('${r.id}')">✎</button>
          <button class="record-op danger" title="删除" onclick="deleteRecord('${r.id}')">🗑</button>
        </div>
      </div>
    </div>`).join('') : '<div class="empty"><div class="empty-icon">📝</div>该月份暂无记录</div>';

  // 加载更多
  const lm = $('#money-loadmore');
  if (shown.length < totalCount) {
    lm.innerHTML = `<button class="btn btn-sm btn-ghost load-more-btn" onclick="moneyLoadMore()">加载更多(已显示 ${shown.length} / 共 ${totalCount} 笔) ▼</button>`;
  } else if (totalCount > 10) {
    lm.innerHTML = `<span style="font-size:11px;color:var(--oak);">已显示全部 ${totalCount} 笔账单</span>`;
  }
}

// 月份切换(图表)
window.moneyShiftMonth = function(delta) {
  const d = new Date(_moneyMonth + '-01T00:00:00');
  const now = new Date();
  d.setMonth(d.getMonth() + delta);
  const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const nowMk = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  if (mk > nowMk) { toast('已是最近月份'); return; }
  _moneyMonth = mk;
  viewMoney();
};

// 柱状图点击 → 联动月份筛选
window.moneyFilterMonth = function(month) {
  _moneyFilter = month;
  _moneyMonth = month;
  _moneyPage = 1;
  viewMoney();
  const body = $('#page-body');
  if (body) body.scrollIntoView({ behavior: 'smooth' });
};

// 加载更多
window.moneyLoadMore = function() {
  _moneyPage += 1;
  viewMoney();
};

window.showRecordModal = function(editId) {
  const customTypes = STORE.recordTypes();
  // 编辑模式:预填
  let editing = null;
  if (editId) {
    editing = STORE.records().find(r => r.id === editId) || null;
  }
  const typeKey = editing ? editing.type : 'var';
  const builtinOpts = Object.entries(MONEY_BUILTIN_TYPES).map(([tk, list]) => `
    <optgroup label="${tk==='var'?'可变支出':(tk==='fixed'?'固定支出':'收入')}">${list.map(n => `<option ${editing && editing.name===n && tk===typeKey ? 'selected':''}>${n}</option>`).join('')}</optgroup>`).join('');
  const customOpts = customTypes.length ? `
    <optgroup label="我的类别">${customTypes.map(n => `<option ${editing && editing.name===n ? 'selected':''}>${n}</option>`).join('')}</optgroup>` : '';

  showModal({
    title: editing ? '✎ 编辑账单' : '记一笔',
    saveText: editing ? '保存修改' : '保存',
    content: `
      <div class="form-row"><label>类型</label>
        <select name="type" onchange="moneyTypeChange(this.value)">
          <option value="var" ${typeKey==='var'?'selected':''}>可变支出</option>
          <option value="fixed" ${typeKey==='fixed'?'selected':''}>固定支出</option>
          <option value="income" ${typeKey==='income'?'selected':''}>收入</option>
        </select>
      </div>
      <div class="form-row"><label>类别</label>
        <select name="name" onchange="moneyCustomToggle(this)">
          ${builtinOpts}
          ${customOpts}
          <option value="__custom">➕ 自定义新类别…</option>
        </select>
      </div>
      <div class="form-row" id="custom-type-row" style="display:none;">
        <label>新类别名称</label>
        <input type="text" name="customName" class="custom-type-input" placeholder="如:宠物、学习、医疗..." maxlength="10">
      </div>
      <div class="form-row"><label>金额</label><input type="number" name="amount" step="0.01" placeholder="0.00" value="${editing ? editing.amount : ''}"></div>
      <div class="form-row"><label>日期</label><input type="date" name="date" value="${editing ? editing.date : STORE.todayKey()}"></div>`,
    onSave: (d) => {
      if (!d.amount || Number(d.amount) <= 0) { toast('请输入金额'); return false; }
      let name = d.name;
      if (d.name === '__custom') {
        name = (d.customName || '').trim();
        if (!name) { toast('请输入新类别名称'); return false; }
        // 保存自定义类别(去重)
        const types = STORE.recordTypes();
        if (!types.includes(name)) {
          types.push(name);
          STORE.setRecordTypes(types);
        }
      }
      const records = STORE.records();
      if (editing) {
        // 编辑:更新对应 id 的记录
        const idx = records.findIndex(r => r.id === editing.id);
        if (idx >= 0) {
          records[idx] = { ...records[idx], type:d.type, name, amount:d.amount, date:d.date };
          STORE.setRecords(records);
        }
        viewMoney();
        toast('已保存修改 ✓');
      } else {
        records.unshift({ id:'r-'+Date.now(), type:d.type, name, amount:d.amount, date:d.date });
        STORE.setRecords(records);
        viewMoney();
        toast('已记录 ✓');
      }
    }
  });
};

// 编辑账单入口
window.editRecord = function(id) { showRecordModal(id); };

// 删除账单(二次确认)
window.deleteRecord = function(id) {
  if (!confirm('确定删除这笔账单?')) return;
  const records = STORE.records().filter(r => r.id !== id);
  STORE.setRecords(records);
  viewMoney();
  toast('已删除');
};

// 类型切换 → 重置类别下拉为对应内置组
window.moneyTypeChange = function(typeKey) {
  const sel = document.querySelector('#modal select[name="name"]');
  if (!sel) return;
  const builtin = MONEY_BUILTIN_TYPES[typeKey] || [];
  const custom = STORE.recordTypes();
  sel.innerHTML = `
    <optgroup label="${typeKey==='var'?'可变支出':(typeKey==='fixed'?'固定支出':'收入')}">${builtin.map(n => `<option>${n}</option>`).join('')}</optgroup>
    ${custom.length ? `<optgroup label="我的类别">${custom.map(n => `<option>${n}</option>`).join('')}</optgroup>` : ''}
    <option value="__custom">➕ 自定义新类别…</option>`;
  moneyCustomToggle(sel);
};

// 选择"自定义新类别"时显示输入框
window.moneyCustomToggle = function(sel) {
  const row = document.getElementById('custom-type-row');
  if (!row) return;
  row.style.display = sel.value === '__custom' ? 'block' : 'none';
  const input = row.querySelector('input');
  if (input && sel.value === '__custom') input.focus();
};

// ============= 视图:时光胶囊 =============
function viewTime() {
  $('#page-title').innerHTML = '💝 时光胶囊';
  $('#page-sub').textContent = '情侣日志 · 备忘录';
  $('#page-actions').innerHTML = `
    <button class="btn btn-sm" onclick="showJournalModal()">+ 日志</button>
    <button class="btn btn-sm btn-ghost" onclick="showNoteModal()">+ 备忘</button>`;

  const journal = STORE.journal();
  const notes = STORE.notes();
  const startDate = STORE.setting().coupleStart || '2026-03-27';
  const days = daysSince(startDate);

  $('#page-body').innerHTML = `
    <div class="couple-banner">
      <div class="couple-days">💗 ${days}</div>
      <div class="couple-label">在一起 ${days} 天 · 距离纪念日还有 ${30 - days%30} 天</div>
    </div>

    <div class="card">
      <div class="card-hd">💌 情侣日志</div>
      <div id="journal-list"></div>
    </div>

    <div class="card">
      <div class="card-hd">📝 备忘录</div>
      <div class="note-tabs">
        <div class="note-tab active" data-cat="all">全部</div>
        <div class="note-tab" data-cat="工作">工作</div>
        <div class="note-tab" data-cat="学习">学习</div>
        <div class="note-tab" data-cat="生活">生活</div>
        <div class="note-tab" data-cat="灵感">灵感</div>
        <div class="note-tab" data-cat="其他">其他</div>
      </div>
      <div id="note-list"></div>
    </div>`;

  $$('.note-tab').forEach(t => t.onclick = () => {
    $$('.note-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    renderNotes(t.dataset.cat);
  });

  const jl = $('#journal-list');
  jl.innerHTML = journal.length ? journal.slice(0,5).map(j => `
    <div class="journal-item">
      <div class="journal-head">
        <div class="journal-date">${j.date}</div>
        <div class="journal-mood">${j.mood||'😊'}</div>
      </div>
      <div class="journal-text">${esc(j.text)}</div>
    </div>`).join('') : '<div class="empty"><div class="empty-icon">💌</div>添加第一条日志吧</div>';

  renderNotes('all');
}

function renderNotes(cat) {
  let notes = STORE.notes();
  if (cat && cat !== 'all') notes = notes.filter(n => n.category === cat);
  const list = $('#note-list');
  list.innerHTML = notes.length ? notes.map(n => `
    <div class="note-item">
      <div class="note-title">${esc(n.title)}</div>
      <div class="note-content">${esc(n.content)}</div>
      <div class="note-meta">
        <span>${esc(n.category)} · ${n.updatedAt.slice(0,10)}</span>
        <span>
          <button class="btn btn-sm btn-ghost" onclick="exportNote('${n.id}')">导出</button>
          <button class="btn btn-sm" onclick="showNoteModal('${n.id}')">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteNote('${n.id}')">删除</button>
        </span>
      </div>
    </div>`).join('') : '<div class="empty"><div class="empty-icon">📝</div>暂无备忘录</div>';
}

window.showJournalModal = function() {
  showModal({
    title: '添加情侣日志',
    content: `
      <div class="form-row"><label>日期</label><input type="date" name="date" value="${STORE.todayKey()}"></div>
      <div class="form-row"><label>心情</label>
        <div class="mood-selector" id="mood-sel">
          <div class="mood-btn active" data-mood="💗">💗</div>
          <div class="mood-btn" data-mood="🥰">🥰</div>
          <div class="mood-btn" data-mood="🎉">🎉</div>
          <div class="mood-btn" data-mood="🥺">🥺</div>
          <div class="mood-btn" data-mood="😊">😊</div>
        </div>
      </div>
      <div class="form-row"><label>今天的记录</label><textarea name="text" rows="4" placeholder="今天发生了什么..."></textarea></div>`,
    onSave: (d) => {
      if (!d.text) { toast('请输入内容'); return false; }
      const mood = $('#mood-sel .mood-btn.active')?.dataset.mood || '😊';
      const journal = STORE.journal();
      journal.unshift({ id:'j-'+Date.now(), date:d.date, mood, text:d.text });
      STORE.setJournal(journal);
      viewTime();
      toast('已记录');
    },
    saveText: '保存'
  });
  setTimeout(() => {
    $$('.mood-btn').forEach(b => b.onclick = () => {
      $$('.mood-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });
  }, 50);
};

window.showNoteModal = function(id) {
  const note = id ? STORE.notes().find(n => n.id === id) : null;
  showModal({
    title: note ? '编辑备忘录' : '新建备忘录',
    content: `
      <div class="form-row"><label>标题</label><input type="text" name="title" value="${note?esc(note.title):''}"></div>
      <div class="form-row"><label>分类</label>
        <select name="category">
          <option ${note?.category==='工作'?'selected':''}>工作</option>
          <option ${note?.category==='学习'?'selected':''}>学习</option>
          <option ${note?.category==='生活'?'selected':''}>生活</option>
          <option ${note?.category==='灵感'?'selected':''}>灵感</option>
          <option ${!note||note?.category==='其他'?'selected':''}>其他</option>
        </select>
      </div>
      <div class="form-row"><label>内容</label><textarea name="content" rows="6">${note?esc(note.content):''}</textarea></div>`,
    onSave: (d) => {
      if (!d.title) { toast('请输入标题'); return false; }
      const notes = STORE.notes();
      if (note) {
        const n = notes.find(x => x.id === id);
        n.title = d.title; n.category = d.category; n.content = d.content;
        n.updatedAt = new Date().toISOString();
      } else {
        notes.unshift({ id:'n-'+Date.now(), title:d.title, category:d.category, content:d.content, updatedAt:new Date().toISOString() });
      }
      STORE.setNotes(notes);
      viewTime();
      toast('已保存');
    }
  });
};

window.deleteNote = function(id) {
  if (!confirm('确定删除?')) return;
  STORE.setNotes(STORE.notes().filter(n => n.id !== id));
  viewTime();
  toast('已删除');
};

window.exportNote = function(id) {
  const n = STORE.notes().find(x => x.id === id);
  if (!n) return;
  const md = `# ${n.title}\n\n分类:${n.category}\n日期:${n.updatedAt.slice(0,10)}\n\n${n.content}`;
  const blob = new Blob([md], { type:'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${n.title}.md`;
  a.click();
};

// ============= 视图:智能提醒 =============
function viewRemind() {
  $('#page-title').innerHTML = '⏰ 智能提醒中心';
  $('#page-sub').textContent = '生日 · 联系 · 自定义';
  $('#page-actions').innerHTML = `
    <button class="btn btn-sm" onclick="showReminderModal()">+ 提醒</button>`;

  const reminders = STORE.reminders();
  const pending = reminders.filter(r => !r.done);

  // 统计
  const stats = { birthday: 0, contact: 0, custom: 0 };
  pending.forEach(r => stats[r.type] = (stats[r.type] || 0) + 1);

  $('#page-body').innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="num">${pending.length}</div><div class="lbl">待处理</div></div>
      <div class="stat-card green"><div class="num">${reminders.filter(r => r.done).length}</div><div class="lbl">已处理</div></div>
      <div class="stat-card"><div class="num">${stats.birthday}</div><div class="lbl">生日</div></div>
      <div class="stat-card"><div class="num">${stats.contact}</div><div class="lbl">联系</div></div>
    </div>

    <div class="card">
      <div class="card-hd">🔔 提醒列表</div>
      <div id="remind-list"></div>
    </div>

    <div class="card">
      <div class="card-hd">📅 日历视图</div>
      <div id="mini-cal"></div>
    </div>`;

  const rl = $('#remind-list');
  if (reminders.length === 0) {
    rl.innerHTML = '<div class="empty"><div class="empty-icon">⏰</div>添加第一个提醒</div>';
  } else {
    rl.innerHTML = reminders.map(r => {
      const days = Math.ceil((new Date(r.date) - new Date()) / 86400000);
      const emoji = r.type==='birthday' ? '🎂' : r.type==='contact' ? '📞' : '🔔';
      return `
        <div class="remind-item">
          <div class="remind-icon">${emoji}</div>
          <div class="remind-info">
            <div class="remind-title">${esc(r.title)}${r.done?' ✓':''}</div>
            <div class="remind-meta">${r.date} · ${days<=0?'今天/已过期':'还有 '+days+' 天'} · 提前 ${r.advance||3} 天</div>
          </div>
          <div class="remind-actions">
            <button class="btn btn-sm" onclick="toggleRemind('${r.id}')">${r.done?'恢复':'完成'}</button>
            <button class="btn btn-sm btn-danger" onclick="deleteRemind('${r.id}')">✕</button>
          </div>
        </div>`;
    }).join('');
  }

  renderMiniCal();
}

window.showReminderModal = function() {
  showModal({
    title: '添加提醒',
    content: `
      <div class="form-row"><label>类型</label>
        <select name="type"><option value="birthday">🎂 生日提醒</option><option value="contact">📞 联系提醒</option><option value="custom">🔔 自定义</option></select>
      </div>
      <div class="form-row"><label>标题</label><input type="text" name="title" placeholder="事项名称"></div>
      <div class="form-row"><label>日期</label><input type="date" name="date"></div>
      <div class="form-row"><label>提前提醒(天)</label><input type="number" name="advance" value="3"></div>
      <div class="form-row"><label>备注</label><textarea name="note" rows="2" placeholder="(选填)"></textarea></div>`,
    onSave: (d) => {
      if (!d.title || !d.date) { toast('请填写完整'); return false; }
      const reminders = STORE.reminders();
      reminders.unshift({ id:'r-'+Date.now(), type:d.type, title:d.title, date:d.date, advance:Number(d.advance)||3, note:d.note, done:false });
      STORE.setReminders(reminders);
      viewRemind();
      toast('已添加');
    }
  });
};

window.toggleRemind = function(id) {
  const reminders = STORE.reminders();
  const r = reminders.find(x => x.id === id);
  if (r) { r.done = !r.done; STORE.setReminders(reminders); viewRemind(); }
};

window.deleteRemind = function(id) {
  STORE.setReminders(STORE.reminders().filter(r => r.id !== id));
  viewRemind();
};

function renderMiniCal() {
  const el = $('#mini-cal');
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month+1, 0).getDate();
  const reminders = STORE.reminders();
  const today = now.getDate();

  let html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;font-size:11px;">';
  ['日','一','二','三','四','五','六'].forEach(d => html += `<div style="opacity:0.5;font-weight:700;">${d}</div>`);
  for (let i = 0; i < firstDay; i++) html += '<div></div>';
  for (let d = 1; d <= lastDate; d++) {
    const hasRemind = reminders.some(r => r.date === `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
    const bg = d === today ? 'var(--red)' : (hasRemind ? 'var(--honey)' : 'transparent');
    const color = d === today || hasRemind ? 'white' : 'var(--deep)';
    html += `<div style="background:${bg};color:${color};padding:6px;border-radius:6px;font-weight:${d===today?'800':'400'};">${d}</div>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

// ============= 视图:成就殿堂 =============
function viewAchieve() {
  $('#page-title').innerHTML = '🏆 成就殿堂';
  $('#page-sub').textContent = '金币 · 徽章 · 卡片';
  $('#page-actions').innerHTML = '';

  const coins = STORE.coins();
  const history = coins.history;
  const weekEarns = {};
  history.forEach(h => {
    const wk = h.date.slice(0, 10);
    const d = new Date(h.date);
    const wkKey = `${d.getFullYear()}-W${Math.ceil(d.getDate()/7)}`;
    weekEarns[wkKey] = (weekEarns[wkKey] || 0) + h.amount;
  });

  const last7Weeks = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i*7);
    const wkKey = `${d.getFullYear()}-W${Math.ceil(d.getDate()/7)}`;
    last7Weeks.push({ wk: wkKey.slice(-3), amt: weekEarns[wkKey] || 0 });
  }
  const maxWk = Math.max(...last7Weeks.map(w => w.amt), 1);

  // 本周明细
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekHistory = history.filter(h => new Date(h.date) >= weekStart);
  const weekSum = weekHistory.reduce((s, h) => s + h.amount, 0);

  // 徽章
  const gkReadsTotal = Object.values(STORE_GK.gkReads()).flat().length;
  const gkCorrectTotal = Object.values(STORE_GK.gkProgress().correct).reduce((s, n) => s + n, 0);
  const badges = [
    { e:'🌟', n:'7天全勤', unlocked: weekHistory.length > 0 },
    { e:'📚', n:'常识积累50条', unlocked: gkReadsTotal >= 50 },
    { e:'🎯', n:'答题小能手', unlocked: gkCorrectTotal >= 20 },
    { e:'🩸', n:'周期记录者', unlocked: STORE_GK.cycle().periods.length >= 3 },
    { e:'📝', n:'备忘录狂魔', unlocked: STORE.notes().length >= 20 },
    { e:'💎', n:'金币100', unlocked: coins.balance >= 100 },
    { e:'🎨', n:'手绘大师', unlocked: false },
    { e:'🔥', n:'连续30天', unlocked: false },
  ];

  $('#page-body').innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="num">${coins.balance}</div><div class="lbl">总金币</div></div>
      <div class="stat-card green"><div class="num">${weekSum.toFixed(1)}</div><div class="lbl">本周</div></div>
      <div class="stat-card"><div class="num">${badges.filter(b => b.unlocked).length}</div><div class="lbl">解锁徽章</div></div>
      <div class="stat-card"><div class="num">${history.length}</div><div class="lbl">总记录</div></div>
    </div>

    <div class="card">
      <div class="card-hd">📊 近 7 周金币趋势</div>
      <div class="bar-chart" id="week-bar"></div>
    </div>

    <div class="card">
      <div class="card-hd">🏅 成就徽章墙</div>
      <div class="badge-grid">
        ${badges.map(b => `
          <div class="badge ${b.unlocked?'':'locked'}">
            <div class="badge-emoji">${b.e}</div>
            <div class="badge-name">${b.n}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-hd">💰 金币流水</div>
      <div class="record-list" id="coin-history"></div>
    </div>`;

  $('#week-bar').innerHTML = last7Weeks.map(w => `
    <div class="bar" style="height:${(w.amt/maxWk*100)}%;">
      <div class="val">${w.amt || ''}</div>
      <div class="lbl">${w.wk}</div>
    </div>`).join('');

  const histEl = $('#coin-history');
  histEl.innerHTML = history.length ? history.slice(0,10).map(h => `
    <div class="record-item">
      <div class="record-left">
        <div class="record-cat">🪙</div>
        <div class="record-info">
          <div class="name">${esc(h.reason)}</div>
          <div class="meta">${h.date.slice(0,16).replace('T',' ')}</div>
        </div>
      </div>
      <div class="record-amt inc">+${h.amount}</div>
    </div>`).join('') : '<div class="empty"><div class="empty-icon">🪙</div>完成任务获取金币吧</div>';
}

// ============= 视图:设置 =============
function viewSettings() {
  $('#page-title').innerHTML = '⚙️ 设置';
  $('#page-sub').textContent = '数据 · 备份 · 推送';
  $('#page-actions').innerHTML = '';

  const s = STORE.setting();

  $('#page-body').innerHTML = `
    <div class="card">
      <div class="card-hd">📦 数据</div>
      <div class="setting-item" onclick="exportAll()">
        <div class="setting-icon">📥</div>
        <div class="setting-info">
          <div class="setting-title">导出全部数据</div>
          <div class="setting-desc">下载 JSON / CSV 备份所有数据</div>
        </div>
      </div>
      <div class="setting-item" onclick="importData()">
        <div class="setting-icon">📤</div>
        <div class="setting-info">
          <div class="setting-title">导入数据</div>
          <div class="setting-desc">从 JSON 文件恢复</div>
        </div>
      </div>
      <div class="setting-item" onclick="clearAll()">
        <div class="setting-icon" style="background:var(--red);color:white;">🗑</div>
        <div class="setting-info">
          <div class="setting-title" style="color:var(--red);">清除全部数据</div>
          <div class="setting-desc">不可恢复,请先导出备份</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">🔔 推送</div>
      <div class="setting-item" onclick="requestPush()">
        <div class="setting-icon">${s.pushEnabled?'✅':'🔕'}</div>
        <div class="setting-info">
          <div class="setting-title">系统级推送 ${s.pushEnabled?'已开启':'未开启'}</div>
          <div class="setting-desc">锁屏可见的桌面通知</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">💰 日常账户预算</div>
      <div class="form-row">
        <label>每日预算(元)</label>
        <input type="number" id="daily-budget" value="${s.dailyBudget}" min="10" max="100">
      </div>
      <button class="btn" onclick="saveBudget()">保存设置</button>
    </div>

    <div class="card">
      <div class="card-hd">ℹ️ 关于</div>
      <p style="font-size:12px;color:var(--leaf);line-height:1.8;">
        <b>WorkBuddy V10.0</b><br>
        森系像素个人工作台 · 像素苹果 + 线条小狗<br>
        数据保存在你的设备本地,支持离线使用<br>
        v10.0 · 2026.08 · 天地通 · 一通 · 日事通 · 万事皆成
      </p>
    </div>`;
}

window.saveBudget = function() {
  const s = STORE.setting();
  s.dailyBudget = Number($('#daily-budget').value) || 30;
  STORE.setSetting(s);
  toast('已保存');
};

window.exportAll = function() {
  const data = {
    todos: STORE.todos(),
    records: STORE.records(),
    journal: STORE.journal(),
    notes: STORE.notes(),
    reminders: STORE.reminders(),
    coins: STORE.coins(),
    setting: STORE.setting(),
    gkReads: STORE_GK.gkReads(),
    gkProgress: STORE_GK.gkProgress(),
    gkReward: STORE_GK.gkReward(),
    gkFav: STORE_GK.gkFav(),
    cycle: STORE_GK.cycle(),
    exportDate: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `workbuddy-backup-${STORE.todayKey()}.json`;
  a.click();
  toast('已导出');
};

window.importData = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        Object.keys(data).forEach(k => {
          if (k === 'exportDate') return;
          localStorage.setItem('wb_' + k, JSON.stringify(data[k]));
        });
        toast('导入成功');
        setTimeout(() => location.reload(), 800);
      } catch { toast('导入失败'); }
    };
    reader.readAsText(file);
  };
  input.click();
};

window.clearAll = function() {
  if (!confirm('确定清除所有数据?此操作不可恢复!')) return;
  Object.keys(localStorage).filter(k => k.startsWith('wb_')).forEach(k => localStorage.removeItem(k));
  toast('已清除');
  setTimeout(() => location.reload(), 800);
};

window.requestPush = async function() {
  if (!('Notification' in window)) { toast('当前环境不支持通知'); return; }
  if (Notification.permission === 'granted') {
    toast('通知已开启');
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    const s = STORE.setting();
    s.pushEnabled = true;
    STORE.setSetting(s);
    toast('通知权限已开启');
    new Notification('WorkBuddy', { body:'🎉 通知已开启,我会温柔提醒你的重要事项', icon:'icons/icon-192.png' });
  } else {
    toast('通知权限被拒绝');
  }
};

// ============= 路由 =============
const VIEWS = { today:viewToday, gk:viewGk, cycle:viewCycle, money:viewMoney, time:viewTime, remind:viewRemind, achieve:viewAchieve, settings:viewSettings };
let _currentView = 'today';

window.gotoView = function(name) {
  _currentView = name;
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
  VIEWS[name]();
  $('#content').scrollTop = 0;
};

// 处理 URL hash
function applyHash() {
  const h = (location.hash || '#today').slice(1);
  if (VIEWS[h]) gotoView(h);
}
window.addEventListener('hashchange', applyHash);

// 导航点击
document.addEventListener('click', (e) => {
  const ni = e.target.closest('.nav-item');
  if (ni && ni.dataset.view) {
    location.hash = '#' + ni.dataset.view;
  }
  const ts = e.target.closest('#toggle-sidebar');
  if (ts) $('#app').classList.toggle('collapsed');
});

// ============= 初始化 =============
function initData() {
  // 初始化待办示例
  if (STORE.todos().length === 0) {
    STORE.setTodos([
      { id:'t-init-1', text:'欢迎使用 WorkBuddy!点击右上角添加新待办', date:STORE.todayKey(), done:false },
      { id:'t-init-2', text:'前往「考公专项」学习今日常识', date:STORE.todayKey(), done:false },
      { id:'t-init-3', text:'前往「生理周期」记录身体状况', date:STORE.todayKey(), done:false }
    ]);
  }
  // 初始化金币
  const c = STORE.coins();
  if (c.history.length === 0) {
    addCoin(0, '初始化');
    c.balance = 0; c.history = [];
    STORE.setCoins(c);
  }
}

// Service Worker 注册
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(() => {
      console.log('SW registered');
    }).catch(err => console.log('SW failed', err));
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initData();
  applyHash();
  // 启动页淡出
  setTimeout(() => {
    $('#splash').classList.add('hidden');
  }, 1500);
});

// 检查每日金币奖励
setInterval(() => {
  checkDailyCoinReward();
}, 60000);