/* 芋泥原型 2.0：在 v1 的课程—采集—笔记链路上补齐评审功能 */

  const sourceTimes = ['02:18', '08:42', '16:05', '32:10'];
  const fieldMeta = [
    ['review', '复习要点', '用一句话回顾本节结论'],
    ['exam', '高频考点', '考试常从概念边界与因果关系出题'],
    ['confuse', '易错易混点', '区分短期波动与长期趋势'],
    ['memory', '记忆知识点', '先定义，再联系案例，最后做练习']
  ];
  let v2CourseFilter = 'all';
  let v2DateFilter = 'all';
  let v2Query = '';
  let v2SortCourses = false;
  let v2SortNotes = false;
  let v2Drag = null;
  let v2HoldTimer = null;
  let v2HoldFeedback = null;
  let v2HoldTarget = null;
  let v2DeviceSource = 'mine';
  let v2AiCourse = 0;
  let v2AiLesson = 0;
  let v2Faq = -1;

  function v2EnsureStudy(s) {
    if (!s) return s;
    if (!Array.isArray(s.favoriteBlocks)) s.favoriteBlocks = [];
    if (!Array.isArray(s.favoriteRemarks)) s.favoriteRemarks = [];
    if (!Array.isArray(s.fieldOrder)) s.fieldOrder = [0, 1, 2, 3];
    if (!s.editedAt) s.editedAt = '2026-09-12';
    return s;
  }
  function v2Study() { return v2EnsureStudy(study()); }
  function v2StudyOf(item) {
    if (!item.study) item.study = freshStudy();
    return v2EnsureStudy(item.study);
  }
  function v2EnsureState() {
    if (!state.profile) state.profile = { nickname: '小芋同学', avatar: '芋', phone: '' };
    if (!state.settings) state.settings = { notice: true, privacy: true, cache: '12.6 MB' };
    if (state.quota === undefined) state.quota = 29;
    state.courses.forEach((c, ci) => c.lessons.forEach((l, li) => {
      const s = v2StudyOf(l);
      if (!l.editedAt) l.editedAt = ['2026-09-12', '2026-09-08', '2026-09-03', '2026-08-28'][(ci + li) % 4];
    }));
    save();
  }
  function v2Esc(value) { return esc(String(value || '')); }
  function v2LessonName() { return lesson() ? lesson().name : '尚未添加课时'; }
  function v2Empty(text, action, label) {
    return `<div class="empty v2-empty"><b>${text}</b>${action ? `<button class="outline" onclick="${action}">${label || '去操作'} →</button>` : ''}</div>`;
  }
  function v2FormatDate(date) { return date ? date.replaceAll('-', '.') : '今天'; }
  function v2Save() { save(); render(); }

  Object.assign(paths, {
    scissors: 'M6 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M6 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0m2.6-10.4L19 16.4M8.6 16.4L19 7.6',
    trash: 'M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5',
    sliders: 'M4 7h16M4 17h16M9 4v6M15 14v6',
    folder: 'M3 6h7l2 2h9v11H3zM3 6V4h7l2 2',
    useredit: 'M9 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8M3 20c.8-4 3-6 6-6c1.2 0 2.3.3 3.2.9M15 18l5-5l2 2l-5 5l-3 1z'
  });

  Object.assign(pages, {
    clip: ['录音剪辑', '选择保留的课堂录音区间，可随时重新调整。', ['录音编辑', '起止时间'], ['设置录音范围', '保存剪辑结果']],
    keypoints: ['重点汇总', '集中回顾所有已标记重点，并可跳回原课时与原文位置。', ['重点浏览', '原文锚点'], ['查看关联内容', '跳转原文']],
    favorites: ['我的收藏', '集中查看、备注或取消收藏的重要笔记。', ['收藏闭环', '集中查看'], ['编辑收藏备注', '取消收藏']],
    account: ['账号信息', '管理微信头像、昵称与手机号。', ['账号', '微信授权'], ['更换头像', '绑定手机号']],
    bindphone: ['绑定手机号', '用于账号找回与服务通知，演示中不会发送短信。', ['账号安全', '手机号'], ['获取验证码', '完成绑定']],
    settings: ['设置', '管理通知、隐私与本地缓存。', ['消息通知', '隐私设置'], ['切换设置项', '清理缓存']],
    help: ['帮助与反馈', '提供常见问题和意见反馈入口。', ['FAQ', '意见反馈'], ['展开问题', '提交反馈']],
    feedback: ['意见反馈', '提交你对录音、笔记或复习体验的建议。', ['帮助反馈'], ['填写建议', '提交反馈']],
    about: ['关于芋泥', '查看服务协议、隐私政策与当前版本。', ['协议', '版本信息'], ['查看协议', '查看版本']],
    policy: ['用户协议', '用户协议内容占位页，供登录前阅读与审核展示。', ['协议'], ['阅读服务说明']],
    privacy: ['隐私政策', '隐私政策内容占位页，供登录前阅读与审核展示。', ['隐私'], ['阅读隐私说明']]
  });
  groups[1][1].splice(4, 0, 'clip');
  groups[2][1].splice(1, 0, 'keypoints', 'favorites');
  groups[2][1].push('account', 'settings', 'help', 'about');

  function v2CourseCards() {
    return state.courses.map((c, i) => `<article class="course-card ${c.color || ''} ${i === state.course ? 'active' : ''}" draggable="${v2SortCourses}" ondragstart="v2DragStart('course',${i})" ondragover="event.preventDefault()" ondrop="v2Drop('course',${i})" onclick="v2OpenCourse(${i})">
      <div class="course-icon">${c.icon}</div><div class="course-info"><b>${v2Esc(c.name)}</b><span>${c.lessons.length} 个课时 · 最近编辑 ${v2FormatDate(c.lessons[0]?.editedAt || '2026-09-12')}</span></div>
      ${v2SortCourses ? `<div class="sort-actions" onclick="event.stopPropagation()"><button aria-label="上移" onclick="v2MoveCourse(${i},-1)">↑</button><button aria-label="下移" onclick="v2MoveCourse(${i},1)">↓</button></div>` : '<span class="chevron">›</span>'}
    </article>`).join('');
  }
  function v2OpenCourse(index) { state.course = index; state.lesson = 0; save(); go('course'); }
  function v2MoveCourse(index, direction) {
    const next = index + direction;
    if (next < 0 || next >= state.courses.length) return;
    [state.courses[index], state.courses[next]] = [state.courses[next], state.courses[index]];
    state.course = next; save(); render(); toast('课程顺序已保存');
  }
  function v2DragStart(type, index) { v2Drag = { type, index }; }
  function v2Drop(type, index) {
    if (!v2Drag || v2Drag.type !== type || v2Drag.index === index) return;
    if (type === 'course') {
      const [item] = state.courses.splice(v2Drag.index, 1); state.courses.splice(index, 0, item); state.course = index;
    } else {
      const order = v2Study().fieldOrder; const [item] = order.splice(v2Drag.index, 1); order.splice(index, 0, item);
    }
    v2Drag = null; save(); render(); toast('排序已保存');
  }
  function v2MoveField(position, direction) {
    const order = v2Study().fieldOrder; const next = position + direction;
    if (next < 0 || next >= order.length) return;
    [order[position], order[next]] = [order[next], order[position]]; save(); render(); toast('笔记字段顺序已保存');
  }

  function v2LessonList() {
    const all = course().lessons;
    const rows = all.map((l, i) => ({ l, i })).filter(({ l }) => {
      const textOk = !v2Query || l.name.toLowerCase().includes(v2Query.toLowerCase());
      const statusOk = v2CourseFilter !== 'ready' || l.ready;
      const dateOk = v2DateFilter === 'all' || (v2DateFilter === 'week' ? l.editedAt >= '2026-09-07' : l.editedAt >= '2026-09-01');
      return textOk && statusOk && dateOk;
    });
    if (!all.length) return v2Empty('这门课程还没有课时', "go('capture')", '记录第一堂课');
    if (!rows.length) return v2Empty('没有符合条件的课时', 'v2ResetLessonFilters()', '清除筛选');
    return rows.map(({ l, i }) => `<article class="lesson-row" onclick="v2OpenLesson(${i})"><span class="lesson-no">${String(i + 1).padStart(2, '0')}</span><div><b>${v2Esc(l.name)}</b><small>编辑于 ${v2FormatDate(l.editedAt)} · ${l.ready ? '已生成笔记' : '待生成'}</small></div><span class="chevron">›</span></article>`).join('');
  }
  function v2OpenLesson(i) { state.lesson = i; save(); go('lesson'); }
  function v2SetLessonFilter(value) { v2CourseFilter = value; render(); }
  function v2SetDateFilter(value) { v2DateFilter = value; render(); }
  function v2SearchLessons(value) { v2Query = value; render(); }
  function v2ResetLessonFilters() { v2CourseFilter = 'all'; v2DateFilter = 'all'; v2Query = ''; render(); }

  function v2LongPress(event, index) {
    v2ClearLongPress();
    v2HoldTarget = event.currentTarget;
    v2HoldFeedback = setTimeout(() => v2HoldTarget?.classList.add('pressing'), 360);
    v2HoldTimer = setTimeout(() => { v2ClearLongPress(); v2NoteMenu(index); }, 760);
  }
  function v2ClearLongPress() {
    clearTimeout(v2HoldTimer); clearTimeout(v2HoldFeedback); v2HoldTimer = null; v2HoldFeedback = null;
    if (v2HoldTarget) v2HoldTarget.classList.remove('pressing'); v2HoldTarget = null;
  }
  function v2NoteMenu(index) {
    sheet('笔记操作', `<button class="sheet-item" onclick="v2ToggleFavorite(${index});closeSheet()">${v2Study().favoriteBlocks.includes(index) ? '取消收藏' : '收藏这段笔记'}</button><button class="sheet-item" onclick="closeSheet();openSource(${index})">跳转原文 · ${sourceTimes[index] || sourceTimes[0]}</button><button class="sheet-item" onclick="closeSheet();go('edit')">编辑笔记</button>`);
  }
  function v2ToggleFavorite(index) {
    const s = v2Study(); const found = s.favoriteBlocks.indexOf(index);
    if (found >= 0) s.favoriteBlocks.splice(found, 1); else s.favoriteBlocks.push(index);
    save(); render(); toast(found >= 0 ? '已取消收藏' : '已收藏');
  }
  function v2FavoriteBlock(index, title, text, extra = '') {
    const saved = v2Study().favoriteBlocks.includes(index);
    return `<article class="note-block" onpointerdown="v2LongPress(event,${index})" onpointerup="v2ClearLongPress()" onpointerleave="v2ClearLongPress()" onpointercancel="v2ClearLongPress()"><div class="note-kicker"><span>${title}</span><button class="mini-fav ${saved ? 'on' : ''}" onclick="event.stopPropagation();v2ToggleFavorite(${index})">${saved ? '★ 已收藏' : '☆ 收藏'}</button></div><p>${text}</p>${extra}<small>长按有反馈 · 可定位原文 ${sourceTimes[index] || sourceTimes[0]}</small></article>`;
  }
  function v2Fields() {
    const s = v2Study();
    return s.fieldOrder.map((field, position) => {
      const [key, title, copy] = fieldMeta[field];
      return `<article class="knowledge-card" draggable="${v2SortNotes}" ondragstart="v2DragStart('field',${position})" ondragover="event.preventDefault()" ondrop="v2Drop('field',${position})"><div><span class="tag">${title}</span><b>${copy}</b><small>关联原文 ${sourceTimes[field] || '02:18'}</small></div>${v2SortNotes ? `<div class="sort-actions"><button onclick="v2MoveField(${position},-1)">↑</button><button onclick="v2MoveField(${position},1)">↓</button></div>` : `<button class="text-btn" onclick="openSource(${field})">原文 ›</button>`}</article>`;
    }).join('');
  }
  function v2SetNoteTab(tab) { noteTab = tab; render(); }

  function v2AllMarked() {
    const result = [];
    state.courses.forEach((c, ci) => c.lessons.forEach((l, li) => {
      const s = v2StudyOf(l);
      if (s.marked || s.favoriteBlocks.length) result.push({ c, ci, l, li, s });
    }));
    return result;
  }
  function v2OpenAnchor(ci, li, index = 0) { state.course = ci; state.lesson = li; save(); go('notes'); setTimeout(() => openSource(index), 60); }
  function v2OpenMarked(ci, li, index) { state.course = ci; state.lesson = li; save(); go('notes'); }
  function v2ToggleMarked() { const s = v2Study(); s.marked = !s.marked; save(); render(); toast(s.marked ? '已加入重点汇总' : '已移出重点汇总'); }
  function v2EditFavorite(ci, li, index) {
    const savedCourse = state.course, savedLesson = state.lesson;
    state.course = ci; state.lesson = li;
    const remark = v2Study().favoriteRemarks[index] || '';
    sheet('编辑收藏备注', `<textarea id="fav-remark" class="sheet-text" placeholder="写下你的复习提醒">${v2Esc(remark)}</textarea><button class="primary wide" onclick="v2SaveFavoriteRemark(${ci},${li},${index})">保存备注</button>`);
    state.course = savedCourse; state.lesson = savedLesson;
  }
  function v2SaveFavoriteRemark(ci, li, index) {
    state.course = ci; state.lesson = li; v2Study().favoriteRemarks[index] = $('#fav-remark').value.trim(); save(); closeSheet(); render(); toast('收藏备注已保存');
  }
  function v2CancelFavorite(ci, li, index) { state.course = ci; state.lesson = li; v2ToggleFavorite(index); }

  function v2ChooseImport(kind) {
    const label = kind === 'audio' ? '音频' : kind === 'image' ? '图片' : '文档（含 PPT）';
    sheet(`导入${label}`, `<p class="sheet-copy">${kind === 'document' ? 'PPT 请作为文档格式导入，不单独创建课件功能。' : '导入后会创建一条待整理的课时记录。'}</p><label class="upload-file">选择${label}文件<input type="file" accept="${kind === 'audio' ? 'audio/*' : kind === 'image' ? 'image/*' : '.pdf,.doc,.docx,.ppt,.pptx,.txt'}" onchange="v2Imported('${kind}',this)"></label>`);
  }
  function v2Imported(kind, input) {
    const file = input.files?.[0]; if (!file) return;
    closeSheet();
    const name = file.name.replace(/\.[^.]+$/, '');
    course().lessons.unshift({ name: `${name} · ${kind === 'audio' ? '音频导入' : kind === 'image' ? '图片资料' : '文档资料'}`, ready: kind === 'audio', editedAt: '2026-09-14' });
    state.lesson = 0; save(); toast(`${file.name} 已导入`); go(kind === 'audio' ? 'processing' : 'lesson');
  }
  function v2OpenClip() { go('clip'); }
  function v2SaveClip() {
    const start = $('#clip-start').value; const end = $('#clip-end').value;
    if (!start || !end || Number(start) >= Number(end)) return toast('请设置正确的起止时间');
    const l = lesson(); l.clip = { start, end }; l.editedAt = '2026-09-14'; save(); toast(`已保留 ${start}–${end}`); goBack();
  }
  function v2DeleteRecording() {
    sheet('删除这条录音？', '<p class="sheet-copy">删除后将同时移除该课时的转写与笔记，此操作不可撤销。</p><button class="danger wide" onclick="v2ConfirmDeleteRecording()">确认删除</button>');
  }
  function v2ConfirmDeleteRecording() {
    const index = state.lesson; course().lessons.splice(index, 1); state.lesson = Math.max(0, index - 1); save(); closeSheet(); toast('录音已删除'); go('course');
  }

  function v2SaveProfile() {
    const nickname = $('#profile-name').value.trim(); if (!nickname) return toast('请填写昵称');
    state.profile.nickname = nickname; save(); toast('账号信息已保存'); goBack();
  }
  function v2ChooseAvatar() {
    sheet('选择头像', '<div class="avatar-options"><button onclick="v2SetAvatar(\'芋\')">芋</button><button onclick="v2SetAvatar(\'学\')">学</button><button onclick="v2SetAvatar(\'Y\')">Y</button></div>');
  }
  function v2SetAvatar(value) { state.profile.avatar = value; save(); closeSheet(); render(); }
  function v2SendCode() { const phone = $('#phone').value.trim(); if (!/^1\d{10}$/.test(phone)) return toast('请输入 11 位手机号'); $('#code').disabled = false; toast('验证码已发送（演示）'); }
  function v2BindPhone() { const phone = $('#phone').value.trim(); const code = $('#code').value.trim(); if (!/^1\d{10}$/.test(phone) || code.length < 4) return toast('请填写手机号和验证码'); state.profile.phone = phone; save(); toast('手机号已绑定'); goBack(); }
  function v2ToggleSetting(key) { state.settings[key] = !state.settings[key]; save(); render(); }
  function v2ClearCache() { sheet('清理本地缓存？', `<p class="sheet-copy">将清除当前设备上的 ${state.settings.cache} 临时音频缓存，不影响云端课程与笔记。</p><button class="danger wide" onclick="v2ConfirmClearCache()">确认清理</button>`); }
  function v2ConfirmClearCache() { state.settings.cache = '0 MB'; save(); closeSheet(); render(); toast('本地缓存已清理'); }
  function v2SubmitFeedback() { const value = $('#feedback-text').value.trim(); if (!value) return toast('请先写下你的建议'); closeSheet(); toast('感谢反馈，已提交'); goBack(); }
  function v2ToggleFaq(index) { v2Faq = v2Faq === index ? -1 : index; render(); }

  function v2SetAiCourse(value) { v2AiCourse = Number(value); v2AiLesson = 0; render(); }
  function v2SetAiLesson(value) { v2AiLesson = Number(value); render(); }
  function v2AiCurrentCourse() { return state.courses[v2AiCourse] || state.courses[0]; }
  function v2AiCurrentLesson() { return v2AiCurrentCourse().lessons[v2AiLesson]; }
  function v2StartCaptureFromAi() { state.course = v2AiCourse; state.lesson = v2AiLesson; save(); go('capture'); }
  function v2AskAI() {
    const input = $('#ai-input'); const value = input.value.trim(); if (!value) return;
    const l = v2AiCurrentLesson(); const available = aiScope === 'lesson' ? Boolean(l?.ready) : v2AiCurrentCourse().lessons.some(x => x.ready);
    chats.push({ role: 'user', text: value });
    chats.push(available ? { role: 'ai', text: `结合「${v2AiCurrentCourse().name}」的课堂笔记：${value} 可以先从核心概念、课堂案例和易错点三个维度复习。`, source: sourceTimes[0] } : { role: 'ai', text: '所选范围暂时没有可用笔记。录完一堂课并生成笔记后，我就能基于课程内容回答。', action: true });
    input.value = ''; render();
  }

  function v2ConfirmCancelEdit() {
    const note = $('#note-editor')?.value; const remark = $('#note-remark')?.value;
    if (note !== undefined && (note !== v2Study().note || remark !== v2Study().remark)) {
      sheet('放弃本次修改？', '<p class="sheet-copy">未保存的笔记内容会丢失。</p><button class="danger wide" onclick="closeSheet();go(\'notes\')">放弃修改</button><button class="outline wide" onclick="closeSheet()">继续编辑</button>');
    } else go('notes');
  }

  function v2NotesView() {
    const s = v2Study();
    const tabs = `<div class="note-tabs"><button class="${noteTab === 0 ? 'on' : ''}" onclick="v2SetNoteTab(0)">概要</button><button class="${noteTab === 1 ? 'on' : ''}" onclick="v2SetNoteTab(1)">要点</button><button class="${noteTab === 2 ? 'on' : ''}" onclick="v2SetNoteTab(2)">拓展</button><button class="${noteTab === 3 ? 'on' : ''}" onclick="v2SetNoteTab(3)">导图</button></div>`;
    let content = '';
    if (noteTab === 0) content = `<section class="summary-card"><span>课堂摘要</span><p>${v2Esc(s.note)}</p><button class="text-btn" onclick="go('edit')">编辑与校正 ›</button></section>${v2FavoriteBlock(0, '核心结论', '课堂从核心概念出发，解释其与实际问题之间的关系，并通过例子帮助理解。')}<button class="source-callout" onclick="openSource(0)">${icon('clock')} 对照录音原文 · ${sourceTimes[0]} <i>›</i></button>`;
    if (noteTab === 1) content = `<div class="section-inline"><b>四类复习内容</b><button class="text-btn" onclick="v2SortNotes=!v2SortNotes;render()">${v2SortNotes ? '完成排序' : '拖拽排序'}</button></div><div class="knowledge-list ${v2SortNotes ? 'sorting' : ''}">${v2Fields()}</div>`;
    if (noteTab === 2) content = `<section class="expand-card"><span>概念解释</span><h3>核心概念如何理解？</h3><p>先确认定义与适用范围，再用课堂中的真实情境校验它。</p><button class="text-btn" onclick="openSource(1)">跳转原文 08:42 ›</button></section>${v2FavoriteBlock(1, '课堂案例', '以课堂案例拆解概念在现实场景中的应用，并比较不同条件下的结果。')}`;
    if (noteTab === 3) content = `<section class="map-card"><div class="map-node root">核心概念</div><div class="map-lines"><span>概念边界</span><span>课堂案例</span><span>易错点</span><span>复习练习</span></div><button class="outline wide" onclick="go('review')">用复习清单巩固</button></section>`;
    return `<div class="note-title"><div><span class="overline">AI 课堂笔记</span><h1>${v2Esc(v2LessonName())}</h1></div><button class="star ${s.marked ? 'active' : ''}" onclick="v2ToggleMarked()">${s.marked ? '★' : '☆'}</button></div>${tabs}${content}<div class="note-footer"><button onclick="go('keypoints')">重点汇总</button><button onclick="go('favorites')">我的收藏</button></div>`;
  }
  function v2TranscriptView() {
    const clip = lesson() && lesson().clip;
    const clipLabel = clip ? clip.start + '–' + clip.end : '00:00 / 45:20';
    const rows = transcriptData.map(function (entry, i) {
      return `<button class="transcript-row ${transcriptIndex === i ? 'active' : ''}" onclick="openSource(${i})"><time>${entry[0]}</time><p>${entry[1]}</p></button>`;
    }).join('');
    return `<div class="transcript-head"><span class="overline">课堂录音</span><h1>${v2Esc(v2LessonName())}</h1><p>剪辑、删除或按时间点对照转写原文。</p></div><div class="audio-player"><button onclick="togglePlayer()">${playerOn ? '❚❚' : '▶'}</button><div><b>${clipLabel}</b><div class="progress"><i style="width:${Math.min(100, playerSeconds / 272 * 100)}%"></i></div></div><span>${playerOn ? '播放中' : '试听'}</span></div><div class="record-actions"><button onclick="v2OpenClip()">${icon('scissors')} 剪辑录音</button><button onclick="v2DeleteRecording()">${icon('trash')} 删除录音</button></div><div class="transcript-list">${rows}</div>`;
  }

  Object.assign(views, {
    login: () => `<div class="login-page"><div class="login-mark">芋</div><h1>把每一堂课，<br>变成自己的知识。</h1><p>登录后，课堂录音、笔记和复习进度将保存到你的账户。</p><button class="wechat-login" onclick="login()">微信授权登录</button><label class="check"><input type="checkbox" id="agreement">我已阅读并同意 <button class="inline-link" onclick="event.preventDefault();go('policy')">用户协议</button> 与 <button class="inline-link" onclick="event.preventDefault();go('privacy')">隐私政策</button></label></div>`,
    home: () => `<div class="greeting"><span>下午好，${v2Esc(state.profile.nickname || '同学')}</span><button onclick="v2SortCourses=!v2SortCourses;render()">${v2SortCourses ? '完成' : '课程排序'}</button></div><section class="quick-action"><div><b>记录一堂课</b><span>录音、录音卡或文件导入</span></div><button class="primary" onclick="go('capture')">开始记录</button></section><button class="continue-study" onclick="v2OpenCourse(state.course)"><span>继续上次学习</span><b>${v2LessonName()} <i>›</i></b></button><section class="section-head"><div><h2>我的课程</h2><p>${state.courses.length} 门课程 · 按课时整理</p></div><button class="add-round" onclick="newCourse()">＋</button></section><div class="course-list ${v2SortCourses ? 'sorting' : ''}">${v2CourseCards()}</div><button class="device-strip" onclick="openDeviceFrom('home')">${icon('device')}<span><b>连接录音卡，课堂上按一下就开始</b><small>也可以直接用手机录音</small></span><i>›</i></button>`,
    course: () => `<div class="course-top"><div class="course-icon large">${course().icon}</div><div><h1>${v2Esc(course().name)}</h1><p>${course().lessons.length} 个课时 · 最近编辑自动归档</p></div><button class="more" onclick="newLesson()">＋</button></div><div class="search"><span>${icon('search')}</span><input value="${v2Esc(v2Query)}" oninput="v2SearchLessons(this.value)" placeholder="搜索本课程课时"></div><div class="filter-row"><button class="${v2CourseFilter === 'all' ? 'on' : ''}" onclick="v2SetLessonFilter('all')">全部</button><button class="${v2CourseFilter === 'ready' ? 'on' : ''}" onclick="v2SetLessonFilter('ready')">已生成</button><button class="${v2DateFilter === 'week' ? 'on' : ''}" onclick="v2SetDateFilter('week')">近 7 天编辑</button><button class="${v2DateFilter === 'month' ? 'on' : ''}" onclick="v2SetDateFilter('month')">本月编辑</button></div><div class="lesson-list">${v2LessonList()}</div><button class="primary wide bottom-action" onclick="go('capture')">${icon('mic')} 记录新的课时</button>`,
    lesson: () => !lesson() ? v2Empty('请选择一个课时', "go('course')", '返回课程') : `<div class="lesson-hero"><span class="overline">${v2Esc(course().name)}</span><h1>${v2Esc(lesson().name)}</h1><p>编辑于 ${v2FormatDate(lesson().editedAt)} · 录音、笔记与复习在同一处完成</p></div><div class="journey"><button class="journey-step done" onclick="go('transcript')"><span>01</span><div><b>课程录音</b><small>${lesson().clip ? `已剪辑 ${lesson().clip.start}–${lesson().clip.end}` : '查看、剪辑或删除'}</small></div><i>›</i></button><button class="journey-step ${lesson().ready ? 'done' : ''}" onclick="lesson().ready?go('notes'):go('capture')"><span>02</span><div><b>AI 课堂笔记</b><small>${lesson().ready ? '已生成 · 可编辑' : '待生成'}</small></div><i>›</i></button><button class="journey-step ${lesson().ready ? 'done' : ''}" onclick="lesson().ready?go('review'):toast('生成笔记后可查看')"><span>03</span><div><b>重点与复习</b><small>${lesson().ready ? '重点、收藏与练习' : '待生成'}</small></div><i>›</i></button><button class="journey-step ${lesson().ready ? 'done' : ''}" onclick="lesson().ready?go('exam'):toast('生成笔记后可练习')"><span>04</span><div><b>课后测试</b><small>${lesson().ready ? '检验掌握程度' : '待生成'}</small></div><i>›</i></button></div>`,
    capture: () => `<div class="capture-intro"><span class="pill">开始记录</span><h1>今天这堂课，<br>怎么采集？</h1><p>录音完成后，AI 会生成转写与结构化笔记。</p></div><div class="capture-choices"><button onclick="recordMode='phone';go('record')">${icon('mic')}<b>小程序录音</b><span>直接使用手机麦克风</span></button><button onclick="recordMode='card';go('record')">${icon('device')}<b>录音卡一键录音</b><span>同步设备状态与回传</span></button><button onclick="v2ChooseImport('audio')">${icon('upload')}<b>导入音频</b><span>已有课堂录音</span></button><button onclick="v2ChooseImport('image')">${icon('file')}<b>导入图片</b><span>板书、课堂照片</span></button><button onclick="v2ChooseImport('document')">${icon('folder')}<b>导入文档</b><span>PDF / Word / PPT 文档</span></button></div><p class="capture-note">PPT 仅作为文档导入，不单独扩展课件入口。</p>`,
    processing: () => `<div class="processing"><div class="processing-orbit"><span>✦</span></div><span class="pill">正在整理课堂内容</span><h1>${processingStep < 3 ? 'AI 正在理解这堂课' : '笔记已经准备好了'}</h1><p>已针对课堂人声、术语与环境噪音优化识别。</p><div class="quota-line">本次消耗 1 次 · 剩余 ${state.quota} 次</div><div class="process-list">${['语音转写', '提炼课堂摘要', '生成结构化笔记', '关联录音原文'].map((x, i) => `<div class="process-row ${i < processingStep ? 'done' : i === processingStep ? 'doing' : ''}"><span>${i < processingStep ? '✓' : i + 1}</span><b>${x}</b><small>${i < processingStep ? '已完成' : i === processingStep ? '处理中' : '等待中'}</small></div>`).join('')}</div><button class="primary wide" onclick="advanceProcessing()">${processingStep < 3 ? '继续处理' : '查看 AI 课堂笔记'}</button></div>`,
    notes: v2NotesView,
    edit: () => { const s = v2Study(); return `<div class="edit-head"><span class="overline">编辑 AI 生成结果</span><h1>校正这份笔记</h1><p>修改会保留在当前课时，并可随时回看原文。</p></div><label class="field-label">课堂摘要<textarea id="note-editor" class="editor">${v2Esc(s.note)}</textarea></label><label class="field-label">补充备注<textarea id="note-remark" class="editor small">${v2Esc(s.remark)}</textarea></label><button class="source-callout" onclick="openSource(0)">${icon('clock')} 对照录音原文 · ${sourceTimes[0]} <i>›</i></button><div class="dual-actions"><button class="outline" onclick="v2ConfirmCancelEdit()">取消</button><button class="primary" onclick="saveNote()">保存修改</button></div>`; },
    transcript: v2TranscriptView,
    review: () => `<div class="review-hero"><span class="pill">课后复习</span><h1>把重点变成<br>真正记得住的内容。</h1><p>从课堂笔记中提炼复习路径，先看重点，再完成练习。</p></div><div class="review-grid"><button onclick="go('keypoints')"><span>✦</span><b>重点汇总</b><small>重点、概念与案例</small></button><button onclick="go('favorites')"><span>★</span><b>我的收藏</b><small>集中查看与编辑</small></button><button onclick="go('exam')"><span>✓</span><b>开始练习</b><small>检验掌握情况</small></button></div><section class="review-card"><span>推荐复习顺序</span><ol><li>回顾本节复习要点</li><li>对照概念解释和课堂案例</li><li>跳回录音原文核对细节</li></ol></section>`,
    ai: () => { const c = v2AiCurrentCourse(), l = v2AiCurrentLesson(), available = aiScope === 'lesson' ? Boolean(l?.ready) : c.lessons.some(x => x.ready); return `<div class="ai-head"><span class="pill">AI 学习助手</span><h1>基于课堂笔记，<br>继续追问。</h1><p>回答会提示依据来源；选择范围不会影响首页当前课程。</p></div><div class="ai-scope"><button class="${aiScope === 'lesson' ? 'on' : ''}" onclick="aiScope='lesson';render()">当前课时</button><button class="${aiScope === 'course' ? 'on' : ''}" onclick="aiScope='course';render()">整门课程</button></div><div class="ai-selects"><select onchange="v2SetAiCourse(this.value)">${state.courses.map((item, i) => `<option value="${i}" ${i === v2AiCourse ? 'selected' : ''}>${v2Esc(item.name)}</option>`).join('')}</select><select onchange="v2SetAiLesson(this.value)">${c.lessons.map((item, i) => `<option value="${i}" ${i === v2AiLesson ? 'selected' : ''}>${v2Esc(item.name)}</option>`).join('') || '<option>暂无课时</option>'}</select></div>${!available ? `<div class="ai-empty"><b>这里还没有可用笔记</b><p>先记录一堂课并生成笔记，再来问我。</p><button class="primary" onclick="v2StartCaptureFromAi()">去录一堂课 →</button></div>` : ''}<div class="chat-list">${chats.map(m => `<div class="bubble ${m.role}"><p>${v2Esc(m.text)}</p>${m.source ? `<button onclick="openSource(0)">依据课堂原文 ${m.source} ›</button>` : ''}${m.action ? '<button onclick="v2StartCaptureFromAi()">去录一堂课 →</button>' : ''}</div>`).join('') || '<div class="ai-suggestion">试着问：这节课最容易混淆的概念是什么？</div>'}</div><div class="chat-input"><input id="ai-input" placeholder="输入你的问题" onkeydown="if(event.key==='Enter')v2AskAI()"><button onclick="v2AskAI()">↑</button></div>`; },
    mine: () => `<div class="profile" onclick="go('account')"><div class="avatar wechat-avatar">${v2Esc(state.profile.avatar)}</div><div><h1>${v2Esc(state.profile.nickname)}</h1><p>${state.profile.phone ? state.profile.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '微信登录 · 点击完善账号信息'} <i>›</i></p></div></div><div class="stats"><div><b>${state.courses.length}</b><span>课程</span></div><div><b>${state.courses.reduce((n,c)=>n+c.lessons.length,0)}</b><span>课时</span></div><div><b>${v2AllMarked().length}</b><span>重点</span></div></div><section class="credit-card"><span>本月免费额度</span><b>${state.quota}<small> / 30 次</small></b><div><i style="width:${state.quota / 30 * 100}%"></i></div><p>基础转写与结构化笔记免费使用</p></section><div class="menu-list"><button onclick="go('keypoints')">${icon('heart')}<span>重点汇总<small>回顾标记过的重点</small></span><i>›</i></button><button onclick="go('favorites')">★<span>我的收藏<small>集中查看重要笔记</small></span><i>›</i></button><button onclick="openDeviceFrom('mine')">${icon('device')}<span>录音卡管理<small>设备、连接与存储</small></span><i>›</i></button><button onclick="go('settings')">${icon('sliders')}<span>设置<small>通知、隐私与缓存</small></span><i>›</i></button><button onclick="go('help')">?<span>帮助与反馈<small>常见问题与意见反馈</small></span><i>›</i></button><button onclick="go('about')">i<span>关于芋泥<small>协议、隐私与版本</small></span><i>›</i></button></div>${state.logged ? '<button class="logout" onclick="logout()">退出登录</button>' : '<button class="primary wide" onclick="go(\'login\')">微信登录</button>'}`,
    clip: () => { const clip = lesson()?.clip || { start: '0', end: '272' }; return `<div class="edit-head"><span class="overline">录音文件编辑</span><h1>剪辑课堂录音</h1><p>拖动并调整起止时间，只保留需要整理的有效片段。</p></div><section class="clip-card"><div class="clip-wave">▁▃▅▂▆▇▅▃▆▂▅▇▃▁</div><div class="clip-range"><label>开始（秒）<input id="clip-start" type="number" min="0" max="271" value="${clip.start}"></label><label>结束（秒）<input id="clip-end" type="number" min="1" max="272" value="${clip.end}"></label></div><small>原始时长 45:20 · 剪辑不会覆盖原始文件</small></section><button class="primary wide" onclick="v2SaveClip()">保存剪辑</button>`; },
    keypoints: () => { const marked = v2AllMarked(); return `<div class="page-hero compact"><span class="pill">课程复习</span><h1>重点汇总</h1><p>把标记过的重点、概念解释和课堂案例放在同一处回顾。</p></div>${marked.length ? `<div class="key-list">${marked.map(({c,ci,l,li,s}) => `<article class="key-card"><span>${v2Esc(c.name)} · ${v2Esc(l.name)}</span><h3>${s.marked ? '课堂核心重点' : '收藏的笔记内容'}</h3><p>核心结论、概念解释与课堂案例已关联到对应录音原文。</p><div><button class="text-btn" onclick="v2OpenMarked(${ci},${li},0)">查看笔记</button><button class="text-btn" onclick="v2OpenAnchor(${ci},${li},${s.favoriteBlocks[0] || 0})">跳转原文 ${sourceTimes[s.favoriteBlocks[0] || 0]} ›</button></div></article>`).join('')}</div>` : v2Empty('还没有标记重点', "go('notes')", '去标记重点')}`; },
    favorites: () => { const list = []; state.courses.forEach((c,ci)=>c.lessons.forEach((l,li)=>v2StudyOf(l).favoriteBlocks.forEach(index=>list.push({c,ci,l,li,index,s:v2StudyOf(l)})))); return `<div class="page-hero compact"><span class="pill">课程复习</span><h1>我的收藏</h1><p>集中查看、添加复习备注，或取消不再需要的收藏。</p></div>${list.length ? `<div class="favorite-list">${list.map(({c,ci,l,li,index,s})=>`<article class="favorite-card"><span>${v2Esc(c.name)} · ${v2Esc(l.name)}</span><h3>${index === 1 ? '课堂案例' : '核心结论'}</h3><p>${s.favoriteRemarks[index] || '尚未添加复习备注'}</p><div><button class="text-btn" onclick="v2OpenMarked(${ci},${li},${index})">查看笔记</button><button class="text-btn" onclick="v2EditFavorite(${ci},${li},${index})">编辑</button><button class="text-btn danger-text" onclick="v2CancelFavorite(${ci},${li},${index})">取消收藏</button></div></article>`).join('')}</div>` : v2Empty('还没有收藏的笔记', "go('notes')", '去收藏内容')}`; },
    account: () => `<div class="account-profile"><button class="avatar wechat-avatar large-avatar" onclick="v2ChooseAvatar()">${v2Esc(state.profile.avatar)}</button><button class="text-btn" onclick="v2ChooseAvatar()">更换头像</button></div><label class="field-label">微信昵称<input id="profile-name" class="input" value="${v2Esc(state.profile.nickname)}"></label><button class="menu-row" onclick="go('bindphone')"><span>${icon('useredit')}</span><b>手机号绑定<small>${state.profile.phone ? state.profile.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '未绑定'}</small></b><i>›</i></button><button class="primary wide" onclick="v2SaveProfile()">保存账号信息</button>`,
    bindphone: () => `<div class="edit-head"><span class="overline">账号安全</span><h1>绑定手机号</h1><p>可用于账号找回和服务通知；演示中不会发送真实短信。</p></div><label class="field-label">手机号<input id="phone" class="input" inputmode="numeric" maxlength="11" placeholder="请输入 11 位手机号" value="${v2Esc(state.profile.phone)}"></label><div class="code-row"><input id="code" class="input" inputmode="numeric" placeholder="验证码" disabled><button class="outline" onclick="v2SendCode()">获取验证码</button></div><button class="primary wide" onclick="v2BindPhone()">确认绑定</button>`,
    settings: () => `<div class="page-hero compact"><span class="pill">个人设置</span><h1>设置</h1><p>管理消息提醒、隐私保护与本地缓存。</p></div><div class="settings-list"><div><span><b>消息通知</b><small>录音处理完成时提醒我</small></span><button class="switch ${state.settings.notice ? 'on' : ''}" onclick="v2ToggleSetting('notice')"><i></i></button></div><div><span><b>隐私保护</b><small>仅自己可见课程与笔记</small></span><button class="switch ${state.settings.privacy ? 'on' : ''}" onclick="v2ToggleSetting('privacy')"><i></i></button></div><button onclick="v2ClearCache()"><span><b>清理缓存</b><small>当前缓存 ${state.settings.cache}</small></span><i>›</i></button></div>`,
    help: () => { const faqs = [['录音卡如何连接？','在“我的—录音卡管理”中绑定设备，并保持蓝牙开启。'],['转写完成要多久？','原型中为模拟流程；正式版本将根据音频时长提示进度。'],['如何修改 AI 笔记？','进入课时的 AI 课堂笔记，点击“编辑与校正”。']]; return `<div class="page-hero compact"><span class="pill">帮助中心</span><h1>帮助与反馈</h1><p>常见问题和意见反馈都在这里。</p></div><section class="faq-list">${faqs.map(([q,a],i)=>`<button onclick="v2ToggleFaq(${i})"><b>${q}</b><i>${v2Faq === i ? '−' : '+'}</i>${v2Faq === i ? `<small>${a}</small>` : ''}</button>`).join('')}</section><button class="primary wide" onclick="go('feedback')">提交意见反馈</button>`; },
    feedback: () => `<div class="edit-head"><span class="overline">意见反馈</span><h1>告诉我们你的想法</h1><p>可以反馈录音、笔记、复习或其他体验问题。</p></div><textarea id="feedback-text" class="editor feedback" placeholder="请描述你的建议或遇到的问题"></textarea><button class="primary wide" onclick="v2SubmitFeedback()">提交反馈</button>`,
    about: () => `<div class="about-mark">芋</div><h1 class="center-title">芋泥 · 课堂笔记</h1><p class="center-copy">让课堂知识，有迹可循。</p><div class="menu-list"><button onclick="go('policy')"><span>用户协议</span><i>›</i></button><button onclick="go('privacy')"><span>隐私政策</span><i>›</i></button><button><span>当前版本<small>2.0.0 · 原型演示版</small></span></button></div>`,
    policy: () => `<article class="legal"><h1>用户协议</h1><p>欢迎使用芋泥课堂笔记。本页面为小程序原型中的协议内容占位，用于展示用户在登录前可主动阅读协议。</p><h3>服务说明</h3><p>用户可使用录音、转写、笔记整理与复习功能；正式服务范围以实际上线版本为准。</p><h3>账号与内容</h3><p>请妥善保管账号。课堂内容仅用于为你提供笔记整理和学习服务。</p></article>`,
    privacy: () => `<article class="legal"><h1>隐私政策</h1><p>本页面为小程序原型中的隐私政策内容占位，用于展示用户在登录前可主动阅读隐私说明。</p><h3>我们处理的信息</h3><p>包括你主动提交的课堂录音、文档资料、账号昵称和必要的设备状态信息。</p><h3>信息保护</h3><p>正式版本将按照适用法律和隐私政策处理信息，并提供对应的查询与管理入口。</p></article>`
  });

  function openDeviceFrom(source) { v2DeviceSource = source || route; go('device'); }
  function goBack() {
    const fallback = { edit: 'notes', transcript: 'notes', notes: 'lesson', review: 'lesson', keypoints: 'mine', favorites: 'mine', exam: 'review', results: 'lesson', record: 'capture', transfer: 'capture', processing: 'lesson', clip: 'transcript', capture: 'course', device: v2DeviceSource, lesson: 'course', course: 'home', account: 'mine', bindphone: 'account', settings: 'mine', help: 'mine', feedback: 'help', about: 'mine', policy: state.logged ? 'about' : 'login', privacy: state.logged ? 'about' : 'login', login: 'home' };
    goWithoutHistory(historyStack.pop() || fallback[route] || 'home');
  }

  v2EnsureState();
render();
