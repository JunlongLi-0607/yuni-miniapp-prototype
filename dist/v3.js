/* 芋泥高保真原型 3.0：校正小程序、录音卡与文件导入的真实产品边界。 */
(function () {
  const IMPORT_LIMIT = 200 * 1024 * 1024;
  const IMPORT_EXTENSIONS = ['m4a', 'mp3', 'wav', 'aac'];
  let selectedImport = null;
  let materialKind = 'image';
  let selectedMaterial = null;
  let playbackRate = 1;
  let noteSection = 'summary';
  let evidenceType = 'summary';
  let editingKnowledgeKey = 'examMove';
  let knowledgeDraft = null;
  let reviewListFilter = 'pending';
  let focusedNoteKey = '';
  let courseQuery = '';
  let courseViewFilter = 'all';
  let courseSortMode = 'edited';
  let lessonSortMode = 'newest';
  let transferError = false;
  let clipStart = 0;
  let clipEnd = 2720;
  let sampleMode = false;
  const loginPreviewMode = new URLSearchParams(location.search).get('preview') === 'login';

  const personalRoutes = new Set(['course', 'capture', 'recordingdetail', 'importaudio', 'importmaterial', 'transfer', 'clip', 'processing', 'edit', 'knowledgeedit', 'keypoints', 'favorites', 'notifications', 'account', 'bindphone', 'settings', 'help', 'feedback', 'about', 'device']);
  const lessonRoutes = new Set(['lesson', 'materialsource', 'notes', 'evidence', 'edit', 'knowledgeedit', 'transcript', 'review', 'exam', 'results']);

  function v3EnsureRuntimeState() {
    if (!Array.isArray(state.courses)) state.courses = [];
    state.course = Math.max(0, Math.min(Number(state.course) || 0, Math.max(0, state.courses.length - 1)));
    const selectedCourse = state.courses[state.course];
    if (selectedCourse && !Array.isArray(selectedCourse.lessons)) selectedCourse.lessons = [];
    state.lesson = Math.max(0, Math.min(Number(state.lesson) || 0, Math.max(0, (selectedCourse?.lessons.length || 1) - 1)));
    state.courses.forEach((item, courseIndex) => {
      if (!item.id) item.id = `course-${item.createdAt || 'demo'}-${courseIndex}`;
      item.lessons.forEach((entry, lessonIndex) => {
        if (!entry.id) entry.id = `${item.id}-lesson-${entry.createdAt || 'demo'}-${lessonIndex}`;
        if (entry.ready) {
          entry.processingStep = 4;
          entry.processingStatus = 'done';
        } else if (entry.processingStep === undefined) {
          entry.processingStep = 0;
          entry.processingStatus = 'pending';
        }
      });
    });
  }

  function v3CanOpenRoute(target) {
    if (!state.logged && personalRoutes.has(target)) {
      pendingLoginAction = () => go(target);
      go('login');
      toast('登录后可继续此操作');
      return false;
    }
    if (!state.logged && lessonRoutes.has(target) && !sampleMode) {
      go('sample');
      toast('个人课程需要登录，可先体验示例课程');
      return false;
    }
    if ((target === 'course' || target === 'capture') && !state.courses.length) {
      newCourse();
      return false;
    }
    if (lessonRoutes.has(target) && !lesson()) {
      go(state.courses.length ? 'course' : 'home');
      toast(state.courses.length ? '请选择一个课时' : '请先创建课程');
      return false;
    }
    return true;
  }

  Object.assign(pages, {
    edit: ['校正知识笔记', '修改 AI 笔记、补充个人备注，并对照对应课堂原文。', ['用户校正', '原文对照'], ['修改课堂摘要', '标记复习重点', '补充个人备注', '保存或取消修改']],
    login: ['微信登录', '仅在首次使用、主动退出或登录态失效时出现；老用户直接进入个人首页。', ['账户状态', '微信授权'], ['阅读协议与隐私政策', '模拟微信授权', '进入独立示例课程']],
    home: ['首页', '游客看到品牌与示例入口；登录用户看到设备待办、课程和消息。', ['分层首页', '任务优先'], ['处理待回传录音', '查看个人课程', '进入消息中心']],
    capture: ['添加课堂记录', '小程序支持录音卡回传，以及已有音频、课堂照片和课件文件导入，不提供手机麦克风录音。', ['真实能力边界', '多渠道采集'], ['从录音卡回传', '导入已有音频', '导入课堂照片', '导入课件文件', '选择归属课程']],
    transfer: ['录音卡文件回传', '展示传输进度、连接中断、文件保留和恢复重试。', ['设备回传', '失败恢复'], ['开始回传', '模拟连接中断', '完成后归档课时']],
    processing: ['转写与生成', '异步展示上传校验、语音识别、笔记生成和原文索引。', ['后台任务', '消息通知'], ['查看处理阶段', '离开页面继续处理', '完成后进入笔记']],
    device: ['我的录音卡', '设备绑定、状态、文件列表和操作指引集中管理。', ['设备管理', '文件入口'], ['绑定或解绑设备', '查看待回传文件', '查看录音操作指引']],
    transcript: ['课堂录音与转写', '逐句对照原始音频频段，支持定位回听、低置信度提示、术语标记和人工校正。', ['语音转写', '逐句校正'], ['播放与拖动录音', '点击句子精准定位', '校正转写内容', '查看课堂场景优化说明']],
    notes: ['AI 课堂笔记', '按课堂内容动态生成课程概要、复习步骤、高频考点、易错易混点和记忆知识点。', ['结构化笔记', '证据分级'], ['切换课程概要、复习与知识清单', '区分老师强调与 AI 推断', '查看具体知识点原文', '查看概要的多片段生成依据']],
    evidence: ['笔记生成依据', '按生成顺序呈现笔记结论、关联原文片段和 AI 归纳逻辑；每条证据均可定位回听。', ['多句溯源', '生成逻辑'], ['查看笔记结论', '按顺序核对多条原文', '理解 AI 归纳过程', '定位录音与转写']],
    knowledgeedit: ['校正知识笔记', '逐条修改 AI 生成的考点、易错点或记忆知识，并保留个人重点与备注。', ['用户校正', '个人理解'], ['修改标题和正文', '标记个人重点', '补充个人备注', '保存到当前课时']],
    keypoints: ['重点速览', '由老师明确强调、AI 高频判断和易错内容自动组成，支持跳回原笔记与生成依据。', ['自动重点', '考前速览'], ['浏览老师强调内容', '查看 AI 判断依据', '返回原笔记模块']],
    favorites: ['我的复习清单', '集中管理用户主动加入的待复习内容，可标记已掌握或返回原笔记。', ['个人复习', '掌握状态'], ['查看待复习内容', '标记已掌握', '移出复习清单', '返回原笔记']],
    course: ['课程详情', '课程下按课时归档笔记，置顶内容优先；课时较多时再提供搜索及状态、最近更新时间筛选。', ['课程归档', '渐进筛选'], ['置顶重要课时', '按最近或最早更新排序', '8 个课时起显示搜索与筛选']],
    sample: ['示例课程', '独立的只读体验空间，不与用户自己的课程和学习数据混淆。', ['游客体验', '只读示例'], ['查看示例课程说明', '浏览示例课时与笔记', '登录后创建自己的课程']],
    importaudio: ['导入课堂录音', '在选择文件前明确格式、大小、时长建议和隐私说明，并对文件进行前置校验。', ['文件校验', '上传约束'], ['选择本地音频', '查看校验结果', '确认课程与课时名称']],
    importmaterial: ['导入课堂资料', '支持课堂照片与 PDF、Word、PPT 课件，按资料类型执行 OCR 或文档解析。', ['图片 OCR', '课件解析'], ['选择课堂照片或课件文件', '校验数量、格式和大小', '确认课程与资料名称']],
    materialsource: ['课堂资料原文', '展示笔记所引用的课堂照片或课件原页，便于核对 AI 整理结果。', ['资料溯源', 'OCR 对照'], ['查看原资料', '定位引用页', '返回笔记校正']],
    recordingdetail: ['录音文件详情', '录音卡中的文件先确认信息和归属，再回传到小程序。', ['录音卡', '文件归档'], ['查看文件元信息', '选择归属课程', '开始回传']],
    clip: ['录音整理', '转写前可裁剪录音首尾无效内容，也可直接使用完整录音；剪辑不会覆盖原文件。', ['非破坏剪辑', '转写前整理'], ['试听录音', '调整起止时间', '恢复完整时长', '确认后开始转写']],
    notifications: ['消息中心', '承接回传和笔记生成的异步完成通知。', ['异步任务', '状态通知'], ['查看处理进度', '进入已完成笔记']]
  });

  const startGroup = groups.find(g => g[0] === '开始');
  if (startGroup && !startGroup[1].includes('sample')) startGroup[1].splice(1, 0, 'sample');
  const collectGroup = groups.find(g => g[0] === '采集与整理');
  if (collectGroup) {
    collectGroup[1] = collectGroup[1].filter(id => id !== 'record');
    if (!collectGroup[1].includes('recordingdetail')) collectGroup[1].splice(1, 0, 'recordingdetail');
    if (!collectGroup[1].includes('importaudio')) collectGroup[1].splice(2, 0, 'importaudio');
    if (!collectGroup[1].includes('importmaterial')) collectGroup[1].splice(3, 0, 'importmaterial');
  }
  const serviceGroup = groups.find(g => g[0] === '复习与服务');
  if (serviceGroup) {
    if (!serviceGroup[1].includes('evidence')) serviceGroup[1].splice(1, 0, 'evidence');
    if (!serviceGroup[1].includes('knowledgeedit')) serviceGroup[1].splice(2, 0, 'knowledgeedit');
    if (!serviceGroup[1].includes('notifications')) serviceGroup[1].push('notifications');
  }

  function courseCount() { return state.courses.length; }
  function lessonCount() { return state.courses.reduce((sum, item) => sum + item.lessons.length, 0); }
  function safeCourseName() { return course()?.name || '请选择课程'; }
  function fileSize(bytes) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`; }
  function v3EnsureOrganization() {
    const courseDates = ['2026-09-02', '2026-08-18', '2026-08-03'];
    state.courses.forEach((item, courseIndex) => {
      if (item.pinned === undefined) item.pinned = courseIndex === 0;
      if (!item.createdAt) item.createdAt = courseDates[courseIndex] || '2026-09-24';
      if (!item.editedAt) item.editedAt = item.lessons[0]?.editedAt || courseDates[courseIndex] || '2026-09-24';
      item.lessons.forEach((entry, lessonIndex) => {
        if (entry.pinned === undefined) entry.pinned = courseIndex === 0 && lessonIndex === 0;
        if (!entry.createdAt) entry.createdAt = entry.editedAt || ['2026-09-12', '2026-09-08', '2026-09-03'][lessonIndex] || '2026-09-24';
        if (!entry.editedAt) entry.editedAt = entry.createdAt;
      });
    });
  }

  function v3CourseRows() {
    const rows = state.courses.map((item, index) => ({ item, index })).filter(({ item }) => {
      const query = courseQuery.trim().toLowerCase();
      const searchText = `${item.name} ${item.lessons.map(entry => entry.name).join(' ')}`.toLowerCase();
      return (!query || searchText.includes(query)) && (courseViewFilter !== 'pinned' || item.pinned);
    });
    rows.sort((a, b) => {
      if (a.item.pinned !== b.item.pinned) return Number(b.item.pinned) - Number(a.item.pinned);
      if (courseSortMode === 'created') return String(b.item.createdAt).localeCompare(String(a.item.createdAt));
      if (courseSortMode === 'manual') return a.index - b.index;
      return String(b.item.editedAt).localeCompare(String(a.item.editedAt));
    });
    return rows;
  }

  function v3CourseCards() {
    const rows = v3CourseRows();
    if (!rows.length) return state.courses.length
      ? `<div class="empty v3-search-empty"><b>没有找到相关课程</b><p>换个关键词，或清除当前筛选。</p><button class="outline" onclick="v3ClearCourseFilters()">清除筛选</button></div>`
      : `<div class="empty v3-search-empty"><b>还没有课程</b><p>创建第一门课程后，就可以添加课堂记录。</p><button class="primary" onclick="newCourse()">创建课程</button></div>`;
    return rows.map(({ item, index }) => `<article class="course-card-v3 ${item.pinned ? 'pinned' : ''}" role="button" tabindex="0" draggable="${courseSortMode === 'manual'}" onclick="v2OpenCourse(${index})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();v2OpenCourse(${index})}" ondragstart="v2DragStart('course',${index})" ondragover="event.preventDefault()" ondrop="v2Drop('course',${index})"><div class="course-main"><span class="course-cover ${item.color || ''}">${item.icon}</span><div><span>${item.pinned ? '置顶课程 · ' : ''}编辑于 ${v2FormatDate(item.editedAt)}</span><b>${esc(item.name)}</b><small>${item.lessons.length} 个课时 · ${item.lessons.filter(entry => entry.ready).length} 份笔记</small></div><i>›</i></div><button class="pin-button ${item.pinned ? 'on' : ''}" onclick="event.stopPropagation();v3ToggleCoursePin(${index})" aria-label="${item.pinned ? '取消置顶' : '置顶课程'}">${item.pinned ? '★' : '☆'}</button></article>`).join('');
  }

  function v3ToggleCoursePin(index) { state.courses[index].pinned = !state.courses[index].pinned; state.courses[index].editedAt = '2026-09-24'; save(); render(); toast(state.courses[index].pinned ? '课程已置顶' : '已取消置顶'); }
  function v3SetCourseQuery(value) { courseQuery = value; const list = document.querySelector('#course-cards-v3'); if (list) list.innerHTML = v3CourseCards(); }
  function v3SetCourseFilter(value) { courseViewFilter = value; render(); }
  function v3SetCourseSort(value) { courseSortMode = value; render(); }
  function v3ClearCourseFilters() { courseQuery = ''; courseViewFilter = 'all'; courseSortMode = 'edited'; render(); }

  function v3LessonRows() {
    const rows = course().lessons.map((item, index) => ({ item, index })).filter(({ item }) => {
      const query = v2Query.trim().toLowerCase();
      return !query || item.name.toLowerCase().includes(query);
    });
    rows.sort((a, b) => {
      if (a.item.pinned !== b.item.pinned) return Number(b.item.pinned) - Number(a.item.pinned);
      return lessonSortMode === 'newest' ? String(b.item.editedAt).localeCompare(String(a.item.editedAt)) : String(a.item.editedAt).localeCompare(String(b.item.editedAt));
    });
    return rows;
  }

  function v3LessonCards() {
    const rows = v3LessonRows();
    if (!course().lessons.length) return `<div class="empty v3-empty-lessons"><span class="empty-state-icon">${icon('book')}</span><b>还没有课时记录</b><p>添加第一条课堂记录后，录音、转写和课堂笔记都会归档在这里。</p><button class="primary" onclick="go('capture')">＋ 添加第一条课堂记录</button></div>`;
    if (!rows.length) return `<div class="empty v3-search-empty"><b>没有找到相关课时</b><p>换个关键词后再试。</p><button class="outline" onclick="v3SearchLessons('');render()">清除搜索</button></div>`;
    return rows.map(({ item, index }) => `<article class="lesson-card-v3 ${item.pinned ? 'pinned' : ''}" role="button" tabindex="0" onclick="v2OpenLesson(${index})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();v2OpenLesson(${index})}"><div class="lesson-main"><div class="lesson-order">${String(index + 1).padStart(2, '0')}</div><div><div class="lesson-title-line"><b>${esc(item.name)}</b>${item.pinned ? '<span>置顶</span>' : ''}</div><p>${item.source || '录音卡'} · ${item.ready ? '笔记已生成' : '正在整理'}</p><small>创建 ${v2FormatDate(item.createdAt)} · 编辑 ${v2FormatDate(item.editedAt)}</small></div><i>›</i></div><div class="lesson-card-actions"><button class="pin-button ${item.pinned ? 'on' : ''}" onclick="event.stopPropagation();v3ToggleLessonPin(${index})" aria-label="${item.pinned ? '取消置顶' : '置顶课时'}">${item.pinned ? '★' : '☆'}</button><button class="lesson-delete-button" onclick="event.stopPropagation();v3ConfirmDeleteLesson(${index})" aria-label="删除课时">${icon('trash')}</button></div></article>`).join('');
  }

  function v3ToggleLessonPin(index) { course().lessons[index].pinned = !course().lessons[index].pinned; course().lessons[index].editedAt = '2026-09-24'; course().editedAt = '2026-09-24'; save(); render(); toast(course().lessons[index].pinned ? '课时已置顶' : '已取消置顶'); }
  function v3SearchLessons(value) { v2Query = value; const list = document.querySelector('#lesson-cards-v3'); if (list) list.innerHTML = v3LessonCards(); }
  function v3SetLessonSort(value) { lessonSortMode = value; render(); }

  function v3OpenCourseMenu() {
    const item = course();
    sheet('管理课程', `<div class="confirm-list"><div><span>课程</span><b>${esc(item.name)}</b></div><div><span>包含内容</span><b>${item.lessons.length} 个课时 · ${item.lessons.filter(entry => entry.ready).length} 份笔记</b></div></div><button class="danger wide" onclick="v3ConfirmDeleteCourse()">删除这门课程</button><button class="secondary wide delete-cancel-button" onclick="closeSheet()">取消</button>`);
  }

  function v3ConfirmDeleteCourse() {
    const item = course();
    sheet('确认删除整门课程？', `<p class="sheet-copy">「${esc(item.name)}」及其中 ${item.lessons.length} 个课时、课堂笔记、复习清单和测试记录都会被删除，且无法恢复。</p><button class="danger wide" onclick="v3DeleteCourse()">确认删除课程</button><button class="secondary wide delete-cancel-button" onclick="closeSheet()">暂不删除</button>`);
  }

  function v3DeleteCourse() {
    state.courses.splice(state.course, 1);
    state.course = Math.max(0, Math.min(state.course, state.courses.length - 1));
    state.lesson = 0;
    v2Query = '';
    if (!state.courses.length) {
      courseQuery = '';
      courseViewFilter = 'all';
      courseSortMode = 'edited';
    }
    save();
    closeSheet();
    route = 'home';
    historyStack = [];
    location.hash = 'home';
    window.render();
    toast('课程已删除');
  }

  function v3ConfirmDeleteLesson(index) {
    state.lesson = Number(index);
    const item = lesson();
    sheet('确认删除这个课时？', `<p class="sheet-copy">「${esc(item.name)}」的录音副本、转写、笔记、复习记录和测试结果都会被删除，且无法恢复。</p><button class="danger wide" onclick="v3DeleteLesson()">确认删除课时</button><button class="secondary wide delete-cancel-button" onclick="closeSheet()">暂不删除</button>`);
  }

  function v3DeleteLesson() {
    course().lessons.splice(state.lesson, 1);
    state.lesson = 0;
    course().editedAt = '2026-09-28';
    save();
    closeSheet();
    go('course');
    toast('课时已删除');
  }

  function requireLogin(next) {
    if (state.logged) return true;
    pendingLoginAction = next;
    go('login');
    toast('登录后可继续此操作');
    return false;
  }

  function openOwnCourses() {
    if (!requireLogin(openOwnCourses)) return;
    go('home');
  }

  function openCapture() {
    if (!requireLogin(openCapture)) return;
    go('capture');
  }

  function openSampleLesson() {
    sampleMode = true;
    state.course = 0;
    state.lesson = 0;
    go('lesson');
    toast('当前为只读示例，不会写入你的学习记录');
  }

  function openPendingRecording() {
    if (!state.bound) {
      go('device');
      toast('请先绑定录音卡');
      return;
    }
    transferProgress = 0;
    transferError = false;
    go('recordingdetail');
  }

  function beginCardRecordingDemo() {
    sheet('请在录音卡上开始录音', `<div class="hardware-guide"><span class="device-button">●</span><div><b>长按设备按键 2 秒</b><p>指示灯变红并震动一次，即表示录音已开始。小程序只显示设备状态，不调用手机麦克风。</p></div></div><button class="primary wide" onclick="closeSheet();toast('录音卡状态：录音中（演示）')">我知道了</button>`);
  }

  function chooseImportFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    let error = '';
    if (!IMPORT_EXTENSIONS.includes(extension)) error = '暂不支持此格式，请选择 M4A、MP3、WAV 或 AAC';
    else if (file.size > IMPORT_LIMIT) error = '文件超过 200 MB，请压缩或拆分后重新选择';
    else if (file.size === 0) error = '文件内容为空，请重新选择';
    selectedImport = error ? null : { name: file.name, size: file.size, extension };
    const result = document.querySelector('#import-result');
    if (result) result.innerHTML = error
      ? `<div class="file-result error"><b>文件不可用</b><span>${error}</span></div>`
      : `<div class="file-result success"><b>✓ 文件校验通过</b><span>${esc(file.name)} · ${fileSize(file.size)}</span></div>`;
    const next = document.querySelector('#import-next');
    if (next) next.disabled = Boolean(error);
  }

  function useDemoImport() {
    selectedImport = { name: '宏观经济学_第4课.m4a', size: 58.4 * 1024 * 1024, extension: 'm4a' };
    render();
  }

  function openMaterialImport(kind) {
    materialKind = kind === 'document' ? 'document' : 'image';
    selectedMaterial = null;
    go('importmaterial');
  }

  function chooseMaterialFile(input) {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const imageExt = ['jpg', 'jpeg', 'png', 'heic'];
    const documentExt = ['pdf', 'doc', 'docx', 'ppt', 'pptx'];
    const allowed = materialKind === 'image' ? imageExt : documentExt;
    const limit = materialKind === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    let error = '';
    if (materialKind === 'image' && files.length > 9) error = '一次最多选择 9 张课堂照片';
    const invalid = files.find(file => !allowed.includes((file.name.split('.').pop() || '').toLowerCase()));
    const oversized = files.find(file => file.size > limit);
    if (!error && invalid) error = `暂不支持 ${invalid.name} 的文件格式`;
    if (!error && oversized) error = `${oversized.name} 超过${materialKind === 'image' ? '单张 10 MB' : '50 MB'}限制`;
    selectedMaterial = error ? null : { files: files.map(file => ({ name: file.name, size: file.size })), kind: materialKind };
    const result = document.querySelector('#material-result');
    if (result) result.innerHTML = error
      ? `<div class="file-result error"><b>文件不可用</b><span>${error}</span></div>`
      : `<div class="file-result success"><b>✓ ${materialKind === 'image' ? `${files.length} 张照片` : '课件文件'}校验通过</b><span>${files.map(file => esc(file.name)).join('、')}</span></div>`;
    const next = document.querySelector('#material-next');
    if (next) next.disabled = Boolean(error);
  }

  function useDemoMaterial() {
    selectedMaterial = materialKind === 'image'
      ? { kind: 'image', files: [{ name: '课堂板书_01.jpg', size: 2.4 * 1024 * 1024 }, { name: '课堂板书_02.jpg', size: 2.1 * 1024 * 1024 }] }
      : { kind: 'document', files: [{ name: '宏观经济学_第4章.pptx', size: 18.6 * 1024 * 1024 }] };
    render();
  }

  function confirmMaterial() {
    if (!selectedMaterial) return toast('请先选择有效的课堂资料');
    const label = selectedMaterial.kind === 'image' ? `${selectedMaterial.files.length} 张课堂照片` : selectedMaterial.files[0].name;
    sheet('确认资料信息', `<div class="confirm-list"><div><span>资料内容</span><b>${esc(label)}</b></div><div><span>处理方式</span><b>${selectedMaterial.kind === 'image' ? '图片 OCR 识别' : '课件文本解析'}</b></div><div><span>保存到</span><b>${esc(safeCourseName())}</b></div></div><label class="field-label">课堂资料名称<input id="material-lesson-name" class="input" maxlength="40" value="第 ${course().lessons.length + 1} 课 · 课堂资料"></label><p class="sheet-copy">系统只会分析你主动选择的文件。请确认资料不含无关个人信息。</p><button class="primary wide" onclick="finishMaterial()">确认上传并开始整理</button>`);
  }

  function finishMaterial() {
    const name = document.querySelector('#material-lesson-name')?.value.trim();
    if (!name) return toast('请填写课堂资料名称');
    const source = selectedMaterial.kind === 'image' ? '图片资料' : '课件文件';
    course().lessons.unshift({ name, ready: false, editedAt: '2026-09-24', source, sourceFiles: selectedMaterial.files });
    state.lesson = 0;
    selectedMaterial = null;
    processingStep = 0;
    save();
    closeSheet();
    go('processing');
  }

  function showSourceMaterial() { go('materialsource'); }

  function transcriptSegments() {
    const corrections = lesson()?.transcriptCorrections || {};
    return [
      { start: 138, end: 186, speaker: '教师', text: corrections[0] || '这节课我们用总需求和总供给模型，解释物价水平与实际产出为什么会同时发生变化。', confidence: 98, tag: '专业术语已识别' },
      { start: 186, end: 242, speaker: '教师', text: corrections[1] || '总需求由消费、投资、政府购买和净出口构成，先记住 AD 等于 C 加 I 加 G 加 NX。', confidence: 96, tag: '公式已识别' },
      { start: 522, end: 579, speaker: '教师', text: corrections[2] || '这里一定要区分需求曲线上的移动和整条需求曲线的移动，这是考试里最容易混淆的地方。', confidence: 84, tag: '老师强调 · 建议核对' },
      { start: 965, end: 1028, speaker: '教师', text: corrections[3] || '如果居民信心增强，消费增加，改变的是总需求本身，所以总需求曲线整体向右移动。', confidence: 94, tag: '方言已转为普通话表达' },
      { start: 1930, end: 1988, speaker: '教师', text: corrections[4] || '复习时先画出总需求总供给图，再判断冲击来自需求侧还是供给侧，最后分析价格和产出的方向。', confidence: 97, tag: '远距离人声已增强' }
    ];
  }

  function v3SetNoteSection(section) { noteSection = section; render(); }
  const knowledgeDefaults = {
    examMove: { type: '高频考点', title: '曲线上的移动 vs. 整条曲线移动', content: '物价水平变化引起的是沿总需求曲线移动；消费、投资、政府购买或净出口变化会使总需求曲线整体移动。' },
    examImpact: { type: 'AI 推断', title: '需求冲击对均衡的影响', content: '短期总供给不变时，总需求右移通常使物价水平和实际产出同时上升。' },
    confuse: { type: '易错易混点', title: '沿曲线移动与曲线整体移动', content: '沿曲线移动来自物价水平变化；整条曲线移动来自消费、投资、政府购买或净出口变化。' },
    memory: { type: '记忆知识点', title: '总需求构成', content: 'AD = C + I + G + NX，即消费＋投资＋政府购买＋净出口。' }
  };
  function v3KnowledgeItem(key) {
    const data = v2Study();
    data.knowledgeEdits = data.knowledgeEdits || {};
    return { ...knowledgeDefaults[key], marked: false, remark: '', ...(data.knowledgeEdits[key] || {}) };
  }
  function v3ReviewState(data = v2Study()) {
    data.reviewList = Array.isArray(data.reviewList) ? data.reviewList : [];
    data.reviewMastered = Array.isArray(data.reviewMastered) ? data.reviewMastered : [];
    return data;
  }
  function v3ReviewItemMeta(key, data = v2Study()) {
    const edits = data.knowledgeEdits || {};
    const defaults = {
      summary: ['课程概要', '总需求—总供给模型：理解经济波动的共同框架', 'AI 综合整理'],
      examMove: ['高频考点', edits.examMove?.title || knowledgeDefaults.examMove.title, '老师明确强调'],
      examImpact: ['高频考点', edits.examImpact?.title || knowledgeDefaults.examImpact.title, 'AI 推断'],
      confuse: ['易错易混点', edits.confuse?.title || knowledgeDefaults.confuse.title, '老师明确强调'],
      memory: ['记忆知识点', edits.memory?.title || knowledgeDefaults.memory.title, '老师讲解＋AI 辅助']
    };
    return defaults[key] || defaults.summary;
  }
  function v3ToggleReviewItem(key) {
    const data = v3ReviewState(); const found = data.reviewList.indexOf(key);
    if (found >= 0) { data.reviewList.splice(found, 1); data.reviewMastered = data.reviewMastered.filter(item => item !== key); }
    else data.reviewList.push(key);
    save(); render(); toast(found >= 0 ? '已移出复习清单' : '已加入复习清单');
  }
  function v3OpenReviewItem(ci, li, key) {
    state.course = ci; state.lesson = li; focusedNoteKey = key; noteSection = key === 'summary' ? 'summary' : 'knowledge'; save(); go('notes');
    setTimeout(() => document.querySelector(`[data-note-key="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    setTimeout(() => { document.querySelector(`[data-note-key="${key}"]`)?.classList.remove('focused-note'); if (focusedNoteKey === key) focusedNoteKey = ''; }, 2400);
    toast('已定位并高亮原笔记');
  }
  function v3ToggleMastered(ci, li, key) { state.course = ci; state.lesson = li; const data = v3ReviewState(); const found = data.reviewMastered.indexOf(key); if (found >= 0) data.reviewMastered.splice(found, 1); else data.reviewMastered.push(key); save(); go('favorites'); }
  function v3RemoveReviewItem(ci, li, key) { state.course = ci; state.lesson = li; const data = v3ReviewState(); data.reviewList = data.reviewList.filter(item => item !== key); data.reviewMastered = data.reviewMastered.filter(item => item !== key); save(); go('favorites'); toast('已移出复习清单'); }
  function v3SetReviewListFilter(value) { reviewListFilter = value; render(); }
  function v3ReviewCount() { let count = 0; state.courses.forEach(c => c.lessons.forEach(l => { count += v3ReviewState(v2StudyOf(l)).reviewList.length; })); return count; }
  function v3SaveSummaryNote() { const data = v2Study(); data.note = document.querySelector('#note-edit').value; data.remark = document.querySelector('#note-remark').value; save(); go('notes'); toast('修改已保存'); }
  function v3OpenKnowledgeEdit(key) { editingKnowledgeKey = key; knowledgeDraft = { ...v3KnowledgeItem(key) }; go('knowledgeedit'); }
  function v3UpdateKnowledgeDraft() {
    if (!knowledgeDraft) knowledgeDraft = { ...v3KnowledgeItem(editingKnowledgeKey) };
    const content = document.querySelector('#knowledge-edit-content');
    const remark = document.querySelector('#knowledge-edit-remark');
    if (content) knowledgeDraft.content = content.value;
    if (remark) knowledgeDraft.remark = remark.value;
  }
  function v3CompareKnowledgeSource() {
    v3UpdateKnowledgeDraft();
    const sourceMap = { examMove: 2, examImpact: 3, confuse: 2, memory: 1 };
    v3OpenTranscriptSegment(sourceMap[editingKnowledgeKey] ?? 0);
  }
  function v3CancelKnowledgeEdit() { knowledgeDraft = null; noteSection = 'knowledge'; go('notes'); }
  function v3SaveKnowledgeEdit() {
    const content = document.querySelector('#knowledge-edit-content').value.trim();
    if (!content) return toast('笔记内容不能为空');
    const data = v2Study();
    data.knowledgeEdits = data.knowledgeEdits || {};
    data.knowledgeEdits[editingKnowledgeKey] = { ...v3KnowledgeItem(editingKnowledgeKey), content, remark: document.querySelector('#knowledge-edit-remark').value.trim(), edited: true };
    knowledgeDraft = null; save(); noteSection = 'knowledge'; go('notes'); toast('修改已保存');
  }
  function v3ToggleReviewStep(index) {
    const data = v2Study();
    data.reviewDone = Array.isArray(data.reviewDone) ? data.reviewDone : [];
    const found = data.reviewDone.indexOf(index);
    if (found >= 0) data.reviewDone.splice(found, 1); else data.reviewDone.push(index);
    save(); render();
  }
  function v3NoteGenerationInfo() {
    sheet('这份笔记如何生成？', `<div class="generation-logic"><div><b>1 · 老师明确强调</b><p>优先识别“重点、常考、容易错、记住”等表达，并保留录音时间。</p></div><div><b>2 · AI 内容理解</b><p>在老师未明确说明时，结合课堂上下文补充可能的考点和复习方法。</p></div><div><b>3 · 按内容动态组合</b><p>材料不足时不强行生成；对应模块会说明未识别到有效内容。</p></div></div><button class="outline wide" onclick="closeSheet()">我知道了</button>`);
  }
  function v3OpenTranscriptSegment(index) {
    if (['图片资料', '课件文件'].includes(lesson()?.source)) return go('materialsource');
    transcriptIndex = index;
    playerSeconds = transcriptSegments()[index]?.start || 0;
    go('transcript');
  }
  function v3EvidenceData(type = evidenceType) {
    const cases = {
      summary: {
        label: '课程概要', title: '总需求—总供给模型：理解经济波动的共同框架', confidence: 92,
        note: '本节课围绕 AD–AS 模型展开，先识别冲击来源，再判断曲线移动方向，最后分析物价水平与实际产出的变化。',
        indices: [0, 1, 3, 4],
        logic: ['识别课程主线：AD–AS 模型与经济波动', '合并公式、课堂案例和老师的分析步骤', '去除重复表达，压缩为可复习的课程概要']
      },
      review: {
        label: '复习建议', title: '画模型 → 判冲击 → 验方向', confidence: 97,
        note: '先画出 AD–AS 模型，再判断冲击来自需求侧还是供给侧，最后检查物价水平与实际产出的变化方向。',
        indices: [4],
        logic: ['识别老师在课尾明确给出的复习顺序', '把一句连续建议拆分为三个可执行动作', '保留老师原有先后关系，补充简短的行动说明']
      },
      exam: {
        label: '高频考点', title: '曲线上的移动 vs. 整条曲线移动', confidence: 96,
        note: '物价水平变化引起沿曲线移动；消费、投资、政府购买或净出口变化会使整条总需求曲线移动。',
        indices: [2, 1],
        logic: ['捕捉老师“考试、容易混淆”的明确强调', '补充前文中的总需求构成作为判断依据', '整理为一组可直接比较的考点']
      },
      inference: {
        label: 'AI 推断', title: '需求冲击对均衡的影响', confidence: 84,
        note: '短期总供给不变时，总需求右移通常使物价水平和实际产出同时上升。',
        indices: [0, 3],
        logic: ['从课程主题确认分析对象是物价与实际产出', '从居民信心案例识别总需求右移', '结合课堂上下文归纳均衡变化；该结论属于 AI 推断']
      },
      confuse: {
        label: '易错易混点', title: '沿曲线移动与曲线整体移动', confidence: 95,
        note: '判断时先看变化来自物价水平，还是来自消费、投资、政府购买或净出口。',
        indices: [2, 1],
        logic: ['以老师明确指出的易混点为主证据', '从前文提取总需求构成', '形成“先判断变化来源”的辨析方法']
      }
    };
    return cases[type] || cases.summary;
  }
  function v3OpenEvidence(type) {
    if (['图片资料', '课件文件'].includes(lesson()?.source)) return go('materialsource');
    evidenceType = type;
    go('evidence');
  }
  function v3MetricInfo(type) {
    if (type === 'support') {
      const data = v3EvidenceData();
      return sheet('依据覆盖度如何计算？', `<div class="metric-explain"><div class="metric-score-sample"><b>${data.confidence}%</b><span>依据覆盖度</span></div><p>AI 先把当前笔记拆成若干条关键结论，再检查每条结论能否在已关联的课堂原文中找到直接或部分依据。</p><div><b>本页计算示例</b><span>关键结论共 4 条</span><span>3 条有直接依据，1 条有部分依据</span><span>按结论重要程度加权后为 ${data.confidence}%</span></div><p class="metric-warning">它表示“这段笔记有多少内容能被当前证据覆盖”，不代表笔记有 ${data.confidence}% 的概率绝对正确，也不评价老师讲授内容是否正确。</p></div><button class="primary wide" onclick="closeSheet()">我知道了</button>`);
    }
    sheet('转写置信度如何理解？', `<div class="metric-explain"><div class="metric-score-sample"><b>94%</b><span>整段录音平均置信度</span></div><p>单句置信度是语音识别模型结合词语识别概率、声音清晰度和上下文，对该句听写结果给出的估计。</p><div><b>94% 如何得到</b><span>先计算每句话的转写置信度</span><span>再按每句识别文字量加权汇总</span><span>低于 90% 的句子单独标记提醒</span></div><div><b>主要影响因素</b><span>教师口音与语速</span><span>专业术语识别情况</span><span>教室噪音、回声和收音距离</span></div><p class="metric-warning">94% 不表示整段文字一定有 94% 正确，也不代表老师观点或 AI 笔记结论正确。重要内容仍建议结合原始录音核对。</p></div><button class="primary wide" onclick="closeSheet()">我知道了</button>`);
  }
  function v3SummaryEvidence() {
    v3OpenEvidence('summary');
  }

  function v3SeekTranscript(index) {
    const segment = transcriptSegments()[index];
    transcriptIndex = index;
    playerSeconds = segment.start;
    document.querySelectorAll('.transcript-sentence').forEach((node, i) => node.classList.toggle('active', i === index));
    const time = document.querySelector('#play-time');
    const range = document.querySelector('#audio-range');
    if (time) time.textContent = formatTime(playerSeconds);
    if (range) range.value = playerSeconds;
  }

  function v3TogglePlayback() { playerOn = !playerOn; render(); }
  function v3SetRate() { playbackRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? .75 : 1; render(); }
  function v3CorrectTranscript(index) {
    const segment = transcriptSegments()[index];
    sheet('校正这句转写', `<p class="sheet-copy">${formatTime(segment.start)}–${formatTime(segment.end)} · 修改只影响转写文本，不会改变原始音频。</p><textarea id="transcript-correction" class="sheet-text">${esc(segment.text)}</textarea><label class="check"><input type="checkbox" id="term-correction">这是专业术语，帮助后续识别</label><button class="primary wide" onclick="v3SaveTranscript(${index})">保存校正</button>`);
  }

  function v3SaveTranscript(index) {
    const value = document.querySelector('#transcript-correction')?.value.trim();
    if (!value) return toast('转写内容不能为空');
    const item = lesson();
    item.transcriptCorrections = item.transcriptCorrections || {};
    item.transcriptCorrections[index] = value;
    item.editedAt = '2026-09-24';
    save();
    closeSheet();
    render();
    toast('这句转写已校正');
  }

  function confirmImport() {
    if (!selectedImport) return toast('请先选择有效的音频文件');
    sheet('确认导入信息', `<div class="confirm-list"><div><span>音频文件</span><b>${esc(selectedImport.name)}</b></div><div><span>文件大小</span><b>${fileSize(selectedImport.size)}</b></div><div><span>保存到</span><b>${esc(safeCourseName())}</b></div></div><label class="field-label">课时名称<input id="import-lesson-name" class="input" maxlength="40" value="第 ${course().lessons.length + 1} 课 · 新课堂记录"></label><p class="sheet-copy">上传后可离开此页，完成时会通过消息中心通知你。</p><button class="primary wide" onclick="finishImport()">确认上传并开始整理</button>`);
  }

  function finishImport() {
    const input = document.querySelector('#import-lesson-name');
    const name = input?.value.trim();
    if (!name) return toast('请填写课时名称');
    course().lessons.unshift({ name, ready: false, duration: '45:20', editedAt: '2026-09-24', source: '文件导入' });
    state.lesson = 0;
    selectedImport = null;
    clipStart = 0;
    clipEnd = 2720;
    save();
    closeSheet();
    go('clip');
  }

  function v3TransferAction() {
    if (transferProgress !== 100) return startTransfer();
    sheet('保存这堂课', `<label class="field-label">课时名称<input id="lesson-name" class="input" maxlength="40" value="第 ${course().lessons.length + 1} 课 · 新课堂记录"></label><p class="sheet-copy">录音将归档到「${esc(safeCourseName())}」，下一步可整理有效时段。</p><button class="primary wide" onclick="v3CreateTransferredLesson()">保存并整理录音</button>`);
  }

  function v3CreateTransferredLesson() {
    const name = document.querySelector('#lesson-name')?.value.trim();
    if (!name) return toast('请填写课时名称');
    course().lessons.unshift({ name, ready: false, duration: '45:20', editedAt: '2026-09-28', source: '录音卡' });
    state.lesson = 0;
    clipStart = 0;
    clipEnd = 2720;
    save();
    closeSheet();
    go('clip');
  }

  function v3UpdateClip(side, value) {
    const next = Number(value);
    if (side === 'start') clipStart = Math.min(next, clipEnd - 30);
    else clipEnd = Math.max(next, clipStart + 30);
    const selection = document.querySelector('.clip-selection');
    if (selection) {
      selection.style.setProperty('--clip-start', `${clipStart / 2720 * 100}%`);
      selection.style.setProperty('--clip-end', `${clipEnd / 2720 * 100}%`);
    }
    document.querySelector('#clip-start-label').textContent = formatTime(clipStart);
    document.querySelector('#clip-end-label').textContent = formatTime(clipEnd);
    document.querySelector('#clip-duration-label').textContent = formatTime(clipEnd - clipStart);
  }

  function v3ResetClip() { clipStart = 0; clipEnd = 2720; render(); toast('已恢复完整录音'); }

  function v3StartProcessing(useFullRecording) {
    const item = lesson();
    if (!item) return go('course');
    item.clip = useFullRecording || (clipStart === 0 && clipEnd === 2720) ? null : { start: formatTime(clipStart), end: formatTime(clipEnd), startSeconds: clipStart, endSeconds: clipEnd };
    item.editedAt = '2026-09-28';
    item.processingStep = 0;
    item.processingStatus = 'processing';
    processingStep = 0;
    save();
    go('processing');
  }

  function v3DeleteCurrentRecording() {
    const imported = lesson()?.source === '文件导入';
    sheet('删除这条录音？', `<p class="sheet-copy">${imported ? '仅移除小程序内的录音副本和当前待整理课时，不会删除手机中的原文件。' : '将删除已回传到小程序的录音和当前待整理课时；录音卡中的源文件不受影响。'}</p><p class="sheet-copy">当前尚未开始转写，不会产生笔记数据。</p><div class="sheet-action-stack"><button class="danger wide" onclick="v3ConfirmDeleteCurrentRecording()">确认删除</button><button class="secondary wide" onclick="closeSheet()">取消</button></div>`);
  }

  function v3ConfirmDeleteCurrentRecording() {
    course().lessons.splice(state.lesson, 1);
    state.lesson = 0;
    save();
    closeSheet();
    go('course');
    toast('录音已从小程序中删除');
  }

  function v3DeleteCardRecording() {
    sheet('删除录音卡中的文件？', '<p class="sheet-copy">删除后，这条尚未回传的录音将无法在小程序中找回。建议确认不再需要后再删除。</p><div class="sheet-action-stack"><button class="danger wide" onclick="closeSheet();go(\'device\');toast(\'录音卡文件已删除\')">确认删除</button><button class="secondary wide" onclick="closeSheet()">取消</button></div>');
  }

  function v3OpenUnbindSheet() {
    sheet('解除设备绑定？', '<p class="sheet-copy">解除后不会删除已回传的课程和笔记，录音卡中的本地文件也会保留。</p><div class="sheet-action-stack"><button class="danger wide" onclick="v3ConfirmUnbind()">确认解除</button><button class="secondary wide" onclick="closeSheet()">取消</button></div>');
  }

  function v3ConfirmUnbind() {
    state.bound = false;
    save();
    closeSheet();
    render();
    toast('录音卡已解除绑定');
  }

  function simulateTransferError() {
    transferError = true;
    transferProgress = 38;
    clearInterval(timer);
    render();
  }

  function retryTransfer() {
    transferError = false;
    transferProgress = 0;
    render();
    toast('连接已恢复，可以重新回传');
  }

  function logoutV3() {
    sheet('退出当前账号？', '<p class="sheet-copy">退出后，本机不会再显示个人课程与设备信息；云端数据不会删除。</p><div class="sheet-action-stack"><button class="danger wide" onclick="state.logged=false;state.bound=false;sampleMode=false;save();closeSheet();historyStack=[];go(\'home\');toast(\'已退出账号\')">确认退出</button><button class="secondary wide" onclick="closeSheet()">取消</button></div>');
  }

  Object.assign(window, { openOwnCourses, openCapture, openSampleLesson, openPendingRecording, beginCardRecordingDemo, chooseImportFile, useDemoImport, confirmImport, finishImport, v3TransferAction, v3CreateTransferredLesson, v3UpdateClip, v3ResetClip, v3StartProcessing, v3DeleteCurrentRecording, v3ConfirmDeleteCurrentRecording, v3DeleteCardRecording, v3OpenUnbindSheet, v3ConfirmUnbind, openMaterialImport, chooseMaterialFile, useDemoMaterial, confirmMaterial, finishMaterial, showSourceMaterial, v3SeekTranscript, v3TogglePlayback, v3SetRate, v3CorrectTranscript, v3SaveTranscript, v3SetNoteSection, v3OpenKnowledgeEdit, v3UpdateKnowledgeDraft, v3CompareKnowledgeSource, v3CancelKnowledgeEdit, v3SaveKnowledgeEdit, v3ReviewState, v3ToggleReviewItem, v3OpenReviewItem, v3ToggleMastered, v3RemoveReviewItem, v3SetReviewListFilter, v3SaveSummaryNote, v3ToggleReviewStep, v3NoteGenerationInfo, v3OpenTranscriptSegment, v3OpenEvidence, v3MetricInfo, v3SummaryEvidence, v3ToggleCoursePin, v3SetCourseQuery, v3SetCourseFilter, v3SetCourseSort, v3ClearCourseFilters, v3ToggleLessonPin, v3SearchLessons, v3SetLessonSort, v3OpenCourseMenu, v3ConfirmDeleteCourse, v3DeleteCourse, v3ConfirmDeleteLesson, v3DeleteLesson, simulateTransferError, retryTransfer, logoutV3 });

  views.login = () => `<div class="login-page"><div class="login-brand"><span>芋</span><b>芋泥课堂笔记</b></div><div class="login-visual"><div class="device-mini">YUNI<i></i></div><div class="note-mini">课堂重点<br><em>自动整理</em></div></div><h1>把课堂带回来，<br>慢慢学懂。</h1><p class="sub">登录后同步你的课程、笔记和录音卡。</p><div class="login-actions"><button id="wechat-login" class="wechat-button" onclick="openLoginConsent()">微信快捷登录</button><button class="ghost-button" onclick="go('sample')">不登录，体验示例课程</button></div><p class="privacy-tip">点击登录后阅读并确认协议；已登录用户下次打开将直接进入首页。</p></div>`;

  views.home = () => state.logged
    ? `<div class="home-head"><div><span class="eyebrow-v3">GOOD AFTERNOON</span><h1>${esc(state.profile?.nickname || '小芋同学')}，继续学习吧</h1></div><button class="notify-button" onclick="go('notifications')">●</button></div><button class="device-status ${state.bound ? 'connected' : ''}" onclick="openDeviceFrom('home')"><span class="device-dot"></span><div><b>${state.bound ? '录音卡已连接' : '连接录音卡'}</b><small>${state.bound ? '电量 86% · 有 1 条录音待回传' : '绑定后可同步课堂录音'}</small></div><i>›</i></button><section class="task-card"><span>下一步</span><h2>${state.bound ? '有一条课堂录音等待回传' : '绑定录音卡，开始记录课堂'}</h2><p>${state.bound ? '今天 11:42 · 45分20秒 · 约 58.4 MB' : '录音由实体录音卡完成，小程序负责回传与整理。'}</p><button onclick="${state.bound ? 'openPendingRecording()' : "openDeviceFrom('home')"}">${state.bound ? '去回传录音' : '连接设备'} →</button></section><div class="section-heading"><div><b>我的课程</b><span>${courseCount()} 门课程 · ${lessonCount()} 个课时</span></div><button onclick="newCourse()">＋ 新建</button></div><div class="course-list-v3">${v2CourseCards()}</div>`
    : `<div class="guest-home"><div class="guest-mark">芋</div><span class="eyebrow-v3">YUNI CLASS NOTES</span><h1>听课时专心听，<br>下课后慢慢懂。</h1><p>连接录音卡，把课堂录音整理成可编辑的笔记、考点和复习内容。</p><div class="feature-row"><div><b>01</b><span>录音卡采集</span></div><div><b>02</b><span>AI 整理</span></div><div><b>03</b><span>复习巩固</span></div></div><div class="guest-actions"><button class="primary" onclick="go('login')">登录并开始使用</button><button class="ghost-button" onclick="go('sample')">体验示例课程</button></div></div>`;

  views.sample = () => `<div class="sample-hero"><span class="pill">只读示例</span><h1>用一堂示例课，<br>了解芋泥怎么工作。</h1><p>示例内容不会保存，也不会占用你的笔记额度。</p></div><article class="sample-course"><div class="sample-cover">↗</div><div><span>宏观经济学</span><h2>第 3 课 · 课程知识与应用</h2><p>45:20 · 已生成课堂笔记</p></div></article><div class="sample-flow"><div><b>01</b><span>课堂录音</span></div><i>→</i><div><b>02</b><span>AI 笔记</span></div><i>→</i><div><b>03</b><span>复习测试</span></div></div><button class="primary wide" onclick="openSampleLesson()">查看完整示例</button><button class="ghost-button wide" onclick="go('login')">登录并创建我的课程</button>`;

  views.capture = () => `<div class="page-intro"><span class="eyebrow-v3">ADD CLASS RECORD</span><h1>添加课堂记录</h1><p>从录音卡、已有音频或课堂资料创建课时。小程序不会调用手机麦克风录音。</p></div><label class="field-label">保存到课程</label>${courseSelect()}<button class="capture-card primary-card" onclick="openPendingRecording()">${icon('device')}<div><b>从录音卡回传</b><span>${state.bound ? '已连接 · 1 条录音待回传' : '需要先绑定并连接录音卡'}</span></div><i>›</i></button><button class="capture-card" onclick="go('importaudio')">${icon('upload')}<div><b>导入已有音频</b><span>M4A / MP3 / WAV / AAC · 最大 200 MB</span></div><i>›</i></button><button class="capture-card" onclick="openMaterialImport('image')">${icon('file')}<div><b>导入课堂照片</b><span>板书 / PPT 拍照 · 最多 9 张</span></div><i>›</i></button><button class="capture-card" onclick="openMaterialImport('document')">${icon('folder')}<div><b>导入课件文件</b><span>PDF / Word / PPT · 最大 50 MB</span></div><i>›</i></button><div class="info-card"><b>不同资料会怎样处理？</b><p>录音会先转写语音；课堂照片会识别图片文字；课件文件会解析可读取的文本和页面结构，再生成笔记。</p></div>`;

  views.device = () => state.bound
    ? `<div class="device-page"><div class="device-hero-v3"><span class="status-chip">● 已连接</span><div class="device-render">YUNI<span></span></div><h1>芋泥录音卡</h1><p>设备编号 YN-001 · 固件已是最新版本</p></div><div class="device-stats"><div><b>86%</b><span>电量</span></div><div><b>12.8 GB</b><span>可用空间</span></div><div><b>正常</b><span>设备状态</span></div></div><button class="secondary wide" onclick="beginCardRecordingDemo()">如何开始录音</button><div class="section-heading"><div><b>待回传录音</b><span>文件保留在设备中，回传成功后可选择删除</span></div><span class="count-badge">1</span></div><button class="recording-row" onclick="openPendingRecording()"><span class="recording-icon">▮▮</span><div><b>REC_20260924_1142.m4a</b><span>今天 11:42 · 45:20 · 58.4 MB</span></div><i>›</i></button><button class="danger-link page-tail-action" onclick="v3OpenUnbindSheet()">解除绑定</button></div>`
    : `<div class="empty-device"><div class="device-render searching">YUNI<span></span></div><h1>连接你的录音卡</h1><p>请打开录音卡并靠近手机。连接用于读取设备状态和回传录音。</p><ol><li>打开手机蓝牙</li><li>长按录音卡电源键 2 秒</li><li>确认设备指示灯闪烁</li></ol><button class="primary wide" onclick="bindDevice()">搜索附近设备</button><p class="privacy-tip">首次连接时，微信可能请求蓝牙权限；拒绝后可在系统设置中重新开启。</p></div>`;

  views.recordingdetail = () => `<div class="recording-detail-page"><div class="page-intro"><span class="eyebrow-v3">RECORDING FILE</span><h1>确认这条课堂录音</h1><p>回传前确认文件和课程信息，避免归档到错误位置。</p></div><div class="audio-file-card"><div class="wave-mini">▂▅▃▆▇▃▅▂▆</div><b>REC_20260924_1142.m4a</b><span>今天 11:42 · 45:20 · 58.4 MB</span><button onclick="playerOn=!playerOn;render()">${playerOn ? '暂停试听' : '试听前 30 秒'} ▶</button></div><label class="field-label">保存到课程</label>${courseSelect('recording-course')}<div class="notice-line">先回传完整文件，下一步可选择裁剪开头和结尾的无效片段，再开始转写。</div><div class="page-bottom-actions"><button class="primary wide" onclick="transferProgress=0;transferError=false;go('transfer')">开始回传</button><button class="danger-link" onclick="v3DeleteCardRecording()">删除录音卡中的文件</button></div></div>`;

  views.transfer = () => `<div class="transfer-page"><span class="eyebrow-v3">DEVICE TRANSFER</span><h1>${transferError ? '回传已暂停' : transferProgress === 100 ? '录音已回传' : '正在回传录音'}</h1><p>${transferError ? '录音卡连接中断，文件仍安全保留在设备中。' : transferProgress === 100 ? '文件校验完成，下一步整理录音有效时段。' : '请将录音卡放在手机附近，保持微信在前台。'}</p><div class="transfer-ring ${transferError ? 'error' : ''}" style="--progress:${transferProgress}"><b id="transfer-percent">${transferProgress}%</b><span>${transferError ? '连接中断' : transferProgress === 100 ? '校验完成' : '正在传输'}</span><i id="transfer-bar" hidden></i></div><div class="transfer-meta"><span>REC_20260924_1142.m4a</span><b>${esc(safeCourseName())}</b></div><div class="page-bottom-actions">${transferError ? '<button class="primary wide" onclick="retryTransfer()">重新连接</button><button class="ghost-button wide" onclick="go(\'device\')">稍后再试</button>' : `<button class="primary wide" ${transferProgress > 0 && transferProgress < 100 ? 'disabled' : ''} onclick="v3TransferAction()">${transferProgress === 100 ? '下一步：整理录音' : transferProgress ? '回传中…' : '开始回传'}</button>${transferProgress > 0 && transferProgress < 100 ? '<button class="ghost-button wide" onclick="simulateTransferError()">演示连接中断</button>' : ''}`}</div></div>`;

  views.clip = () => { const item = lesson(); if (!item) return `<div class="empty">请先选择一条录音。</div>`; return `<div class="page-intro clip-intro"><span class="eyebrow-v3">TRIM BEFORE TRANSCRIPTION</span><h1>整理有效课堂录音</h1><p>只需去掉课前等待或课后空白，也可以直接使用完整录音。</p></div><section class="clip-file-card"><div><span>${item.source === '文件导入' ? '本地音频' : '录音卡回传'}</span><b>${esc(item.name)}</b><small>原始时长 45:20 · M4A</small></div><button onclick="playerOn=!playerOn;render()">${playerOn ? '暂停' : '试听'} ${playerOn ? 'Ⅱ' : '▶'}</button></section><section class="clip-editor-card"><div class="clip-editor-heading"><div><b>保留的录音范围</b><span>至少保留 30 秒</span></div><button onclick="v3ResetClip()">恢复完整时长</button></div><div class="clip-selection" style="--clip-start:${clipStart / 2720 * 100}%;--clip-end:${clipEnd / 2720 * 100}%"><div class="clip-waveform">${Array.from({length:42},(_,i)=>`<i style="height:${10 + (i * 11 % 28)}px"></i>`).join('')}</div></div><div class="clip-time-range"><label><span>开始时间</span><b id="clip-start-label">${formatTime(clipStart)}</b><input type="range" min="0" max="2690" step="10" value="${clipStart}" oninput="v3UpdateClip('start',this.value)"></label><label><span>结束时间</span><b id="clip-end-label">${formatTime(clipEnd)}</b><input type="range" min="30" max="2720" step="10" value="${clipEnd}" oninput="v3UpdateClip('end',this.value)"></label></div><div class="clip-result"><span>将用于转写</span><b id="clip-duration-label">${formatTime(clipEnd - clipStart)}</b></div></section><div class="clip-safe-note"><span>✓</span><p><b>这是非破坏剪辑</b>原始录音会完整保留，之后仍可重新调整有效时段。</p></div><button class="primary wide" onclick="v3StartProcessing(false)">确认范围并开始转写</button><button class="ghost-button wide" onclick="v3StartProcessing(true)">直接使用完整录音</button><button class="danger-link" onclick="v3DeleteCurrentRecording()">删除这条录音</button>`; };

  views.importaudio = () => `<div class="import-page"><div class="page-intro"><span class="eyebrow-v3">LOCAL AUDIO</span><h1>导入课堂录音</h1><p>文件仅用于生成本次课堂内容，上传前请确认已获得必要授权。</p></div><div class="upload-rules"><b>上传要求</b><ul><li>格式：M4A、MP3、WAV、AAC</li><li>大小：单个文件不超过 200 MB</li><li>建议：时长不超过 3 小时，声音清晰且内容完整</li></ul></div><label class="upload-zone">${icon('upload')}<b>选择音频文件</b><span>从微信聊天或手机文件中选择</span><input type="file" accept=".m4a,.mp3,.wav,.aac,audio/*" onchange="chooseImportFile(this)"></label><div id="import-result">${selectedImport ? `<div class="file-result success"><b>✓ 文件校验通过</b><span>${esc(selectedImport.name)} · ${fileSize(selectedImport.size)}</span></div>` : ''}</div><label class="field-label">保存到课程</label>${courseSelect('import-course')}<div class="import-actions"><button id="import-next" class="primary wide" ${selectedImport ? '' : 'disabled'} onclick="confirmImport()">下一步</button><button class="ghost-button wide" onclick="useDemoImport()">使用示例文件体验</button></div></div>`;

  views.importmaterial = () => { const imageMode = materialKind === 'image'; const accept = imageMode ? '.jpg,.jpeg,.png,.heic,image/*' : '.pdf,.doc,.docx,.ppt,.pptx'; return `<div class="import-page"><div class="page-intro"><span class="eyebrow-v3">CLASS MATERIAL</span><h1>导入课堂资料</h1><p>补充课堂板书、PPT 照片或老师发放的课件，和录音笔记一起整理。</p></div><div class="material-tabs"><button class="${imageMode ? 'on' : ''}" onclick="openMaterialImport('image')">课堂照片</button><button class="${imageMode ? '' : 'on'}" onclick="openMaterialImport('document')">课件文件</button></div><div class="upload-rules"><b>${imageMode ? '照片要求' : '文件要求'}</b><ul>${imageMode ? '<li>格式：JPG、PNG、HEIC</li><li>一次最多 9 张，单张不超过 10 MB</li><li>请保证文字清晰、画面端正，避免反光遮挡</li>' : '<li>格式：PDF、DOC、DOCX、PPT、PPTX</li><li>单个文件不超过 50 MB</li><li>扫描版 PDF 将按图片识别，处理时间可能更长</li>'}</ul></div><label class="upload-zone">${icon(imageMode ? 'file' : 'folder')}<b>${imageMode ? '选择课堂照片' : '选择课件文件'}</b><span>${imageMode ? '从相册或微信聊天中选择' : '从微信聊天或手机文件中选择'}</span><input type="file" ${imageMode ? 'multiple' : ''} accept="${accept}" onchange="chooseMaterialFile(this)"></label><div id="material-result">${selectedMaterial ? `<div class="file-result success"><b>✓ ${imageMode ? `${selectedMaterial.files.length} 张照片` : '课件文件'}校验通过</b><span>${selectedMaterial.files.map(item => esc(item.name)).join('、')}</span></div>` : ''}</div><label class="field-label">保存到课程</label>${courseSelect('material-course')}<div class="import-actions"><button id="material-next" class="primary wide" ${selectedMaterial ? '' : 'disabled'} onclick="confirmMaterial()">下一步</button><button class="ghost-button wide" onclick="useDemoMaterial()">使用示例${imageMode ? '照片' : '课件'}体验</button></div></div>`; };

  views.processing = () => { const current = lesson(); processingStep = current?.processingStep ?? processingStep; const source = current?.source || '录音卡'; const steps = source === '图片资料' ? ['上传并校验照片','识别图片文字与版面','生成结构化笔记','关联笔记与原图片'] : source === '课件文件' ? ['上传并校验课件','解析页面与文本结构','生成结构化笔记','关联笔记与课件页'] : ['上传并校验音频','识别课堂语音','生成结构化笔记','建立原文索引']; return `<div class="processing-page"><div class="ai-orbit">✦<i></i></div><span class="status-chip">${processingStep < 4 ? '后台处理中' : '整理完成'}</span><h1>${processingStep < 4 ? '正在整理这堂课' : '课堂笔记已生成'}</h1><p>${esc(currentName())}</p><div class="process-card">${steps.map((item, index) => `<div class="process-item ${index < processingStep ? 'done' : index === processingStep ? 'active' : ''}"><span>${index < processingStep ? '✓' : index + 1}</span><div><b>${item}</b><small>${index < processingStep ? '已完成' : index === processingStep ? '处理中…' : '等待中'}</small></div></div>`).join('')}</div><div class="notice-line">你可以离开此页。再次进入时会继续显示这条课时的处理进度。</div><button class="primary wide" ${processingStep < 4 ? 'disabled' : ''} onclick="go('notes')">查看课堂笔记</button><button class="ghost-button wide" onclick="go('home')">返回首页</button></div>`; };

  views.materialsource = () => { const source = lesson()?.source; const files = lesson()?.sourceFiles || [{ name: source === '课件文件' ? '课堂课件.pdf' : '课堂板书_01.jpg' }]; return `<div class="page-intro"><span class="eyebrow-v3">SOURCE MATERIAL</span><h1>课堂资料原文</h1><p>${esc(currentName())} · ${source === '课件文件' ? '课件解析' : '图片 OCR'}</p></div><div class="source-preview"><span>${source === '课件文件' ? '第 06 页' : '照片 1 / ' + files.length}</span><div class="source-paper"><b>核心概念与应用条件</b><i></i><i></i><i class="short"></i><em>${source === '课件文件' ? 'PPT / PDF 页面预览' : '课堂板书照片预览'}</em></div></div><div class="source-extract"><div class="row"><b>识别文字</b><span class="pill">引用来源</span></div><p>本节课先介绍核心概念，再结合课堂案例讨论不同条件下的应用方式。</p><small>AI 识别结果可能有误，请以原始资料为准。</small></div><div class="source-file-list">${files.map((file, index) => `<button><span>${index + 1}</span><b>${esc(file.name)}</b><i>${index === 0 ? '当前' : '查看'}</i></button>`).join('')}</div>`; };

  views.evidence = () => {
    const data = v3EvidenceData();
    const segments = transcriptSegments();
    return `<div class="evidence-page-head"><span class="eyebrow-v3">TRACEABLE AI NOTE</span><h1>笔记生成依据</h1><p>${esc(currentName())} · ${data.label}</p></div><section class="evidence-result-card"><span>AI 整理结果</span><h2>${data.title}</h2><p>${data.note}</p><button class="support-score" onclick="v3MetricInfo('support')" aria-label="查看依据覆盖度说明"><b>${data.confidence}%</b><small>依据覆盖度 ⓘ</small></button></section><div class="evidence-section-title"><div><b>关联课堂原文</b><span>按笔记生成时的引用顺序排列</span></div><em>${data.indices.length} 个片段</em></div><div class="evidence-trace-list">${data.indices.map((index, position) => { const segment = segments[index]; return `<article><span class="trace-order">${position + 1}</span><button onclick="v3OpenTranscriptSegment(${index})"><div><b>${formatTime(segment.start)}–${formatTime(segment.end)}</b><em onclick="event.stopPropagation();v3MetricInfo('transcript')" role="button" tabindex="0">${segment.speaker} · 置信度 ${segment.confidence}% ⓘ</em></div><p>${esc(segment.text)}</p><small>定位原文并回听 ›</small></button></article>`; }).join('')}</div><section class="ai-reasoning-card"><div><span>✦</span><div><b>AI 如何生成这段笔记</b><small>这是整理步骤，不代表老师原话</small></div></div><ol>${data.logic.map(item => `<li>${item}</li>`).join('')}</ol></section><div class="evidence-boundary"><b>依据边界</b><p>${evidenceType === 'inference' ? '该内容由 AI 结合课堂上下文推断，老师未直接给出完整结论，建议回听原文后使用。' : '笔记经过压缩和改写，不等同于老师逐字原话；重要内容请结合原始录音核对。'}</p></div><button class="evidence-back-button wide" onclick="go('notes')">← 返回课堂笔记</button>`;
  };

  views.transcript = () => { const segments = transcriptSegments(); const active = segments[transcriptIndex] || segments[0]; return `<div class="transcript-page-head"><span class="eyebrow-v3">AUDIO & TRANSCRIPT</span><h1>课堂录音与转写</h1><p>${esc(currentName())}</p></div><section class="player-card-v3"><div class="player-title"><div><span>原始课堂录音</span><b>45:00 · M4A</b></div><span class="audio-quality">清晰度良好</span></div><div class="waveform-v3" aria-hidden="true">${Array.from({length:54},(_,i)=>`<i class="${i < playerSeconds / 50 ? 'played' : ''}" style="height:${9 + (i * 7 % 24)}px"></i>`).join('')}</div><input id="audio-range" type="range" min="0" max="2700" value="${playerSeconds}" oninput="playerSeconds=Number(this.value);document.querySelector('#play-time').textContent=formatTime(playerSeconds)" aria-label="录音播放进度"><div class="player-controls"><button class="rate-button" onclick="v3SetRate()">${playbackRate}×</button><button class="skip-button" onclick="playerSeconds=Math.max(0,playerSeconds-10);render()">−10</button><button class="main-play" onclick="v3TogglePlayback()">${playerOn ? 'Ⅱ' : '▶'}</button><button class="skip-button" onclick="playerSeconds=Math.min(2700,playerSeconds+10);render()">+10</button><div class="player-time"><b id="play-time">${formatTime(playerSeconds)}</b><span>/ 45:00</span></div></div></section><div class="transcript-summary"><div><span>转写完成度</span><b>100%</b></div><button onclick="v3MetricInfo('transcript')" aria-label="查看转写置信度说明"><span>平均置信度 ⓘ</span><b>94%</b></button><div><span>转写可能有误</span><b>1 句</b></div></div><button class="confidence-explain-link" onclick="v3MetricInfo('transcript')">什么是转写置信度？</button><button class="enhancement-card" onclick="sheet('课堂语音优化','<div class=\'enhancement-list\'><span>✓ 教师口音与方言普通话化</span><span>✓ 课程专业术语上下文识别</span><span>✓ 教室噪音与回声抑制</span><span>✓ 远距离人声增强</span></div><p class=\'sheet-copy\'>优化结果仍可能存在误差，重要内容建议结合原始音频核对。</p>')"><span>✦</span><div><b>课堂语音优化已启用</b><small>口音 · 术语 · 噪音 · 远距离收音</small></div><i>›</i></button><div class="transcript-section-title"><div><b>逐句转写</b><span>点击句子即可定位对应音频</span></div><button onclick="v3CorrectTranscript(${transcriptIndex})">校正当前句</button></div><div class="sentence-timeline">${segments.map((segment,index)=>`<article class="transcript-sentence ${index === transcriptIndex ? 'active' : ''} ${segment.confidence < 90 ? 'uncertain' : ''}" onclick="v3SeekTranscript(${index})"><div class="time-rail"><b>${formatTime(segment.start)}</b><span>${formatTime(segment.end)}</span><i></i></div><div class="sentence-body"><div class="speaker-line"><span>${segment.speaker}</span><em onclick="event.stopPropagation();v3MetricInfo('transcript')" role="button" tabindex="0">${segment.confidence}% ⓘ</em>${segment.confidence < 90 ? '<strong onclick="event.stopPropagation();v3MetricInfo(\'transcript\')" role="button" tabindex="0">转写可能有误</strong>' : ''}</div><p>${esc(segment.text)}</p><div class="sentence-meta"><span>${segment.tag}</span><button onclick="event.stopPropagation();v3CorrectTranscript(${index})">校正</button></div></div></article>`).join('')}</div><div class="transcript-footnote">转写文本经过课堂场景优化；方言会尽量转换为自然普通话表达，原始音频始终保留用于核对。</div>`; };

  views.lesson = () => { const item = lesson(); if (!item) return v2Empty('请选择一个课时', "go('course')", '返回课程'); const material = ['图片资料', '课件文件'].includes(item.source); const sourceTitle = material ? '课堂资料' : '课程录音'; const sourceCopy = material ? `${item.sourceFiles?.length || 1} 个文件 · 查看原资料与识别文字` : (item.clip ? `已剪辑 ${item.clip.start}–${item.clip.end}` : '查看录音与原始转写'); const sourceAction = material ? "go('materialsource')" : "go('transcript')"; const noteAction = item.ready ? "go('notes')" : "go('processing')"; const reviewAction = item.ready ? "go('review')" : "toast('生成笔记后可查看')"; const examAction = item.ready ? "go('exam')" : "toast('生成笔记后可练习')"; return `<div class="greeting">${esc(course().name)}</div><h2 style="font-size:23px">${esc(item.name)}</h2><p class="sub">编辑于 ${v2FormatDate(item.editedAt)} · 来源：${esc(item.source || '录音卡')}</p><div class="banner">${material ? '从课堂资料提取内容，并保留原图片或课件页作为笔记依据。' : '从课堂录音开始，逐步形成自己的复习资料。'}</div><div class="step-list"><div class="step" role="button" tabindex="0" onclick="${sourceAction}"><span class="step-num">${icon(material ? 'file' : 'mic')}</span><div class="step-main"><h3>${sourceTitle}</h3><p>${sourceCopy}</p></div><span class="step-status">查看 ›</span></div><div class="step" role="button" tabindex="0" onclick="${noteAction}"><span class="step-num">${icon('spark')}</span><div class="step-main"><h3>AI 摘要与结构化笔记</h3><p>概要、四类要点、概念解释与课堂案例</p></div><span class="step-status">${item.ready ? '查看 ›' : '生成中'}</span></div><div class="step" role="button" tabindex="0" onclick="${reviewAction}"><span class="step-num">${icon('book')}</span><div class="step-main"><h3>重点与复习建议</h3><p>重点速览、复习清单与复习顺序</p></div><span class="step-status">${item.ready ? '查看 ›' : '待生成'}</span></div><div class="step" role="button" tabindex="0" onclick="${examAction}"><span class="step-num">${icon('file')}</span><div class="step-main"><h3>课后测试</h3><p>完成练习，检查知识掌握情况</p></div><span class="step-status">${item.ready ? '查看 ›' : '待生成'}</span></div></div>`; };

  views.knowledgeedit = () => { const item = knowledgeDraft || v3KnowledgeItem(editingKnowledgeKey); const sourceMap = { examMove: 2, examImpact: 3, confuse: 2, memory: 1 }; const segment = transcriptSegments()[sourceMap[editingKnowledgeKey] ?? 0]; return `<div class="page-intro"><span class="eyebrow-v3">EDIT NOTE</span><h1>校正知识笔记</h1><p>${esc(currentName())} · ${item.type}</p></div><div class="edit-source-status"><span>AI 生成内容</span><b>保存后标记为“用户已校正”</b></div><label class="field-label" for="knowledge-edit-content">课堂摘要</label><textarea id="knowledge-edit-content" class="field knowledge-edit-area" maxlength="500" oninput="v3UpdateKnowledgeDraft()">${esc(item.content)}</textarea><label class="field-label" for="knowledge-edit-remark">补充我的备注</label><textarea id="knowledge-edit-remark" class="field" rows="4" maxlength="200" placeholder="记录自己的理解、疑问或课堂补充" oninput="v3UpdateKnowledgeDraft()">${esc(item.remark)}</textarea><button class="knowledge-source-callout" onclick="v3CompareKnowledgeSource()">${icon('clock')}<span><b>对照录音原文 · ${formatTime(segment.start)}</b><small>根据课堂原文补充或校正自己的理解</small></span><i>›</i></button><div class="edit-boundary-tip">修改只影响当前课时的个人笔记，不会覆盖录音原文与转写内容。</div><div class="bottom-action"><button class="secondary" onclick="v3CancelKnowledgeEdit()">取消</button><button class="primary" onclick="v3SaveKnowledgeEdit()">保存修改</button></div>`; };

  views.notes = () => { const data = v2Study(); const reviewState = v3ReviewState(data); const material = ['图片资料', '课件文件'].includes(lesson()?.source); const sourceLabel = material ? '课堂资料' : '课堂录音'; const reviewDone = Array.isArray(data.reviewDone) ? data.reviewDone : []; const examMove = v3KnowledgeItem('examMove'); const examImpact = v3KnowledgeItem('examImpact'); const confuse = v3KnowledgeItem('confuse'); const memory = v3KnowledgeItem('memory'); const editBadge = item => item.edited ? '<span class="user-corrected-badge">用户已校正</span>' : ''; const remark = item => item.remark ? `<div class="user-note-inline"><b>我的备注</b><p>${esc(item.remark)}</p></div>` : ''; const sourceButton = index => { const segment = transcriptSegments()[index]; return `<button class="source-link" onclick="v3OpenTranscriptSegment(${index})">${material ? '查看原资料' : `原文 ${formatTime(segment.start)}`} ›</button>`; }; const sections = `<div class="note-section-tabs"><button class="${noteSection === 'summary' ? 'on' : ''}" onclick="v3SetNoteSection('summary')">课程概要</button><button class="${noteSection === 'review' ? 'on' : ''}" onclick="v3SetNoteSection('review')">怎么复习</button><button class="${noteSection === 'knowledge' ? 'on' : ''}" onclick="v3SetNoteSection('knowledge')">知识清单</button></div>`; let content = '';
    if (noteSection === 'summary') content = `<section class="summary-hero-card ${focusedNoteKey === 'summary' ? 'focused-note' : ''}" data-note-key="summary"><div class="module-heading"><div><span class="module-index">01</span><b>课程概要</b></div><span class="ai-badge">AI 综合整理</span></div><h2>总需求—总供给模型：理解经济波动的共同框架</h2><p>本节课围绕总需求与总供给模型展开。总需求由消费、投资、政府购买和净出口构成；当居民信心、财政政策或外部需求变化时，总需求曲线会整体移动。分析经济冲击时，需要先判断变化来自需求侧还是供给侧，再结合曲线移动方向判断物价水平和实际产出的变化。</p><div class="summary-keyline"><span>一句话掌握</span><b>识别冲击来源 → 判断曲线移动 → 分析价格与产出</b></div><div class="module-actions"><button onclick="go('edit')">校正内容</button><button class="${reviewState.reviewList.includes('summary') ? 'review-added' : ''}" onclick="v3ToggleReviewItem('summary')">${reviewState.reviewList.includes('summary') ? '✓ 已加入复习清单' : '＋ 加入复习清单'}</button></div></section><section class="coverage-card"><div><b>综合 4 个关键片段</b><span>概要不对应单一原文时间点</span></div><strong>92%</strong><button onclick="v3SummaryEvidence()">查看生成依据 ›</button></section>`;
    if (noteSection === 'review') content = `<section class="note-module"><div class="module-heading"><div><span class="module-index">02</span><b>这节课怎么复习</b></div><span class="source-badge teacher">老师给出顺序</span></div><p class="module-intro">根据老师在课尾的复习建议，按下面三步完成一次闭环复习。</p><div class="review-steps-v3">${[['先画模型','不看笔记，画出 AD–AS 坐标轴、曲线和均衡点。'],['再判冲击','看到案例时，先判断影响需求侧还是供给侧。'],['最后验方向','检查物价水平与实际产出的变化方向是否一致。']].map(([title,copy],index)=>`<button class="review-step-v3 ${reviewDone.includes(index) ? 'done' : ''}" onclick="v3ToggleReviewStep(${index})"><span>${reviewDone.includes(index) ? '✓' : index + 1}</span><div><b>${title}</b><p>${copy}</p></div></button>`).join('')}</div><div class="module-actions"><button class="source-link" onclick="v3OpenEvidence('review')">查看生成依据 ›</button><button onclick="go('exam')">开始练习</button></div></section><div class="review-progress"><span>复习进度</span><div><i style="width:${reviewDone.length / 3 * 100}%"></i></div><b>${reviewDone.length}/3</b></div>`;
    if (noteSection === 'knowledge') content = `<section class="knowledge-module exam-module"><div class="module-heading"><div><span class="module-index">03</span><b>高频考点</b></div><span class="source-badge teacher">老师明确强调</span></div><article class="${focusedNoteKey === 'examMove' ? 'focused-note' : ''}" data-note-key="examMove"><div><span>优先级 1</span><b>${esc(examMove.title)}</b>${editBadge(examMove)}</div><p>${esc(examMove.content)}</p>${remark(examMove)}<div class="evidence-line">综合 2 处课堂原文 <span><button class="source-link" onclick="v3OpenEvidence('exam')">查看生成依据 ›</button><button class="knowledge-edit-link" onclick="v3OpenKnowledgeEdit('examMove')">编辑校正</button><button class="knowledge-edit-link ${reviewState.reviewList.includes('examMove') ? 'review-added' : ''}" onclick="v3ToggleReviewItem('examMove')">${reviewState.reviewList.includes('examMove') ? '✓ 已加入' : '＋ 复习清单'}</button></span></div></article><article class="${focusedNoteKey === 'examImpact' ? 'focused-note' : ''}" data-note-key="examImpact"><div><span>AI 推断</span><b>${esc(examImpact.title)}</b>${editBadge(examImpact)}</div><p>${esc(examImpact.content)}</p>${remark(examImpact)}<div class="evidence-line">AI 结合 2 处原文推断 <span><button class="source-link" onclick="v3OpenEvidence('inference')">查看生成依据 ›</button><button class="knowledge-edit-link" onclick="v3OpenKnowledgeEdit('examImpact')">编辑校正</button><button class="knowledge-edit-link ${reviewState.reviewList.includes('examImpact') ? 'review-added' : ''}" onclick="v3ToggleReviewItem('examImpact')">${reviewState.reviewList.includes('examImpact') ? '✓ 已加入' : '＋ 复习清单'}</button></span></div></article></section><section class="knowledge-module confuse-module ${focusedNoteKey === 'confuse' ? 'focused-note' : ''}" data-note-key="confuse"><div class="module-heading"><div><span class="module-index">04</span><b>易错易混点</b>${editBadge(confuse)}</div><span class="source-badge teacher">老师明确强调</span></div><h3 class="knowledge-item-title">${esc(confuse.title)}</h3><p class="module-intro">${esc(confuse.content)}</p>${remark(confuse)}<div class="compare-box"><div><span>沿曲线移动</span><b>物价水平变化</b><p>曲线本身不变，经济在同一条 AD 曲线上移动。</p></div><div><span>曲线整体移动</span><b>需求构成变化</b><p>C、I、G 或 NX 改变，整条 AD 曲线左右移动。</p></div></div><div class="memory-warning">AI 记忆辅助：先看“物价变了”，还是“需求构成变了”。</div><div class="module-actions"><button class="source-link" onclick="v3OpenEvidence('confuse')">查看 2 处生成依据 ›</button><button onclick="v3OpenKnowledgeEdit('confuse')">编辑校正</button><button class="${reviewState.reviewList.includes('confuse') ? 'review-added' : ''}" onclick="v3ToggleReviewItem('confuse')">${reviewState.reviewList.includes('confuse') ? '✓ 已加入复习清单' : '＋ 加入复习清单'}</button></div></section><section class="knowledge-module memory-module ${focusedNoteKey === 'memory' ? 'focused-note' : ''}" data-note-key="memory"><div class="module-heading"><div><span class="module-index">05</span><b>记忆知识点</b>${editBadge(memory)}</div><span class="source-badge ai">老师讲解＋AI 记忆辅助</span></div><div class="formula-card"><span>${esc(memory.title)}</span><b>${esc(memory.content)}</b></div>${remark(memory)}<div class="memory-hook"><span>AI 记忆线索</span><p>“消费投资加政府，再看出口减进口。”口诀由 AI 生成，不属于老师原话。</p></div><div class="module-actions">${sourceButton(1)}<button onclick="v3OpenKnowledgeEdit('memory')">编辑校正</button><button class="${reviewState.reviewList.includes('memory') ? 'review-added' : ''}" onclick="v3ToggleReviewItem('memory')">${reviewState.reviewList.includes('memory') ? '✓ 已加入复习清单' : '＋ 加入复习清单'}</button></div></section>`;
    return `<div class="notes-v3-head"><div><span>${esc(course().name)} · AI NOTES</span><h1>${esc(v2LessonName())}</h1><p>由${sourceLabel}整理 · AI 生成内容可校正</p></div><button onclick="go('edit')">${icon('edit')}</button></div><button class="note-generation-status" onclick="v3NoteGenerationInfo()"><span>✦</span><div><b>已根据课堂内容生成 5 个模块</b><small>老师明确强调的内容已优先标记</small></div><i>›</i></button>${sections}${content}<div class="notes-bottom-actions"><button onclick="go('transcript')" ${material ? 'style="display:none"' : ''}>录音与转写</button><button onclick="go('review')">进入复习计划 →</button></div>`; };
  views.edit = () => { const data = v2Study(); const material = ['图片资料', '课件文件'].includes(lesson()?.source); return `<div class="note-edit-page"><div class="greeting">校正知识笔记 <span>对照${material ? '原资料' : '原文'}，更有依据</span></div><h2 style="font-size:23px">校正知识笔记</h2><p class="sub">修改会保留在当前课时，并可随时回看${material ? '原资料' : '原文'}。</p><label class="label" for="note-edit">课堂摘要</label><textarea id="note-edit" class="field edit-area">${esc(data.note)}</textarea><label class="label" for="note-remark">补充我的备注</label><textarea id="note-remark" class="field" rows="3" placeholder="记录自己的理解或疑问">${esc(data.remark)}</textarea><button class="summary-source-callout" onclick="${material ? "go('materialsource')" : 'openSource(0)'}">${icon('clock')}<span><b>${material ? '对照课堂原资料' : '对照录音原文 · 02:18'}</b><small>${material ? '查看引用的图片、课件页和识别文字' : '根据课堂原文补充或校正自己的理解'}</small></span><i>›</i></button><div class="bottom-action page-bottom-actions"><button class="secondary" onclick="v2ConfirmCancelEdit()">取消</button><button class="primary" onclick="v3SaveSummaryNote()">保存修改</button></div></div>`; };
  window.openSource = function (index) {
    if (['图片资料', '课件文件'].includes(lesson()?.source)) return go('materialsource');
    const mapped = [0, 2, 3, 4][index] ?? 0;
    transcriptIndex = mapped;
    playerSeconds = transcriptSegments()[mapped].start;
    go('transcript');
  };
  window.startPlayerTimer = function () {
    timer = setInterval(() => {
      playerSeconds = Math.min(2700, playerSeconds + playbackRate);
      const time = document.querySelector('#play-time');
      const range = document.querySelector('#audio-range');
      if (time) time.textContent = formatTime(Math.floor(playerSeconds));
      if (range) range.value = playerSeconds;
      if (playerSeconds >= 2700) { playerOn = false; clearInterval(timer); }
    }, 1000);
  };

  const originalHomeView = views.home;
  views.home = () => {
    if (!state.logged) return originalHomeView();
    v3EnsureOrganization();
    if (!state.courses.length) return `<div class="first-course-home"><div class="greeting"><span>今天，也学有所获</span><span>LEARN A LITTLE MORE</span></div><h1>让课堂知识<br>有迹可循。</h1><section class="first-course-hero"><div><h2>好好听课，笔记交给芋泥。</h2><p>录下课堂，整理重点，轻松复习</p></div><span class="first-course-art">${icon('file')}</span></section><div class="section-heading first-course-heading"><div><b>我的课程</b><span>0 门课程</span></div></div><div class="empty first-course-empty"><span class="empty-state-icon">${icon('book')}</span><b>还没有课程</b><p>创建第一门课程后，每次上课的录音会自动归档到对应课程里。</p><button class="primary" onclick="newCourse()">＋ 创建我的第一门课</button></div><button class="device-status first-course-device ${state.bound ? 'connected' : ''}" onclick="openDeviceFrom('home')"><span class="device-dot"></span><div><b>${state.bound ? '录音卡已连接' : '连接你的录音卡'}</b><small>${state.bound ? '电量 86% · 有 1 条录音待回传' : '绑定后可同步课堂录音'}</small></div><i>›</i></button></div>`;
    return `<div class="home-head"><div><span class="eyebrow-v3">MY LEARNING SPACE</span><h1>${esc(state.profile?.nickname || '小芋同学')}，继续学习吧</h1></div><button class="notify-button" onclick="go('notifications')">●</button></div><button class="device-status ${state.bound ? 'connected' : ''}" onclick="openDeviceFrom('home')"><span class="device-dot"></span><div><b>${state.bound ? '录音卡已连接' : '连接录音卡'}</b><small>${state.bound ? '电量 86% · 有 1 条录音待回传' : '绑定后可同步课堂录音'}</small></div><i>›</i></button><div class="organize-toolbar home-organize"><div><button class="${courseViewFilter === 'all' ? 'on' : ''}" onclick="v3SetCourseFilter('all')">全部课程</button><button class="${courseViewFilter === 'pinned' ? 'on' : ''}" onclick="v3SetCourseFilter('pinned')">已置顶</button></div><select onchange="v3SetCourseSort(this.value)" aria-label="课程排序"><option value="edited" ${courseSortMode === 'edited' ? 'selected' : ''}>最近编辑</option><option value="created" ${courseSortMode === 'created' ? 'selected' : ''}>最近创建</option><option value="manual" ${courseSortMode === 'manual' ? 'selected' : ''}>自定义排序</option></select></div><div class="section-heading"><div><b>我的课程</b><span>${courseCount()} 门课程 · 置顶优先显示</span></div><button onclick="newCourse()">＋ 新建</button></div><div id="course-cards-v3" class="course-list-v3">${v3CourseCards()}</div>`;
  };

  views.course = () => {
    v3EnsureOrganization();
    const manyLessons = course().lessons.length >= 8;
    return `<div class="course-header-v3"><div class="course-cover ${course().color || ''}">${course().icon}</div><div><span>MY COURSE</span><h1>${esc(course().name)}</h1><p>${course().lessons.length} 个课时 · ${course().lessons.filter(item => item.ready).length} 份笔记</p></div><div class="course-header-actions"><button class="pin-button ${course().pinned ? 'on' : ''}" onclick="v3ToggleCoursePin(${state.course})" aria-label="${course().pinned ? '取消置顶' : '置顶课程'}">${course().pinned ? '★' : '☆'}</button><button class="course-more-button" onclick="v3OpenCourseMenu()" aria-label="管理课程">•••</button></div></div><button class="primary wide add-record-button" onclick="go('capture')">＋ 添加课堂记录</button>${manyLessons ? `<div class="course-search-v3">${icon('search')}<input value="${esc(v2Query)}" oninput="v3SearchLessons(this.value)" placeholder="搜索这门课程的课时笔记">${v2Query ? '<button onclick="v3SearchLessons(\'\');render()">清除</button>' : ''}</div>` : ''}<div class="lesson-list-heading"><div><b>课时笔记</b><span>置顶内容优先${manyLessons ? ' · 可搜索课时' : ''}</span></div><div class="lesson-list-actions"><select onchange="v3SetLessonSort(this.value)" aria-label="课时排序"><option value="newest" ${lessonSortMode === 'newest' ? 'selected' : ''}>最近更新</option><option value="oldest" ${lessonSortMode === 'oldest' ? 'selected' : ''}>最早更新</option></select></div></div><div id="lesson-cards-v3">${v3LessonCards()}</div>`;
  };

  views.keypoints = () => { const items = []; state.courses.forEach((c, ci) => c.lessons.forEach((l, li) => { if (!l.ready) return; items.push({ c, ci, l, li, key: 'examMove', type: '老师明确强调', title: '曲线上的移动 vs. 整条曲线移动' }); items.push({ c, ci, l, li, key: 'confuse', type: '易错易混', title: '先判断物价变化，还是需求构成变化' }); })); return `<div class="page-hero compact"><span class="pill">AI 自动整理</span><h1>重点速览</h1><p>来自老师明确强调、AI 高频判断和易错内容，不需要手动标记。</p></div><div class="quick-point-list">${items.slice(0, 6).map(item => `<article><span>${item.type}</span><h3>${item.title}</h3><p>${esc(item.c.name)} · ${esc(item.l.name)}</p><button onclick="v3OpenReviewItem(${item.ci},${item.li},'${item.key}')">查看原笔记 ›</button></article>`).join('')}</div>`; };

  views.favorites = () => { const items = []; state.courses.forEach((c, ci) => c.lessons.forEach((l, li) => { const data = v3ReviewState(v2StudyOf(l)); data.reviewList.forEach(key => { const meta = v3ReviewItemMeta(key, data); items.push({ c, ci, l, li, key, meta, mastered: data.reviewMastered.includes(key) }); }); })); const visible = items.filter(item => reviewListFilter === 'mastered' ? item.mastered : !item.mastered); return `<div class="page-hero compact"><span class="pill">个人复习</span><h1>我的复习清单</h1><p>只保留你主动加入的内容，掌握后可归档或再次复习。</p></div><div class="review-list-tabs"><button class="${reviewListFilter === 'pending' ? 'on' : ''}" onclick="v3SetReviewListFilter('pending')">待复习 ${items.filter(item => !item.mastered).length}</button><button class="${reviewListFilter === 'mastered' ? 'on' : ''}" onclick="v3SetReviewListFilter('mastered')">已掌握 ${items.filter(item => item.mastered).length}</button></div>${visible.length ? `<div class="review-queue">${visible.map(item => `<article><div><span>${item.meta[0]} · ${item.meta[2]}</span><h3>${esc(item.meta[1])}</h3><p>${esc(item.c.name)} · ${esc(item.l.name)}</p></div><div><button onclick="v3OpenReviewItem(${item.ci},${item.li},'${item.key}')">查看原笔记</button><button onclick="v3ToggleMastered(${item.ci},${item.li},'${item.key}')">${item.mastered ? '重新复习' : '标记已掌握'}</button><button class="danger-text" onclick="v3RemoveReviewItem(${item.ci},${item.li},'${item.key}')">移出</button></div></article>`).join('')}</div>` : `<div class="empty v3-search-empty"><b>${reviewListFilter === 'mastered' ? '还没有已掌握内容' : '复习清单还是空的'}</b><p>${reviewListFilter === 'mastered' ? '完成复习后，可将内容标记为已掌握。' : '在课堂笔记中点击“加入复习清单”。'}</p><button class="primary" onclick="go('keypoints')">浏览重点速览</button></div>`}`; };

  views.review = () => `<div class="page-hero compact"><span class="pill">复习计划</span><h1>把重点，再过一遍</h1><p>先快速浏览系统整理的重点，再处理自己的复习清单。</p></div><div class="review-entry-grid"><button onclick="go('keypoints')"><span>01</span><b>重点速览</b><small>老师强调 · 高频考点 · 易错内容</small><i>›</i></button><button onclick="go('favorites')"><span>02</span><b>我的复习清单</b><small>待复习内容与掌握状态</small><i>›</i></button><button onclick="go('exam')"><span>03</span><b>课后测试</b><small>用练习检查知识掌握情况</small><i>›</i></button></div>`;

  views.notifications = () => `<div class="page-intro"><span class="eyebrow-v3">MESSAGES</span><h1>消息中心</h1><p>查看录音回传、笔记生成和设备状态提醒。</p></div><div class="message-list"><button onclick="go('notes')"><span class="message-icon success">✓</span><div><b>课堂笔记已生成</b><p>「第 3 课 · 课程知识与应用」已完成整理</p><small>今天 12:36</small></div><i>›</i></button><button><span class="message-icon">●</span><div><b>录音卡电量充足</b><p>当前电量 86%，可继续使用</p><small>今天 09:20</small></div></button></div>`;

  const oldMine = views.mine;
  views.mine = () => state.logged ? oldMine().replace('onclick="logout()"', 'onclick="logoutV3()"').replace(`<b>${v2AllMarked().length}</b><span>标记重点`, `<b>${v3ReviewCount()}</b><span>复习清单`).replace('重点汇总<small>回顾标记过的重点', '重点速览<small>AI 自动整理课堂重点').replace('★ 我的收藏<small>集中查看重要笔记', '＋ 我的复习清单<small>管理待复习与已掌握内容') : `<div class="guest-mine"><div class="guest-mine-content"><div class="guest-avatar">芋</div><h1>登录后使用完整功能</h1><p>同步课程、笔记与录音卡状态，换设备也能继续学习。</p></div><div class="guest-mine-actions"><button class="primary wide" onclick="go('login')">微信快捷登录</button><button class="ghost-button wide" onclick="go('sample')">体验示例课程</button></div></div>`;

  const originalAiView = views.ai;
  views.ai = () => {
    if (!state.courses.length) return `<div class="ai-page"><div class="page-intro"><h1>一起把知识学懂</h1><p>围绕课堂笔记回答，帮助你理解和复习。</p></div><div class="empty first-course-empty"><span class="empty-state-icon">${icon('book')}</span><b>还没有课程</b><p>先创建课程并添加课堂记录，生成笔记后就可以在这里提问。</p><button class="primary" onclick="go('home')">返回首页创建课程</button></div></div>`;
    let content = originalAiView();
    if (aiScope === 'course') {
      content = content.replace(/<select class="field" aria-label="选择问答课时"[\s\S]*?<\/select>/, '');
    }
    return `<div class="ai-page">${content.replace('<div class="chat-input">', '<div class="ai-chat-dock"><div class="chat-input">').replace('<p class="fine center">演示问答，仅用于体验引用与跳转；未接入 AI。</p>', '<p class="fine center">演示问答，仅用于体验引用与跳转；未接入 AI。</p></div>')}</div>`;
  };
  const originalExamView = views.exam;
  views.exam = () => `<div class="exam-page">${originalExamView()}</div>`;

  const originalPreview = preview;
  window.preview = function (target) {
    if (target === 'login') {
      location.href = `${location.pathname}?preview=login#login`;
      return;
    }
    originalPreview(target);
  };

  const originalCompleteLogin = completeLogin;
  window.completeLogin = function () {
    if (state.logged) return go('home');
    originalCompleteLogin();
    sampleMode = false;
    state.profile = state.profile || { nickname: '小芋同学', avatar: '芋', phone: '' };
    save();
    if (loginPreviewMode) history.replaceState(null, '', `${location.pathname}#home`);
  };

  const originalRender = render;
  window.render = function () {
    v3EnsureRuntimeState();
    if (state.logged && route === 'login' && !loginPreviewMode) route = 'home';
    if (!state.logged && personalRoutes.has(route)) route = 'login';
    if (!state.logged && lessonRoutes.has(route) && !sampleMode) route = 'sample';
    if ((route === 'course' || route === 'capture') && !state.courses.length) route = 'home';
    if (lessonRoutes.has(route) && !lesson()) route = state.courses.length ? 'course' : 'home';
    originalRender();
    document.body.classList.toggle('is-guest', !state.logged);
    const titleMap = { sample: '示例课程', importaudio: '导入音频', importmaterial: '导入课堂资料', materialsource: '课堂资料原文', recordingdetail: '录音详情', notifications: '消息中心' };
    if (titleMap[route]) document.querySelector('#page-title').textContent = titleMap[route];
    if (route === 'home') document.querySelector('#page-title').textContent = state.logged ? '芋泥课堂笔记' : '芋泥';
    document.querySelector('#back').style.visibility = ['home', 'ai', 'mine'].includes(route) ? 'hidden' : 'visible';
  };

  window.goBack = function () {
    const fallback = { sample: 'home', importaudio: 'capture', importmaterial: 'capture', materialsource: 'notes', recordingdetail: 'device', notifications: 'home', edit: 'notes', transcript: 'notes', notes: 'lesson', review: 'lesson', keypoints: 'mine', favorites: 'mine', exam: 'review', results: 'lesson', transfer: 'recordingdetail', clip: 'capture', processing: 'home', capture: 'home', device: v2DeviceSource || 'home', lesson: route === 'lesson' && !state.logged ? 'sample' : 'course', course: 'home', account: 'mine', bindphone: 'account', settings: 'mine', help: 'mine', feedback: 'help', about: 'mine', policy: state.logged ? 'about' : 'login', privacy: state.logged ? 'about' : 'login', login: 'home' };
    goWithoutHistory(historyStack.pop() || fallback[route] || 'home');
  };

  const originalGo = go;
  window.go = function (target) {
    if (target !== 'sample' && target !== 'lesson' && sampleMode) sampleMode = false;
    if (!v3CanOpenRoute(target)) return;
    originalGo(target);
  };

  startProcessingTimer = function () {
    const current = lesson();
    if (!current || current.ready) return;
    processingStep = current.processingStep || 0;
    current.processingStatus = 'processing';
    timer = setInterval(() => {
      processingStep = Math.min(4, processingStep + 1);
      current.processingStep = processingStep;
      if (processingStep === 4) {
        clearInterval(timer);
        current.ready = true;
        current.processingStatus = 'done';
      }
      save();
      if (route === 'processing' && lesson()?.id === current.id) render();
    }, 900);
  };

  v3EnsureRuntimeState();
  if (state.logged && route === 'login' && !loginPreviewMode) route = 'home';
  render();
})();
