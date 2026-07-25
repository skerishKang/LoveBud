import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const REQUIRED_PROJECT_FIELDS = ['id', 'name', 'description', 'tasks', 'developmentMode', 'currentMilestone', 'futureRoadmap', 'blockers'];
const REQUIRED_TASK_FIELDS = ['done', 'evidence'];
const VALID_MODES = ['active-development', 'maintenance', 'draft-pr', 'planning', 'unknown'];

let errors = [];

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function loadProjects() {
  const filePath = path.join(rootDir, 'projects.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const wrapped = source.replace(/^export /gm, '') + '\n;globalThis.__result = [projects, undefinedProjects];';
  const script = new vm.Script(wrapped, { filename: 'projects.js' });
  const ctx = vm.createContext({
    console,
    globalThis: {},
    Array, Object, String, Number, Boolean, Math, JSON, Map, Set, RegExp, Date, Error, Symbol
  });
  script.runInContext(ctx);
  return ctx.globalThis.__result;
}

function validateProject(p, isDefined) {
  for (const field of REQUIRED_PROJECT_FIELDS) {
    assert(p[field] !== undefined, `${p.id}: missing field "${field}"`);
  }
  assert(typeof p.id === 'string', `${p.id}: id must be string`);
  assert(/^[a-z0-9-]+$/.test(p.id), `${p.id}: id must be lowercase kebab-case`);
  assert(typeof p.name === 'string', `${p.id}: name must be string`);
  assert(VALID_MODES.includes(p.developmentMode), `${p.id}: invalid developmentMode "${p.developmentMode}"`);
  assert(Array.isArray(p.currentMilestone), `${p.id}: currentMilestone must be array`);
  assert(Array.isArray(p.futureRoadmap), `${p.id}: futureRoadmap must be array`);
  assert(Array.isArray(p.blockers), `${p.id}: blockers must be array`);

  const taskIds = Object.keys(p.tasks);
  for (const tid of taskIds) {
    const task = p.tasks[tid];
    assert(typeof task === 'object', `${p.id}/${tid}: task must be object`);
    for (const f of REQUIRED_TASK_FIELDS) {
      assert(task[f] !== undefined, `${p.id}/${tid}: missing field "${f}"`);
    }
    assert(typeof task.done === 'boolean', `${p.id}/${tid}: done must be boolean`);
    assert(typeof task.evidence === 'string', `${p.id}/${tid}: evidence must be string`);
    if (task.done) {
      assert(task.evidence.length > 0, `${p.id}/${tid}: done task must have evidence`);
    }
  }

  if (isDefined) {
    assert(taskIds.length > 0, `${p.id}: defined project must have at least one task`);
  } else {
    assert(taskIds.length === 0, `${p.id}: undefined project must have zero tasks`);
  }
}

function main() {
  const [projects, undefinedProjects] = loadProjects();
  const all = [...projects, ...undefinedProjects];

  assert(all.length === 13, `must have exactly 13 projects, got ${all.length}`);
  assert(projects.length === 9, `must have 9 defined projects, got ${projects.length}`);
  assert(undefinedProjects.length === 4, `must have 4 undefined projects, got ${undefinedProjects.length}`);

  const seen = new Set();
  for (const p of all) {
    assert(!seen.has(p.id), `duplicate project id: ${p.id}`);
    seen.add(p.id);
  }

  for (const p of projects) {
    validateProject(p, true);
  }
  for (const p of undefinedProjects) {
    validateProject(p, false);
  }

  const totalTasks = all.reduce((acc, p) => acc + Object.keys(p.tasks).length, 0);
  const totalDone = all.reduce((acc, p) => acc + Object.values(p.tasks).filter(t => t.done).length, 0);
  assert(totalTasks > 0, 'must have at least one task across all projects');
  assert(totalDone <= totalTasks, 'done count must not exceed task count');

  if (errors.length > 0) {
    console.error(`VALIDATION FAILED: ${errors.length} error(s)`);
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('=== Node Structured Validation ===');
  console.log(`Projects: ${all.length} (defined ${projects.length}, undefined ${undefinedProjects.length})`);
  console.log(`Tasks: ${totalTasks} (done ${totalDone})`);
  console.log('Errors: 0');
  console.log('All validations passed');
}

main();
