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
};

// ============= 考公常识库(按日期) =============
const GK_COMMON = [
  // 时政要闻
  { id:'c01', date:'2026-08-02', field:'时政', title:'二十届四中全会审议通过「十五五」规划建议', brief:'2025年10月二十届四中全会审议通过《中共中央关于制定国民经济和社会发展第十五个五年规划的建议》,提出2035年基本实现社会主义现代化远景目标。', source:'新华社 / 二十届四中全会公报', detail:'核心要点:高质量发展、新发展格局、科技自立自强、共同富裕、双碳目标。' },
  { id:'c02', date:'2026-08-01', field:'时政', title:'全国统一大市场建设持续推进', brief:'2025年《加快建设全国统一大市场的意见》深化实施,破除地方保护和市场分割,畅通国内大循环。', source:'国务院政策文件', detail:'重点任务:统一市场基础制度规则、推进市场设施高标准联通、打造统一的要素和资源市场。' },
  { id:'c03', date:'2026-07-31', field:'时政', title:'「新质生产力」成为发展关键词', brief:'习近平总书记提出因地制宜发展新质生产力,以科技创新引领产业创新,改造提升传统产业。', source:'人民日报', detail:'新质生产力以劳动者、劳动资料、劳动对象及其优化组合的跃升为基本内涵。' },
  { id:'c04', date:'2026-07-30', field:'时政', title:'扩大内需战略:提振消费专项行动', brief:'2025年多部门联合实施提振消费专项行动,推动以旧换新、服务消费扩容提质。', source:'国家发改委', detail:'消费是拉动经济增长的重要引擎,重点领域:汽车、家电、住房、服务消费。' },
  // 法律基础
  { id:'c05', date:'2026-08-02', field:'法律', title:'《民法典》:社会生活的百科全书', brief:'2021年1月1日施行,共7编1260条,包括总则、物权、合同、人格权、婚姻家庭、继承、侵权责任,人格权独立成编是最大亮点。', source:'《中华人民共和国民法典》', detail:'总则编规定民事主体、民事权利、民事法律行为等基础制度;人格权编含生命权、身体权、健康权、姓名权、名誉权、隐私权等。' },
  { id:'c06', date:'2026-08-01', field:'法律', title:'宪法是国家的根本法', brief:'现行宪法1982年通过,历经五次修正,具有最高法律效力,一切法律不得与宪法相抵触。', source:'《中华人民共和国宪法》', detail:'宪法规定国家根本制度、根本任务和公民基本权利义务,是全国各族人民共同遵守的行为准则。' },
  { id:'c07', date:'2026-07-31', field:'法律', title:'行政法的基本原则', brief:'合法行政、合理行政、程序正当、高效便民、诚实守信、权责统一,是行政机关行使职权必须遵循的准则。', source:'行政法学基础', detail:'程序正当包括:信息公开、公众参与、说明理由、听取申辩等。' },
  // 经济常识
  { id:'c08', date:'2026-08-02', field:'经济', title:'恩格尔系数:衡量生活水平的标尺', brief:'食品支出占消费总支出的比重。系数越低生活水平越高:>59%贫困,50-59%温饱,40-50%小康,30-40%富裕,<30%最富裕。中国2024年约29.8%。', source:'国家统计局', detail:'恩格尔系数是国际上通用的衡量居民生活水平高低的重要指标。' },
  { id:'c09', date:'2026-08-01', field:'经济', title:'GDP:国内生产总值', brief:'一定时期内一个国家(地区)境内所有常住单位生产的最终产品和服务价值总和。区分名义GDP与实际GDP(扣除价格因素)。', source:'国家统计局', detail:'GDP增速是宏观经济运行的核心指标,2025年政府工作报告目标约5%左右。' },
  { id:'c10', date:'2026-07-31', field:'经济', title:'货币政策三大工具', brief:'存款准备金率、再贴现政策、公开市场操作(OMO),央行通过三大工具调节市场货币供应量。', source:'中国人民银行', detail:'降准增加可贷资金、降息降低融资成本,均属宽松货币政策。' },
  // 人文历史
  { id:'c11', date:'2026-08-02', field:'人文历史', title:'《诗经》:中国最早的诗歌总集', brief:'收录西周初年至春秋中叶诗歌305篇,分风、雅、颂三部分;表现手法为赋、比、兴,合称「六义」。', source:'中国文学史', detail:'风:各诸侯国乐调,共160篇;雅:周王朝京都地区正乐,105篇;颂:宗庙祭祀乐歌,40篇。' },
  { id:'c12', date:'2026-08-01', field:'人文历史', title:'科举制度:影响千年的选官制度', brief:'隋朝创立(隋炀帝设进士科),唐朝完善,1905年清末废除。分乡试、会试、殿试三级。', source:'中国通史', detail:'殿试一甲前三名:状元、榜眼、探花,合称「三鼎甲」。' },
  { id:'c13', date:'2026-07-31', field:'人文历史', title:'丝绸之路与「一带一路」', brief:'古代丝绸之路由张骞凿空西域开辟,分陆上(长安-河西走廊-中亚)与海上两条;现代「一带一路」倡议2013年提出。', source:'中国历史常识', detail:'一带一路:丝绸之路经济带 + 21世纪海上丝绸之路。' },
  // 科技常识
  { id:'c14', date:'2026-08-02', field:'科技', title:'光年是长度单位而非时间单位', brief:'光在真空中一年传播的距离,约9.46万亿千米。常用语衡量星际空间距离,如银河系直径约10万光年。', source:'天文常识', detail:'1光年 ≈ 9.46 × 10^12 千米 = 63241 天文单位。' },
  { id:'c15', date:'2026-08-01', field:'科技', title:'「嫦娥六号」实现月球背面采样返回', brief:'2024年6月嫦娥六号任务成功完成月球背面南极-艾特肯盆地采样返回,人类首次月背采样。', source:'国家航天局', detail:'嫦娥工程三步走:绕、落、回;后续将推进月球科研站建设。' },
  { id:'c16', date:'2026-07-30', field:'科技', title:'芯片制造:光刻机与制程', brief:'光刻机是芯片制造核心设备,制程越小集成度越高(7nm/5nm/3nm)。ASML垄断EUV光刻机市场。', source:'科技常识', detail:'国产芯片自主可控是科技自立自强的重要环节。' },
];

// ============= 考公训练题库(7 分类) =============
const GK_QUIZ = [
  // ---- 行测:言语理解 ----
  { id:'q01', section:'行测', category:'言语理解', level:'基础', question:'填入画横线部分最恰当的一项是:改革攻坚之路,唯有______,方能行稳致远。', options:['A. 一蹴而就','B. 驰而不息','C. 半途而废','D. 见异思迁'], answer:'B', explain:'「驰而不息」意为奔驰不停息,比喻坚持不懈、持之以恒,契合改革长期推进的语境。A项「一蹴而就」与后文「行稳致远」矛盾;C、D项语义消极,均排除。', src:'国考言语理解真题风格' },
  { id:'q02', section:'行测', category:'言语理解', level:'进阶', question:'下列句子没有语病的一项是:', options:['A. 通过这次实践活动,使我深受教育。','B. 我们要养成节约用水的好习惯。','C. 他的写作水平明显有了很大的提高和改进。','D. 能否坚持锻炼是身体健康的重要保证。'], answer:'B', explain:'A项「通过...使...」缺主语,删「通过」或「使」;C项「提高」与「改进」语义重复,删其一;D项两面对一面,「能否」对应「是否健康」。B项无误。', src:'言语理解病句辨析' },
  // ---- 行测:判断推理 ----
  { id:'q03', section:'行测', category:'判断推理', level:'基础', question:'如果「所有成功的企业都注重创新」为真,那么以下哪项一定为假?', options:['A. 某注重创新的企业是成功的','B. 某不注重创新的企业是成功的','C. 某成功的企业不注重创新','D. 所有注重创新的企业都成功'], answer:'C', explain:'「所有成功的企业都注重创新」,即成功→注重创新。逆否命题:不注重创新→不成功。C项「成功且不注重创新」与条件矛盾,必为假。', src:'逻辑判断·逆否命题' },
  { id:'q04', section:'行测', category:'判断推理', level:'进阶', question:'甲乙丙三人只有一人是教师。甲说:「我是教师」;乙说:「甲不是教师」;丙说:「我不是教师」。已知三人中只有一人说真话,则教师是:', options:['A. 甲','B. 乙','C. 丙','D. 无法确定'], answer:'C', explain:'若甲为教师,则甲真、乙假、丙真,两人真,不符;若乙为教师,则甲假、乙真、丙真,不符;若丙为教师,则甲假、乙真、丙假,恰一人真。故教师是丙。', src:'逻辑判断·真假话' },
  // ---- 行测:数量关系 ----
  { id:'q05', section:'行测', category:'数量关系', level:'基础', question:'一项工程,甲单独做需10天完成,乙单独做需15天完成。两人合作,需要多少天完成?', options:['A. 5天','B. 6天','C. 7.5天','D. 12天'], answer:'B', explain:'甲效率1/10,乙效率1/15,合作效率1/10+1/15=3/30+2/30=1/6,故1÷(1/6)=6天。', src:'工程问题·合作效率' },
  { id:'q06', section:'行测', category:'数量关系', level:'冲刺', question:'某商品按定价的八折出售,仍可获得20%的利润,若成本为240元,则定价为多少元?', options:['A. 300元','B. 320元','C. 360元','D. 400元'], answer:'C', explain:'八折后售价=240×(1+20%)=288元,定价=288÷0.8=360元。', src:'经济利润问题' },
  // ---- 行测:资料分析 ----
  { id:'q07', section:'行测', category:'资料分析', level:'基础', question:'2024年某省粮食产量5800万吨,同比增长3.6%,则2023年该省粮食产量约为:', options:['A. 5600万吨','B. 5560万吨','C. 6010万吨','D. 5480万吨'], answer:'A', explain:'基期量=现期量÷(1+增长率)=5800÷1.036≈5598万吨,最接近5600万吨。', src:'资料分析·基期量' },
  { id:'q08', section:'行测', category:'资料分析', level:'进阶', question:'某市2024年GDP为1.2万亿元,其中第三产业占比58%,则第三产业增加值为:', options:['A. 6960亿元','B. 696亿元','C. 5800亿元','D. 6480亿元'], answer:'A', explain:'1.2万亿×58%=1.2×0.58万亿=0.696万亿=6960亿元。', src:'资料分析·现期比重' },
  // ---- 申论:材料阅读 ----
  { id:'q09', section:'申论', category:'材料阅读', level:'基础', question:'(材料略)某村通过「党支部+合作社+农户」模式盘活闲置土地,发展特色种植。下列对材料主旨概括最准确的是:', options:['A. 农业发展依赖政府补贴','B. 多元主体协同是乡村产业振兴的有效路径','C. 城市资本应主导农村资源开发','D. 土地流转可以一劳永逸解决农民增收'], answer:'B', explain:'材料核心在「党支部+合作社+农户」多元主体协同,答案为B。A项以偏概全、C项与材料无关、D项绝对化。', src:'申论材料概括' },
  // ---- 申论:归纳概括 ----
  { id:'q10', section:'申论', category:'归纳概括', level:'进阶', question:'材料中某社区居家养老服务存在的主要问题,以下概括最准确的一组是:', options:['A. 设施老化、人手不足','B. 参与度低、信息不畅、资源分散','C. 资金短缺、态度消极','D. 场地有限、费用过高'], answer:'B', explain:'归纳概括要求全面、准确、有条理。材料分别提到老人参与度低、信息传递不畅、各类资源分散三方面,故B项最全面。A/C/D均只对应材料局部信息。', src:'申论归纳概括' },
  // ---- 申论:写作要点 ----
  { id:'q11', section:'申论', category:'写作要点', level:'冲刺', question:'围绕「青年干部成长」写一篇议论文,以下关于分论点设置最合理的是:', options:['A. 仰望星空、脚踏实地、担当作为,层层递进','B. 只谈理想信念,忽略实践','C. 空谈理论学习,不接地气','D. 罗列数据事实,缺乏观点'], answer:'A', explain:'议论文分论点应层次清晰、逻辑递进。「仰望星空(理想)→脚踏实地(实践)→担当作为(行动)」构成完整的成长路径,契合主题。', src:'申论写作·论点设置' },
];

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

// 答题判分
window.answerQuiz = function(qid, pick) {
  const q = GK_QUIZ.find(x => x.id === qid);
  if (!q) return;
  const correct = pick === q.answer;
  const progress = STORE_GK.gkProgress();
  if (correct) {
    progress.correct[qid] = (progress.correct[qid] || 0) + 1;
    // 答对奖励:0.2/题,每日封顶 5 题
    const today = STORE.todayKey();
    const reward = STORE_GK.gkReward();
    const count = reward[today] || 0;
    if (count < 5) {
      reward[today] = count + 1;
      STORE_GK.setGkReward(reward);
      addCoin(0.2, `答对「${q.category}」题`);
      toast('✅ 回答正确 +0.2 金币');
    } else {
      toast('✅ 回答正确(今日奖励已达上限)');
    }
  } else {
    progress.wrong[qid] = (progress.wrong[qid] || 0) + 1;
    toast('❌ 回答错误,已收入错题集');
  }
  STORE_GK.setGkProgress(progress);
  renderGkQuiz(qid);
};

// 移除错题
window.removeWrong = function(qid) {
  const progress = STORE_GK.gkProgress();
  delete progress.wrong[qid];
  STORE_GK.setGkProgress(progress);
  viewGk();
  toast('已从错题集移除');
};

// 难度样式
function diffClass(level) {
  return { '基础':'basic', '进阶':'mid', '冲刺':'hard' }[level] || 'basic';
}

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

// ---------- 常识子页 ----------
function renderGkCommon() {
  const today = STORE.todayKey();
  if (!_gkDate) _gkDate = today;
  const gkReads = STORE_GK.gkReads();
  const todayLearned = (gkReads[_gkDate] || []);

  // 领域筛选
  const fields = ['all','时政','法律','经济','人文历史','科技'];
  let list = GK_COMMON.filter(c => c.date === _gkDate);
  if (_gkField !== 'all') list = list.filter(c => c.field === _gkField);
  if (list.length === 0) {
    // 该日期没有对应领域的条目,放宽到全部
    list = GK_COMMON.filter(c => c.date === _gkDate);
  }

  // 分页
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (_gkPage > pages) _gkPage = pages;
  const pageList = list.slice((_gkPage-1)*PAGE_SIZE, _gkPage*PAGE_SIZE);

  $('#gk-body').innerHTML = `
    <div class="tabs" style="margin-bottom:8px;">
      ${fields.map(f => `<div class="tab ${_gkField===f?'active':''}" data-f="${f}">${f==='all'?'全部':f}</div>`).join('')}
    </div>

    <div class="date-nav">
      <button class="btn btn-sm btn-ghost" onclick="gkShiftDate(-1)">← ${shiftDate(_gkDate,-1)}</button>
      <div class="date-nav-center">
        <div class="date-nav-day">${_gkDate}</div>
        <button class="btn btn-sm" onclick="gkShiftDate(0)">回到今天</button>
      </div>
      <button class="btn btn-sm btn-ghost" onclick="gkShiftDate(1)">${shiftDate(_gkDate,1)} →</button>
    </div>

    <div id="gk-common-list"></div>
    <div class="gk-pager" id="gk-common-pager"></div>`;

  $$('#gk-body .tab[data-f]').forEach(t => t.onclick = () => {
    _gkField = t.dataset.f;
    _gkPage = 1;
    renderGkCommon();
  });

  const listEl = $('#gk-common-list');
  listEl.innerHTML = pageList.map(c => {
    const learned = todayLearned.includes(c.id);
    const faved = isFav('common', c.id);
    return `
      <div class="feed-item" style="position:relative;">
        <div class="feed-cat">${esc(c.field)}</div>
        <div class="feed-title">${esc(c.title)}</div>
        <div class="feed-text">${esc(c.brief)}</div>
        <div class="common-src">📎 ${esc(c.source)}</div>
        <details class="common-detail"><summary>查看详解</summary>${esc(c.detail||c.brief)}</details>
        <div class="feed-actions">
          <span class="left">${c.date}</span>
          <span>
            <button class="btn btn-sm btn-ghost" onclick="toggleGkFav('common','${c.id}')">${faved?'★ 已收藏':'☆ 收藏'}</button>
            ${learned ? '<span style="color:var(--moss);font-size:11px;font-weight:700;">✓ 已学习</span>' :
              `<button class="btn btn-sm" onclick="markCommonLearned('${c.id}')">标记已学</button>`}
          </span>
        </div>
      </div>`;
  }).join('') || '<div class="empty"><div class="empty-icon">📖</div>这一天还没有常识内容</div>';

  // 分页
  const pager = $('#gk-common-pager');
  pager.innerHTML = pages > 1 ? Array.from({length: pages}, (_, i) =>
    `<button class="btn btn-sm ${_gkPage===i+1?'':''}" style="${_gkPage===i+1?'background:var(--deep);color:var(--cream);':''}" onclick="_gkPage=${i+1};renderGkCommon()">${i+1}</button>`).join('') : '';
}

window.gkShiftDate = function(days) {
  _gkDate = days === 0 ? STORE.todayKey() : shiftDate(_gkDate, days);
  _gkPage = 1;
  renderGkCommon();
};

// ---------- 训练子页 ----------
function renderGkQuiz(highlightId) {
  const sections = ['行测','申论'];
  const cats = {
    '行测': ['all','言语理解','判断推理','数量关系','资料分析'],
    '申论': ['all','材料阅读','归纳概括','写作要点'],
  };
  let list = GK_QUIZ.filter(q => q.section === _gkSection);
  if (_gkCat !== 'all') list = list.filter(q => q.category === _gkCat);

  // 分页
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (_gkPage > pages) _gkPage = pages;
  const pageList = list.slice((_gkPage-1)*PAGE_SIZE, _gkPage*PAGE_SIZE);
  const progress = STORE_GK.gkProgress();

  $('#gk-body').innerHTML = `
    <div class="tabs" style="margin-bottom:8px;">
      ${sections.map(s => `<div class="tab ${_gkSection===s?'active':''}" data-s="${s}">${s==='行测'?'🧩':'✍️'} ${s}</div>`).join('')}
    </div>
    <div class="tabs" style="margin-bottom:10px;">
      ${cats[_gkSection].map(c => `<div class="tab ${_gkCat===c?'active':''}" data-c="${c}">${c==='all'?'全部':c}</div>`).join('')}
    </div>
    <div id="gk-quiz-list"></div>
    <div class="gk-pager" id="gk-quiz-pager"></div>`;

  $$('#gk-body .tab[data-s]').forEach(t => t.onclick = () => {
    _gkSection = t.dataset.s;
    _gkCat = 'all';
    _gkPage = 1;
    renderGkQuiz();
  });
  $$('#gk-body .tab[data-c]').forEach(t => t.onclick = () => {
    _gkCat = t.dataset.c;
    _gkPage = 1;
    renderGkQuiz();
  });

  const listEl = $('#gk-quiz-list');
  listEl.innerHTML = pageList.map(q => {
    const faved = isFav('quiz', q.id);
    const answered = progress.correct[q.id] || progress.wrong[q.id] || 0;
    return `
      <div class="quiz-card">
        <div class="quiz-head">
          <span class="difficulty-${diffClass(q.level)}">${q.level}</span>
          <span class="quiz-cat">${q.section} · ${q.category}</span>
          <button class="fav-star ${faved?'active':''}" onclick="toggleGkFav('quiz','${q.id}')">${faved?'★':'☆'}</button>
        </div>
        <div class="quiz-question">${esc(q.question)}</div>
        <div class="quiz-options" id="quiz-opt-${q.id}">
          ${q.options.map(o => {
            const letter = o[0];
            return `<div class="quiz-option" data-q="${q.id}" data-p="${letter}" data-a="${q.answer}" data-correct="${letter===q.answer}">
              <span class="quiz-opt-letter">${letter}</span><span>${esc(o.slice(2))}</span>
            </div>`;
          }).join('')}
        </div>
        ${answered ? '' : ''}
        <div class="quiz-explain" id="quiz-exp-${q.id}" style="display:none;"></div>
      </div>`;
  }).join('') || '<div class="empty"><div class="empty-icon">📝</div>该分类暂无题目</div>';

  // 绑定答题事件
  $$('.quiz-option').forEach(opt => {
    if (opt.dataset.q !== highlightId) return;
    opt.onclick = () => {
      const qid = opt.dataset.q, pick = opt.dataset.p;
      const correct = opt.dataset.correct === 'true';
      answerQuiz(qid, pick);
    };
  });
  // 未高亮时也绑定(默认全部可答)
  if (!highlightId) {
    $$('.quiz-option').forEach(opt => {
      opt.onclick = () => {
        const qid = opt.dataset.q, pick = opt.dataset.p;
        answerQuiz(qid, pick);
      };
    });
  }

  const pager = $('#gk-quiz-pager');
  pager.innerHTML = pages > 1 ? Array.from({length: pages}, (_, i) =>
    `<button class="btn btn-sm" style="${_gkPage===i+1?'background:var(--deep);color:var(--cream);':''}" onclick="_gkPage=${i+1};renderGkQuiz()">${i+1}</button>`).join('') : '';
}

// ---------- 复习子页 ----------
function renderGkReview() {
  const progress = STORE_GK.gkProgress();
  const fav = STORE_GK.gkFav();
  const wrongIds = Object.keys(progress.wrong);
  const wrongList = GK_QUIZ.filter(q => wrongIds.includes(q.id));
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
          <span class="difficulty-${diffClass(q.level)}">${q.level}</span>
          <span class="quiz-cat">${q.section} · ${q.category}</span>
          <span style="color:var(--red);font-size:11px;">❌ ${progress.wrong[q.id]} 次</span>
        </div>
        <div class="quiz-question">${esc(q.question)}</div>
        <div class="quiz-options" id="quiz-opt-${q.id}">
          ${q.options.map(o => {
            const letter = o[0];
            return `<div class="quiz-option ${letter===q.answer?'correct':''}" style="pointer-events:none;">
              <span class="quiz-opt-letter">${letter}</span><span>${esc(o.slice(2))}</span>
              ${letter===q.answer?'<span class="quiz-tick">✓</span>':''}
            </div>`;
          }).join('')}
        </div>
        <div class="quiz-explain" style="display:block;">💡 ${esc(q.explain)}</div>
        <div class="feed-actions" style="margin-top:10px;">
          <span class="left">正确答案:${q.answer}</span>
          <button class="btn btn-sm btn-ghost" onclick="removeWrong('${q.id}')">从错题集移除</button>
        </div>
      </div>`).join('');
  } else {
    let html = '';
    const commons = favCommon.map(f => GK_COMMON.find(c => c.id === f.refId)).filter(Boolean);
    if (commons.length) {
      html += `<div class="card"><div class="card-hd">📖 收藏的常识</div>${commons.map(c => `
        <div class="feed-item">
          <div class="feed-cat">${esc(c.field)}</div>
          <div class="feed-title">${esc(c.title)}</div>
          <div class="feed-text">${esc(c.brief)}</div>
          <div class="feed-actions">
            <span class="left">${c.date} · ${esc(c.source)}</span>
            <button class="btn btn-sm btn-ghost" onclick="toggleGkFav('common','${c.id}')">取消收藏</button>
          </div>
        </div>`).join('')}</div>`;
    }
    const quizs = favQuiz.map(f => GK_QUIZ.find(q => q.id === f.refId)).filter(Boolean);
    if (quizs.length) {
      html += `<div class="card"><div class="card-hd">🎯 收藏的题目</div>${quizs.map(q => `
        <div class="quiz-card">
          <div class="quiz-head">
            <span class="difficulty-${diffClass(q.level)}">${q.level}</span>
            <span class="quiz-cat">${q.section} · ${q.category}</span>
          </div>
          <div class="quiz-question">${esc(q.question)}</div>
          <div class="quiz-options" id="quiz-opt-${q.id}">
            ${q.options.map(o => {
              const letter = o[0];
              return `<div class="quiz-option ${letter===q.answer?'correct':''}" style="pointer-events:none;">
                <span class="quiz-opt-letter">${letter}</span><span>${esc(o.slice(2))}</span>
                ${letter===q.answer?'<span class="quiz-tick">✓</span>':''}
              </div>`;
            }).join('')}
          </div>
          <div class="quiz-explain" style="display:block;">💡 ${esc(q.explain)}</div>
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

// ============= 视图:财富工坊 =============
function viewMoney() {
  $('#page-title').innerHTML = '💰 财富工坊';
  $('#page-sub').textContent = '五账户独立 · 严禁混合';
  $('#page-actions').innerHTML = `
    <button class="btn btn-sm" onclick="showRecordModal()">+ 记账</button>`;

  const records = STORE.records();
  const today = STORE.todayKey();
  const todaySpent = records.filter(r => r.date === today && r.type !== 'income').reduce((s, r) => s + Number(r.amount), 0);
  const monthSpent = records.filter(r => r.date.startsWith(today.slice(0,7)) && r.type !== 'income').reduce((s, r) => s + Number(r.amount), 0);
  const fixedSpent = records.filter(r => r.date.startsWith(today.slice(0,7)) && r.type === 'fixed').reduce((s, r) => s + Number(r.amount), 0);
  const income = records.filter(r => r.date.startsWith(today.slice(0,7)) && r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
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

  // 周图表
  const weekData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dk = d.toISOString().slice(0,10);
    const s = records.filter(r => r.date === dk && r.type !== 'income').reduce((s, r) => s + Number(r.amount), 0);
    weekData.push({ day: ['日','一','二','三','四','五','六'][d.getDay()], amount: s });
  }
  const maxAmt = Math.max(...weekData.map(d => d.amount), 1);

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
      <div class="card-hd">📋 最近记录</div>
      <div class="record-list" id="record-list"></div>
    </div>`;

  // 渲染图表
  $('#week-chart').innerHTML = weekData.map(d => `
    <div class="bar" style="height:${(d.amount/maxAmt*100)}%;">
      <div class="val">${d.amount||''}</div>
      <div class="lbl">${d.day}</div>
    </div>`).join('');

  // 渲染记录
  const list = $('#record-list');
  const recent = records.slice(0, 10);
  list.innerHTML = recent.length ? recent.map(r => `
    <div class="record-item">
      <div class="record-left">
        <div class="record-cat">${r.type==='income'?'💵':(r.type==='fixed'?'📌':'💸')}</div>
        <div class="record-info">
          <div class="name">${esc(r.name)}</div>
          <div class="meta">${r.date} · ${r.type==='income'?'收入':(r.type==='fixed'?'固定':'可变')}</div>
        </div>
      </div>
      <div class="record-amt ${r.type==='income'?'inc':'exp'}">${r.type==='income'?'+':'-'}¥${Number(r.amount).toFixed(2)}</div>
    </div>`).join('') : '<div class="empty"><div class="empty-icon">📝</div>还没有记录</div>';
}

window.showRecordModal = function() {
  showModal({
    title: '记一笔',
    content: `
      <div class="form-row"><label>类型</label>
        <select name="type"><option value="var">可变支出</option><option value="fixed">固定支出</option><option value="income">收入</option></select>
      </div>
      <div class="form-row"><label>类别</label>
        <select name="name">
          <optgroup label="可变支出"><option>餐饮</option><option>交通</option><option>日用品</option><option>娱乐</option></optgroup>
          <optgroup label="固定支出"><option>房租</option><option>水电</option><option>工资</option><option>订阅</option></optgroup>
          <optgroup label="收入"><option>工资</option><option>兼职</option><option>投资</option><option>红包</option><option>其他</option></optgroup>
        </select>
      </div>
      <div class="form-row"><label>金额</label><input type="number" name="amount" step="0.01" placeholder="0.00"></div>
      <div class="form-row"><label>日期</label><input type="date" name="date" value="${STORE.todayKey()}"></div>`,
    onSave: (d) => {
      if (!d.amount || Number(d.amount) <= 0) { toast('请输入金额'); return false; }
      const records = STORE.records();
      records.unshift({ id:'r-'+Date.now(), type:d.type, name:d.name, amount:d.amount, date:d.date });
      STORE.setRecords(records);
      viewMoney();
      toast('已记录');
    }
  });
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