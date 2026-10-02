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

// 2. Execute — 1 agent duy nhất để tránh conflict khi sửa file
phase('Execute')
const exec = await agent(
  `Thực hiện đúng plan sau, không mở rộng scope:\n${plan}\n
   Xong thì chạy "git status --porcelain" và trả về danh sách mọi file đã tạo/sửa.`,
  { phase: 'Execute', schema: FILES })
log(`${exec.files.length} file thay đổi`)

// 3+4. Review → Refactor theo từng file (pipeline: file A refactor trong khi file B còn đang review)
const reviewed = await pipeline(exec.files,
  file => agent(
    `Review file ${file} (đọc toàn bộ file + git diff của nó) theo plan:\n${plan}\n
     Tìm: bug, vi phạm rule CLAUDE.md/AGENTS.override, code thừa, trùng lặp, chỗ cần tối ưu. Không sửa file.`,
    { label: `review:${file}`, phase: 'Review', schema: FINDINGS }),
  (r, file) => r.findings.length === 0 ? { file, applied: 0 } : agent(
    `Optimize/refactor ${file} theo findings sau, chỉ sửa đúng file này, giữ nguyên behavior:\n${JSON.stringify(r.findings, null, 2)}`,
    { label: `refactor:${file}`, phase: 'Refactor' }).then(() => ({ file, applied: r.findings.length })))

// 5. Test
phase('Test')
await agent(
  `Viết testcase cho các thay đổi (theo convention test đã có trong module):\n${exec.files.join('\n')}\n
   Bao phủ happy path + edge case + nhánh lỗi. Summary: ${exec.summary}`,
  { phase: 'Test' })

// 6. Verify — tự sửa tối đa 2 vòng
phase('Verify')
let verdict
for (let i = 0; i < 3; i++) {
  verdict = await agent(
    `Chạy lệnh verify của module (theo AGENTS.override.md) + các test vừa viết. Báo passed/failed kèm output rút gọn.`,
    { label: `verify#${i + 1}`, phase: 'Verify', schema: VERDICT })
  if (verdict.passed) break
  if (i < 2) await agent(`Verify fail. Sửa root cause, không xoá/skip test:\n${verdict.output}`, { label: `fix#${i + 1}`, phase: 'Verify' })
}

return { plan, files: exec.files, reviewed: reviewed.filter(Boolean), verdict }
