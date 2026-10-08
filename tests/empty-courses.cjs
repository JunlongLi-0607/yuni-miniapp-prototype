const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');

// Execute the actual scripts and navigation handlers with isolated prototype storage.
function boot(saved) {
  const nodes = new Map();
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, { innerHTML: '', textContent: '', value: '', style: {}, classList: { toggle() {}, add() {}, remove() {} }, scrollTop: 0 });
    return nodes.get(key);
  };
  const store = new Map(saved ? [['yuni-prototype-v1', saved]] : []);
  const context = vm.createContext({
    console, URLSearchParams,
    location: { search: '', hash: '#home', pathname: '/' },
    document: { querySelector: node, querySelectorAll: () => [], body: node('body') },
    localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    addEventListener() {}, history: { replaceState() {} }
  });
  context.window = context;
  for (const file of ['app.js', 'v2.js', 'v3.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  return { run: code => vm.runInContext(code, context), node, store };
}

const app = boot();
app.run("state.logged=true;state.courses=[{name:'最后一门课程',icon:'册',lessons:[{name:'最后一个课时',ready:true}]}];state.course=0;state.lesson=0;go('course');v3DeleteLesson()");
assert.match(app.node('#screen').innerHTML, /还没有课时记录/);
app.run('v3DeleteCourse()');
assert.equal(app.run('route'), 'home');
assert.match(app.node('#screen').innerHTML, /还没有课程/);
assert.match(app.node('#screen').innerHTML, /创建我的第一门课/);
for (const route of ['ai', 'mine', 'home']) {
  app.run(`go('${route}')`);
  assert.equal(app.run('route'), route);
  assert.ok(app.node('#screen').innerHTML);
}
const restored = boot(app.store.get('yuni-prototype-v1'));
assert.match(restored.node('#screen').innerHTML, /还没有课程/);
restored.run("newCourse();document.querySelector('#course-name').value='重新创建';createCourse()");
assert.equal(restored.run('course().name'), '重新创建');
assert.match(restored.node('#screen').innerHTML, /还没有课时记录/);
console.log('PASS: delete last lesson/course, navigate all tabs, reload empty state, create course again');
