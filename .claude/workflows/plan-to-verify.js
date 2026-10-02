export const meta = {
  name: 'plan-to-verify',
  description: 'Plan → execute → review changed files → refactor → tests → verify',
  whenToUse: 'Implement một task end-to-end trong 1 module, có review + test + verify',
  phases: [
    { title: 'Plan' }, { title: 'Execute' }, { title: 'Review' },
    { title: 'Refactor' }, { title: 'Test' }, { title: 'Verify' },
  ],
}

const task = typeof args === 'string' ? args : args?.task
if (!task) throw new Error('Truyền task qua args, vd: args: "thêm API X vào kira-gateway"')

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
      properties: { line: { type: 'number' }, severity: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } },
      required: ['severity', 'issue', 'fix'],
    } },
  },
  required: ['findings'],
}
const VERDICT = {
  type: 'object',
  properties: { passed: { type: 'boolean' }, command: { type: 'string' }, output: { type: 'string' } },
  required: ['passed', 'command', 'output'],
}

// 1. Plan — chỉ đọc, không sửa code
phase('Plan')
const plan = await agent(
  `Lập kế hoạch cho task: "${task}". Đọc AGENTS.override.md của module liên quan, chạy gitnexus impact cho các symbol sẽ sửa.
   KHÔNG sửa file. Trả về plan dạng các bước, file sẽ tạo/sửa, rủi ro, lệnh verify của module.`,
  { phase: 'Plan' })
if (!plan) throw new Error('Plan agent bị skip/lỗi — dừng workflow')

// 2. Execute — 1 agent duy nhất để tránh conflict khi sửa file
phase('Execute')
const before = await agent(
  `Chạy "git status --porcelain -uall" và trả về đường dẫn của mọi file đang thay đổi/untracked (summary để trống).`,
  { phase: 'Execute', label: 'snapshot', effort: 'low', schema: FILES })
const exec = await agent(
  `Thực hiện đúng plan sau, không mở rộng scope:\n${plan}\n
   Xong thì chạy "git status --porcelain -uall" và trả về đường dẫn từng file (không phải thư mục) mà task này đã tạo/sửa.`,
  { phase: 'Execute', schema: FILES })
if (!exec) throw new Error('Execute agent bị skip/lỗi — dừng workflow')
// ponytail: file đã dirty từ trước bị loại khỏi review, kể cả khi task sửa tiếp nó
const preexisting = new Set(before?.files ?? [])
const files = exec.files.filter(f => !preexisting.has(f))
if (files.length < exec.files.length) log(`Bỏ qua ${exec.files.length - files.length} file đã thay đổi từ trước task`)
log(`${files.length} file thay đổi`)

// 3+4. Review → Refactor theo từng file (pipeline: file A refactor trong khi file B còn đang review)
const reviewed = await pipeline(files,
  file => agent(
    `Review file ${file} (đọc toàn bộ file + git diff của nó) theo plan:\n${plan}\n
     Tìm: bug, vi phạm rule CLAUDE.md/AGENTS.override, code thừa, trùng lặp, chỗ cần tối ưu. Không sửa file.`,
    { label: `review:${file}`, phase: 'Review', schema: FINDINGS }),
  (r, file) => r.findings.length === 0 ? { file, applied: 0 } : agent(
    `Optimize/refactor ${file} theo findings sau, chỉ sửa đúng file này, giữ nguyên behavior.
     Tự kiểm chứng từng finding trước khi sửa; finding nào sai thì bỏ qua và ghi lý do.
     KHÔNG chạy build/compile/test (agent khác đang chạy song song; bước Verify sẽ build):\n${JSON.stringify(r.findings, null, 2)}`,
    { label: `refactor:${file}`, phase: 'Refactor' }).then(() => ({ file, applied: r.findings.length })))

// 5. Test
phase('Test')
await agent(
  `Viết testcase cho các thay đổi (theo convention test đã có trong module):\n${files.join('\n')}\n
   Bao phủ happy path + edge case + nhánh lỗi. Summary: ${exec.summary}`,
  { phase: 'Test' })

// 6. Verify — tự sửa tối đa 2 vòng
phase('Verify')
let verdict
for (let i = 0; i < 3; i++) {
  verdict = await agent(
    `Với TỪNG module chứa các file sau, chạy lệnh verify theo AGENTS.override.md của module đó + các test vừa viết:\n${files.join('\n')}\n
     passed=true chỉ khi mọi module đều pass. Báo kèm output rút gọn.`,
    { label: `verify#${i + 1}`, phase: 'Verify', schema: VERDICT })
  if (verdict?.passed) break
  if (i < 2) await agent(`Verify fail. Sửa root cause, không xoá/skip test:\n${verdict?.output ?? 'verify agent không trả kết quả'}`, { label: `fix#${i + 1}`, phase: 'Verify' })
}
if (!verdict?.passed) log('Verify vẫn FAIL sau 2 vòng sửa — cần xử lý tay')

return { plan, files, reviewed: reviewed.filter(Boolean), verdict }
