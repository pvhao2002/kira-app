export const meta = {
  name: 'plan-to-verify',
  description: 'dev-workflow: understand/plan → TDD execute → review/refactor theo nhóm file → verify + detect_changes → debt report',
  whenToUse: 'Implement một task end-to-end, có review + test + verify. Duyệt plan: chạy {task, planOnly:true}, rồi chạy lại {task, plan}',
  phases: [
    { title: 'Plan', model: 'opus' }, { title: 'Execute', model: 'sonnet' },
    { title: 'Review' }, { title: 'Refactor' }, { title: 'Verify' }, { title: 'Finish' },
  ],
}

// args: "task" | { task, plan?, planOnly? }
const opts = typeof args === 'string' ? { task: args } : (args ?? {})
const task = opts.task
if (!task) throw new Error('Truyền task qua args, vd: args: "thêm API X vào kira-gateway"')

const GROUP_SIZE = 4
const MAX_FIXES = 3 // dev-workflow: 3 lần sửa thất bại → dừng, báo bằng chứng
const NON_CODE = /\.(md|txt|lock|log|svg|png|jpe?g)$|package-lock\.json$|[\\/](generated|dist|build|target)[\\/]/i

const PLAN = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['bug', 'feature', 'improvement', 'refactor'] },
    plan: { type: 'string' },
    risks: { type: 'array', items: {
      type: 'object',
      properties: { symbol: { type: 'string' }, risk: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'] }, note: { type: 'string' } },
      required: ['symbol', 'risk'],
    } },
    questions: { type: 'array', items: { type: 'string' } },
    dirty: { type: 'array', items: { type: 'string' } },
  },
  required: ['type', 'plan', 'risks', 'questions', 'dirty'],
}
const EXEC = {
  type: 'object',
  properties: {
    files: { type: 'array', items: { type: 'string' } },
    tests: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['files', 'tests', 'summary'],
}
const FINDINGS = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: {
      type: 'object',
      properties: {
        file: { type: 'string' }, line: { type: 'number' }, severity: { type: 'string' },
        lens: { type: 'string', enum: ['correctness', 'over-engineering', 'merge-risk', 'missing-test'] },
        issue: { type: 'string' }, fix: { type: 'string' },
      },
      required: ['file', 'severity', 'lens', 'issue', 'fix'],
    } },
  },
  required: ['findings'],
}
const VERDICT = {
  type: 'object',
  properties: {
    passed: { type: 'boolean' }, command: { type: 'string' }, output: { type: 'string' },
    unexpectedChanges: { type: 'array', items: { type: 'string' } },
  },
  required: ['passed', 'command', 'output', 'unexpectedChanges'],
}
const DEBT = {
  type: 'object',
  properties: { debt: { type: 'array', items: { type: 'string' } } },
  required: ['debt'],
}
const INDEX_STEP = `Chạy "node .gitnexus/run.cjs status"; index stale thì chạy "node .gitnexus/run.cjs analyze --index-only" trước khi dùng graph.`
const DIRTY_STEP = `Chạy "git status --porcelain -uall" và đưa đường dẫn mọi file đang thay đổi/untracked vào "dirty".`

// 1. Plan — Step 0-3 dev-workflow, chỉ đọc; nếu đã có plan duyệt sẵn thì chỉ refresh index + chụp git status
phase('Plan')
const planned = opts.plan
  ? await agent(`${INDEX_STEP} ${DIRTY_STEP} Để "plan" rỗng, "risks"/"questions" rỗng, "type" theo task: "${task}".`,
      { phase: 'Plan', label: 'snapshot', model: 'opus', effort: 'low', schema: PLAN })
  : await agent(
      `Lập kế hoạch cho task: "${task}". KHÔNG sửa file. Làm theo skill dev-workflow, Step 0-3:
       0. ${INDEX_STEP}
       1. Phân loại "type" (bug/feature/improvement/refactor).
       2. Hiểu code trước khi quyết: bug → superpowers:systematic-debugging + gitnexus-debugging tìm root cause;
          feature/improvement → gitnexus-exploring tìm module, flow, helper có sẵn để tái dùng; refactor → gitnexus-refactoring
          (rename dùng GitNexus rename, không find-and-replace). Đọc AGENTS.override.md của module liên quan.
          Với MỌI symbol sẽ sửa: chạy impact upstream, ghi vào "risks"; UNKNOWN thì xác nhận bằng text search và ghi lại trong note.
       3. Thiết kế theo ponytail: cần không → đã có trong codebase → stdlib → platform → dependency đã cài → một dòng → code tối thiểu.
          Bug nhỏ (root cause rõ, 1-2 file): plan ngắn, sửa tại hàm dùng chung mà mọi caller đi qua. Refactor: giữ nguyên behavior.
       "plan": các task, mỗi task ghi symbol sửa + risk, file sẽ tạo/sửa, test sẽ viết (TDD), acceptance criteria, lệnh verify của module.
       "questions": chỉ câu hỏi thiết yếu mà repo không trả lời được (để rỗng nếu đủ rõ). ${DIRTY_STEP}`,
      { phase: 'Plan', model: 'opus', schema: PLAN })
if (!planned) throw new Error('Plan agent bị skip/lỗi — dừng workflow')
const plan = opts.plan ?? planned.plan
const highRisk = planned.risks.filter(r => r.risk === 'HIGH' || r.risk === 'CRITICAL')
if (highRisk.length) log(`⚠ Risk cao: ${highRisk.map(r => `${r.symbol} (${r.risk})`).join(', ')}`)
// Gate: plan phải được duyệt; câu hỏi mở hoặc risk HIGH/CRITICAL buộc dừng để user duyệt
if (!opts.plan && (opts.planOnly || planned.questions.length || highRisk.length))
  return { type: planned.type, plan, risks: planned.risks, questions: planned.questions, next: 'Trả lời câu hỏi/duyệt plan rồi chạy lại với args {task, plan}' }

// 2. Execute — Step 4, 1 agent duy nhất để tránh conflict khi sửa file
phase('Execute')
const exec = await agent(
  `Thực hiện đúng plan sau, không mở rộng scope:\n${plan}\n
   Mỗi task theo superpowers:test-driven-development: chạy gitnexus impact cho symbol nếu chưa có → viết test fail →
   xác nhận fail đúng lý do → implement đơn giản nhất (ponytail) → chạy focused test → refactor không đổi behavior.
   Shortcut cố ý thì đánh dấu comment "ponytail:" nêu giới hạn + cách nâng cấp. Test fail không rõ nguyên nhân → superpowers:systematic-debugging.
   Xong thì chạy "git status --porcelain -uall": "files" = đường dẫn từng file production (không phải thư mục) task đã tạo/sửa,
   "tests" = các file test đã tạo/sửa, "summary" kèm kết quả test thực sự đã chạy.`,
  { phase: 'Execute', model: 'sonnet', schema: EXEC })
if (!exec) throw new Error('Execute agent bị skip/lỗi — dừng workflow')
// ponytail: file đã dirty từ trước bị loại khỏi review, kể cả khi task sửa tiếp nó — chạy với working tree sạch
const preexisting = new Set(planned.dirty)
const files = exec.files.filter(f => !preexisting.has(f))
const tests = exec.tests.filter(f => !preexisting.has(f))
const codeFiles = files.filter(f => !NON_CODE.test(f))
log(`${files.length} file thay đổi (${codeFiles.length} file code), ${tests.length} file test, bỏ qua ${exec.files.length - files.length} file dirty từ trước`)

// 3+4. Review → Refactor (Step 5) theo nhóm file cùng thư mục (thấy được trùng lặp/contract giữa các file)
const byDir = {}
for (const f of codeFiles) (byDir[f.replace(/[\\/][^\\/]*$/, '')] ??= []).push(f)
const groups = Object.values(byDir).flatMap(g =>
  Array.from({ length: Math.ceil(g.length / GROUP_SIZE) }, (_, i) => g.slice(i * GROUP_SIZE, (i + 1) * GROUP_SIZE)))
const groupLabel = g => `${g[0]}${g.length > 1 ? ` +${g.length - 1}` : ''}`

const reviewed = await pipeline(groups,
  group => agent(
    `Review nhóm file sau (đọc toàn bộ từng file + git diff + code liên quan, không chỉ diff) theo plan:\n${group.join('\n')}\n\nPlan:\n${plan}\n
     Test liên quan:\n${tests.join('\n')}\n
     Các lens: correctness (đúng requirement/plan, bug, vi phạm rule CLAUDE.md/AGENTS.override, security);
     over-engineering (ponytail-review: code thừa, abstraction/option không ai yêu cầu, trùng lặp kể cả giữa các file trong nhóm);
     merge-risk (gitnexus: impact/context của symbol đã đổi, caller có thể vỡ); missing-test (nhánh rủi ro chưa có test). Không sửa file.`,
    { label: `review:${groupLabel(group)}`, phase: 'Review', effort: 'medium', schema: FINDINGS }),
  (r, group) => r.findings.length === 0 ? { group, applied: 0 } : agent(
    `Xử lý findings theo superpowers:receiving-code-review: kiểm chứng từng finding với code trước khi sửa;
     finding sai thì bỏ qua và ghi lý do kèm bằng chứng. Chạy gitnexus impact trước khi sửa symbol.
     CHỈ sửa các file: ${group.join(', ')} và test của chúng (finding missing-test). Giữ nguyên behavior (đã có test khoá).
     KHÔNG chạy build/compile/test (agent khác đang chạy song song; bước Verify sẽ build):\n${JSON.stringify(r.findings, null, 2)}`,
    { label: `refactor:${groupLabel(group)}`, phase: 'Refactor' })
    .then(() => ({ group, applied: r.findings.length })))

// 5. Verify — Step 6, tự sửa tối đa MAX_FIXES vòng
phase('Verify')
const allFiles = [...files, ...tests]
let verdict
for (let i = 0; i <= MAX_FIXES; i++) {
  verdict = await agent(
    `Theo superpowers:verification-before-completion. Với TỪNG module chứa các file sau, chạy lệnh verify theo AGENTS.override.md
     của module đó + các test liên quan:\n${allFiles.join('\n')}\n
     Rồi chạy gitnexus detect_changes scope all ("node .gitnexus/run.cjs detect-changes --scope all --repo ."); partial/truncated
     thì chạy lại. Bỏ qua file dirty từ trước: ${planned.dirty.join(', ') || '(không có)'}.
     "unexpectedChanges": symbol/process/file đã đổi nhưng không nằm trong plan, hoặc thay đổi không liên quan.
     Kiểm tra acceptance criteria, regression risk, security boundary theo plan:\n${plan}\n
     passed=true chỉ khi mọi module pass, detect_changes sạch và unexpectedChanges rỗng. Báo kèm output rút gọn; không báo pass nếu chưa thực sự chạy.`,
    { label: `verify#${i + 1}`, phase: 'Verify', effort: 'low', schema: VERDICT })
  if (verdict?.passed) break
  if (i < MAX_FIXES) await agent(
    `Verify fail. Dùng superpowers:systematic-debugging tìm root cause rồi sửa, không xoá/skip test, không mở rộng scope:
     ${verdict?.output ?? 'verify agent không trả kết quả'}\nThay đổi ngoài plan: ${verdict?.unexpectedChanges?.join(', ') || '(không có)'}`,
    { label: `fix#${i + 1}`, phase: 'Verify', effort: 'high' })
}
if (!verdict?.passed) log(`Verify vẫn FAIL sau ${MAX_FIXES} vòng sửa — dừng, cần xử lý tay`)

// 6. Finish — Step 7, chỉ báo cáo; commit/push do user quyết
phase('Finish')
const debt = await agent(
  `Theo ponytail:ponytail-debt, liệt kê các comment "ponytail:" mà task này thêm vào (xem git diff của các file sau), dạng "path:line: nội dung":\n${allFiles.join('\n')}`,
  { phase: 'Finish', label: 'ponytail-debt', effort: 'low', schema: DEBT })

return {
  type: planned.type, plan, risks: planned.risks, files, tests, summary: exec.summary,
  reviewed: reviewed.filter(Boolean), verdict, debt: debt?.debt ?? [],
  next: verdict?.passed ? 'Review diff, rồi dùng superpowers:finishing-a-development-branch để commit/PR' : 'Xử lý verify fail trước khi commit',
}
