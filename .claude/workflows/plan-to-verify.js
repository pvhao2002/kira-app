export const meta = {
  name: 'plan-to-verify',
  description: 'Plan → execute → tests → review/refactor theo nhóm file → verify',
  whenToUse: 'Implement một task end-to-end, có review + test + verify. Duyệt plan: chạy {task, planOnly:true}, rồi chạy lại {task, plan}',
  phases: [
    { title: 'Plan' }, { title: 'Execute' }, { title: 'Test' },
    { title: 'Review' }, { title: 'Refactor' }, { title: 'Verify' },
  ],
}

// args: "task" | { task, plan?, planOnly? }
const opts = typeof args === 'string' ? { task: args } : (args ?? {})
const task = opts.task
if (!task) throw new Error('Truyền task qua args, vd: args: "thêm API X vào kira-gateway"')

const GROUP_SIZE = 4
const NON_CODE = /\.(md|txt|lock|log|svg|png|jpe?g)$|package-lock\.json$|[\\/](generated|dist|build|target)[\\/]/i

const PLAN = {
  type: 'object',
  properties: { plan: { type: 'string' }, dirty: { type: 'array', items: { type: 'string' } } },
  required: ['plan', 'dirty'],
}
const FILES = {
  type: 'object',
  properties: { files: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['files', 'summary'],
}
const FINDINGS = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: {
      type: 'object',
      properties: { file: { type: 'string' }, line: { type: 'number' }, severity: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } },
      required: ['file', 'severity', 'issue', 'fix'],
    } },
  },
  required: ['findings'],
}
const VERDICT = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, command: { type: 'string' }, output: { type: 'string' } },
  required: ['passed', 'command', 'output'],
}
const DIRTY_STEP = `Chạy "git status --porcelain -uall" và đưa đường dẫn mọi file đang thay đổi/untracked vào "dirty".`

// 1. Plan — chỉ đọc; nếu đã có plan duyệt sẵn thì chỉ chụp git status
phase('Plan')
const planned = opts.plan
  ? await agent(`${DIRTY_STEP} Để "plan" rỗng.`, { phase: 'Plan', label: 'snapshot', effort: 'low', schema: PLAN })
  : await agent(
      `Lập kế hoạch cho task: "${task}". Đọc AGENTS.override.md của module liên quan, chạy gitnexus impact cho các symbol sẽ sửa.
       KHÔNG sửa file. "plan": các bước, file sẽ tạo/sửa, rủi ro, lệnh verify của module. ${DIRTY_STEP}`,
      { phase: 'Plan', schema: PLAN })
if (!planned) throw new Error('Plan agent bị skip/lỗi — dừng workflow')
const plan = opts.plan ?? planned.plan
if (opts.planOnly) return { plan, next: 'Duyệt/sửa plan rồi chạy lại với args {task, plan}' }

// 2. Execute — 1 agent duy nhất để tránh conflict khi sửa file
phase('Execute')
const exec = await agent(
  `Thực hiện đúng plan sau, không mở rộng scope:\n${plan}\n
   Xong thì chạy "git status --porcelain -uall" và trả về đường dẫn từng file (không phải thư mục) mà task này đã tạo/sửa.`,
  { phase: 'Execute', schema: FILES })
if (!exec) throw new Error('Execute agent bị skip/lỗi — dừng workflow')
// ponytail: file đã dirty từ trước bị loại khỏi review, kể cả khi task sửa tiếp nó — chạy với working tree sạch
const preexisting = new Set(planned.dirty)
const files = exec.files.filter(f => !preexisting.has(f))
const codeFiles = files.filter(f => !NON_CODE.test(f))
log(`${files.length} file thay đổi (${codeFiles.length} file code), bỏ qua ${exec.files.length - files.length} file dirty từ trước`)

// 3. Test trước refactor — khoá behavior để Verify bắt được refactor làm hỏng logic
phase('Test')
const tests = await agent(
  `Viết testcase cho các thay đổi (theo convention test đã có trong module):\n${codeFiles.join('\n')}\n
   Bao phủ happy path + edge case + nhánh lỗi. Summary: ${exec.summary}
   KHÔNG sửa code production. Trả về đường dẫn các file test đã tạo/sửa.`,
  { phase: 'Test', schema: FILES })

// 4+5. Review → Refactor theo nhóm file cùng thư mục (thấy được trùng lặp/contract giữa các file)
const byDir = {}
for (const f of codeFiles) (byDir[f.replace(/[\\/][^\\/]*$/, '')] ??= []).push(f)
const groups = Object.values(byDir).flatMap(g =>
  Array.from({ length: Math.ceil(g.length / GROUP_SIZE) }, (_, i) => g.slice(i * GROUP_SIZE, (i + 1) * GROUP_SIZE)))

const reviewed = await pipeline(groups,
  group => agent(
    `Review nhóm file sau (đọc toàn bộ từng file + git diff của nó) theo plan:\n${group.join('\n')}\n\nPlan:\n${plan}\n
     Tìm: bug, vi phạm rule CLAUDE.md/AGENTS.override, code thừa, trùng lặp (kể cả giữa các file trong nhóm), chỗ cần tối ưu. Không sửa file.`,
    { label: `review:${group[0]}${group.length > 1 ? ` +${group.length - 1}` : ''}`, phase: 'Review', effort: 'medium', schema: FINDINGS }),
  (r, group) => r.findings.length === 0 ? { group, applied: 0 } : agent(
    `Optimize/refactor theo findings sau, CHỈ sửa các file: ${group.join(', ')}. Giữ nguyên behavior (đã có test khoá).
     Tự kiểm chứng từng finding trước khi sửa; finding nào sai thì bỏ qua và ghi lý do.
     KHÔNG chạy build/compile/test (agent khác đang chạy song song; bước Verify sẽ build):\n${JSON.stringify(r.findings, null, 2)}`,
    { label: `refactor:${group[0]}${group.length > 1 ? ` +${group.length - 1}` : ''}`, phase: 'Refactor' })
    .then(() => ({ group, applied: r.findings.length })))

// 6. Verify — tự sửa tối đa 2 vòng
phase('Verify')
const allFiles = [...files, ...(tests?.files ?? [])]
let verdict
for (let i = 0; i < 3; i++) {
  verdict = await agent(
    `Với TỪNG module chứa các file sau, chạy lệnh verify theo AGENTS.override.md của module đó + các test vừa viết:\n${allFiles.join('\n')}\n
     passed=true chỉ khi mọi module đều pass. Báo kèm output rút gọn.`,
    { label: `verify#${i + 1}`, phase: 'Verify', effort: 'low', schema: VERDICT })
  if (verdict?.passed) break
  if (i < 2) await agent(
    `Verify fail. Sửa root cause, không xoá/skip test:\n${verdict?.output ?? 'verify agent không trả kết quả'}`,
    { label: `fix#${i + 1}`, phase: 'Verify', effort: 'high' })
}
if (!verdict?.passed) log('Verify vẫn FAIL sau 2 vòng sửa — cần xử lý tay')

return { plan, files, tests: tests?.files ?? [], reviewed: reviewed.filter(Boolean), verdict }
