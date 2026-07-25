import { projects, undefinedProjects } from './projects.js';
import { businesses } from './businesses.js';
import fs from 'fs';

function calcProgress(tasks) {
  const entries = Object.entries(tasks);
  if (entries.length === 0) return 0;
  const done = entries.filter(([, t]) => t.done).length;
  return Math.round((done / entries.length) * 100);
}

function render() {
  const all = [...projects, ...undefinedProjects];
  const totalDone = all.reduce((acc, p) => acc + Object.values(p.tasks).filter(t => t.done).length, 0);
  const totalTasks = all.reduce((acc, p) => acc + Object.keys(p.tasks).length, 0);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Portfolio Console</title>
<style>
* { box-sizing: border-box; }
body { font-family: -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
h1 { color: #333; }
h2 { color: #555; margin-top: 24px; }
table { border-collapse: collapse; width: 100%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; white-space: nowrap; }
th { background: #4a90d9; color: #fff; }
tr:nth-child(even) { background: #f9f9f9; }
.progress-bar { display: inline-block; width: 100px; height: 12px; background: #e0e0e0; border-radius: 6px; overflow: hidden; vertical-align: middle; }
.progress-fill { height: 100%; background: #4caf50; border-radius: 6px; }
.section { margin: 24px 0; }
.project-card { background: #fff; padding: 16px; margin: 12px 0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.project-card h3 { margin: 0 0 8px; }
.task-list { list-style: none; padding: 0; }
.task-list li { padding: 4px 0; }
.done { color: #4caf50; }
.pending { color: #f44336; }
.meta { color: #666; font-size: .85em; }
.footer { margin-top: 24px; padding: 12px; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.1); color: #666; font-size: .9em; }
@media (max-width: 768px) {
  table { font-size: .85em; }
  th, td { padding: 6px 8px; }
  .progress-bar { width: 60px; }
}
@media (max-width: 375px) {
  body { padding: 10px; }
  table { font-size: .7em; display: block; overflow-x: auto; }
  th, td { padding: 4px 4px; white-space: normal; word-break: break-word; }
}
</style>
</head>
<body>
<h1>Portfolio Console</h1>
<p>Total projects: ${all.length} | Defined: ${projects.length} | Undefined: ${undefinedProjects.length}</p>
<p class="meta">Task-based progress calculation with verifiable evidence</p>
<table>
<tr><th>#</th><th>Project</th><th>Progress</th><th>Tasks</th><th>Done</th><th>Mode</th><th>Milestone</th></tr>
${all.map((p, i) => {
  const pct = calcProgress(p.tasks);
  const taskCount = Object.keys(p.tasks).length;
  const doneCount = Object.values(p.tasks).filter(t => t.done).length;
  return `<tr><td>${i + 1}</td><td>${p.name}</td><td><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div> ${pct}%</td><td>${taskCount}</td><td>${doneCount}</td><td>${p.developmentMode}</td><td>${p.currentMilestone.join(', ') || '\u2014'}</td></tr>`;
}).join('\n')}
</table>
<div class="section" id="defined-section">
<h2>Defined Projects</h2>
${projects.map(p => {
  const pct = calcProgress(p.tasks);
  return `<div class="project-card" data-project-id="${p.id}">
<h3>${p.name} (${pct}%) <span class="meta">${p.developmentMode}</span></h3>
<p>${p.description}</p>
<ul class="task-list">
${Object.entries(p.tasks).map(([id, t]) =>
  `<li class="${t.done ? 'done' : 'pending'}">${t.done ? '\u2705' : '\u274c'} ${id} \u2014 ${t.evidence || '(no evidence)'}</li>`
).join('\n')}
</ul>
<p class="meta">Milestone: ${p.currentMilestone.join(', ') || '\u2014'} | Future: ${p.futureRoadmap.join(', ') || '\u2014'} | Blockers: ${p.blockers.join(', ') || '\u2014'}</p>
</div>`;
}).join('\n')}
</div>
<div class="section" id="undefined-section">
<h2>Undefined Projects</h2>
${undefinedProjects.map(p =>
  `<div class="project-card" data-project-id="${p.id}"><h3>${p.name}</h3><p>${p.description}</p><p class="meta">Mode: ${p.developmentMode} \u2014 No defined tasks or evidence</p></div>`
).join('\n')}
</div>
<div class="footer">
<p>Progress calculated from completed tasks (${totalDone} of ${totalTasks}). No arbitrary stored progress percentage.</p>
<p>Each task requires verifiable evidence (Issue, PR, commit, comment). OPEN issues are not valid evidence for completed tasks.</p>
<p>Task-based progress — verifiable evidence required for every done task.</p>
</div>
</body>
</html>`;
  return html;
}

const html = render();
fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html generated');
