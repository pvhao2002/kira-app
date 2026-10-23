/** Static learning content for a Java full-stack developer; English is the target language, Vietnamese is the hint. */
export interface LocalizedText {
  en: string;
  vi: string;
}

export interface Phrase {
  en: string;
  vi: string;
}

export interface PhraseGroup {
  title: LocalizedText;
  tip?: LocalizedText;
  phrases: Phrase[];
}

export interface SpeakingTemplate {
  title: LocalizedText;
  body: string;
}

export type TrackId = 'interview' | 'meetings' | 'standup' | 'reports' | 'techstack' | 'office' | 'situations' | 'symbols' | 'pronunciation' | 'agile' | 'writing' | 'client' | 'feedback' | 'phrasal' | 'presenting' | 'oncall' | 'onboarding' | 'social' | 'livecoding' | 'fintech' | 'mistakes' | 'qa' | 'diplomatic' | 'systemtalk' | 'listening' | 'release' | 'remote' | 'aitools' | 'offer' | 'support' | 'hiring' | 'wellbeing' | 'security' | 'data' | 'git' | 'pairing' | 'docs' | 'vocab' | 'product' | 'phone' | 'cv' | 'linking' | 'techdebt' | 'meetup' | 'workshop' | 'walkthrough' | 'cloud' | 'testingtalk' | 'consulting' | 'jargon' | 'storytelling' | 'questions' | 'leadership' | 'estimates' | 'frontend' | 'mobile' | 'acceptance' | 'sdinterview' | 'dialogues' | 'travel';

export interface SpeakingTrack {
  id: TrackId;
  groups: PhraseGroup[];
  templates: SpeakingTemplate[];
}

export interface RoadmapWeek {
  week: number;
  phase: LocalizedText;
  focus: LocalizedText;
  tracks: TrackId[];
  tasks: LocalizedText[];
}

export const DAILY_ROUTINE: LocalizedText[] = [
  {en: '10 min — Listen to one tech talk or podcast clip and note 3 new phrases.', vi: '10 phút — Nghe một đoạn tech talk/podcast, ghi lại 3 cụm từ mới.'},
  {en: '10 min — Shadow 5 phrases from today\'s track: listen, pause, repeat aloud with the same rhythm.', vi: '10 phút — Shadowing 5 mẫu câu của chủ đề hôm nay: nghe, dừng, nhắc lại đúng nhịp.'},
  {en: '5 min — Record your stand-up update before the real meeting and listen back once.', vi: '5 phút — Tự ghi âm phần stand-up trước buổi họp thật và nghe lại một lần.'},
  {en: '5 min — Explain one piece of code you touched today out loud, as if to a teammate.', vi: '5 phút — Nói to giải thích một đoạn code bạn đã sửa hôm nay như đang nói với đồng nghiệp.'}
];

export const ROADMAP: RoadmapWeek[] = [
  {
    week: 1, phase: {en: 'Foundation', vi: 'Nền tảng'}, tracks: ['standup', 'pronunciation', 'office', 'onboarding', 'mistakes'],
    focus: {en: 'Pronounce your daily tech vocabulary and introduce yourself', vi: 'Phát âm từ vựng kỹ thuật hằng ngày và giới thiệu bản thân'},
    tasks: [
      {en: 'Listen and repeat 20 tech terms: Java, Spring Boot, Angular, deploy, cache, queue, schema, endpoint…', vi: 'Nghe và nhắc lại 20 thuật ngữ: Java, Spring Boot, Angular, deploy, cache, queue, schema, endpoint…'},
      {en: 'Write and record a 60-second self-introduction.', vi: 'Viết và ghi âm phần giới thiệu bản thân 60 giây.'},
      {en: 'Learn the 3-part stand-up structure: yesterday, today, blockers.', vi: 'Học cấu trúc stand-up 3 phần: hôm qua, hôm nay, vướng mắc.'}
    ]
  },
  {
    week: 2, phase: {en: 'Foundation', vi: 'Nền tảng'}, tracks: ['standup', 'meetings', 'symbols', 'listening', 'questions'],
    focus: {en: 'Speak in every stand-up using the template', vi: 'Nói trong mọi buổi stand-up theo mẫu'},
    tasks: [
      {en: 'Give a stand-up update in English every working day (record at least 3).', vi: 'Báo cáo stand-up bằng tiếng Anh mỗi ngày làm việc (ghi âm ít nhất 3 lần).'},
      {en: 'Practise 10 clarifying phrases: "Could you repeat that?", "Just to confirm…".', vi: 'Luyện 10 câu hỏi lại cho rõ: "Could you repeat that?", "Just to confirm…".'},
      {en: 'Shadow one 5-minute engineering video at 0.75× speed, then at 1×.', vi: 'Shadowing một video kỹ thuật 5 phút ở tốc độ 0.75×, sau đó 1×.'}
    ]
  },
  {
    week: 3, phase: {en: 'Foundation', vi: 'Nền tảng'}, tracks: ['meetings', 'situations', 'writing', 'remote', 'vocab', 'phone'],
    focus: {en: 'Ask for help and describe a blocker clearly', vi: 'Nhờ giúp đỡ và mô tả vướng mắc rõ ràng'},
    tasks: [
      {en: 'Describe one real bug: what you expected, what happened, what you tried.', vi: 'Mô tả một bug thật: kỳ vọng gì, thực tế ra sao, đã thử những gì.'},
      {en: 'Practise polite agreeing and disagreeing phrases in a mock discussion.', vi: 'Luyện các câu đồng ý/phản đối lịch sự trong một buổi thảo luận giả lập.'},
      {en: 'Write a Slack/Teams message asking for a code review, then read it aloud.', vi: 'Viết tin nhắn Slack/Teams nhờ review code rồi đọc to.'}
    ]
  },
  {
    week: 4, phase: {en: 'Team routines', vi: 'Thói quen trong nhóm'}, tracks: ['reports', 'writing', 'qa', 'git', 'docs', 'testingtalk', 'dialogues'],
    focus: {en: 'Deliver your first weekly report', vi: 'Trình bày báo cáo tuần đầu tiên'},
    tasks: [
      {en: 'Fill the weekly report template with this week\'s real work.', vi: 'Điền mẫu báo cáo tuần bằng công việc thật của tuần này.'},
      {en: 'Present it out loud in under 3 minutes and record it.', vi: 'Trình bày to trong dưới 3 phút và ghi âm lại.'},
      {en: 'Learn 5 phrases for risks and delays.', vi: 'Học 5 mẫu câu nói về rủi ro và chậm tiến độ.'}
    ]
  },
  {
    week: 5, phase: {en: 'Team routines', vi: 'Thói quen trong nhóm'}, tracks: ['reports', 'meetings', 'agile', 'product', 'jargon', 'estimates', 'acceptance'],
    focus: {en: 'Sprint review and bi-weekly report', vi: 'Sprint review và báo cáo 2 tuần'},
    tasks: [
      {en: 'Prepare a bi-weekly / sprint summary with goals, done, carried over and metrics.', vi: 'Chuẩn bị tổng kết 2 tuần/sprint: mục tiêu, đã xong, chuyển sprint sau, số liệu.'},
      {en: 'Practise demo phrases: "Let me walk you through…", "As you can see…".', vi: 'Luyện câu demo: "Let me walk you through…", "As you can see…".'},
      {en: 'Give one retrospective point for each: went well, to improve, action.', vi: 'Đưa một ý retro cho mỗi phần: làm tốt, cần cải thiện, hành động.'}
    ]
  },
  {
    week: 6, phase: {en: 'Team routines', vi: 'Thói quen trong nhóm'}, tracks: ['meetings', 'agile', 'feedback', 'phrasal', 'diplomatic', 'wellbeing', 'workshop'],
    focus: {en: 'Lead a short meeting or discussion', vi: 'Dẫn dắt một buổi họp/thảo luận ngắn'},
    tasks: [
      {en: 'Open, steer and close a 15-minute meeting using the meeting phrases.', vi: 'Mở đầu, điều phối và kết thúc buổi họp 15 phút bằng các mẫu câu họp.'},
      {en: 'Summarise action items with owners and deadlines out loud.', vi: 'Nói tóm tắt các việc cần làm kèm người phụ trách và hạn chót.'},
      {en: 'Negotiate a scope or deadline change in a role-play.', vi: 'Đóng vai thương lượng thay đổi phạm vi hoặc deadline.'}
    ]
  },
  {
    week: 7, phase: {en: 'Technical discussion', vi: 'Thảo luận kỹ thuật'}, tracks: ['techstack', 'symbols', 'oncall', 'release', 'linking', 'walkthrough', 'cloud'],
    focus: {en: 'Explain your backend: Java, Spring Boot, database', vi: 'Giải thích backend: Java, Spring Boot, database'},
    tasks: [
      {en: 'Explain the request flow of one API: controller → service → repository → DB.', vi: 'Giải thích luồng xử lý một API: controller → service → repository → DB.'},
      {en: 'Talk for 2 minutes about a transaction, index or N+1 problem you solved.', vi: 'Nói 2 phút về một vấn đề transaction, index hoặc N+1 bạn đã xử lý.'},
      {en: 'Learn to say numbers and units naturally: "two hundred milliseconds", "ten K requests".', vi: 'Tập đọc số và đơn vị tự nhiên: "two hundred milliseconds", "ten K requests".'}
    ]
  },
  {
    week: 8, phase: {en: 'Technical discussion', vi: 'Thảo luận kỹ thuật'}, tracks: ['techstack', 'client', 'presenting', 'fintech', 'support', 'data', 'consulting'],
    focus: {en: 'Explain your frontend and integration', vi: 'Giải thích frontend và tích hợp'},
    tasks: [
      {en: 'Describe an Angular component: inputs, state (Signals), API calls and error states.', vi: 'Mô tả một component Angular: input, state (Signals), gọi API và trạng thái lỗi.'},
      {en: 'Explain authentication with JWT and refresh tokens in simple English.', vi: 'Giải thích xác thực bằng JWT và refresh token bằng tiếng Anh đơn giản.'},
      {en: 'Compare two options (e.g. REST vs messaging) using pros and cons phrases.', vi: 'So sánh hai lựa chọn (ví dụ REST và messaging) bằng mẫu câu ưu/nhược điểm.'}
    ]
  },
  {
    week: 9, phase: {en: 'Technical discussion', vi: 'Thảo luận kỹ thuật'}, tracks: ['techstack', 'meetings', 'client', 'systemtalk', 'aitools', 'security', 'pairing', 'techdebt', 'frontend', 'mobile'],
    focus: {en: 'Code review and architecture debate', vi: 'Code review và tranh luận kiến trúc'},
    tasks: [
      {en: 'Give 5 code-review comments politely, using suggestion phrases.', vi: 'Viết và nói 5 nhận xét code review lịch sự bằng mẫu câu gợi ý.'},
      {en: 'Defend a design decision and respond to a challenge without sounding defensive.', vi: 'Bảo vệ một quyết định thiết kế và phản hồi phản biện mà không gay gắt.'},
      {en: 'Explain an incident: impact, root cause, fix, prevention.', vi: 'Trình bày một sự cố: ảnh hưởng, nguyên nhân gốc, cách sửa, phòng ngừa.'}
    ]
  },
  {
    week: 10, phase: {en: 'Interview readiness', vi: 'Sẵn sàng phỏng vấn'}, tracks: ['interview', 'livecoding', 'cv', 'storytelling'],
    focus: {en: 'Tell your career story', vi: 'Kể câu chuyện sự nghiệp'},
    tasks: [
      {en: 'Polish a 2-minute "Tell me about yourself" answer.', vi: 'Hoàn thiện câu trả lời 2 phút cho "Tell me about yourself".'},
      {en: 'Prepare 3 STAR stories: a hard bug, a performance win, a team conflict.', vi: 'Chuẩn bị 3 câu chuyện STAR: bug khó, cải thiện hiệu năng, mâu thuẫn trong nhóm.'},
      {en: 'Record each story and cut filler words ("uh", "like").', vi: 'Ghi âm từng câu chuyện và cắt bớt từ đệm ("uh", "like").'}
    ]
  },
  {
    week: 11, phase: {en: 'Interview readiness', vi: 'Sẵn sàng phỏng vấn'}, tracks: ['interview', 'techstack', 'livecoding', 'sdinterview'],
    focus: {en: 'Technical interview out loud', vi: 'Phỏng vấn kỹ thuật bằng lời'},
    tasks: [
      {en: 'Answer 10 common Java/Spring questions aloud (JVM, GC, Spring beans, transactions).', vi: 'Trả lời to 10 câu hỏi Java/Spring phổ biến (JVM, GC, Spring bean, transaction).'},
      {en: 'Think aloud while solving one coding problem.', vi: 'Vừa giải một bài coding vừa nói ra suy nghĩ.'},
      {en: 'Walk through a system design: requirements, components, data, scaling.', vi: 'Trình bày một bài system design: yêu cầu, thành phần, dữ liệu, mở rộng.'}
    ]
  },
  {
    week: 12, phase: {en: 'Interview readiness', vi: 'Sẵn sàng phỏng vấn'}, tracks: ['interview', 'feedback', 'social', 'offer', 'hiring', 'meetup', 'travel'],
    focus: {en: 'Mock interview, negotiation and review', vi: 'Phỏng vấn thử, đàm phán và tổng kết'},
    tasks: [
      {en: 'Do a full 45-minute mock interview with a friend or AI and record it.', vi: 'Phỏng vấn thử 45 phút với bạn bè hoặc AI và ghi âm lại.'},
      {en: 'Practise salary and offer conversation phrases.', vi: 'Luyện mẫu câu trao đổi lương và offer.'},
      {en: 'Compare today\'s recording with week 1 and pick the next 3 weak spots.', vi: 'So sánh bản ghi âm hôm nay với tuần 1 và chọn 3 điểm yếu tiếp theo.'}
    ]
  },
  {
    week: 13, phase: {en: 'Advanced', vi: 'Nâng cao'}, tracks: ['consulting', 'client', 'presenting'],
    focus: {en: 'Work with clients like a consultant', vi: 'Làm việc với khách hàng như một chuyên viên tư vấn'},
    tasks: [
      {en: 'Run a 15-minute mock requirements call: ask 5 clarifying questions and summarize the agreement.', vi: 'Giả lập cuộc gọi lấy yêu cầu 15 phút: hỏi 5 câu làm rõ và tóm tắt thỏa thuận.'},
      {en: 'Write a weekly client status email with a Green/Amber/Red status.', vi: 'Viết email báo cáo tình trạng hằng tuần cho khách hàng với trạng thái Xanh/Vàng/Đỏ.'},
      {en: 'Present one technical recommendation in 3 minutes, starting with the business impact.', vi: 'Trình bày một đề xuất kỹ thuật trong 3 phút, bắt đầu bằng tác động kinh doanh.'}
    ]
  },
  {
    week: 14, phase: {en: 'Advanced', vi: 'Nâng cao'}, tracks: ['workshop', 'diplomatic', 'feedback', 'linking', 'leadership'],
    focus: {en: 'Lead discussions and handle disagreement', vi: 'Dẫn dắt thảo luận và xử lý bất đồng'},
    tasks: [
      {en: 'Facilitate a 20-minute brainstorming session in English, including voting and next steps.', vi: 'Điều phối một buổi brainstorming 20 phút bằng tiếng Anh, có biểu quyết và bước tiếp theo.'},
      {en: 'Rewrite three direct sentences into softer, diplomatic ones and say them aloud.', vi: 'Viết lại ba câu nói thẳng thành câu khéo léo hơn và nói to.'},
      {en: 'Give one piece of SBI feedback to a teammate (or record it as practice).', vi: 'Góp ý theo SBI cho một đồng nghiệp (hoặc ghi âm để luyện).'}
    ]
  },
  {
    week: 15, phase: {en: 'Advanced', vi: 'Nâng cao'}, tracks: ['oncall', 'release', 'security', 'systemtalk'],
    focus: {en: 'Communicate under pressure: incidents and releases', vi: 'Giao tiếp dưới áp lực: sự cố và phát hành'},
    tasks: [
      {en: 'Role-play an incident call: raise the alarm, give two status updates, close it.', vi: 'Đóng vai cuộc gọi sự cố: báo động, cập nhật trạng thái hai lần, kết thúc.'},
      {en: 'Walk through your system\'s architecture diagram in 5 minutes without notes.', vi: 'Trình bày sơ đồ kiến trúc hệ thống của bạn trong 5 phút không cần ghi chú.'},
      {en: 'Write a blameless postmortem summary for a past bug.', vi: 'Viết bản tóm tắt postmortem không đổ lỗi cho một bug cũ.'}
    ]
  },
  {
    week: 16, phase: {en: 'Advanced', vi: 'Nâng cao'}, tracks: ['interview', 'livecoding', 'cv', 'offer', 'dialogues', 'sdinterview'],
    focus: {en: 'Full interview simulation, all rounds', vi: 'Mô phỏng phỏng vấn đầy đủ tất cả các vòng'},
    tasks: [
      {en: 'Answer one random question from each of the 6 PwC rounds aloud, 2 minutes each.', vi: 'Trả lời to một câu ngẫu nhiên của mỗi vòng PwC trong 6 vòng, mỗi câu 2 phút.'},
      {en: 'Solve one coding problem while thinking aloud, then state the time and space complexity.', vi: 'Giải một bài code trong khi nói to suy nghĩ, rồi nêu độ phức tạp thời gian và bộ nhớ.'},
      {en: 'Update your CV bullets with action verbs and numbers, then practise your counter-offer reply.', vi: 'Cập nhật CV với động từ hành động và con số, rồi luyện câu trả lời đàm phán offer.'}
    ]
  }
];

/** Progress is saved by position (track.group.phrase), so add new groups and phrases at the end, never in the middle. */
export const TRACKS: SpeakingTrack[] = [
  {
    id: 'interview',
    groups: [
      {
        title: {en: 'Introducing yourself', vi: 'Giới thiệu bản thân'},
        tip: {en: 'Present → past → future: current role, key achievement, why this job.', vi: 'Hiện tại → quá khứ → tương lai: vai trò hiện tại, thành tích chính, vì sao ứng tuyển.'},
        phrases: [
          {en: 'I\'m a full-stack developer with five years of experience, mainly in Java, Spring Boot and Angular.', vi: 'Tôi là lập trình viên full-stack với 5 năm kinh nghiệm, chủ yếu Java, Spring Boot và Angular.'},
          {en: 'In my current role, I\'m responsible for designing REST APIs and building the front-end features that use them.', vi: 'Ở vị trí hiện tại, tôi phụ trách thiết kế REST API và xây dựng tính năng front-end sử dụng chúng.'},
          {en: 'Most recently, I worked on a payment module that handles around ten thousand transactions a day.', vi: 'Gần đây nhất, tôi làm module thanh toán xử lý khoảng mười nghìn giao dịch mỗi ngày.'},
          {en: 'I enjoy working across the whole stack, from database design to the user interface.', vi: 'Tôi thích làm xuyên suốt cả hệ thống, từ thiết kế database đến giao diện người dùng.'},
          {en: 'I\'m looking for a role where I can take more ownership of architecture decisions.', vi: 'Tôi đang tìm vị trí được chủ động hơn trong các quyết định kiến trúc.'}
        ]
      },
      {
        title: {en: 'Talking about projects (STAR)', vi: 'Kể về dự án (STAR)'},
        tip: {en: 'Situation, Task, Action, Result — spend most time on Action and give a number in Result.', vi: 'Bối cảnh, Nhiệm vụ, Hành động, Kết quả — nói kỹ phần Hành động và có số liệu ở Kết quả.'},
        phrases: [
          {en: 'The situation was that our order API became very slow during peak hours.', vi: 'Bối cảnh là API đặt hàng của chúng tôi rất chậm vào giờ cao điểm.'},
          {en: 'My task was to find the bottleneck and bring the response time under two hundred milliseconds.', vi: 'Nhiệm vụ của tôi là tìm điểm nghẽn và đưa thời gian phản hồi xuống dưới 200 ms.'},
          {en: 'I profiled the queries, added the missing indexes and introduced a Redis cache for read-heavy data.', vi: 'Tôi phân tích truy vấn, thêm index còn thiếu và dùng Redis cache cho dữ liệu đọc nhiều.'},
          {en: 'As a result, the average latency dropped by seventy percent.', vi: 'Kết quả là độ trễ trung bình giảm 70%.'},
          {en: 'Looking back, I would add performance tests earlier in the project.', vi: 'Nhìn lại, tôi sẽ đưa kiểm thử hiệu năng vào sớm hơn trong dự án.'}
        ]
      },
      {
        title: {en: 'Handling technical questions', vi: 'Xử lý câu hỏi kỹ thuật'},
        phrases: [
          {en: 'That\'s a good question. Let me think about it for a second.', vi: 'Câu hỏi hay. Cho tôi suy nghĩ một chút.'},
          {en: 'Just to make sure I understand — are you asking about the JVM memory model or about garbage collection?', vi: 'Để chắc là tôi hiểu đúng — anh/chị hỏi về mô hình bộ nhớ JVM hay về garbage collection?'},
          {en: 'I\'d start with a simple solution and then optimise it.', vi: 'Tôi sẽ bắt đầu bằng giải pháp đơn giản rồi tối ưu sau.'},
          {en: 'Let me think out loud while I work through this.', vi: 'Để tôi vừa làm vừa nói ra suy nghĩ.'},
          {en: 'I haven\'t used that in production, but my understanding is that it works like this…', vi: 'Tôi chưa dùng cái đó trên production, nhưng theo hiểu biết của tôi thì nó hoạt động như sau…'},
          {en: 'The trade-off here is between consistency and performance.', vi: 'Sự đánh đổi ở đây là giữa tính nhất quán và hiệu năng.'}
        ]
      },
      {
        title: {en: 'Questions to ask the interviewer', vi: 'Câu hỏi dành cho người phỏng vấn'},
        phrases: [
          {en: 'What does a typical day look like for a developer on this team?', vi: 'Một ngày làm việc thông thường của lập trình viên trong nhóm như thế nào?'},
          {en: 'How do you handle code reviews and releases?', vi: 'Nhóm xử lý code review và phát hành như thế nào?'},
          {en: 'What are the biggest technical challenges the team is facing right now?', vi: 'Thách thức kỹ thuật lớn nhất của nhóm hiện nay là gì?'},
          {en: 'How would you measure success for this role in the first six months?', vi: 'Thành công của vị trí này trong 6 tháng đầu được đánh giá thế nào?'},
          {en: 'What are the next steps in the hiring process?', vi: 'Các bước tiếp theo của quy trình tuyển dụng là gì?'}
        ]
      },
      {
        title: {en: 'Salary and offer discussion', vi: 'Trao đổi lương và offer'},
        phrases: [
          {en: 'Based on my experience and the market, I\'m looking for a range of … to … per month.', vi: 'Dựa trên kinh nghiệm và mặt bằng thị trường, tôi mong muốn mức … đến … mỗi tháng.'},
          {en: 'I\'m flexible, but I\'d like to understand the whole package, including bonus and benefits.', vi: 'Tôi linh hoạt, nhưng muốn hiểu toàn bộ đãi ngộ, gồm thưởng và phúc lợi.'},
          {en: 'Thank you for the offer. Could I have a few days to review it?', vi: 'Cảm ơn về offer. Tôi có thể có vài ngày để xem xét không?'},
          {en: 'Is there any flexibility on the base salary?', vi: 'Mức lương cơ bản có thể linh hoạt không?'},
          {en: 'I really appreciate your time today, and I\'m excited about this opportunity.', vi: 'Cảm ơn anh/chị đã dành thời gian hôm nay, tôi rất hào hứng với cơ hội này.'}
        ]
      },
      {
        title: {en: 'When you don\'t know the answer', vi: 'Khi không biết câu trả lời'},
        tip: {en: 'Never go silent or bluff. Say what you do know, reason out loud, and say how you would find out.', vi: 'Đừng im lặng hay "chém gió". Nói điều bạn biết, suy luận thành tiếng, và nói cách bạn sẽ tìm hiểu.'},
        phrases: [
          {en: 'I haven\'t used that in production, but here\'s how I understand it.', vi: 'Tôi chưa dùng cái đó trên production, nhưng đây là cách tôi hiểu.'},
          {en: 'I\'m not sure about the exact name, but the idea is…', vi: 'Tôi không chắc tên chính xác, nhưng ý tưởng là…'},
          {en: 'Let me think about it for a moment.', vi: 'Cho tôi suy nghĩ một chút.'},
          {en: 'If I had to guess, I\'d say it\'s related to the connection pool, and I\'d confirm it with the metrics.', vi: 'Nếu phải đoán, tôi nghĩ liên quan tới connection pool, và tôi sẽ xác nhận bằng metrics.'},
          {en: 'I don\'t know, but I\'d look it up in the official documentation.', vi: 'Tôi không biết, nhưng tôi sẽ tra trong tài liệu chính thức.'},
          {en: 'Could you rephrase the question? I want to make sure I answer the right thing.', vi: 'Anh/chị diễn đạt lại câu hỏi được không? Tôi muốn trả lời đúng ý.'}
        ]
      },
      {
        title: {en: 'Online interview issues', vi: 'Sự cố khi phỏng vấn online'},
        phrases: [
          {en: 'Sorry, you froze for a moment. Could you repeat the last question?', vi: 'Xin lỗi, hình bị đứng một chút. Anh/chị nhắc lại câu hỏi cuối được không?'},
          {en: 'My connection is unstable. Would it be okay if I turned off my camera?', vi: 'Mạng tôi không ổn định. Tôi tắt camera được không ạ?'},
          {en: 'I\'ll share my screen so you can see my code.', vi: 'Tôi chia sẻ màn hình để anh/chị xem code nhé.'},
          {en: 'Can you see my screen clearly? Should I make the font bigger?', vi: 'Anh/chị thấy màn hình rõ không? Tôi phóng to chữ nhé?'},
          {en: 'I got disconnected. Sorry about that. Shall I continue from where I stopped?', vi: 'Tôi vừa bị rớt mạng, xin lỗi. Tôi tiếp tục từ chỗ dừng nhé?'}
        ]
      },
      {
        title: {en: 'Closing the interview', vi: 'Kết thúc buổi phỏng vấn'},
        phrases: [
          {en: 'Thank you for your time today. I really enjoyed our conversation.', vi: 'Cảm ơn anh/chị đã dành thời gian. Tôi rất thích cuộc trò chuyện hôm nay.'},
          {en: 'After this conversation, I\'m even more interested in the role.', vi: 'Sau buổi trao đổi này, tôi càng quan tâm tới vị trí hơn.'},
          {en: 'When can I expect to hear back about the next steps?', vi: 'Khi nào tôi có thể nhận phản hồi về các bước tiếp theo?'},
          {en: 'Is there anything else I can provide, like references or code samples?', vi: 'Tôi có cần cung cấp thêm gì không, như người tham chiếu hay code mẫu?'},
          {en: 'Have a great rest of your day.', vi: 'Chúc anh/chị phần còn lại của ngày thật tốt.'}
        ]
      },
      {
        title: {en: 'Describing your current project in depth', vi: 'Mô tả chi tiết dự án hiện tại'},
        tip: {en: 'Cover four things: the business goal, the architecture, your part, and one hard problem you solved.', vi: 'Nói đủ bốn ý: mục tiêu kinh doanh, kiến trúc, phần bạn làm, và một vấn đề khó bạn đã giải quyết.'},
        phrases: [
          {en: 'The product helps users track their credit cards and investments in one place.', vi: 'Sản phẩm giúp người dùng theo dõi thẻ tín dụng và khoản đầu tư ở một nơi.'},
          {en: 'It\'s a modular monolith with Spring Boot, MySQL and an Angular front end.', vi: 'Đây là modular monolith dùng Spring Boot, MySQL và front end Angular.'},
          {en: 'I own the credit card module, from the database schema to the API.', vi: 'Tôi phụ trách module thẻ tín dụng, từ schema database tới API.'},
          {en: 'One hard problem was making statement imports idempotent.', vi: 'Một vấn đề khó là làm cho việc import sao kê có tính idempotent.'},
          {en: 'We have about ten thousand active users and a few hundred thousand transactions a month.', vi: 'Có khoảng 10.000 người dùng hoạt động và vài trăm nghìn giao dịch mỗi tháng.'},
          {en: 'If I could change one thing, I\'d add better monitoring from the start.', vi: 'Nếu được thay đổi một điều, tôi sẽ thêm giám sát tốt hơn ngay từ đầu.'}
        ]
      },
      {
        title: {en: 'Tricky personal questions', vi: 'Câu hỏi cá nhân khó'},
        tip: {en: 'Be honest and brief, then turn the answer towards what you learned and why you\'re ready now.', vi: 'Trung thực và ngắn gọn, rồi hướng câu trả lời sang điều bạn học được và vì sao giờ bạn đã sẵn sàng.'},
        phrases: [
          {en: 'I took six months off to care for a family member, and I kept learning during that time.', vi: 'Giải thích khoảng trống sự nghiệp: tôi nghỉ 6 tháng để chăm sóc người thân và vẫn tiếp tục học.'},
          {en: 'I\'d prefer to focus on the value I can bring to this role, rather than my current salary.', vi: 'Khi bị hỏi lương hiện tại: tôi muốn tập trung vào giá trị tôi mang lại cho vị trí này.'},
          {en: 'I\'ve mostly worked with Java, but I learn new stacks quickly. For example, I picked up Angular in a month.', vi: 'Khi thiếu một công nghệ: tôi chủ yếu làm Java nhưng học stack mới nhanh.'},
          {en: 'I\'ve changed jobs twice in three years because the projects ended, and now I\'m looking for a long-term role.', vi: 'Giải thích việc nhảy việc: hai lần đổi việc vì dự án kết thúc, giờ tôi tìm vị trí lâu dài.'},
          {en: 'I don\'t have a degree in computer science, but I have five years of hands-on experience.', vi: 'Không có bằng chuyên ngành: tôi có năm năm kinh nghiệm thực tế.'},
          {en: 'I\'m interviewing with a few companies, but this role is my first choice.', vi: 'Khi được hỏi đang phỏng vấn nơi khác không: có vài nơi, nhưng đây là lựa chọn ưu tiên.'}
        ]
      },
      {
        title: {en: 'Small talk before the interview starts', vi: 'Nói chuyện xã giao trước khi phỏng vấn'},
        phrases: [
          {en: 'Hi, nice to meet you. Thanks for having me.', vi: 'Chào anh/chị, rất vui được gặp. Cảm ơn đã mời tôi.'},
          {en: 'I\'m doing well, thank you. How about you?', vi: 'Tôi khỏe, cảm ơn. Còn anh/chị thì sao?'},
          {en: 'Yes, I found the office easily. The directions were very clear.', vi: 'Vâng, tôi tìm văn phòng dễ dàng. Chỉ dẫn rất rõ.'},
          {en: 'It\'s a bit rainy in Hanoi today, but I like this weather.', vi: 'Hôm nay Hà Nội hơi mưa, nhưng tôi thích thời tiết này.'},
          {en: 'I\'m ready whenever you are.', vi: 'Tôi sẵn sàng bất cứ khi nào anh/chị muốn bắt đầu.'}
        ]
      },
      {
        title: {en: 'Following up after the interview', vi: 'Liên hệ lại sau phỏng vấn'},
        phrases: [
          {en: 'Thank you again for your time today.', vi: 'Một lần nữa cảm ơn anh/chị đã dành thời gian hôm nay.'},
          {en: 'I enjoyed learning about the team\'s work on payment systems.', vi: 'Tôi rất thích được tìm hiểu công việc của nhóm về hệ thống thanh toán.'},
          {en: 'Our conversation made me even more excited about the role.', vi: 'Cuộc trò chuyện khiến tôi càng hào hứng với vị trí này.'},
          {en: 'I just wanted to follow up on the timeline for a decision.', vi: 'Tôi muốn hỏi thêm về thời gian có quyết định.'},
          {en: 'Please let me know if you need any more information from me.', vi: 'Nếu cần thêm thông tin gì từ tôi, xin cứ cho tôi biết.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: '"Tell me about yourself" (2 minutes)', vi: '"Tell me about yourself" (2 phút)'},
        body: `I'm [name], a Java full-stack developer with [X] years of experience.
Right now I work at [company], where I build [type of product] using Spring Boot on the back end and Angular on the front end.
One project I'm proud of is [project]: I [key action], which [measurable result].
Before that, I [previous role or key experience].
I'm interested in this role because [reason linked to the company or product], and I'd like to grow in [area].`
      },
      {
        title: {en: 'STAR story', vi: 'Câu chuyện STAR'},
        body: `Situation: At [company], [context and problem].
Task: I was responsible for [goal].
Action: First, I [step 1]. Then I [step 2]. Finally, I [step 3].
Result: [number or impact]. What I learned was [lesson].`
      }
    ]
  },
  {
    id: 'meetings',
    groups: [
      {
        title: {en: 'Giving your opinion', vi: 'Đưa ra ý kiến'},
        phrases: [
          {en: 'From my point of view, we should split this into two smaller tickets.', vi: 'Theo tôi, chúng ta nên tách việc này thành hai ticket nhỏ hơn.'},
          {en: 'I\'d suggest we keep the current approach and revisit it next sprint.', vi: 'Tôi đề xuất giữ cách hiện tại và xem lại vào sprint sau.'},
          {en: 'One thing we might want to consider is the impact on the mobile app.', vi: 'Một điều chúng ta có thể cần cân nhắc là ảnh hưởng tới ứng dụng mobile.'},
          {en: 'I\'m not a hundred percent sure, but I think the issue is on the API side.', vi: 'Tôi không chắc 100%, nhưng tôi nghĩ vấn đề nằm ở phía API.'}
        ]
      },
      {
        title: {en: 'Agreeing and disagreeing politely', vi: 'Đồng ý và phản đối lịch sự'},
        phrases: [
          {en: 'That makes sense to me.', vi: 'Điều đó hợp lý với tôi.'},
          {en: 'I see your point, but I\'m a bit worried about the performance.', vi: 'Tôi hiểu ý bạn, nhưng tôi hơi lo về hiệu năng.'},
          {en: 'I agree with the idea in general, although the timeline looks tight.', vi: 'Nhìn chung tôi đồng ý, dù tiến độ có vẻ gấp.'},
          {en: 'Could we look at it from a different angle?', vi: 'Chúng ta có thể nhìn vấn đề từ góc độ khác không?'},
          {en: 'Let\'s try both options in a quick spike and compare the results.', vi: 'Hãy thử nhanh cả hai phương án rồi so sánh kết quả.'}
        ]
      },
      {
        title: {en: 'Clarifying and checking understanding', vi: 'Hỏi lại và xác nhận hiểu đúng'},
        tip: {en: 'Asking again is professional. Repeating the requirement in your words prevents rework.', vi: 'Hỏi lại là chuyên nghiệp. Nhắc lại yêu cầu bằng lời của bạn giúp tránh làm lại.'},
        phrases: [
          {en: 'Sorry, could you repeat the last part?', vi: 'Xin lỗi, bạn nhắc lại phần cuối được không?'},
          {en: 'Just to confirm, the deadline is Friday, not Monday, right?', vi: 'Xác nhận lại, deadline là thứ Sáu chứ không phải thứ Hai, đúng không?'},
          {en: 'So if I understand correctly, the user should see an error instead of an empty list?', vi: 'Nếu tôi hiểu đúng thì người dùng nên thấy thông báo lỗi thay vì danh sách trống?'},
          {en: 'Could you give me an example of what you expect?', vi: 'Bạn có thể cho ví dụ về kết quả mong đợi không?'},
          {en: 'Could you speak a little more slowly? The connection is not very clear.', vi: 'Bạn nói chậm hơn chút được không? Đường truyền không rõ lắm.'}
        ]
      },
      {
        title: {en: 'Asking for help and escalating', vi: 'Nhờ giúp đỡ và báo cáo vượt cấp'},
        phrases: [
          {en: 'Do you have five minutes? I\'d like a second pair of eyes on this bug.', vi: 'Bạn có 5 phút không? Tôi muốn nhờ xem giúp bug này.'},
          {en: 'I\'ve been stuck on this for a couple of hours. Here\'s what I\'ve tried so far.', vi: 'Tôi bị kẹt chỗ này vài tiếng rồi. Đây là những gì tôi đã thử.'},
          {en: 'I think we need a decision from the product owner before we continue.', vi: 'Tôi nghĩ cần quyết định của product owner trước khi làm tiếp.'},
          {en: 'I want to flag a risk early: this might not be ready by the release date.', vi: 'Tôi muốn báo sớm một rủi ro: việc này có thể không kịp ngày phát hành.'}
        ]
      },
      {
        title: {en: 'Running and closing a meeting', vi: 'Điều phối và kết thúc cuộc họp'},
        phrases: [
          {en: 'Shall we get started? Today we need to agree on the API contract.', vi: 'Chúng ta bắt đầu nhé? Hôm nay cần thống nhất API contract.'},
          {en: 'Let\'s park that topic and discuss it offline.', vi: 'Tạm gác chủ đề đó, mình trao đổi riêng sau.'},
          {en: 'We\'re running out of time, so let\'s wrap up.', vi: 'Sắp hết giờ rồi, mình chốt lại nhé.'},
          {en: 'To summarise: Minh will update the schema, and I\'ll fix the UI by Thursday.', vi: 'Tóm lại: Minh cập nhật schema, tôi sửa UI trước thứ Năm.'},
          {en: 'I\'ll send the meeting notes and action items after this call.', vi: 'Tôi sẽ gửi biên bản và danh sách việc cần làm sau buổi họp.'}
        ]
      },
      {
        title: {en: 'Interrupting politely', vi: 'Ngắt lời lịch sự'},
        phrases: [
          {en: 'Sorry to interrupt, but I think we\'re mixing up two issues.', vi: 'Xin lỗi ngắt lời, nhưng mình nghĩ đang lẫn hai vấn đề.'},
          {en: 'Can I add something quickly?', vi: 'Mình bổ sung nhanh một ý được không?'},
          {en: 'Before we move on, I have a quick question.', vi: 'Trước khi chuyển ý, mình có câu hỏi nhanh.'},
          {en: 'Sorry, please finish your point first.', vi: 'Xin lỗi, bạn nói hết ý trước đi.'},
          {en: 'Going back to what Lan said earlier…', vi: 'Quay lại điều Lan nói lúc nãy…'},
          {en: 'I\'d like to hear from Nam, who hasn\'t had a chance to speak yet.', vi: 'Mình muốn nghe ý kiến của Nam, bạn ấy chưa có dịp nói.'}
        ]
      },
      {
        title: {en: 'Reaching a decision', vi: 'Đi đến quyết định'},
        phrases: [
          {en: 'It sounds like we agree on the approach. Any objections?', vi: 'Có vẻ mọi người đồng ý với hướng này. Có ai phản đối không?'},
          {en: 'We don\'t have enough information to decide today.', vi: 'Hôm nay chưa đủ thông tin để quyết định.'},
          {en: 'Who\'s the decision maker here?', vi: 'Ai là người ra quyết định ở đây?'},
          {en: 'Let\'s timebox this discussion to ten minutes.', vi: 'Giới hạn thảo luận này trong mười phút.'},
          {en: 'Let\'s go with option B and review it in two weeks.', vi: 'Chọn phương án B và xem lại sau hai tuần.'},
          {en: 'I\'ll write the decision and the reasons in the ticket.', vi: 'Mình sẽ ghi quyết định và lý do vào ticket.'}
        ]
      },
      {
        title: {en: 'Chat messages during online meetings', vi: 'Tin nhắn chat trong lúc họp online'},
        phrases: [
          {en: 'Plus one to what Lan said.', vi: '"+1" = mình đồng ý với ý đó.'},
          {en: 'Sorry, I have to drop off for another call.', vi: 'Xin lỗi, mình phải rời để vào cuộc họp khác.'},
          {en: 'Be right back. Two minutes.', vi: '"brb" = be right back, quay lại ngay.'},
          {en: 'Your audio is cutting out.', vi: 'Tiếng của bạn bị ngắt quãng.'},
          {en: 'Here\'s the link to the doc we\'re discussing.', vi: 'Đây là link tài liệu đang thảo luận.'},
          {en: 'Can someone share the recording afterwards?', vi: 'Ai đó chia sẻ bản ghi sau buổi họp được không?'},
          {en: 'I\'ll answer this question in the chat to save time.', vi: 'Mình trả lời câu này trong chat cho đỡ mất thời gian.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Giving your opinion in a discussion', vi: 'Nêu ý kiến trong cuộc thảo luận'},
        body: `From my point of view, we should [proposal].
The main reason is [reason], for example [example or number].
I see the concern about [other person's point], and we could handle it by [mitigation].
What do you think?`
      },
      {
        title: {en: 'Running a short meeting', vi: 'Điều phối một cuộc họp ngắn'},
        body: `Thanks for joining. Today we need to [goal] in [minutes] minutes.
Agenda: [topic 1], [topic 2], then next steps.
[...]
To summarize: we agreed on [decision]. [Name] will [action] by [date].
I'll send the notes after the call.`
      }
    ]
  },
  {
    id: 'standup',
    groups: [
      {
        title: {en: 'Yesterday', vi: 'Hôm qua'},
        tip: {en: 'Keep the whole update under one minute. Talk about outcomes, not every small step.', vi: 'Giữ cả phần báo cáo dưới 1 phút. Nói kết quả, không kể từng bước nhỏ.'},
        phrases: [
          {en: 'Yesterday I finished the validation for the transfer API and opened a pull request.', vi: 'Hôm qua tôi hoàn thành phần validation cho API chuyển khoản và tạo pull request.'},
          {en: 'I fixed the bug where the dashboard showed the wrong currency.', vi: 'Tôi đã sửa bug dashboard hiển thị sai loại tiền.'},
          {en: 'I spent most of the day investigating the slow report query.', vi: 'Phần lớn hôm qua tôi điều tra câu truy vấn báo cáo bị chậm.'},
          {en: 'I reviewed two pull requests and paired with Lan on the login flow.', vi: 'Tôi review hai pull request và pair với Lan về luồng đăng nhập.'}
        ]
      },
      {
        title: {en: 'Today', vi: 'Hôm nay'},
        phrases: [
          {en: 'Today I\'m going to address the review comments and merge the PR.', vi: 'Hôm nay tôi sẽ xử lý các comment review và merge PR.'},
          {en: 'I\'ll start working on the export-to-Excel feature.', vi: 'Tôi sẽ bắt đầu làm tính năng xuất Excel.'},
          {en: 'I plan to write unit tests for the payment service.', vi: 'Tôi dự định viết unit test cho payment service.'},
          {en: 'I\'ll deploy the fix to staging and ask QA to verify it.', vi: 'Tôi sẽ deploy bản sửa lên staging và nhờ QA kiểm tra.'}
        ]
      },
      {
        title: {en: 'Blockers', vi: 'Vướng mắc'},
        phrases: [
          {en: 'No blockers for now.', vi: 'Hiện tại không có vướng mắc.'},
          {en: 'I\'m blocked by the missing API spec from the partner team.', vi: 'Tôi đang bị chặn vì thiếu API spec từ nhóm đối tác.'},
          {en: 'I\'m waiting for access to the staging database.', vi: 'Tôi đang chờ quyền truy cập database staging.'},
          {en: 'I might need some help from someone who knows the billing module.', vi: 'Có thể tôi cần ai đó rành module billing hỗ trợ.'},
          {en: 'Can we take this offline after the stand-up?', vi: 'Mình trao đổi riêng việc này sau stand-up nhé?'}
        ]
      },
      {
        title: {en: 'End-of-day report', vi: 'Báo cáo cuối ngày'},
        tip: {en: 'Write it in 3–5 lines: done, in progress, next, risks. Link the ticket or PR.', vi: 'Viết 3–5 dòng: đã xong, đang làm, tiếp theo, rủi ro. Gắn link ticket hoặc PR.'},
        phrases: [
          {en: 'Here\'s my update for today.', vi: 'Đây là cập nhật công việc hôm nay của tôi.'},
          {en: 'I completed the search API and it\'s now in code review.', vi: 'Tôi đã hoàn thành API tìm kiếm và đang chờ code review.'},
          {en: 'The import job is about 70% done; I\'ll finish the error handling tomorrow morning.', vi: 'Job import xong khoảng 70%; sáng mai tôi sẽ làm nốt phần xử lý lỗi.'},
          {en: 'I couldn\'t finish the migration because the test data wasn\'t ready.', vi: 'Tôi chưa xong phần migration vì dữ liệu test chưa sẵn sàng.'},
          {en: 'The fix is deployed to staging and ready for QA.', vi: 'Bản sửa đã deploy lên staging và sẵn sàng cho QA.'},
          {en: 'One risk: the third-party API is slower than expected, so the estimate may slip by a day.', vi: 'Một rủi ro: API bên thứ ba chậm hơn dự kiến, nên ước lượng có thể trễ một ngày.'},
          {en: 'Tomorrow I\'ll focus on the unit tests and the release notes.', vi: 'Ngày mai tôi sẽ tập trung vào unit test và release notes.'},
          {en: 'No blockers. Have a good evening, everyone.', vi: 'Không có vướng mắc. Chúc mọi người buổi tối vui vẻ.'}
        ]
      },
      {
        title: {en: 'Daily demo', vi: 'Demo hằng ngày'},
        tip: {en: 'Say what the demo shows before you click. Prepare the data and a backup recording.', vi: 'Nói trước demo sẽ cho thấy gì rồi mới bấm. Chuẩn bị sẵn dữ liệu và một bản ghi hình dự phòng.'},
        phrases: [
          {en: 'Let me share my screen. Can everyone see it?', vi: 'Để tôi chia sẻ màn hình. Mọi người thấy chưa ạ?'},
          {en: 'Today I\'d like to show you the new export feature.', vi: 'Hôm nay tôi muốn cho mọi người xem tính năng xuất file mới.'},
          {en: 'The goal is to let users download their statements as Excel.', vi: 'Mục tiêu là cho người dùng tải sao kê dưới dạng Excel.'},
          {en: 'First, I\'ll log in as a normal user. Then I\'ll open the statements page.', vi: 'Đầu tiên tôi đăng nhập bằng user thường. Sau đó tôi mở trang sao kê.'},
          {en: 'As you can see, the file is generated in about two seconds.', vi: 'Như mọi người thấy, file được tạo trong khoảng hai giây.'},
          {en: 'Now let me show what happens when the input is invalid.', vi: 'Giờ tôi cho xem chuyện gì xảy ra khi dữ liệu đầu vào không hợp lệ.'},
          {en: 'This part is still a work in progress, so the styling isn\'t final.', vi: 'Phần này vẫn đang làm dở nên giao diện chưa hoàn chỉnh.'},
          {en: 'It looks like the demo environment is slow. Let me show the recording instead.', vi: 'Có vẻ môi trường demo đang chậm. Để tôi cho xem bản ghi hình thay thế.'},
          {en: 'That\'s all for the demo. Any questions or feedback?', vi: 'Phần demo đến đây là hết. Mọi người có câu hỏi hay góp ý gì không?'},
          {en: 'Good point. I\'ll note it down and follow up after the meeting.', vi: 'Ý hay đấy. Tôi sẽ ghi lại và phản hồi sau cuộc họp.'}
        ]
      },
      {
        title: {en: 'Handling questions after a demo', vi: 'Xử lý câu hỏi sau demo'},
        phrases: [
          {en: 'Good question. Right now it only supports Excel, but CSV is planned for the next sprint.', vi: 'Câu hỏi hay. Hiện chỉ hỗ trợ Excel, CSV dự kiến ở sprint sau.'},
          {en: 'That\'s a bug I hadn\'t seen. Thanks for spotting it. I\'ll create a ticket.', vi: 'Đó là bug mình chưa thấy. Cảm ơn đã phát hiện. Mình sẽ tạo ticket.'},
          {en: 'That\'s out of scope for this story, but let\'s discuss it with the product owner.', vi: 'Phần đó ngoài phạm vi story này, nhưng mình trao đổi với product owner nhé.'},
          {en: 'The data here is test data, so the numbers look a bit strange.', vi: 'Dữ liệu ở đây là dữ liệu test nên số liệu trông hơi lạ.'},
          {en: 'Let me check and get back to you on the performance numbers.', vi: 'Để mình kiểm tra và phản hồi lại về số liệu hiệu năng.'},
          {en: 'Would you like me to show it on mobile as well?', vi: 'Bạn có muốn mình demo thêm trên mobile không?'}
        ]
      },
      {
        title: {en: 'Tricky stand-up situations', vi: 'Tình huống stand-up khó'},
        phrases: [
          {en: 'Not much to report today. I\'m still working on the same migration.', vi: 'Hôm nay không có gì mới. Mình vẫn đang làm phần migration đó.'},
          {en: 'I\'m picking up Lan\'s tickets while she\'s on leave.', vi: 'Mình đang nhận các ticket của Lan trong lúc bạn ấy nghỉ phép.'},
          {en: 'Yesterday was mostly meetings, so I didn\'t make much progress on the code.', vi: 'Hôm qua chủ yếu là họp nên code không tiến triển nhiều.'},
          {en: 'I underestimated this task. It\'ll take two more days.', vi: 'Mình đã ước lượng thấp task này. Cần thêm hai ngày.'},
          {en: 'I\'m new to this module, so I\'m still finding my way around.', vi: 'Mình mới làm module này nên vẫn đang tìm hiểu.'},
          {en: 'Quick heads-up: I\'ll be offline this afternoon for a doctor\'s appointment.', vi: 'Báo nhanh: chiều nay mình offline vì có lịch khám bệnh.'}
        ]
      },
      {
        title: {en: 'Friday wrap-up', vi: 'Tổng kết tuần (chiều thứ Sáu)'},
        phrases: [
          {en: 'Quick wrap-up for the week: we closed eight tickets and released one hotfix.', vi: 'Tổng kết nhanh tuần này: nhóm đóng tám ticket và phát hành một bản hotfix.'},
          {en: 'The biggest win was finishing the statement export.', vi: 'Thành quả lớn nhất là hoàn thành tính năng xuất sao kê.'},
          {en: 'One thing carried over is the bank API integration.', vi: 'Một việc chuyển sang tuần sau là tích hợp API ngân hàng.'},
          {en: 'Next week, the focus is testing and the client demo on Wednesday.', vi: 'Tuần sau tập trung vào test và buổi demo cho khách hàng thứ Tư.'},
          {en: 'Thanks, everyone, for a productive week. Have a great weekend!', vi: 'Cảm ơn mọi người vì một tuần làm việc hiệu quả. Cuối tuần vui vẻ!'}
        ]
      },
      {
        title: {en: 'Written daily update for a team in another time zone', vi: 'Cập nhật daily bằng văn bản cho team ở múi giờ khác'},
        phrases: [
          {en: 'Good morning from Hanoi! Here\'s my update before you start your day.', vi: 'Chào buổi sáng từ Hà Nội! Đây là cập nhật trước khi bạn bắt đầu ngày làm việc.'},
          {en: 'Done: the validation fix is merged and deployed to staging.', vi: 'Đã xong: bản sửa validation đã merge và deploy lên staging.'},
          {en: 'Next: I\'ll start the reconciliation report after your review.', vi: 'Tiếp theo: mình sẽ làm báo cáo đối soát sau khi bạn review.'},
          {en: 'Question for you: should rejected payments appear in the report?', vi: 'Câu hỏi cho bạn: các giao dịch bị từ chối có nên xuất hiện trong báo cáo không?'},
          {en: 'I\'ll check your reply first thing tomorrow.', vi: 'Sáng mai việc đầu tiên mình làm là xem phản hồi của bạn.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Daily stand-up', vi: 'Stand-up hằng ngày'},
        body: `Yesterday I [finished or worked on] [task], and [result or status].
Today I'm going to [main task]. I also plan to [secondary task].
Blockers: [none or I'm waiting for … or I need help with …].`
      },
      {
        title: {en: 'End-of-day report', vi: 'Báo cáo cuối ngày'},
        body: `Hi team, here's my update for today.
Done: [task] ([ticket or PR link]).
In progress: [task] — about [percent]% done, expected [date].
Next: tomorrow I'll [next task].
Risks and blockers: [none or risk and what I need].`
      },
      {
        title: {en: 'Daily demo script', vi: 'Kịch bản demo hằng ngày'},
        body: `Let me share my screen. Can everyone see it?
Today I'd like to show [feature]. The goal is to [user value].
First, I'll [step one]. Then I'll [step two].
As you can see, [result].
Now let me show [edge case or error case].
[Part] is still a work in progress, and the next step is [next step].
That's all for the demo. Any questions or feedback?`
      }
    ]
  },
  {
    id: 'reports',
    groups: [
      {
        title: {en: 'Weekly report', vi: 'Báo cáo tuần'},
        phrases: [
          {en: 'This week, we completed the user profile API and the first version of the settings page.', vi: 'Tuần này chúng tôi hoàn thành API hồ sơ người dùng và phiên bản đầu của trang cài đặt.'},
          {en: 'The import feature is about eighty percent done. The remaining part is error handling.', vi: 'Tính năng import xong khoảng 80%. Phần còn lại là xử lý lỗi.'},
          {en: 'We\'re on track for the release next Wednesday.', vi: 'Chúng tôi đang đúng tiến độ cho bản phát hành thứ Tư tới.'},
          {en: 'One task slipped because the requirements changed mid-week.', vi: 'Một việc bị trễ vì yêu cầu thay đổi giữa tuần.'},
          {en: 'Next week, our focus will be performance testing and bug fixing.', vi: 'Tuần sau chúng tôi tập trung kiểm thử hiệu năng và sửa bug.'}
        ]
      },
      {
        title: {en: 'Bi-weekly / sprint review', vi: 'Báo cáo 2 tuần / sprint review'},
        phrases: [
          {en: 'In this sprint, we committed to twelve stories and delivered ten.', vi: 'Sprint này chúng tôi cam kết 12 story và hoàn thành 10.'},
          {en: 'Two stories will be carried over because they depend on the external API.', vi: 'Hai story chuyển sang sprint sau vì phụ thuộc API bên ngoài.'},
          {en: 'Let me walk you through the new feature with a quick demo.', vi: 'Để tôi trình bày tính năng mới qua một demo ngắn.'},
          {en: 'As you can see, the page now loads in under one second.', vi: 'Như mọi người thấy, trang giờ tải dưới một giây.'},
          {en: 'Our velocity was slightly lower because of two production incidents.', vi: 'Velocity hơi thấp do có hai sự cố production.'},
          {en: 'For the next sprint, we\'re planning to focus on the reporting module.', vi: 'Sprint tới chúng tôi dự định tập trung vào module báo cáo.'}
        ]
      },
      {
        title: {en: 'Risks, delays and retrospective', vi: 'Rủi ro, chậm trễ và retrospective'},
        phrases: [
          {en: 'The main risk is the dependency on the third-party payment gateway.', vi: 'Rủi ro chính là phụ thuộc vào cổng thanh toán bên thứ ba.'},
          {en: 'To reduce the risk, we\'ve added a fallback and more monitoring.', vi: 'Để giảm rủi ro, chúng tôi đã thêm phương án dự phòng và giám sát.'},
          {en: 'What went well: code reviews were faster and more focused.', vi: 'Điều làm tốt: code review nhanh và tập trung hơn.'},
          {en: 'What could be improved: we underestimated the testing effort.', vi: 'Điều cần cải thiện: chúng tôi ước lượng thiếu công sức kiểm thử.'},
          {en: 'As an action item, we\'ll add a testing estimate to every story.', vi: 'Hành động tiếp theo: thêm ước lượng kiểm thử cho mỗi story.'}
        ]
      },
      {
        title: {en: 'Monthly and quarterly reports', vi: 'Báo cáo tháng và quý'},
        phrases: [
          {en: 'This month, we delivered three of the four planned features.', vi: 'Tháng này nhóm giao được ba trên bốn tính năng đã lên kế hoạch.'},
          {en: 'We\'re on track for the quarterly goal.', vi: 'Nhóm đang đúng tiến độ cho mục tiêu quý.'},
          {en: 'We\'re slightly behind on the migration, mainly because of vendor delays.', vi: 'Nhóm hơi chậm phần migration, chủ yếu do nhà cung cấp chậm trễ.'},
          {en: 'Production incidents went down from five to one.', vi: 'Số sự cố production giảm từ năm xuống một.'},
          {en: 'Our biggest achievement this quarter was launching the AI import.', vi: 'Thành tựu lớn nhất quý này là ra mắt tính năng AI import.'},
          {en: 'Next quarter, we\'ll focus on performance and reducing tech debt.', vi: 'Quý tới nhóm sẽ tập trung vào hiệu năng và giảm nợ kỹ thuật.'},
          {en: 'We need one more QA engineer to keep this pace.', vi: 'Nhóm cần thêm một kỹ sư QA để giữ được tốc độ này.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Weekly report', vi: 'Báo cáo tuần'},
        body: `Summary: Overall we are [on track or slightly behind] for [milestone].
Done this week:
- [feature or fix] — [impact]
In progress:
- [task] — [percentage]% done, expected by [day]
Risks and blockers:
- [risk] — [mitigation]
Next week:
- [priority 1]
- [priority 2]`
      },
      {
        title: {en: 'Bi-weekly / sprint review', vi: 'Báo cáo 2 tuần / sprint review'},
        body: `Sprint goal: [goal] — [achieved or partly achieved].
Delivered: [X] of [Y] stories ([story points] points).
Highlights: [demo item 1], [demo item 2].
Carried over: [story] because [reason].
Metrics: [bugs fixed or response time or test coverage].
Retro: went well — [..]; to improve — [..]; action — [..].
Next sprint focus: [..].`
      }
    ]
  },
  {
    id: 'techstack',
    groups: [
      {
        title: {en: 'Java and Spring Boot', vi: 'Java và Spring Boot'},
        phrases: [
          {en: 'This service is a Spring Boot application with a layered structure: controller, service and repository.', vi: 'Service này là ứng dụng Spring Boot theo lớp: controller, service và repository.'},
          {en: 'We inject dependencies through the constructor, which makes the class easier to test.', vi: 'Chúng tôi inject dependency qua constructor nên class dễ test hơn.'},
          {en: 'The method is annotated with @Transactional, so both updates are rolled back if one fails.', vi: 'Hàm có @Transactional nên cả hai cập nhật đều rollback nếu một cái lỗi.'},
          {en: 'We use virtual threads to handle many blocking I/O calls without a large thread pool.', vi: 'Chúng tôi dùng virtual thread để xử lý nhiều lời gọi I/O chặn mà không cần thread pool lớn.'},
          {en: 'Validation happens at the controller level with Bean Validation annotations.', vi: 'Việc validate thực hiện ở tầng controller bằng annotation Bean Validation.'},
          {en: 'We return a consistent error response instead of exposing the stack trace.', vi: 'Chúng tôi trả về lỗi theo định dạng thống nhất thay vì lộ stack trace.'}
        ]
      },
      {
        title: {en: 'Database and performance', vi: 'Database và hiệu năng'},
        phrases: [
          {en: 'The query was doing a full table scan, so we added a composite index.', vi: 'Câu truy vấn đang quét toàn bảng nên chúng tôi thêm composite index.'},
          {en: 'We had an N+1 problem, and we fixed it with a fetch join.', vi: 'Chúng tôi gặp lỗi N+1 và đã sửa bằng fetch join.'},
          {en: 'Schema changes go through Flyway migrations, and we never edit an applied migration.', vi: 'Thay đổi schema đi qua Flyway migration, và không bao giờ sửa migration đã chạy.'},
          {en: 'We store money as BigDecimal to avoid rounding errors.', vi: 'Chúng tôi lưu tiền bằng BigDecimal để tránh lỗi làm tròn.'},
          {en: 'We added a cache, but we need a clear strategy for invalidation.', vi: 'Chúng tôi đã thêm cache nhưng cần chiến lược invalidation rõ ràng.'}
        ]
      },
      {
        title: {en: 'Angular and front end', vi: 'Angular và front end'},
        phrases: [
          {en: 'The page is a standalone component, and its state is managed with Signals.', vi: 'Trang là standalone component và state được quản lý bằng Signals.'},
          {en: 'The feature route is lazy-loaded, so it doesn\'t increase the initial bundle size.', vi: 'Route của tính năng được lazy-load nên không làm tăng bundle ban đầu.'},
          {en: 'An HTTP interceptor attaches the token and refreshes it when it expires.', vi: 'HTTP interceptor gắn token và làm mới khi token hết hạn.'},
          {en: 'We show explicit loading, empty and error states for every list.', vi: 'Chúng tôi hiển thị rõ trạng thái đang tải, trống và lỗi cho mọi danh sách.'},
          {en: 'The layout is responsive and supports both light and dark mode.', vi: 'Giao diện responsive và hỗ trợ cả chế độ sáng và tối.'}
        ]
      },
      {
        title: {en: 'Architecture and integration', vi: 'Kiến trúc và tích hợp'},
        phrases: [
          {en: 'We chose a modular monolith because the team is small and the domains are still changing.', vi: 'Chúng tôi chọn modular monolith vì nhóm nhỏ và domain còn thay đổi.'},
          {en: 'The two services communicate asynchronously through RabbitMQ.', vi: 'Hai service giao tiếp bất đồng bộ qua RabbitMQ.'},
          {en: 'The consumer is idempotent, so a redelivered message doesn\'t create duplicates.', vi: 'Consumer có tính idempotent nên message gửi lại không tạo bản ghi trùng.'},
          {en: 'The pros are simplicity and speed; the cons are tighter coupling.', vi: 'Ưu điểm là đơn giản và nhanh; nhược điểm là phụ thuộc chặt hơn.'},
          {en: 'If traffic grows, we can scale this part horizontally behind the load balancer.', vi: 'Nếu lưu lượng tăng, có thể scale ngang phần này phía sau load balancer.'}
        ]
      },
      {
        title: {en: 'Code review', vi: 'Code review'},
        tip: {en: 'Comment on the code, not the person. Use questions and "we" instead of "you".', vi: 'Nhận xét code, không nhận xét người. Dùng câu hỏi và "we" thay cho "you".'},
        phrases: [
          {en: 'Nice work. I just have a couple of small suggestions.', vi: 'Làm tốt lắm. Tôi chỉ có vài góp ý nhỏ.'},
          {en: 'What do you think about extracting this logic into a separate method?', vi: 'Bạn nghĩ sao về việc tách logic này ra một hàm riêng?'},
          {en: 'Could we add a test for the case where the list is empty?', vi: 'Mình thêm test cho trường hợp danh sách rỗng được không?'},
          {en: 'This might cause a race condition if two requests arrive at the same time.', vi: 'Chỗ này có thể gây race condition nếu hai request đến cùng lúc.'},
          {en: 'Nit: the variable name could be more descriptive. Not a blocker.', vi: 'Nit: tên biến có thể rõ nghĩa hơn. Không bắt buộc.'},
          {en: 'Good catch, thanks. I\'ve updated it.', vi: 'Phát hiện hay, cảm ơn. Tôi đã sửa rồi.'}
        ]
      },
      {
        title: {en: 'Debugging and incidents', vi: 'Debug và sự cố'},
        phrases: [
          {en: 'I can reproduce the bug locally, but only with production data.', vi: 'Tôi tái hiện được bug ở local nhưng chỉ với dữ liệu production.'},
          {en: 'According to the logs, the request times out after thirty seconds.', vi: 'Theo log, request bị timeout sau 30 giây.'},
          {en: 'The root cause was a missing null check after the last refactoring.', vi: 'Nguyên nhân gốc là thiếu kiểm tra null sau lần refactor gần nhất.'},
          {en: 'We rolled back the release and the error rate went back to normal.', vi: 'Chúng tôi rollback bản phát hành và tỉ lệ lỗi trở lại bình thường.'},
          {en: 'To prevent this, we\'ve added an alert and a regression test.', vi: 'Để phòng ngừa, chúng tôi đã thêm cảnh báo và regression test.'}
        ]
      },
      {
        title: {en: 'Testing and quality', vi: 'Kiểm thử và chất lượng'},
        phrases: [
          {en: 'We use JUnit 5 and Mockito for unit tests, and Testcontainers for integration tests.', vi: 'Dùng JUnit 5 và Mockito cho unit test, Testcontainers cho integration test.'},
          {en: 'Every bug fix comes with a regression test.', vi: 'Mỗi lần sửa bug đều kèm một regression test.'},
          {en: 'The pipeline blocks the merge if any test fails.', vi: 'Pipeline chặn merge nếu có test nào fail.'},
          {en: 'We test against MySQL in a container instead of an in-memory database.', vi: 'Test với MySQL trong container thay vì database trong bộ nhớ.'},
          {en: 'Static analysis runs on every pull request.', vi: 'Phân tích tĩnh chạy cho mọi pull request.'}
        ]
      },
      {
        title: {en: 'Security in our stack', vi: 'Bảo mật trong hệ thống'},
        phrases: [
          {en: 'Authentication uses short-lived JWTs and refresh tokens in HttpOnly cookies.', vi: 'Xác thực dùng JWT ngắn hạn và refresh token trong cookie HttpOnly.'},
          {en: 'Every query is scoped to the current user, so ownership is enforced on the server.', vi: 'Mọi query đều giới hạn theo người dùng hiện tại nên quyền sở hữu được kiểm soát ở server.'},
          {en: 'Provider credentials are encrypted in the database with a master key.', vi: 'Thông tin đăng nhập nhà cung cấp được mã hóa trong database bằng master key.'},
          {en: 'We never log tokens, passwords or financial payloads.', vi: 'Không bao giờ log token, mật khẩu hay dữ liệu tài chính.'},
          {en: 'Errors return a stable code and a trace ID, never a stack trace.', vi: 'Lỗi trả về mã ổn định và trace ID, không bao giờ trả stack trace.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Explaining a technical decision', vi: 'Trình bày một quyết định kỹ thuật'},
        body: `The problem was [problem and its impact].
We considered [option A] and [option B].
Option A is [pros], but [cons]. Option B is [pros], but [cons].
We chose [option] because [main reason], and we accept [trade-off].
If [condition changes], we'll revisit this decision.`
      },
      {
        title: {en: 'Incident summary', vi: 'Tóm tắt sự cố'},
        body: `Impact: From [time] to [time], [users or feature] were affected: [symptom].
Root cause: [cause].
Fix: We [rolled back or patched or scaled] [component].
Prevention: [test or alert or process change], owned by [name], due [date].`
      }
    ]
  },
  {
    id: 'office',
    groups: [
      {
        title: {en: 'Greetings and small talk', vi: 'Chào hỏi và nói chuyện xã giao'},
        phrases: [
          {en: 'Good morning! How\'s it going?', vi: 'Chào buổi sáng! Mọi việc thế nào?'},
          {en: 'Not bad, thanks. How about you?', vi: 'Cũng ổn, cảm ơn. Còn bạn thì sao?'},
          {en: 'How was your weekend?', vi: 'Cuối tuần của bạn thế nào?'},
          {en: 'Hi, I\'m Minh. I just joined the backend team.', vi: 'Chào, mình là Minh. Mình mới vào nhóm backend.'},
          {en: 'Nice to meet you. Which project are you working on?', vi: 'Rất vui được gặp bạn. Bạn đang làm dự án nào?'},
          {en: 'Are you going to grab lunch? Mind if I join you?', vi: 'Bạn đi ăn trưa à? Mình đi cùng được không?'},
          {en: 'See you tomorrow. Have a nice evening!', vi: 'Hẹn gặp mai nhé. Chúc buổi tối vui vẻ!'}
        ]
      },
      {
        title: {en: 'Polite requests and thanks', vi: 'Nhờ vả lịch sự và cảm ơn'},
        tip: {en: 'Could you… / Would you mind… sound softer than Can you… or a bare command.', vi: 'Could you… / Would you mind… nghe nhẹ nhàng hơn Can you… hoặc câu ra lệnh.'},
        phrases: [
          {en: 'Could you give me a hand with this for a minute?', vi: 'Bạn giúp mình việc này một chút được không?'},
          {en: 'Would you mind sending me the link again?', vi: 'Bạn gửi lại giúp mình đường link được không?'},
          {en: 'Do you have a few minutes? I have a quick question.', vi: 'Bạn có vài phút không? Mình có câu hỏi nhanh.'},
          {en: 'Sorry to bother you, but where can I find the design document?', vi: 'Xin lỗi làm phiền, mình tìm tài liệu thiết kế ở đâu vậy?'},
          {en: 'Thanks a lot, that really helped.', vi: 'Cảm ơn nhiều, giúp ích cho mình lắm.'},
          {en: 'No problem. Let me know if you need anything else.', vi: 'Không có gì. Cần gì thêm cứ báo mình nhé.'},
          {en: 'I appreciate your quick reply.', vi: 'Cảm ơn bạn đã phản hồi nhanh.'}
        ]
      },
      {
        title: {en: 'Office items', vi: 'Vật dụng văn phòng'},
        tip: {en: 'Learn each item inside a sentence, not as a single word.', vi: 'Học mỗi vật dụng trong một câu, không học từ đơn lẻ.'},
        phrases: [
          {en: 'Can I borrow your charger? My laptop is almost dead.', vi: 'Cho mình mượn sạc được không? Laptop mình sắp hết pin. (charger: sạc)'},
          {en: 'The printer on this floor is out of paper again.', vi: 'Máy in ở tầng này lại hết giấy. (printer: máy in)'},
          {en: 'Let me draw the flow on the whiteboard.', vi: 'Để mình vẽ luồng lên bảng trắng. (whiteboard: bảng trắng, marker: bút lông)'},
          {en: 'The projector in meeting room B isn\'t working.', vi: 'Máy chiếu ở phòng họp B không hoạt động. (projector: máy chiếu)'},
          {en: 'Do you have an HDMI adapter for a USB-C laptop?', vi: 'Bạn có đầu chuyển HDMI cho laptop cổng USB-C không? (adapter: đầu chuyển)'},
          {en: 'I need a second monitor and an external keyboard.', vi: 'Mình cần thêm một màn hình phụ và bàn phím rời. (monitor, keyboard, mouse)'},
          {en: 'Could you staple these pages and put them in a folder?', vi: 'Bạn bấm ghim mấy trang này và cho vào bìa hồ sơ giúp mình nhé? (stapler, folder)'},
          {en: 'I left my headset in the pantry.', vi: 'Mình để quên tai nghe ở phòng pantry. (headset: tai nghe có mic, pantry: phòng ăn nhỏ)'},
          {en: 'My access card doesn\'t open the main door.', vi: 'Thẻ ra vào của mình không mở được cửa chính. (access card / badge)'},
          {en: 'Please write it on a sticky note so I don\'t forget.', vi: 'Ghi lên giấy note giúp mình để mình khỏi quên. (sticky note: giấy note)'}
        ]
      },
      {
        title: {en: 'Meeting rooms and schedules', vi: 'Phòng họp và lịch làm việc'},
        phrases: [
          {en: 'I\'ve booked meeting room A from two to three.', vi: 'Mình đã đặt phòng họp A từ 2 đến 3 giờ.'},
          {en: 'Is this room free right now?', vi: 'Phòng này bây giờ có trống không?'},
          {en: 'I\'ll send you a calendar invite.', vi: 'Mình sẽ gửi bạn lời mời trên lịch.'},
          {en: 'Can we move our one-on-one to Thursday?', vi: 'Mình dời buổi họp 1-1 sang thứ Năm được không?'},
          {en: 'I\'m working from home today, so let\'s meet online.', vi: 'Hôm nay mình làm ở nhà nên họp online nhé.'},
          {en: 'I\'ll be out of the office on Friday.', vi: 'Thứ Sáu mình không có mặt ở văn phòng.'}
        ]
      },
      {
        title: {en: 'Pantry, facilities and office rules', vi: 'Pantry, tiện ích và nội quy'},
        phrases: [
          {en: 'Where can I get a glass of water?', vi: 'Mình lấy nước uống ở đâu?'},
          {en: 'The coffee machine is out of order again.', vi: 'Máy pha cà phê lại hỏng rồi.'},
          {en: 'Please label your food before you put it in the fridge.', vi: 'Vui lòng ghi tên lên đồ ăn trước khi để vào tủ lạnh.'},
          {en: 'Could you turn the air conditioning down a bit? It\'s freezing.', vi: 'Bạn chỉnh điều hòa ấm hơn chút được không? Lạnh quá. (turn down = giảm)'},
          {en: 'Is it okay to take a phone call here, or should I go to a phone booth?', vi: 'Nghe điện thoại ở đây được không, hay mình nên vào phòng gọi riêng?'},
          {en: 'Visitors need to sign in at reception.', vi: 'Khách đến cần đăng ký ở lễ tân.'},
          {en: 'There\'s a fire drill at three this afternoon.', vi: 'Chiều nay 3 giờ có diễn tập phòng cháy.'}
        ]
      },
      {
        title: {en: 'Finding your way around the office', vi: 'Tìm đường trong văn phòng'},
        phrases: [
          {en: 'Excuse me, where is meeting room Saigon?', vi: 'Xin lỗi, phòng họp Saigon ở đâu vậy?'},
          {en: 'It\'s on the fifth floor, next to the lifts.', vi: 'Ở tầng 5, cạnh thang máy. (lift = Anh, elevator = Mỹ)'},
          {en: 'Go down the corridor and turn left. It\'s the second door on the right.', vi: 'Đi dọc hành lang rồi rẽ trái. Cửa thứ hai bên phải.'},
          {en: 'The restrooms are at the end of the hall.', vi: 'Nhà vệ sinh ở cuối hành lang.'},
          {en: 'Is there a quiet room where I can take a call?', vi: 'Có phòng yên tĩnh nào để mình nghe điện thoại không?'},
          {en: 'I\'ll walk you there. It\'s on my way.', vi: 'Để mình dẫn bạn đi. Tiện đường mình.'}
        ]
      },
      {
        title: {en: 'Stationery and furniture', vi: 'Văn phòng phẩm và nội thất'},
        phrases: [
          {en: 'Could you pass me the stapler and a few paper clips?', vi: 'Đưa giúp mình cái dập ghim và vài cái kẹp giấy. (stapler, paper clip)'},
          {en: 'I need scissors and some tape to wrap this gift.', vi: 'Mình cần kéo và băng dính để gói món quà này. (scissors, tape)'},
          {en: 'Please put the signed contracts in the filing cabinet.', vi: 'Để các hợp đồng đã ký vào tủ hồ sơ nhé. (filing cabinet)'},
          {en: 'Confidential documents go in the shredder, not the bin.', vi: 'Tài liệu mật bỏ vào máy hủy giấy, không bỏ thùng rác. (shredder, bin)'},
          {en: 'My chair is broken. Can I get a new one?', vi: 'Ghế của mình bị hỏng. Mình xin cái mới được không? (chair)'},
          {en: 'Is there a standing desk I can use?', vi: 'Có bàn làm việc đứng nào mình dùng được không? (standing desk)'},
          {en: 'I need an envelope to send this letter.', vi: 'Mình cần một phong bì để gửi thư này. (envelope)'},
          {en: 'There are notebooks and pens in the supply cupboard.', vi: 'Sổ và bút có trong tủ đồ dùng chung. (supply cupboard)'}
        ]
      },
      {
        title: {en: 'Electronics and facilities', vi: 'Thiết bị điện tử và tiện ích'},
        phrases: [
          {en: 'Is there a docking station at this desk?', vi: 'Bàn này có docking station không? (bộ cắm mở rộng cho laptop)'},
          {en: 'I need an extension cord. The socket is too far.', vi: 'Mình cần ổ cắm nối dài. Ổ điện xa quá. (extension cord, socket)'},
          {en: 'My webcam isn\'t working. Can I borrow one for the call?', vi: 'Webcam của mình không chạy. Mình mượn một cái để họp được không? (webcam)'},
          {en: 'Please don\'t plug in USB sticks you find. They could be unsafe.', vi: 'Đừng cắm USB nhặt được. Có thể không an toàn. (USB stick)'},
          {en: 'You can keep your bag in a locker.', vi: 'Bạn có thể cất túi vào tủ khóa cá nhân. (locker)'},
          {en: 'The water dispenser is next to the pantry.', vi: 'Cây nước nằm cạnh phòng pantry. (water dispenser)'},
          {en: 'Can I use the microwave to heat up my lunch?', vi: 'Mình dùng lò vi sóng hâm cơm trưa được không? (microwave)'},
          {en: 'The vending machine only takes cards.', vi: 'Máy bán hàng tự động chỉ nhận thẻ. (vending machine)'}
        ]
      },
      {
        title: {en: 'Everyday short responses', vi: 'Câu đáp ngắn hằng ngày'},
        tip: {en: 'A short, warm reply sounds more natural than just "Yes" or "No". Vary them.', vi: 'Câu đáp ngắn mà thân thiện nghe tự nhiên hơn chỉ nói "Yes" hay "No". Hãy thay đổi cách đáp.'},
        phrases: [
          {en: 'Sure, no problem.', vi: 'Được thôi, không vấn đề gì. (đồng ý giúp)'},
          {en: 'Absolutely.', vi: 'Hoàn toàn đồng ý / chắc chắn rồi.'},
          {en: 'I\'m afraid not.', vi: 'E là không. (từ chối lịch sự)'},
          {en: 'Not really.', vi: 'Không hẳn. (phủ nhận nhẹ nhàng)'},
          {en: 'I\'m not sure. Let me check.', vi: 'Mình không chắc. Để mình kiểm tra.'},
          {en: 'That\'s right. Exactly.', vi: 'Đúng vậy. Chính xác.'},
          {en: 'I see. That makes sense.', vi: 'Mình hiểu rồi. Hợp lý đấy.'},
          {en: 'Got it, thanks.', vi: 'Rõ rồi, cảm ơn.'},
          {en: 'Fair point.', vi: 'Ý đó hợp lý.'},
          {en: 'Good to know.', vi: 'Biết vậy cũng tốt. (khi nhận thông tin mới)'},
          {en: 'Me too. Same here.', vi: 'Mình cũng vậy.'},
          {en: 'You\'re welcome. Anytime.', vi: 'Không có gì. Cần lúc nào cũng được.'}
        ]
      },
      {
        title: {en: 'Ordering food and team treats', vi: 'Đặt đồ ăn và đãi cả nhóm'},
        phrases: [
          {en: 'I\'m ordering bubble tea for the team. What would you like?', vi: 'Mình đặt trà sữa cho cả nhóm. Bạn muốn uống gì?'},
          {en: 'Less sugar and less ice, please.', vi: 'Ít đường, ít đá nhé.'},
          {en: 'It\'s my treat today to celebrate the release.', vi: 'Hôm nay mình mời để ăn mừng bản release.'},
          {en: 'The food has arrived. It\'s in the pantry.', vi: 'Đồ ăn đến rồi, để ở pantry nhé.'},
          {en: 'Does anyone have dietary restrictions?', vi: 'Có ai ăn kiêng hay kiêng món gì không?'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Introducing yourself to a new team', vi: 'Giới thiệu bản thân với nhóm mới'},
        body: `Hi everyone, I'm [name]. I just joined as a [role] on the [team] team.
Before this, I worked on [previous project or domain].
I'll mainly work on [area] here. Feel free to reach out if you need help with [skill].
Looking forward to working with you all!`
      }
    ]
  },
  {
    id: 'situations',
    groups: [
      {
        title: {en: 'Running late, leave and absence', vi: 'Đến muộn, xin nghỉ và vắng mặt'},
        phrases: [
          {en: 'Sorry, I\'m running about fifteen minutes late because of heavy traffic.', vi: 'Xin lỗi, mình sẽ đến muộn khoảng 15 phút vì kẹt xe.'},
          {en: 'I\'m not feeling well today, so I\'d like to take a sick day.', vi: 'Hôm nay mình không khỏe nên xin nghỉ ốm một ngày.'},
          {en: 'I\'d like to request a day off next Monday for a family matter.', vi: 'Mình xin nghỉ thứ Hai tới vì việc gia đình.'},
          {en: 'I have to leave an hour early today. I\'ll make up the time tomorrow.', vi: 'Hôm nay mình phải về sớm một tiếng. Mai mình sẽ làm bù.'},
          {en: 'While I\'m away, Nam will cover the support tickets.', vi: 'Trong lúc mình vắng, Nam sẽ xử lý các ticket hỗ trợ.'}
        ]
      },
      {
        title: {en: 'Online call problems', vi: 'Sự cố khi họp online'},
        phrases: [
          {en: 'Sorry, you\'re breaking up. Could you say that again?', vi: 'Xin lỗi, tiếng bạn bị ngắt quãng. Bạn nói lại được không?'},
          {en: 'I think you\'re on mute.', vi: 'Hình như bạn đang tắt mic.'},
          {en: 'My internet is unstable, so I\'ll turn off my camera.', vi: 'Mạng của mình không ổn định nên mình sẽ tắt camera.'},
          {en: 'Can you see my screen now?', vi: 'Giờ bạn thấy màn hình của mình chưa?'},
          {en: 'I got disconnected. What did I miss?', vi: 'Mình vừa bị rớt mạng. Mình đã bỏ lỡ gì vậy?'},
          {en: 'Let me rejoin the call.', vi: 'Để mình vào lại cuộc gọi.'}
        ]
      },
      {
        title: {en: 'IT and access problems', vi: 'Sự cố IT và quyền truy cập'},
        phrases: [
          {en: 'I can\'t connect to the VPN. Is anyone else having the same issue?', vi: 'Mình không kết nối được VPN. Có ai bị giống vậy không?'},
          {en: 'My account is locked. Who should I contact?', vi: 'Tài khoản của mình bị khóa. Mình nên liên hệ ai?'},
          {en: 'I don\'t have permission to access this repository yet.', vi: 'Mình chưa có quyền truy cập repository này.'},
          {en: 'I\'ve raised a ticket with IT and I\'m waiting for a reply.', vi: 'Mình đã tạo ticket cho IT và đang chờ phản hồi.'},
          {en: 'The build server seems to be down. I\'ll let the team know.', vi: 'Có vẻ build server đang lỗi. Mình sẽ báo cho cả nhóm.'}
        ]
      },
      {
        title: {en: 'Misunderstandings and apologies', vi: 'Hiểu nhầm và xin lỗi'},
        tip: {en: 'Own the mistake, give the fix, then move on. Don\'t over-apologize.', vi: 'Nhận lỗi, đưa ra cách khắc phục rồi tiếp tục. Đừng xin lỗi quá nhiều.'},
        phrases: [
          {en: 'Sorry, I think I misunderstood the requirement.', vi: 'Xin lỗi, mình nghĩ mình đã hiểu sai yêu cầu.'},
          {en: 'Just to make sure we\'re on the same page, you mean the monthly report, right?', vi: 'Để chắc là mình hiểu giống nhau, ý bạn là báo cáo tháng phải không?'},
          {en: 'My apologies for the late reply. I was in back-to-back meetings.', vi: 'Xin lỗi vì trả lời muộn. Mình họp liên tục từ sáng.'},
          {en: 'That was my mistake. I\'ve already fixed it and added a test.', vi: 'Đó là lỗi của mình. Mình đã sửa và thêm test rồi.'},
          {en: 'Sorry, I didn\'t catch your name.', vi: 'Xin lỗi, mình chưa nghe rõ tên bạn.'}
        ]
      },
      {
        title: {en: 'Saying no and managing workload', vi: 'Từ chối và quản lý khối lượng việc'},
        phrases: [
          {en: 'I\'d love to help, but I\'m fully booked today. Can it wait until tomorrow?', vi: 'Mình rất muốn giúp nhưng hôm nay kín việc rồi. Để mai được không?'},
          {en: 'If I take this on, the payment task will be delayed. Which one is the priority?', vi: 'Nếu mình nhận việc này thì task thanh toán sẽ bị trễ. Việc nào ưu tiên hơn?'},
          {en: 'I\'m not the best person for this, but Hoa knows that module well.', vi: 'Mình không phải người phù hợp nhất, nhưng Hoa rất rành module đó.'},
          {en: 'Can I get back to you after lunch?', vi: 'Sau bữa trưa mình trả lời bạn được không?'}
        ]
      },
      {
        title: {en: 'Handing over and following up', vi: 'Bàn giao và nhắc việc'},
        phrases: [
          {en: 'Just following up on my message from yesterday.', vi: 'Mình nhắc lại tin nhắn hôm qua của mình nhé.'},
          {en: 'Any update on the API spec?', vi: 'Có cập nhật gì về API spec chưa?'},
          {en: 'I\'ve written a handover note with the open tasks and links.', vi: 'Mình đã viết ghi chú bàn giao gồm các task còn mở và link liên quan.'},
          {en: 'Please ping me on Teams if anything is unclear.', vi: 'Có gì chưa rõ thì nhắn mình trên Teams nhé.'}
        ]
      },
      {
        title: {en: 'Feeling unwell or an emergency at work', vi: 'Không khỏe hoặc khẩn cấp tại công ty'},
        phrases: [
          {en: 'I have a terrible headache. I need to go home early.', vi: 'Mình đau đầu quá. Mình cần về sớm.'},
          {en: 'Is there a first aid kit on this floor?', vi: 'Tầng này có hộp sơ cứu không?'},
          {en: 'Someone fainted in the meeting room. Please call an ambulance.', vi: 'Có người ngất trong phòng họp. Gọi cấp cứu giúp với.'},
          {en: 'I have a family emergency and need to leave right now.', vi: 'Nhà mình có việc khẩn cấp, mình phải đi ngay.'},
          {en: 'I\'ll let my manager know and hand over the urgent task.', vi: 'Mình sẽ báo quản lý và bàn giao việc gấp.'}
        ]
      },
      {
        title: {en: 'Forgetting and losing things', vi: 'Quên và mất đồ'},
        phrases: [
          {en: 'I left my laptop charger at home. Does anyone have a spare one?', vi: 'Mình để quên sạc laptop ở nhà. Ai có cái dư không?'},
          {en: 'I think I lost my access card. Who should I report it to?', vi: 'Hình như mình mất thẻ ra vào. Mình báo cho ai?'},
          {en: 'I forgot my password and I\'m locked out of my account.', vi: 'Mình quên mật khẩu và bị khóa tài khoản.'},
          {en: 'Sorry, I completely forgot about our meeting. Can we reschedule?', vi: 'Xin lỗi, mình quên mất cuộc họp. Mình dời lịch được không?'},
          {en: 'Has anyone seen a black umbrella? I think I left it here.', vi: 'Có ai thấy chiếc ô màu đen không? Hình như mình để quên ở đây.'}
        ]
      },
      {
        title: {en: 'Weather, power and commuting', vi: 'Thời tiết, mất điện và đi lại'},
        phrases: [
          {en: 'My street is flooded after the heavy rain, so I\'ll work from home this morning.', vi: 'Đường nhà mình ngập sau mưa lớn nên sáng nay mình làm ở nhà.'},
          {en: 'There\'s a power cut in my area. I\'m on my phone\'s hotspot for now.', vi: 'Khu mình bị cúp điện. Tạm thời mình đang dùng 4G phát từ điện thoại.'},
          {en: 'A typhoon is expected tomorrow, so the office will be closed.', vi: 'Ngày mai dự báo có bão nên văn phòng sẽ đóng cửa.'},
          {en: 'Traffic is terrible today. I\'m stuck on the bridge.', vi: 'Hôm nay kẹt xe kinh khủng. Mình đang bị kẹt trên cầu.'},
          {en: 'My laptop battery is low and there\'s no power. I might drop off the call.', vi: 'Pin laptop yếu mà không có điện. Mình có thể rớt khỏi cuộc gọi.'},
          {en: 'Stay safe, everyone. Let\'s move the meeting to tomorrow.', vi: 'Mọi người giữ an toàn nhé. Mình dời cuộc họp sang ngày mai.'}
        ]
      },
      {
        title: {en: 'Noise and shared workspace', vi: 'Tiếng ồn và không gian làm việc chung'},
        phrases: [
          {en: 'Sorry, could you keep it down a little? I\'m on a call.', vi: 'Xin lỗi, bạn nói nhỏ lại một chút được không? Mình đang gọi điện.'},
          {en: 'Is anyone sitting here?', vi: 'Chỗ này có ai ngồi chưa?'},
          {en: 'Do you mind if I open the window?', vi: 'Mình mở cửa sổ được không?'},
          {en: 'I\'ve booked this desk for the morning, but you can use it after lunch.', vi: 'Mình đã đặt bàn này buổi sáng, sau bữa trưa bạn dùng được.'},
          {en: 'Sorry, I didn\'t realize I was so loud.', vi: 'Xin lỗi, mình không nhận ra là mình nói to vậy.'}
        ]
      },
      {
        title: {en: 'When you made a promise you can\'t keep', vi: 'Khi lỡ hứa mà không làm kịp'},
        phrases: [
          {en: 'I promised the fix by today, but I need one more day to test it properly.', vi: 'Mình đã hứa sửa xong hôm nay, nhưng cần thêm một ngày để test kỹ.'},
          {en: 'I\'d rather deliver it tomorrow than release something that isn\'t tested.', vi: 'Mình thà giao ngày mai còn hơn phát hành thứ chưa được test.'},
          {en: 'I should have told you earlier. Sorry about that.', vi: 'Lẽ ra mình nên báo sớm hơn. Xin lỗi nhé.'},
          {en: 'Is tomorrow at noon still okay for you?', vi: 'Trưa mai có còn ổn với bạn không?'},
          {en: 'In the meantime, here\'s a workaround you can use.', vi: 'Trong lúc chờ, đây là cách tạm thời bạn có thể dùng.'}
        ]
      },
      {
        title: {en: 'Hosting a foreign visitor at the office', vi: 'Đón khách nước ngoài tới văn phòng'},
        phrases: [
          {en: 'Welcome to our office! How was your trip?', vi: 'Chào mừng tới văn phòng! Chuyến đi của anh/chị thế nào?'},
          {en: 'Let me get you a visitor badge from reception.', vi: 'Để tôi lấy thẻ khách cho anh/chị ở lễ tân.'},
          {en: 'Can I get you some coffee or water?', vi: 'Anh/chị dùng cà phê hay nước không?'},
          {en: 'The meeting room is ready. Please follow me.', vi: 'Phòng họp đã sẵn sàng. Mời anh/chị đi theo tôi.'},
          {en: 'The Wi-Fi password is on the card on the table.', vi: 'Mật khẩu Wi-Fi ghi trên tấm thẻ trên bàn.'},
          {en: 'I\'ve booked a car to take you back to the hotel at six.', vi: 'Tôi đã đặt xe đưa anh/chị về khách sạn lúc 6 giờ.'}
        ]
      },
      {
        title: {en: 'When a message is misunderstood', vi: 'Khi tin nhắn bị hiểu lầm'},
        phrases: [
          {en: 'Sorry, my message sounded harsher than I meant.', vi: 'Xin lỗi, tin nhắn của mình nghe gay gắt hơn mình định.'},
          {en: 'I wasn\'t criticizing your work. I just wanted to understand the change.', vi: 'Mình không chê công việc của bạn. Mình chỉ muốn hiểu thay đổi đó.'},
          {en: 'Let me rephrase that more clearly.', vi: 'Để mình diễn đạt lại rõ hơn.'},
          {en: 'Could we have a quick call? It\'s easier than chatting.', vi: 'Mình gọi nhanh được không? Nói chuyện dễ hơn chat.'},
          {en: 'Thanks for telling me. I\'ll be more careful with my wording.', vi: 'Cảm ơn bạn đã nói. Mình sẽ cẩn thận hơn khi dùng từ.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Sick leave message', vi: 'Tin nhắn xin nghỉ ốm'},
        body: `Hi [manager], I'm not feeling well today, so I'd like to take a sick day.
My open task is [task]; [colleague] can cover [urgent item] if needed.
I'll check messages [occasionally or tomorrow morning]. Thanks for understanding.`
      },
      {
        title: {en: 'Polite follow-up', vi: 'Nhắc việc lịch sự'},
        body: `Hi [name], just following up on [topic] from [day].
Do you have an update, or is there anything you need from me?
I need it by [date] to [reason]. Thanks!`
      }
    ]
  },
  {
    id: 'symbols',
    groups: [
      {
        title: {en: 'Reading code symbols', vi: 'Đọc ký hiệu trong code'},
        tip: {en: 'When pairing, say the symbol name, not "this thing". Brackets: ( ) parentheses, [ ] square brackets, { } curly braces, < > angle brackets.', vi: 'Khi pair code, hãy gọi đúng tên ký hiệu thay vì "cái này". ( ) parentheses, [ ] square brackets, { } curly braces, < > angle brackets.'},
        phrases: [
          {en: 'Open parenthesis, user ID, close parenthesis.', vi: '( ) = parentheses — "mở ngoặc tròn, user ID, đóng ngoặc tròn".'},
          {en: 'Put the body inside curly braces.', vi: '{ } = curly braces — đặt phần thân trong ngoặc nhọn.'},
          {en: 'You\'re missing a semicolon at the end of the line.', vi: '; = semicolon, : = colon — bạn thiếu dấu chấm phẩy cuối dòng.'},
          {en: 'The variable name is user underscore ID, all lowercase.', vi: '_ = underscore, - = dash/hyphen — tên biến là user_id, viết thường hết.'},
          {en: 'The path is slash api slash v1 slash users.', vi: '/ = slash (forward slash), \\ = backslash — đường dẫn /api/v1/users.'},
          {en: 'Use double equals for comparison, not a single equals sign.', vi: '== = double equals, = = equals sign, != = not equals.'},
          {en: 'That annotation starts with an at sign: at Transactional.', vi: '@ = at sign — annotation @Transactional đọc là "at Transactional".'},
          {en: 'Add a hash before the ID in the CSS selector.', vi: '# = hash (Anh-Anh) / pound sign (Mỹ) — thêm dấu # trước ID trong CSS selector.'},
          {en: 'The two conditions are joined with double ampersand.', vi: '&& = double ampersand ("and"), || = double pipe ("or"), ! = exclamation mark / "not".'},
          {en: 'Wrap the string in double quotes, not single quotes.', vi: '" " = double quotes, \' \' = single quotes, ` ` = backticks.'},
          {en: 'Run git log, dash dash oneline.', vi: '-- = double dash — chạy git log --oneline.'},
          {en: 'Select star from orders where status equals PAID.', vi: '* = asterisk/star — đọc câu SQL SELECT * FROM orders WHERE status = \'PAID\'.'}
        ]
      },
      {
        title: {en: 'Naming styles and code structure', vi: 'Kiểu đặt tên và cấu trúc code'},
        phrases: [
          {en: 'Class names are in PascalCase, and variables are in camelCase.', vi: 'PascalCase cho tên class, camelCase cho biến.'},
          {en: 'Constants are in upper snake case, like MAX underscore RETRIES.', vi: 'Hằng số dùng UPPER_SNAKE_CASE như MAX_RETRIES.'},
          {en: 'Our URLs use kebab case, with dashes between the words.', vi: 'URL của mình dùng kebab-case, nối từ bằng dấu gạch ngang.'},
          {en: 'Go to line forty-two in the OrderService file.', vi: 'Mở dòng 42 trong file OrderService.'},
          {en: 'This method takes two arguments and returns a list of strings.', vi: 'Method này nhận hai tham số và trả về một list String.'},
          {en: 'It\'s a generic type: list of T, or List angle bracket T.', vi: 'Kiểu generic List<T> đọc là "list of T".'},
          {en: 'The if statement is nested three levels deep. Let\'s use an early return.', vi: 'Câu if đang lồng 3 tầng. Mình dùng early return nhé.'},
          {en: 'Can you scroll up a bit? I want to see the imports.', vi: 'Bạn cuộn lên chút được không? Mình muốn xem phần import.'}
        ]
      },
      {
        title: {en: 'Numbers, versions and units', vi: 'Số, phiên bản và đơn vị'},
        tip: {en: 'Each part of a version is read as a number, joined by "point": 3.5.2 = three point five point two, 3.10 = three point ten. IPs too: 10.0.0.1 = ten dot zero dot zero dot one.', vi: 'Mỗi phần của phiên bản đọc như một số, nối bằng "point": 3.5.2 = three point five point two, 3.10 = three point ten. IP đọc "dot": 10.0.0.1 = ten dot zero dot zero dot one.'},
        phrases: [
          {en: 'We\'re upgrading from Spring Boot three point four to three point five.', vi: 'Mình đang nâng Spring Boot từ 3.4 lên 3.5.'},
          {en: 'The service runs on Java twenty-five.', vi: 'Service chạy trên Java 25.'},
          {en: 'The p ninety-nine latency is three hundred and fifty milliseconds.', vi: 'Độ trễ p99 là 350 ms (milliseconds).'},
          {en: 'Uptime last month was ninety-nine point nine five percent.', vi: 'Uptime tháng trước là 99,95%. Lưu ý tiếng Anh dùng dấu chấm cho số thập phân.'},
          {en: 'We handle about twelve hundred requests per second at peak.', vi: '1.200 request/giây lúc cao điểm — "twelve hundred" hoặc "one point two K".'},
          {en: 'The table has around two point three million rows.', vi: 'Bảng có khoảng 2,3 triệu dòng (2.3M).'},
          {en: 'The file is four hundred kilobytes; the limit is ten megabytes.', vi: 'File 400 KB; giới hạn 10 MB.'},
          {en: 'The server has sixteen gigs of RAM and four cores.', vi: 'Server có 16 GB RAM ("gigs") và 4 core.'},
          {en: 'The error code is HTTP four oh four, not five hundred.', vi: 'Mã lỗi 404 đọc "four oh four", 500 đọc "five hundred", 503 "five oh three".'},
          {en: 'The amount is one million two hundred thousand dong.', vi: '1.200.000 VND = "one million two hundred thousand dong".'}
        ]
      },
      {
        title: {en: 'Dates, times and spelling', vi: 'Ngày giờ và đánh vần'},
        tip: {en: 'Spell names and IDs with the NATO alphabet: A for Alpha, B for Bravo, C for Charlie, D for Delta, E for Echo…', vi: 'Đánh vần tên, mã bằng bảng NATO: A – Alpha, B – Bravo, C – Charlie, D – Delta, E – Echo, F – Foxtrot…'},
        phrases: [
          {en: 'The release is on Tuesday, the fourteenth of November.', vi: 'Ngày phát hành là thứ Ba, 14 tháng 11. Ngày dùng số thứ tự: fourteenth.'},
          {en: 'Let\'s meet at half past two, Vietnam time.', vi: 'Hẹn 2 giờ 30 theo giờ Việt Nam.'},
          {en: 'The job runs every day at two a.m. UTC.', vi: 'Job chạy lúc 2 giờ sáng UTC mỗi ngày.'},
          {en: 'There\'s a seven-hour time difference between us.', vi: 'Hai bên lệch nhau 7 tiếng.'},
          {en: 'The deadline is end of day Friday, Singapore time.', vi: 'Hạn chót là cuối ngày thứ Sáu theo giờ Singapore.'},
          {en: 'My last name is Pham: P for Papa, H for Hotel, A for Alpha, M for Mike.', vi: 'Đánh vần họ Pham bằng NATO: Papa, Hotel, Alpha, Mike.'},
          {en: 'The ticket number is KB dash one two three four.', vi: 'Mã ticket KB-1234 đọc từng chữ số.'},
          {en: 'Is that B as in Bravo or D as in Delta?', vi: 'Là chữ B (Bravo) hay D (Delta) vậy?'}
        ]
      },
      {
        title: {en: 'Reading URLs, emails and file paths', vi: 'Đọc URL, email và đường dẫn file'},
        tip: {en: '. = dot, @ = at, / = slash, - = dash, _ = underscore. Say "dot com", "dot v n". Spell unusual parts.', vi: '. = dot, @ = at, / = slash, - = dash, _ = underscore. Đọc "dot com", "dot v n". Đánh vần những phần lạ.'},
        phrases: [
          {en: 'The URL is h t t p s, colon, slash slash, api dot kira dot dev, slash v1.', vi: 'https://api.kira.dev/v1 — thường chỉ nói "api dot kira dot dev slash v1".'},
          {en: 'My email is kira dot pham at example dot com.', vi: 'kira.pham@example.com.'},
          {en: 'The file is in src, slash main, slash resources, slash application dot yml.', vi: 'src/main/resources/application.yml.'},
          {en: 'The environment variable is called DB underscore PASSWORD, all caps.', vi: 'DB_PASSWORD — viết hoa toàn bộ (all caps).'},
          {en: 'The branch name is feature slash card dash statements.', vi: 'feature/card-statements.'},
          {en: 'The query string is question mark page equals two, ampersand size equals twenty.', vi: '?page=2&size=20.'},
          {en: 'Open localhost, port four two zero one.', vi: 'localhost:4201 — cổng đọc từng số hoặc "forty-two oh one".'}
        ]
      },
      {
        title: {en: 'Fractions, ratios and simple math', vi: 'Phân số, tỉ lệ và phép tính đơn giản'},
        phrases: [
          {en: 'About two thirds of the requests hit the cache.', vi: '2/3 = two thirds; 1/4 = a quarter; 1/2 = a half.'},
          {en: 'The error rate is zero point five percent.', vi: '0,5% = zero point five percent (hoặc "half a percent").'},
          {en: 'The ratio of reads to writes is about ten to one.', vi: '10:1 đọc là "ten to one".'},
          {en: 'Traffic doubled, and then it tripled during the campaign.', vi: 'double = gấp đôi; triple = gấp ba.'},
          {en: 'That\'s ten times faster, an order of magnitude.', vi: 'an order of magnitude = gấp khoảng mười lần.'},
          {en: 'Twelve divided by four is three, and three squared is nine.', vi: 'divided by = chia; squared = bình phương; times = nhân.'},
          {en: 'It went up by five percentage points, from ten to fifteen percent.', vi: 'percentage points = điểm phần trăm (khác với tăng 5%).'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Reading a stack trace to a teammate', vi: 'Đọc stack trace cho đồng nghiệp'},
        body: `I'm getting a [NullPointerException] in [OrderService] dot [calculateTotal], line [eighty-seven].
It's called from [OrderController] dot [create], line [forty-two].
The cause is: [cannot invoke getPrice because item is null].
I think [the item list contains a null value]. Can you take a look?`
      }
    ]
  },
  {
    id: 'pronunciation',
    groups: [
      {
        title: {en: 'Tech words people often mispronounce', vi: 'Từ kỹ thuật hay phát âm sai'},
        tip: {en: 'The Vietnamese hint shows the sound and the stressed syllable in CAPITALS. Listen, then repeat at slow speed.', vi: 'Gợi ý tiếng Việt ghi cách đọc, âm tiết nhấn VIẾT HOA. Bật nghe, rồi lặp lại ở tốc độ chậm.'},
        phrases: [
          {en: 'We should clear the cache.', vi: 'cache /kæʃ/ đọc như "cash", KHÔNG phải "ca-chê".'},
          {en: 'The message is waiting in the queue.', vi: 'queue /kjuː/ đọc như chữ "Q", không đọc "queue-ơ".'},
          {en: 'The data is stored in a SQL database.', vi: 'SQL đọc "S-Q-L" hoặc "SEE-kwəl" (sequel); data /ˈdeɪ.tə/ hoặc /ˈdæ.tə/.'},
          {en: 'We deploy behind nginx on Linux.', vi: 'nginx đọc "engine-x"; Linux /ˈlɪn.ʊks/ "LIN-ux".'},
          {en: 'The config is written in YAML, and the response is JSON.', vi: 'YAML /ˈjæm.əl/ "YAM-ul"; JSON /ˈdʒeɪ.sən/ "JAY-son".'},
          {en: 'We run it on Kubernetes in Azure.', vi: 'Kubernetes "koo-ber-NET-eez"; Azure /ˈæʒ.ər/ "AZH-er".'},
          {en: 'Please check the width and the height of the image.', vi: 'width /wɪdθ/ có âm cuối "θ"; height /haɪt/ đọc "hai-t", không có "th".'},
          {en: 'The test suite takes ten minutes.', vi: 'suite /swiːt/ đọc như "sweet", không phải "suit".'},
          {en: 'Run it with sudo.', vi: 'sudo /ˈsuː.duː/ "SOO-doo".'},
          {en: 'The GUI is built with Angular.', vi: 'GUI /ˈɡuː.i/ "GOO-ee"; Angular /ˈæŋ.ɡjə.lər/ "ANG-gyu-ler".'},
          {en: 'We use Hibernate for persistence.', vi: 'Hibernate "HAI-ber-nate"; persistence "per-SIS-tence".'},
          {en: 'The variable is null, so it throws an exception.', vi: 'null /nʌl/ "nân-l" với âm l cuối; exception "ik-SEP-shun".'}
        ]
      },
      {
        title: {en: 'Word stress in common work words', vi: 'Trọng âm từ hay dùng ở công ty'},
        tip: {en: 'Wrong stress confuses listeners more than a wrong vowel. The word family can move the stress.', vi: 'Nhấn sai trọng âm gây khó hiểu hơn đọc sai nguyên âm. Cùng họ từ nhưng trọng âm có thể đổi chỗ.'},
        phrases: [
          {en: 'I develop the API, and Lan is a front-end developer.', vi: 'de-VEL-op, de-VEL-op-er (không nhấn DE).'},
          {en: 'We need to analyze the logs before the analysis meeting.', vi: 'AN-a-lyze nhưng a-NAL-y-sis — trọng âm đổi chỗ.'},
          {en: 'The architecture of the system is quite simple.', vi: 'AR-chi-tec-ture /ˈɑːr.kɪ.tek.tʃər/, "ch" đọc /k/.'},
          {en: 'Please record the meeting. The record is in the shared folder.', vi: 're-CORD (động từ) và REC-ord (danh từ).'},
          {en: 'Can you present the results? It\'s a present from the team.', vi: 'pre-SENT (động từ) và PRES-ent (danh từ).'},
          {en: 'The database is a key component of the platform.', vi: 'DA-ta-base, com-PO-nent, PLAT-form.'},
          {en: 'We need to prioritize the performance issues.', vi: 'pri-OR-i-tize, per-FOR-mance, IS-sue /ˈɪʃ.uː/.'},
          {en: 'This is a temporary solution until the next iteration.', vi: 'TEM-po-rar-y, so-LU-tion, it-er-A-tion.'}
        ]
      },
      {
        title: {en: 'Final sounds and -ed endings', vi: 'Âm cuối và đuôi -ed'},
        tip: {en: '-ed has three sounds: /t/ after voiceless sounds (fixed), /d/ after voiced sounds (deployed), /ɪd/ after t or d (tested, added).', vi: '-ed có ba cách đọc: /t/ sau âm vô thanh (fixed), /d/ sau âm hữu thanh (deployed), /ɪd/ sau t hoặc d (tested, added).'},
        phrases: [
          {en: 'I fixed the bug and pushed the code.', vi: 'fixed /fɪkst/, pushed /pʊʃt/ — đọc /t/.'},
          {en: 'We deployed and logged the result.', vi: 'deployed /dɪˈplɔɪd/, logged /lɒɡd/ — đọc /d/.'},
          {en: 'I tested it and added two more cases.', vi: 'tested /ˈtes.tɪd/, added /ˈæd.ɪd/ — thêm âm tiết /ɪd/.'},
          {en: 'It works on my laptop, but it breaks in staging.', vi: 'Đọc rõ /s/ cuối: works, breaks — người Việt hay bỏ âm cuối.'},
          {en: 'The tests passed and the builds are green.', vi: 'tests /tests/ (cụm phụ âm cuối), passed /pæst/, builds /bɪldz/.'},
          {en: 'I asked him to check the logs.', vi: 'asked /æskt/ — cụm "skt" khó, nói chậm rồi tăng tốc.'}
        ]
      },
      {
        title: {en: 'Linking and natural rhythm', vi: 'Nối âm và nhịp nói tự nhiên'},
        tip: {en: 'Native speakers link a final consonant to the next vowel: "check it out" sounds like "che-ki-tout". Stress the content words, reduce the small words.', vi: 'Người bản xứ nối phụ âm cuối với nguyên âm kế tiếp: "check it out" nghe như "che-ki-tao". Nhấn từ mang nội dung, đọc lướt từ nhỏ.'},
        phrases: [
          {en: 'Let me check it out.', vi: 'Nối âm: "le-me che-ki-tout".'},
          {en: 'I\'ll look into it after lunch.', vi: 'Nối âm: "loo-kin-tu-it". Nhấn LOOK và LUNCH.'},
          {en: 'Can I ask a question?', vi: '"can" đọc nhẹ /kən/: "kə-nai-as-kə-QUES-tion".'},
          {en: 'What are you working on?', vi: 'Nói nhanh: "wha-də-yə WOR-king on".'},
          {en: 'I\'m going to set it up later.', vi: '"going to" → "gonna"; "set it up" → "se-di-dup".'},
          {en: 'Give me a second.', vi: '"give me" → "gimme", "a second" lướt nhẹ.'}
        ]
      },
      {
        title: {en: 'Minimal pairs: long and short vowels', vi: 'Cặp âm tối thiểu: nguyên âm dài và ngắn'},
        tip: {en: 'Long /iː/ is stretched and smiling (sheep); short /ɪ/ is relaxed and quick (ship). The meaning changes!', vi: '/iː/ dài, kéo môi như cười (sheep); /ɪ/ ngắn, thả lỏng, nhanh (ship). Đọc sai là đổi nghĩa!'},
        phrases: [
          {en: 'Ship it. Not sheep it.', vi: 'ship /ʃɪp/ (phát hành) ≠ sheep /ʃiːp/ (con cừu).'},
          {en: 'I\'ll leave the meeting early. I live near the office.', vi: 'leave /liːv/ (rời đi) ≠ live /lɪv/ (sống).'},
          {en: 'Please fill in the form. I feel tired today.', vi: 'fill /fɪl/ (điền) ≠ feel /fiːl/ (cảm thấy).'},
          {en: 'It\'s a big bug. Put it in the bag.', vi: 'bug /bʌɡ/ ≠ bag /bæɡ/ ≠ big /bɪɡ/.'},
          {en: 'The bed is next to the bad window.', vi: 'bed /bed/ ≠ bad /bæd/ — /æ/ mở miệng rộng hơn.'},
          {en: 'Can you pull the code? Then we\'ll pool the results.', vi: 'pull /pʊl/ (ngắn) ≠ pool /puːl/ (dài).'}
        ]
      },
      {
        title: {en: 'The "th" sounds', vi: 'Âm "th"'},
        tip: {en: 'Put the tip of your tongue between your teeth and blow air. /θ/ has no voice (think); /ð/ has voice (this).', vi: 'Đặt đầu lưỡi giữa hai hàm răng và thổi hơi. /θ/ không rung (think); /ð/ có rung (this).'},
        phrases: [
          {en: 'I think the third thread is stuck.', vi: '/θ/: think, third, thread — không đọc thành "t" hay "s".'},
          {en: 'This is the method, not that one.', vi: '/ð/: this, the, that — không đọc thành "d" hay "z".'},
          {en: 'Thanks for the throughput numbers.', vi: '/θ/: thanks, throughput.'},
          {en: 'The authentication flow is the same as the other one.', vi: 'authentication /ɔːˌθen.tɪˈkeɪ.ʃən/; other /ˈʌð.ər/.'},
          {en: 'Think, sink. Thought, sought.', vi: 'Cặp đối chiếu: think /θ/ ≠ sink /s/.'}
        ]
      },
      {
        title: {en: '/ʃ/, /s/, /tʃ/ and /dʒ/', vi: 'Âm /ʃ/, /s/, /tʃ/ và /dʒ/'},
        phrases: [
          {en: 'Please share the session link.', vi: 'share /ʃ/ (tròn môi, như "s" nhưng mềm hơn) ≠ session đầu /s/… rồi /ʃ/: "SESH-un".'},
          {en: 'The sheet is on the shared drive.', vi: 'sheet /ʃiːt/ ≠ seat /siːt/.'},
          {en: 'Let\'s choose the cheaper option.', vi: '/tʃ/: choose, cheaper — như "ch" bật hơi.'},
          {en: 'The job runs on a Java engine.', vi: '/dʒ/: job, Java, engine — không đọc thành "z" hay "gi".'},
          {en: 'Check the change log.', vi: '/tʃ/: check, change.'}
        ]
      },
      {
        title: {en: 'Consonant clusters and final -s', vi: 'Cụm phụ âm và -s cuối'},
        tip: {en: 'Don\'t add a vowel between consonants: "script", not "sờ-cờ-ríp".', vi: 'Không chèn nguyên âm vào giữa các phụ âm: "script", không đọc "sờ-cờ-ríp".'},
        phrases: [
          {en: 'The script splits the strings.', vi: 'Cụm đầu: scr-, spl-, str-.'},
          {en: 'It helps with the next steps.', vi: 'Cụm cuối: helps /lps/, next /kst/, steps /ps/.'},
          {en: 'The tests and the requests failed.', vi: 'tests /sts/, requests /sts/ — giữ âm cuối rõ ràng.'},
          {en: 'She fixes bugs and sends reports.', vi: 'Ngôi thứ ba thêm -s: fixes /ɪz/, sends /z/, reports /s/.'},
          {en: 'Twelve months, sixth release.', vi: 'Cụm rất khó: twelve /lv/, months /nθs/, sixth /ksθ/ — nói chậm rồi tăng tốc.'}
        ]
      },
      {
        title: {en: 'Intonation for questions and lists', vi: 'Ngữ điệu câu hỏi và liệt kê'},
        tip: {en: 'Yes/no questions usually rise at the end ↗. Wh- questions usually fall ↘. In lists, rise on each item and fall on the last one.', vi: 'Câu hỏi Yes/No thường lên giọng cuối câu ↗. Câu hỏi Wh- thường xuống giọng ↘. Khi liệt kê: lên giọng ở từng mục, xuống ở mục cuối.'},
        phrases: [
          {en: 'Is the build green?', vi: 'green ↗ — câu hỏi yes/no: lên giọng ở cuối.'},
          {en: 'When is the release?', vi: 'release ↘ — câu hỏi Wh-: xuống giọng ở cuối.'},
          {en: 'We need Java, Docker, and MySQL.', vi: 'Java ↗, Docker ↗, MySQL ↘ — liệt kê: lên – lên – xuống.'},
          {en: 'The deadline is Friday, right?', vi: 'right ↗ — câu hỏi đuôi để thật sự xác nhận: lên giọng.'},
          {en: 'It\'s working now, isn\'t it?', vi: 'isn\'t it ↘ — câu hỏi đuôi khi bạn khá chắc: xuống giọng.'}
        ]
      },
      {
        title: {en: 'Pronouncing tool and product names', vi: 'Phát âm tên công cụ và sản phẩm'},
        tip: {en: 'Names are said the way their creators say them. When in doubt, listen to an official talk or video.', vi: 'Tên riêng nên đọc theo cách người tạo ra nó đọc. Khi không chắc, nghe một bài nói hoặc video chính thức.'},
        phrases: [
          {en: 'I\'ll create a Jira ticket for it.', vi: 'Jira đọc "JEE-ruh", không đọc "gi-ra".'},
          {en: 'The events go through Kafka.', vi: 'Kafka đọc "KAHF-kuh".'},
          {en: 'We use PostgreSQL for the reporting database.', vi: 'PostgreSQL đọc "POST-gres-Q-L" hoặc ngắn gọn "Postgres".'},
          {en: 'The session data is in Redis.', vi: 'Redis đọc "RED-iss".'},
          {en: 'Check the dashboard in Grafana.', vi: 'Grafana đọc "gruh-FAH-nuh".'},
          {en: 'The front end is built with Vite.', vi: 'Vite đọc "veet" (tiếng Pháp nghĩa là nhanh), không đọc "vai".'},
          {en: 'The admin panel uses Vue.', vi: 'Vue đọc như "view".'},
          {en: 'We build the backend with Maven, not Gradle.', vi: 'Maven đọc "MAY-vn"; Gradle đọc "GRAY-dl".'},
          {en: 'It\'s deployed on A W S, in the Singapore region.', vi: 'AWS đọc từng chữ "A-W-S" (ây-đắp-bờ-liu-ét).'},
          {en: 'We generate the boilerplate with Lombok.', vi: 'Lombok đọc "LOM-bok".'},
          {en: 'Our pipeline runs on GitHub Actions.', vi: 'GitHub đọc "GIT-hub" — g cứng như "get".'},
          {en: 'The logs are in Elasticsearch, and we view them in Kibana.', vi: 'Elasticsearch "ee-LAS-tic-search"; Kibana "kee-BAH-nuh".'}
        ]
      },
      {
        title: {en: 'Saying common acronyms', vi: 'Đọc các từ viết tắt hay gặp'},
        tip: {en: 'Some acronyms are spelled letter by letter (A P I), others are said as a word (JSON, OAuth). Follow what your team says.', vi: 'Có từ viết tắt đọc từng chữ (A P I), có từ đọc thành một từ (JSON, OAuth). Hãy theo cách nhóm bạn đọc.'},
        phrases: [
          {en: 'The A P I returns J S O N, or simply JSON.', vi: 'API đọc từng chữ "ây-pi-ai"; JSON thường đọc "JAY-son".'},
          {en: 'We log in with OAuth and SSO.', vi: 'OAuth đọc "OH-auth"; SSO đọc từng chữ "ét-ét-âu".'},
          {en: 'The C I C D pipeline runs on every push.', vi: 'CI/CD đọc từng chữ "xi-ai xi-đi".'},
          {en: 'Open the project in your I D E.', vi: 'IDE đọc từng chữ "ai-đi-i".'},
          {en: 'The U I is in Angular, and the U X team reviews it.', vi: 'UI "iu-ai"; UX "iu-éc".'},
          {en: 'Check the S L A with the vendor.', vi: 'SLA đọc từng chữ "ét-eo-ây".'},
          {en: 'It\'s stored in an S3 bucket.', vi: 'S3 đọc "ét-thri".'},
          {en: 'We need to pass the PCI DSS audit.', vi: 'PCI DSS đọc từng chữ "pi-xi-ai đi-ét-ét".'}
        ]
      }
    ],
    templates: []
  },
  {
    id: 'agile',
    groups: [
      {
        title: {en: 'Sprint planning', vi: 'Sprint planning'},
        tip: {en: 'Commit only to what the team can finish. Say what is in scope and what is not.', vi: 'Chỉ cam kết những gì nhóm làm xong được. Nói rõ cái gì trong phạm vi và cái gì không.'},
        phrases: [
          {en: 'What\'s the sprint goal for these two weeks?', vi: 'Mục tiêu của sprint hai tuần này là gì?'},
          {en: 'Based on our velocity, I think we can take about thirty points.', vi: 'Dựa trên velocity, mình nghĩ nhóm nhận được khoảng 30 điểm.'},
          {en: 'I\'m off on Thursday, so my capacity is a bit lower this sprint.', vi: 'Thứ Năm mình nghỉ nên capacity sprint này thấp hơn một chút.'},
          {en: 'This story is too big. Can we break it down into smaller ones?', vi: 'Story này lớn quá. Mình chia nhỏ ra được không?'},
          {en: 'I\'d suggest a quick spike before we commit to an estimate.', vi: 'Mình đề xuất làm một spike nhỏ trước khi cam kết ước lượng.'},
          {en: 'This depends on the payment team, so it\'s risky to pull it in.', vi: 'Việc này phụ thuộc nhóm payment nên kéo vào sprint thì rủi ro.'},
          {en: 'Let\'s keep this in the backlog and revisit it next sprint.', vi: 'Để việc này trong backlog, sprint sau xem lại nhé.'},
          {en: 'So we\'re committing to these six stories. Does everyone agree?', vi: 'Vậy mình cam kết 6 story này. Mọi người đồng ý chứ?'}
        ]
      },
      {
        title: {en: 'Backlog refinement and estimation', vi: 'Refinement và ước lượng'},
        phrases: [
          {en: 'What are the acceptance criteria for this story?', vi: 'Tiêu chí chấp nhận (acceptance criteria) của story này là gì?'},
          {en: 'I don\'t think this story is ready yet. It doesn\'t meet the Definition of Ready.', vi: 'Mình nghĩ story này chưa sẵn sàng, chưa đạt Definition of Ready.'},
          {en: 'What should happen if the user cancels halfway through?', vi: 'Nếu người dùng hủy giữa chừng thì hệ thống phải xử lý thế nào?'},
          {en: 'Are there any edge cases we haven\'t covered?', vi: 'Có trường hợp biên nào mình chưa tính tới không?'},
          {en: 'I\'d estimate it as a five, mainly because of the migration.', vi: 'Mình ước lượng 5 điểm, chủ yếu vì phần migration.'},
          {en: 'Why did you vote an eight? What am I missing?', vi: 'Sao bạn vote 8 điểm? Mình đang bỏ sót điều gì?'},
          {en: 'Let\'s split it: the API first, and the UI in a separate story.', vi: 'Tách ra: làm API trước, UI để ở một story riêng.'},
          {en: 'Who can clarify this requirement with the client?', vi: 'Ai có thể làm rõ yêu cầu này với khách hàng?'}
        ]
      },
      {
        title: {en: 'Sprint review', vi: 'Sprint review'},
        phrases: [
          {en: 'This sprint we completed five out of six stories.', vi: 'Sprint này nhóm hoàn thành 5 trên 6 story.'},
          {en: 'The export story wasn\'t finished, so it\'s carried over to the next sprint.', vi: 'Story xuất file chưa xong nên được chuyển sang sprint sau.'},
          {en: 'Here\'s the feature running on staging.', vi: 'Đây là tính năng đang chạy trên staging.'},
          {en: 'We\'d love your feedback before we release it to production.', vi: 'Nhóm rất mong nhận góp ý trước khi phát hành lên production.'},
          {en: 'That\'s a great suggestion. We\'ll add it to the backlog.', vi: 'Góp ý rất hay. Nhóm sẽ đưa vào backlog.'}
        ]
      },
      {
        title: {en: 'Retrospective', vi: 'Retrospective'},
        tip: {en: 'Talk about the process, not the person. Every improvement needs an owner and a date.', vi: 'Nói về quy trình, không nói về cá nhân. Mỗi cải tiến cần người phụ trách và hạn.'},
        phrases: [
          {en: 'Let\'s use the Start, Stop, Continue format today.', vi: 'Hôm nay mình dùng format Start – Stop – Continue nhé.'},
          {en: 'One thing that worked really well was pairing on the hard tickets.', vi: 'Một điều làm rất tốt là pair với nhau ở các ticket khó.'},
          {en: 'Kudos to the QA team for catching that critical bug early.', vi: 'Khen nhóm QA đã phát hiện sớm con bug nghiêm trọng đó.'},
          {en: 'We should stop merging pull requests without a review.', vi: 'Mình nên dừng việc merge PR khi chưa có review.'},
          {en: 'What slowed us down most this sprint was unclear requirements.', vi: 'Điều làm nhóm chậm nhất sprint này là yêu cầu không rõ ràng.'},
          {en: 'I\'d like to second that. The pipeline was also very slow.', vi: 'Mình đồng tình. Pipeline cũng chậm nữa.'},
          {en: 'Let\'s capture that as an action item. Who wants to own it?', vi: 'Ghi lại thành action item nhé. Ai nhận phụ trách việc này?'},
          {en: 'Did we follow up on the action items from the last retro?', vi: 'Mình đã làm các action item của buổi retro trước chưa?'}
        ]
      },
      {
        title: {en: 'Facilitating as a Scrum Master', vi: 'Điều phối với vai trò Scrum Master'},
        phrases: [
          {en: 'Let\'s keep the stand-up to fifteen minutes.', vi: 'Giữ stand-up trong 15 phút nhé.'},
          {en: 'That sounds like a deeper discussion. Can the two of you stay after?', vi: 'Có vẻ cần thảo luận sâu hơn. Hai bạn ở lại sau buổi họp được không?'},
          {en: 'Let\'s go through the board from right to left, starting with what\'s almost done.', vi: 'Đi qua bảng từ phải sang trái, bắt đầu với việc sắp xong.'},
          {en: 'Is anything blocked that I can help remove?', vi: 'Có việc gì bị chặn mà mình có thể giúp gỡ không?'},
          {en: 'We\'ve carried this story over twice. What\'s really stopping it?', vi: 'Story này đã bị chuyển sang sprint sau hai lần. Điều gì thực sự đang cản trở?'}
        ]
      },
      {
        title: {en: 'Kanban and flow', vi: 'Kanban và luồng công việc'},
        tip: {en: 'Stop starting, start finishing: a WIP limit keeps work flowing.', vi: 'Ngừng bắt đầu việc mới, tập trung hoàn thành: giới hạn WIP giúp công việc trôi chảy.'},
        phrases: [
          {en: 'We\'ve hit the WIP limit in "In review", so let\'s review before starting new work.', vi: 'Cột "In review" đã đạt giới hạn WIP, nên review trước khi bắt đầu việc mới.'},
          {en: 'Our cycle time went down from five days to three.', vi: 'Thời gian chu trình (cycle time) giảm từ năm ngày xuống ba.'},
          {en: 'This ticket has been waiting for a week. Who can pick it up?', vi: 'Ticket này đã chờ một tuần. Ai có thể nhận?'},
          {en: 'Let\'s pull the next item from the top of the backlog.', vi: 'Kéo việc tiếp theo từ đầu backlog.'},
          {en: 'The bottleneck is testing, so maybe developers can help with it.', vi: 'Điểm nghẽn là khâu test, có lẽ developer có thể hỗ trợ.'}
        ]
      },
      {
        title: {en: 'Sprint goal and Definition of Done', vi: 'Mục tiêu sprint và Definition of Done'},
        phrases: [
          {en: 'Our sprint goal is that users can download their statements.', vi: 'Mục tiêu sprint là người dùng tải được sao kê.'},
          {en: 'Is this story really done, or just code complete?', vi: 'Story này thật sự xong chưa, hay mới chỉ viết xong code?'},
          {en: 'Our Definition of Done includes tests, code review and deployment to staging.', vi: 'Definition of Done của nhóm gồm test, code review và deploy lên staging.'},
          {en: 'It\'s not done until the product owner has accepted it.', vi: 'Chưa gọi là xong cho tới khi product owner chấp nhận.'},
          {en: 'If we can\'t meet the sprint goal, we should say so early.', vi: 'Nếu không đạt mục tiêu sprint, nên báo sớm.'}
        ]
      },
      {
        title: {en: 'Async stand-up in chat', vi: 'Stand-up không đồng bộ qua chat'},
        phrases: [
          {en: 'We\'re doing async stand-ups this week. Please post your update by ten.', vi: 'Tuần này stand-up qua chat. Mọi người gửi cập nhật trước 10 giờ nhé.'},
          {en: 'Yesterday: finished the export API. Today: tests and docs. Blockers: none.', vi: 'Mẫu cập nhật ngắn: hôm qua – hôm nay – vướng mắc.'},
          {en: 'Replying in the thread: I can help with that blocker after lunch.', vi: 'Trả lời trong thread: mình có thể giúp gỡ vướng mắc đó sau bữa trưa.'},
          {en: 'If anything needs a discussion, let\'s jump on a quick call.', vi: 'Nếu cần thảo luận thì mình gọi nhanh nhé.'},
          {en: 'Reminder: two people haven\'t posted their update yet.', vi: 'Nhắc nhở: còn hai người chưa gửi cập nhật.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Retro input (Start / Stop / Continue)', vi: 'Ý kiến retro (Start / Stop / Continue)'},
        body: `Continue: [what worked], because [impact].
Stop: [what hurt us], because [impact].
Start: [new idea], so that [expected benefit].
Action item: [action], owned by [name], by [date].`
      },
      {
        title: {en: 'Explaining your estimate', vi: 'Giải thích ước lượng'},
        body: `I'd estimate this as [points or days].
The main effort is [part], and the main risk is [risk].
If we [simplify or split or get answer on X], it could drop to [smaller estimate].`
      }
    ]
  },
  {
    id: 'writing',
    groups: [
      {
        title: {en: 'Opening and purpose', vi: 'Mở đầu và nêu mục đích'},
        tip: {en: 'Put the request in the first two lines. Busy people read only the top.', vi: 'Đặt yêu cầu ngay trong hai dòng đầu. Người bận chỉ đọc phần trên.'},
        phrases: [
          {en: 'Hi Anna, hope you\'re doing well.', vi: 'Chào Anna, hy vọng bạn vẫn ổn. (mở đầu email thân thiện)'},
          {en: 'I\'m writing to ask about the timeline for the API change.', vi: 'Mình viết email để hỏi về tiến độ thay đổi API.'},
          {en: 'Quick question about the release tomorrow.', vi: 'Hỏi nhanh về bản release ngày mai. (mở đầu tin nhắn chat)'},
          {en: 'Following up on our call this morning, here are the next steps.', vi: 'Tiếp nối cuộc gọi sáng nay, đây là các bước tiếp theo.'},
          {en: 'Thanks for getting back to me so quickly.', vi: 'Cảm ơn bạn đã phản hồi nhanh.'},
          {en: 'Sorry for the delayed response.', vi: 'Xin lỗi vì phản hồi muộn.'}
        ]
      },
      {
        title: {en: 'Requests, updates and attachments', vi: 'Yêu cầu, cập nhật và đính kèm'},
        phrases: [
          {en: 'Could you please review the attached document by Friday?', vi: 'Bạn xem giúp tài liệu đính kèm trước thứ Sáu được không?'},
          {en: 'Please find the test report attached.', vi: 'Gửi bạn báo cáo test trong file đính kèm.'},
          {en: 'Just a heads-up: staging will be down from six to seven tonight.', vi: 'Báo trước: tối nay staging sẽ dừng từ 6 đến 7 giờ.'},
          {en: 'FYI, the client approved the new design.', vi: 'Để bạn nắm: khách hàng đã duyệt thiết kế mới. (FYI = for your information)'},
          {en: 'Could you confirm whether this is still a priority?', vi: 'Bạn xác nhận giúp việc này còn ưu tiên không?'},
          {en: 'I\'ve added you to the thread so you have the context.', vi: 'Mình đã thêm bạn vào thread để bạn nắm bối cảnh.'},
          {en: 'Looping in Minh, who owns the billing service.', vi: 'Thêm Minh vào cuộc trao đổi, Minh phụ trách billing service.'},
          {en: 'Moving Tom to BCC to spare his inbox.', vi: 'Chuyển Tom sang BCC để đỡ đầy hộp thư của anh ấy.'}
        ]
      },
      {
        title: {en: 'Async chat etiquette', vi: 'Phép lịch sự khi chat không đồng bộ'},
        tip: {en: 'Don\'t send only "Hi" and wait. Write the greeting and the question in one message.', vi: 'Đừng chỉ gửi "Hi" rồi chờ. Viết lời chào và câu hỏi trong cùng một tin nhắn.'},
        phrases: [
          {en: 'Hi Nam, when you have a moment, could you check why the build failed? No rush.', vi: 'Chào Nam, lúc nào rảnh bạn xem giúp sao build lỗi nhé. Không gấp đâu.'},
          {en: 'This is urgent: production login is failing for some users.', vi: 'Việc gấp: một số người dùng không đăng nhập được trên production.'},
          {en: 'Let\'s move this to a thread to keep the channel clean.', vi: 'Mình chuyển vào thread để kênh gọn gàng nhé.'},
          {en: 'I\'ll reply properly after my meeting.', vi: 'Họp xong mình sẽ trả lời kỹ.'},
          {en: 'Thanks, that answers my question.', vi: 'Cảm ơn, vậy là mình rõ rồi.'},
          {en: 'Sorry, I\'m a bit confused. Do you mean the old endpoint or the new one?', vi: 'Xin lỗi mình hơi rối. Ý bạn là endpoint cũ hay endpoint mới?'}
        ]
      },
      {
        title: {en: 'Pull requests and code review comments', vi: 'Pull request và comment review'},
        tip: {en: 'Prefix review comments: "nit:" for small style points, "question:" when you are not sure, "blocking:" when it must change.', vi: 'Gắn nhãn comment: "nit:" cho góp ý nhỏ, "question:" khi chưa chắc, "blocking:" khi bắt buộc sửa.'},
        phrases: [
          {en: 'This PR adds pagination to the transactions API.', vi: 'PR này thêm phân trang cho API giao dịch.'},
          {en: 'How to test: run the migration, then call the endpoint with page equals two.', vi: 'Cách test: chạy migration rồi gọi endpoint với page=2.'},
          {en: 'nit: could we rename this variable to totalAmount?', vi: 'nit: mình đổi tên biến thành totalAmount được không?'},
          {en: 'question: is this method called inside a transaction?', vi: 'question: method này có được gọi trong transaction không?'},
          {en: 'blocking: this query is open to SQL injection. Please use a parameter.', vi: 'blocking: câu query này có thể bị SQL injection. Hãy dùng tham số.'},
          {en: 'Good catch, fixed in the latest commit.', vi: 'Phát hiện hay, đã sửa ở commit mới nhất.'},
          {en: 'I\'d prefer to keep it as is, because the other services use the same pattern.', vi: 'Mình muốn giữ nguyên vì các service khác cũng dùng cách này.'},
          {en: 'Looks good to me. Approved.', vi: 'Mình thấy ổn. Đã approve. (LGTM = looks good to me)'}
        ]
      },
      {
        title: {en: 'Closing lines', vi: 'Câu kết'},
        phrases: [
          {en: 'Let me know if you have any questions.', vi: 'Có câu hỏi gì cứ cho mình biết.'},
          {en: 'Looking forward to your reply.', vi: 'Mong nhận được phản hồi của bạn.'},
          {en: 'Thanks in advance for your help.', vi: 'Cảm ơn trước vì sự giúp đỡ của bạn.'},
          {en: 'Best regards, Kira.', vi: 'Trân trọng, Kira. (kết email trang trọng; thân hơn: "Thanks," / "Cheers,")'}
        ]
      },
      {
        title: {en: 'Escalating politely', vi: 'Đưa vấn đề lên cấp trên (escalate) một cách lịch sự'},
        tip: {en: 'Escalate the problem, not the person. Give facts, impact, what you tried, and the decision you need.', vi: 'Báo cáo vấn đề, không tố cáo cá nhân. Nêu dữ kiện, tác động, những gì đã thử, và quyết định cần có.'},
        phrases: [
          {en: 'I\'d like to escalate an issue that is blocking the release.', vi: 'Mình muốn báo cáo lên một vấn đề đang chặn bản phát hành.'},
          {en: 'We\'ve been waiting for the API credentials for five working days.', vi: 'Nhóm đã chờ thông tin API năm ngày làm việc.'},
          {en: 'We\'ve followed up three times without a response.', vi: 'Nhóm đã nhắc ba lần mà chưa có phản hồi.'},
          {en: 'If we don\'t get them by Wednesday, the launch will slip by a week.', vi: 'Nếu không nhận được trước thứ Tư, ngày ra mắt sẽ trễ một tuần.'},
          {en: 'Could you help us get a decision from the partner\'s side?', vi: 'Anh/chị giúp nhóm có được quyết định từ phía đối tác không?'}
        ]
      },
      {
        title: {en: 'Meetings by email and chat', vi: 'Sắp xếp cuộc họp qua email và chat'},
        phrases: [
          {en: 'Would Thursday at ten work for you?', vi: 'Thứ Năm lúc 10 giờ có tiện cho bạn không?'},
          {en: 'I\'m afraid I can\'t make it on Monday. Could we move it to Tuesday?', vi: 'Rất tiếc thứ Hai mình không tham gia được. Dời sang thứ Ba được không?'},
          {en: 'I\'ll have to decline, but Minh can join on my behalf.', vi: 'Mình phải từ chối, nhưng Minh có thể tham gia thay mình.'},
          {en: 'Could you share an agenda before the meeting?', vi: 'Bạn gửi agenda trước buổi họp được không?'},
          {en: 'Do we still need this meeting, or can we handle it by email?', vi: 'Mình có còn cần cuộc họp này không, hay trao đổi qua email là đủ?'}
        ]
      },
      {
        title: {en: 'Apologies and corrections', vi: 'Xin lỗi và đính chính'},
        phrases: [
          {en: 'Apologies, I sent the wrong file earlier. Please use the attached version.', vi: 'Xin lỗi, lúc nãy mình gửi nhầm file. Vui lòng dùng bản đính kèm.'},
          {en: 'Correction: the maintenance is on Saturday, not Sunday.', vi: 'Đính chính: bảo trì vào thứ Bảy, không phải Chủ nhật.'},
          {en: 'Sorry for the confusion. Here is the correct link.', vi: 'Xin lỗi vì gây nhầm lẫn. Đây là đường link đúng.'},
          {en: 'I apologize for the delay. The report is attached.', vi: 'Xin lỗi vì chậm trễ. Báo cáo đính kèm.'}
        ]
      },
      {
        title: {en: 'Formal and informal register', vi: 'Văn phong trang trọng và thân mật'},
        tip: {en: 'Match the channel: chat with teammates can be informal; emails to clients and managers you don\'t know well should be more formal.', vi: 'Phù hợp với kênh: chat với đồng nghiệp có thể thân mật; email cho khách hàng và cấp trên chưa thân nên trang trọng hơn.'},
        phrases: [
          {en: 'Informal: Can you check this? Formal: Could you please review the attached document?', vi: 'Nhờ kiểm tra: thân mật và trang trọng.'},
          {en: 'Informal: Sorry, my bad. Formal: I apologize for the error.', vi: 'Xin lỗi: thân mật và trang trọng.'},
          {en: 'Informal: Thanks a lot! Formal: Thank you for your support.', vi: 'Cảm ơn: thân mật và trang trọng.'},
          {en: 'Informal: Got it. Formal: Noted, thank you.', vi: 'Xác nhận đã hiểu: thân mật và trang trọng.'},
          {en: 'Informal: Let me know. Formal: Please let me know if you have any questions.', vi: 'Kết thúc: thân mật và trang trọng.'},
          {en: 'Informal: Hey team! Formal: Dear all,', vi: 'Lời chào nhóm: thân mật và trang trọng.'}
        ]
      },
      {
        title: {en: 'Writing clear tickets', vi: 'Viết ticket rõ ràng'},
        tip: {en: 'A good ticket answers: what is the problem, why it matters, and how we know it is done.', vi: 'Ticket tốt trả lời: vấn đề là gì, vì sao quan trọng, và thế nào là xong.'},
        phrases: [
          {en: 'Title: Statement export fails for cards with more than a thousand transactions.', vi: 'Tiêu đề nêu đúng vấn đề, cụ thể.'},
          {en: 'Context: finance needs this report for the monthly close.', vi: 'Bối cảnh: vì sao việc này quan trọng.'},
          {en: 'Expected: the export finishes in under a minute.', vi: 'Kết quả mong đợi đo được.'},
          {en: 'Out of scope: changing the file format.', vi: 'Nêu rõ phần ngoài phạm vi.'},
          {en: 'Related: this depends on the ticket for the new index.', vi: 'Liên kết ticket phụ thuộc.'},
          {en: 'I\'ve split this into three smaller tickets so we can work in parallel.', vi: 'Mình đã chia thành ba ticket nhỏ để làm song song.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Request email', vi: 'Email yêu cầu'},
        body: `Subject: [Action needed] [topic] by [date]

Hi [name],

Could you please [request] by [date]? We need it to [reason].
Context: [one or two sentences, link].
If [date] doesn't work, let me know and we can adjust.

Thanks,
[your name]`
      },
      {
        title: {en: 'Pull request description', vi: 'Mô tả pull request'},
        body: `What: [what this PR changes].
Why: [problem or ticket link].
How to test: [steps].
Risks: [migration or config or none].
Screenshots: [if UI changed].`
      },
      {
        title: {en: 'Escalation email', vi: 'Email đưa vấn đề lên cấp trên'},
        body: `Subject: [Escalation] [issue] is blocking [milestone]

Hi [name],

I'd like to escalate [issue], which is blocking [milestone].
Facts: [what is missing or broken] since [date]; we followed up on [dates].
Impact: if this isn't resolved by [date], [consequence].
What we need: [decision or access or person] by [date].

Thanks for your help,
[your name]`
      },
      {
        title: {en: 'Out-of-office reply', vi: 'Thư trả lời tự động khi nghỉ'},
        body: `Hi, thank you for your email.
I'm out of the office from [date] to [date], with limited access to email.
For urgent matters, please contact [name] at [email].
I'll reply when I'm back on [date].
Best regards, [your name]`
      },
      {
        title: {en: 'Introducing two people', vi: 'Giới thiệu hai người với nhau'},
        body: `Hi [name A] and [name B],

I'd like to introduce you to each other.
[Name A] leads [team or area] and is working on [topic].
[Name B] is [role] and has a lot of experience with [topic].
I think you'd both benefit from a short chat about [subject]. I'll let you take it from here.

Best,
[your name]`
      }
    ]
  },
  {
    id: 'client',
    groups: [
      {
        title: {en: 'Opening a client call', vi: 'Mở đầu cuộc gọi với khách hàng'},
        phrases: [
          {en: 'Thanks for joining. Can everyone hear me clearly?', vi: 'Cảm ơn mọi người đã tham gia. Mọi người nghe rõ mình không?'},
          {en: 'Let me quickly introduce myself. I\'m the backend developer on this project.', vi: 'Để mình giới thiệu nhanh. Mình là lập trình viên backend của dự án.'},
          {en: 'Today we\'d like to clarify the requirements for the reporting module.', vi: 'Hôm nay nhóm muốn làm rõ yêu cầu cho module báo cáo.'},
          {en: 'We have thirty minutes, so let\'s go through the agenda.', vi: 'Mình có 30 phút, mình đi qua agenda nhé.'},
          {en: 'Is it okay if we record this call for our notes?', vi: 'Mình ghi âm cuộc gọi để ghi chú được không ạ?'}
        ]
      },
      {
        title: {en: 'Clarifying requirements', vi: 'Làm rõ yêu cầu'},
        tip: {en: 'Ask about the goal behind a feature. Then repeat the requirement back in your own words.', vi: 'Hỏi mục tiêu phía sau tính năng. Sau đó nhắc lại yêu cầu bằng lời của mình.'},
        phrases: [
          {en: 'What problem are you trying to solve with this feature?', vi: 'Tính năng này giúp anh/chị giải quyết vấn đề gì?'},
          {en: 'Who are the main users, and how often will they use it?', vi: 'Người dùng chính là ai, và họ dùng thường xuyên thế nào?'},
          {en: 'Could you walk me through how you do this today?', vi: 'Anh/chị mô tả giúp hiện tại mình đang làm việc này thế nào?'},
          {en: 'When you say real time, do you mean within seconds or within a few minutes?', vi: 'Khi nói "real time", ý anh/chị là trong vài giây hay vài phút?'},
          {en: 'What should happen if the payment fails?', vi: 'Nếu thanh toán lỗi thì hệ thống nên xử lý thế nào?'},
          {en: 'Is this a must-have for the first release, or a nice-to-have?', vi: 'Đây là bắt buộc cho bản đầu tiên, hay là có thì tốt?'},
          {en: 'Just to make sure I understand: users can export only their own data, right?', vi: 'Để chắc mình hiểu đúng: người dùng chỉ xuất được dữ liệu của chính họ, đúng không?'},
          {en: 'Do you have any examples or screenshots we could look at?', vi: 'Anh/chị có ví dụ hay ảnh chụp màn hình nào để nhóm tham khảo không?'}
        ]
      },
      {
        title: {en: 'Explaining technical things simply', vi: 'Giải thích kỹ thuật đơn giản'},
        tip: {en: 'Explain the impact on the business first, the technology second. Use an everyday comparison.', vi: 'Giải thích tác động kinh doanh trước, công nghệ sau. Dùng ví dụ đời thường.'},
        phrases: [
          {en: 'In simple terms, the cache is like a shortcut that makes the page load faster.', vi: 'Nói đơn giản, cache giống như lối tắt giúp trang tải nhanh hơn.'},
          {en: 'The main impact for your users is that the report will take seconds instead of minutes.', vi: 'Tác động chính với người dùng là báo cáo mất vài giây thay vì vài phút.'},
          {en: 'There are two options. Let me explain the trade-offs.', vi: 'Có hai phương án. Để mình giải thích ưu nhược điểm.'},
          {en: 'Option A is faster to build, but it\'s harder to change later.', vi: 'Phương án A làm nhanh hơn nhưng sau này khó thay đổi hơn.'},
          {en: 'This is technically possible, but it would add about two weeks.', vi: 'Về kỹ thuật thì làm được, nhưng sẽ mất thêm khoảng hai tuần.'}
        ]
      },
      {
        title: {en: 'Managing expectations and scope', vi: 'Quản lý kỳ vọng và phạm vi'},
        phrases: [
          {en: 'That\'s a new requirement, so we\'ll need to check the impact on the timeline.', vi: 'Đó là yêu cầu mới nên nhóm cần kiểm tra ảnh hưởng tới tiến độ.'},
          {en: 'We can deliver the core part by Friday and the rest in the next release.', vi: 'Nhóm có thể giao phần lõi trước thứ Sáu, phần còn lại ở bản sau.'},
          {en: 'I don\'t want to give you a wrong estimate. Let me get back to you by tomorrow.', vi: 'Mình không muốn đưa ước lượng sai. Để mai mình phản hồi lại.'},
          {en: 'I\'m afraid we can\'t include this without moving the deadline.', vi: 'Rất tiếc nhóm không thể thêm việc này nếu không lùi hạn chót.'},
          {en: 'If we drop the PDF export, we can still make the launch date.', vi: 'Nếu bỏ phần xuất PDF thì vẫn kịp ngày ra mắt.'}
        ]
      },
      {
        title: {en: 'Wrapping up', vi: 'Kết thúc cuộc gọi'},
        phrases: [
          {en: 'Let me summarize what we agreed on today.', vi: 'Để mình tóm tắt những gì đã thống nhất hôm nay.'},
          {en: 'I\'ll send you the meeting notes and the open questions by email.', vi: 'Mình sẽ gửi biên bản họp và các câu hỏi còn mở qua email.'},
          {en: 'Could you confirm the final design by Wednesday?', vi: 'Anh/chị xác nhận thiết kế cuối cùng trước thứ Tư được không?'},
          {en: 'Thank you for your time. Talk to you next week.', vi: 'Cảm ơn anh/chị đã dành thời gian. Hẹn tuần sau.'}
        ]
      },
      {
        title: {en: 'UAT and sign-off', vi: 'UAT và nghiệm thu'},
        phrases: [
          {en: 'The build is ready for user acceptance testing on the UAT environment.', vi: 'Bản build đã sẵn sàng cho kiểm thử chấp nhận người dùng (UAT).'},
          {en: 'Here are the test scenarios and the test accounts.', vi: 'Đây là các kịch bản test và tài khoản test.'},
          {en: 'Please log any issues in the shared tracker, with screenshots.', vi: 'Vui lòng ghi mọi lỗi vào tracker chung, kèm ảnh chụp.'},
          {en: 'Is this a defect, or a change to the original requirement?', vi: 'Đây là lỗi, hay là thay đổi so với yêu cầu ban đầu?'},
          {en: 'All critical issues are fixed. Could you sign off by Friday?', vi: 'Mọi lỗi nghiêm trọng đã sửa. Anh/chị nghiệm thu trước thứ Sáu được không?'},
          {en: 'Once we have your sign-off, we\'ll schedule the go-live.', vi: 'Khi có xác nhận nghiệm thu, nhóm sẽ lên lịch go-live.'}
        ]
      },
      {
        title: {en: 'When the client is unhappy', vi: 'Khi khách hàng không hài lòng'},
        phrases: [
          {en: 'I understand your frustration, and I\'m sorry this happened.', vi: 'Tôi hiểu sự không hài lòng của anh/chị và rất tiếc việc này đã xảy ra.'},
          {en: 'Let me make sure I understand the main concern.', vi: 'Để tôi chắc chắn đã hiểu đúng mối lo chính.'},
          {en: 'Here\'s what happened, and here\'s what we\'re doing about it.', vi: 'Đây là điều đã xảy ra, và đây là những gì chúng tôi đang làm.'},
          {en: 'We\'ll send you a daily update until it\'s resolved.', vi: 'Chúng tôi sẽ gửi cập nhật mỗi ngày cho tới khi giải quyết xong.'},
          {en: 'I\'ll involve our project manager so we can agree on a recovery plan.', vi: 'Tôi sẽ mời quản lý dự án tham gia để thống nhất kế hoạch khắc phục.'}
        ]
      },
      {
        title: {en: 'Project kickoff with a client', vi: 'Buổi kickoff dự án với khách hàng'},
        phrases: [
          {en: 'Let\'s start with a quick round of introductions: your name, your role, and what you\'d like from this project.', vi: 'Bắt đầu bằng phần giới thiệu nhanh: tên, vai trò, và bạn mong muốn gì từ dự án.'},
          {en: 'Our goal for the first phase is a working payment API in eight weeks.', vi: 'Mục tiêu giai đoạn một là có API thanh toán chạy được trong tám tuần.'},
          {en: 'Who on your side can make decisions about scope?', vi: 'Bên anh/chị, ai có quyền quyết định về phạm vi?'},
          {en: 'How would you like to receive updates: a weekly email or a call?', vi: 'Anh/chị muốn nhận cập nhật thế nào: email hằng tuần hay một cuộc gọi?'},
          {en: 'We\'ll need access to the test environment by the end of next week.', vi: 'Nhóm cần quyền truy cập môi trường test trước cuối tuần sau.'},
          {en: 'Let\'s agree on how we\'ll handle changes to the scope.', vi: 'Mình thống nhất cách xử lý khi phạm vi thay đổi.'}
        ]
      },
      {
        title: {en: 'Saying no to a client while keeping the relationship', vi: 'Từ chối khách hàng mà vẫn giữ quan hệ'},
        phrases: [
          {en: 'I understand why this matters to you. Let me explain what\'s possible.', vi: 'Tôi hiểu vì sao việc này quan trọng với anh/chị. Để tôi giải thích điều gì khả thi.'},
          {en: 'We can\'t do it by Friday without risking quality, but we can deliver it next Wednesday.', vi: 'Làm trước thứ Sáu sẽ ảnh hưởng chất lượng, nhưng có thể giao vào thứ Tư tới.'},
          {en: 'Storing card numbers in plain text isn\'t something we can do, but here\'s a safe alternative.', vi: 'Lưu số thẻ dạng thô là điều không thể làm, nhưng đây là một phương án an toàn.'},
          {en: 'If this is the top priority, which other feature should we move to the next phase?', vi: 'Nếu đây là ưu tiên số một, tính năng nào nên chuyển sang giai đoạn sau?'},
          {en: 'Let me check with my team and come back to you with options by tomorrow.', vi: 'Để tôi trao đổi với nhóm và gửi lại các phương án trước ngày mai.'}
        ]
      },
      {
        title: {en: 'Before and after a client call', vi: 'Trước và sau cuộc gọi với khách hàng'},
        phrases: [
          {en: 'Let\'s do a quick internal prep call ten minutes before.', vi: 'Mình họp nội bộ nhanh mười phút trước đó nhé.'},
          {en: 'Who will lead the call, and who will take notes?', vi: 'Ai dẫn cuộc gọi, và ai ghi chép?'},
          {en: 'Let\'s agree on what we can and can\'t commit to today.', vi: 'Mình thống nhất hôm nay được cam kết gì và không được cam kết gì.'},
          {en: 'After the call, I\'ll send the summary within an hour.', vi: 'Sau cuộc gọi, mình sẽ gửi bản tóm tắt trong vòng một giờ.'},
          {en: 'The client seemed worried about the timeline. Let\'s discuss it internally.', vi: 'Khách hàng có vẻ lo về tiến độ. Mình bàn nội bộ nhé.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Meeting notes email', vi: 'Email biên bản họp'},
        body: `Hi [client name],

Thanks for your time today. Here's a summary.
Agreed: [decision 1]; [decision 2].
Open questions: [question] — [owner], by [date].
Next steps: we will [action] by [date].

Please let me know if I missed anything.
Best regards,
[your name]`
      }
    ]
  },
  {
    id: 'feedback',
    groups: [
      {
        title: {en: 'One-on-one with your manager', vi: 'Họp 1-1 với quản lý'},
        phrases: [
          {en: 'I\'d like to talk about my growth plan for this year.', vi: 'Mình muốn trao đổi về kế hoạch phát triển năm nay.'},
          {en: 'I\'ve been feeling a bit overloaded recently.', vi: 'Dạo gần đây mình thấy hơi quá tải.'},
          {en: 'I\'d love to take on more responsibility, like leading the next feature.', vi: 'Mình muốn nhận thêm trách nhiệm, ví dụ dẫn dắt tính năng tiếp theo.'},
          {en: 'Is there anything you think I should improve?', vi: 'Anh/chị thấy mình nên cải thiện điều gì không?'},
          {en: 'Could you help me get more exposure to system design?', vi: 'Anh/chị giúp mình có thêm cơ hội làm thiết kế hệ thống được không?'},
          {en: 'What would I need to show to be ready for a senior role?', vi: 'Mình cần thể hiện điều gì để sẵn sàng cho vị trí senior?'}
        ]
      },
      {
        title: {en: 'Giving feedback', vi: 'Đưa ra góp ý'},
        tip: {en: 'Use SBI: Situation, Behavior, Impact. Describe what happened, not the person\'s character.', vi: 'Dùng SBI: Tình huống – Hành vi – Tác động. Mô tả sự việc, không phán xét tính cách.'},
        phrases: [
          {en: 'Can I share some feedback about yesterday\'s release?', vi: 'Mình góp ý một chút về bản release hôm qua được không?'},
          {en: 'In the demo, you explained the flow really clearly. The client loved it.', vi: 'Trong buổi demo bạn giải thích luồng rất rõ. Khách hàng rất thích.'},
          {en: 'When the PR was merged without tests, we had to roll back in the evening.', vi: 'Khi PR được merge mà không có test, nhóm phải rollback vào buổi tối.'},
          {en: 'Next time, could you ping me before changing the shared config?', vi: 'Lần sau bạn nhắn mình trước khi đổi config dùng chung được không?'},
          {en: 'How do you see it? Maybe I\'m missing some context.', vi: 'Bạn thấy sao? Có thể mình đang thiếu bối cảnh.'}
        ]
      },
      {
        title: {en: 'Receiving feedback', vi: 'Nhận góp ý'},
        phrases: [
          {en: 'Thanks for telling me. I wasn\'t aware of that.', vi: 'Cảm ơn đã nói với mình. Mình chưa nhận ra điều đó.'},
          {en: 'Could you give me a specific example?', vi: 'Bạn cho mình một ví dụ cụ thể được không?'},
          {en: 'That\'s fair. I\'ll make sure to add tests from now on.', vi: 'Hợp lý. Từ giờ mình sẽ đảm bảo thêm test.'},
          {en: 'I see your point, but let me explain why I did it that way.', vi: 'Mình hiểu ý bạn, nhưng để mình giải thích vì sao mình làm vậy.'},
          {en: 'What would you do differently in my position?', vi: 'Nếu là mình thì bạn sẽ làm khác thế nào?'}
        ]
      },
      {
        title: {en: 'Performance review and career', vi: 'Đánh giá hiệu suất và sự nghiệp'},
        tip: {en: 'Bring numbers: what you shipped, what improved, and how much.', vi: 'Mang theo con số: bạn đã giao gì, cải thiện gì, bao nhiêu.'},
        phrases: [
          {en: 'This year I led the migration to Spring Boot 3 with zero downtime.', vi: 'Năm nay mình dẫn dắt việc nâng lên Spring Boot 3 mà không có downtime.'},
          {en: 'I reduced the report generation time by sixty percent.', vi: 'Mình giảm thời gian tạo báo cáo 60%.'},
          {en: 'I also mentored two new joiners on our codebase.', vi: 'Mình cũng kèm hai bạn mới vào làm quen codebase.'},
          {en: 'One area I want to improve is public speaking in big meetings.', vi: 'Một điểm mình muốn cải thiện là nói trước đám đông trong các cuộc họp lớn.'},
          {en: 'Based on my results, I\'d like to discuss a salary review.', vi: 'Dựa trên kết quả, mình muốn trao đổi về việc xem xét lại lương.'},
          {en: 'What are the next steps for my promotion?', vi: 'Các bước tiếp theo để mình được thăng chức là gì?'}
        ]
      },
      {
        title: {en: 'Writing a peer review', vi: 'Viết đánh giá đồng nghiệp'},
        phrases: [
          {en: 'Minh consistently delivers high-quality code and reviews pull requests quickly.', vi: 'Minh luôn viết code chất lượng và review PR nhanh.'},
          {en: 'A great example was the way he handled the payment outage in May.', vi: 'Ví dụ tiêu biểu là cách anh ấy xử lý sự cố thanh toán hồi tháng 5.'},
          {en: 'She is always willing to help new team members.', vi: 'Cô ấy luôn sẵn lòng giúp đỡ thành viên mới.'},
          {en: 'One area for growth is sharing progress earlier, before problems become urgent.', vi: 'Một điểm có thể phát triển: chia sẻ tiến độ sớm hơn, trước khi vấn đề trở nên gấp.'},
          {en: 'I\'d love to see him take a bigger role in design discussions.', vi: 'Mình muốn thấy anh ấy đóng vai trò lớn hơn trong các buổi thảo luận thiết kế.'},
          {en: 'Overall, she\'s one of the most reliable people I\'ve worked with.', vi: 'Nhìn chung, cô ấy là một trong những người đáng tin cậy nhất mình từng làm cùng.'}
        ]
      },
      {
        title: {en: 'Asking for feedback proactively', vi: 'Chủ động xin góp ý'},
        phrases: [
          {en: 'Do you have any feedback on how I ran the demo today?', vi: 'Bạn có góp ý gì về cách mình điều phối buổi demo hôm nay không?'},
          {en: 'What\'s one thing I could do better in my code reviews?', vi: 'Có điều gì mình có thể làm tốt hơn khi review code?'},
          {en: 'Please be honest. I really want to improve.', vi: 'Cứ nói thật nhé. Mình thật sự muốn tiến bộ.'},
          {en: 'Was my explanation clear, or was it too technical for the client?', vi: 'Phần giải thích của mình có rõ không, hay quá kỹ thuật với khách hàng?'},
          {en: 'Could we check in again in a month to see if it\'s better?', vi: 'Một tháng nữa mình trao đổi lại xem đã tốt hơn chưa nhé?'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Self-review summary', vi: 'Tóm tắt tự đánh giá'},
        body: `Key achievements: [achievement] — impact: [number or result].
Collaboration: [helping, mentoring, cross-team work].
What I learned: [skill].
What I want to improve: [area], by [concrete plan].
Next goals: [goal for next period].`
      },
      {
        title: {en: 'SBI feedback', vi: 'Góp ý theo SBI'},
        body: `Situation: In [meeting or task] on [day],
Behavior: you [specific action].
Impact: As a result, [effect on team, client or product].
Request: Next time, could you [suggestion]? What do you think?`
      }
    ]
  },
  {
    id: 'phrasal',
    groups: [
      {
        title: {en: 'Phrasal verbs developers use every day', vi: 'Cụm động từ dev dùng hằng ngày'},
        tip: {en: 'Phrasal verbs sound more natural than formal verbs in speech: "look into" instead of "investigate".', vi: 'Khi nói, cụm động từ nghe tự nhiên hơn từ trang trọng: "look into" thay cho "investigate".'},
        phrases: [
          {en: 'I\'ll look into the timeout issue this afternoon.', vi: 'look into = điều tra, xem xét.'},
          {en: 'We managed to figure out why the job was failing.', vi: 'figure out = tìm ra, hiểu ra.'},
          {en: 'Can you set up the local environment for the new joiner?', vi: 'set up = cài đặt, thiết lập.'},
          {en: 'We\'ll roll out the feature to ten percent of users first.', vi: 'roll out = triển khai dần.'},
          {en: 'The release broke checkout, so we rolled it back.', vi: 'roll back = quay về bản trước.'},
          {en: 'Let\'s break down this epic into smaller stories.', vi: 'break down = chia nhỏ.'},
          {en: 'I\'ll follow up with the DevOps team tomorrow.', vi: 'follow up (with) = nhắc lại, theo dõi tiếp.'},
          {en: 'The product owner pushed back on the new deadline.', vi: 'push back (on) = phản đối, không đồng ý.'},
          {en: 'We need to clean up the old feature flags.', vi: 'clean up = dọn dẹp.'},
          {en: 'Can you fill me in on what happened in the meeting?', vi: 'fill (someone) in = cập nhật thông tin cho ai.'},
          {en: 'The service went down for ten minutes last night.', vi: 'go down = bị sập, ngừng hoạt động.'},
          {en: 'I came across a similar bug in the old project.', vi: 'come across = tình cờ gặp.'},
          {en: 'Let\'s wrap up the meeting. We\'re out of time.', vi: 'wrap up = kết thúc.'},
          {en: 'I ran into a problem with the database migration.', vi: 'run into = gặp phải (vấn đề).'},
          {en: 'We should phase out the legacy API by next quarter.', vi: 'phase out = loại bỏ dần.'},
          {en: 'Could you walk me through your solution?', vi: 'walk (someone) through = giải thích từng bước.'}
        ]
      },
      {
        title: {en: 'Workplace idioms', vi: 'Thành ngữ ở công sở'},
        phrases: [
          {en: 'Let\'s make sure we\'re all on the same page.', vi: 'on the same page = cùng hiểu một cách.'},
          {en: 'Fixing the typo is low-hanging fruit. Let\'s do it first.', vi: 'low-hanging fruit = việc dễ mà có ích, làm trước.'},
          {en: 'Can you give me a ballpark figure for the effort?', vi: 'ballpark figure = con số ước lượng sơ bộ.'},
          {en: 'Just a heads-up: I\'ll be offline tomorrow morning.', vi: 'heads-up = báo trước.'},
          {en: 'We\'re back to square one after the client changed the scope.', vi: 'back to square one = quay về vạch xuất phát.'},
          {en: 'Let\'s not reinvent the wheel. There\'s a library for that.', vi: 'reinvent the wheel = làm lại cái đã có sẵn.'},
          {en: 'This bug is just the tip of the iceberg.', vi: 'tip of the iceberg = phần nổi của tảng băng.'},
          {en: 'Let\'s touch base on Friday to check progress.', vi: 'touch base = trao đổi ngắn để cập nhật.'},
          {en: 'I don\'t have the bandwidth to take this on this week.', vi: 'bandwidth = khả năng/thời gian để nhận thêm việc.'},
          {en: 'Let\'s take this offline so we don\'t hold up the meeting.', vi: 'take it offline = trao đổi riêng sau; hold up = làm chậm.'},
          {en: 'The deadline is tight, but it\'s doable.', vi: 'tight = gấp; doable = làm được.'},
          {en: 'Let\'s keep it simple and not over-engineer it.', vi: 'over-engineer = làm quá phức tạp so với nhu cầu.'}
        ]
      },
      {
        title: {en: 'Acronyms in messages', vi: 'Từ viết tắt trong tin nhắn'},
        tip: {en: 'Use acronyms in chat, but say the full words in meetings with clients.', vi: 'Dùng viết tắt trong chat, nhưng nói đầy đủ khi họp với khách hàng.'},
        phrases: [
          {en: 'I\'ll send the report by end of day. EOD.', vi: 'EOD = end of day, cuối ngày làm việc.'},
          {en: 'What\'s the ETA for the fix?', vi: 'ETA = estimated time of arrival, khi nào xong.'},
          {en: 'I\'m out of office next week. OOO.', vi: 'OOO = out of office, nghỉ / không ở văn phòng.'},
          {en: 'This is still a work in progress. WIP.', vi: 'WIP = work in progress, đang làm dở.'},
          {en: 'To be honest, I\'m not sure. TBH.', vi: 'TBH = to be honest, thật lòng mà nói.'},
          {en: 'The venue is to be confirmed. TBC.', vi: 'TBC = to be confirmed, sẽ xác nhận sau; TBD = to be decided.'},
          {en: 'As far as I know, it\'s already deployed. AFAIK.', vi: 'AFAIK = as far as I know, theo mình biết.'},
          {en: 'Please review it as soon as possible. ASAP.', vi: 'ASAP = as soon as possible, càng sớm càng tốt.'},
          {en: 'In my opinion, we should wait. IMO.', vi: 'IMO = in my opinion, theo ý mình.'},
          {en: 'Please treat this as a P1 incident.', vi: 'P1 = priority one, mức ưu tiên cao nhất.'}
        ]
      },
      {
        title: {en: 'Phrasal verbs for meetings and planning', vi: 'Cụm động từ khi họp và lên kế hoạch'},
        phrases: [
          {en: 'I\'d like to bring up the issue with the test environment.', vi: 'bring up = nêu ra (một vấn đề).'},
          {en: 'Can we come up with a simpler solution?', vi: 'come up with = nghĩ ra.'},
          {en: 'Let\'s put off the redesign until next quarter.', vi: 'put off = hoãn lại.'},
          {en: 'The product owner needs to sign off on the design.', vi: 'sign off on = phê duyệt.'},
          {en: 'Let\'s go over the plan one more time.', vi: 'go over = xem lại, rà soát.'},
          {en: 'Who will take over the ticket while Lan is away?', vi: 'take over = tiếp quản.'},
          {en: 'We need to cut down on meetings this sprint.', vi: 'cut down on = cắt giảm.'}
        ]
      }
    ],
    templates: []
  },
  {
    id: 'presenting',
    groups: [
      {
        title: {en: 'Opening a talk', vi: 'Mở đầu bài thuyết trình'},
        tip: {en: 'Tell the audience what they will get in the first thirty seconds.', vi: 'Nói cho người nghe biết họ sẽ nhận được gì trong 30 giây đầu.'},
        phrases: [
          {en: 'Good afternoon, everyone. Thanks for coming.', vi: 'Chào buổi chiều mọi người. Cảm ơn đã tham dự.'},
          {en: 'Today I\'m going to talk about how we cut our API latency in half.', vi: 'Hôm nay mình sẽ nói về cách nhóm giảm một nửa độ trễ API.'},
          {en: 'By the end of this session, you\'ll know when to use a cache and when not to.', vi: 'Cuối buổi, mọi người sẽ biết khi nào nên dùng cache và khi nào không.'},
          {en: 'The talk has three parts: the problem, our solution, and the lessons learned.', vi: 'Bài nói có ba phần: vấn đề, giải pháp của nhóm và bài học rút ra.'},
          {en: 'Feel free to stop me if you have questions.', vi: 'Có câu hỏi gì cứ ngắt lời mình nhé.'},
          {en: 'I\'ll take questions at the end.', vi: 'Mình sẽ nhận câu hỏi ở cuối buổi.'}
        ]
      },
      {
        title: {en: 'Signposting and transitions', vi: 'Dẫn dắt và chuyển ý'},
        phrases: [
          {en: 'Let\'s start with some background.', vi: 'Mình bắt đầu với một chút bối cảnh.'},
          {en: 'Now let\'s move on to the architecture.', vi: 'Giờ mình chuyển sang phần kiến trúc.'},
          {en: 'This brings me to my next point.', vi: 'Điều này dẫn tới ý tiếp theo của mình.'},
          {en: 'I\'ll come back to this later.', vi: 'Mình sẽ quay lại ý này sau.'},
          {en: 'To sum up this part, the bottleneck was the database.', vi: 'Tóm lại phần này, điểm nghẽn là ở database.'},
          {en: 'Before I continue, are there any questions so far?', vi: 'Trước khi tiếp, đến đây có câu hỏi nào không?'}
        ]
      },
      {
        title: {en: 'Explaining diagrams and data', vi: 'Giải thích sơ đồ và số liệu'},
        phrases: [
          {en: 'As you can see on this slide, the request goes through the gateway first.', vi: 'Như mọi người thấy trên slide, request đi qua gateway trước.'},
          {en: 'On the left, we have the client. On the right, the database.', vi: 'Bên trái là client. Bên phải là database.'},
          {en: 'This arrow shows the event flowing to the queue.', vi: 'Mũi tên này thể hiện event đi vào hàng đợi.'},
          {en: 'Let me zoom in on this part.', vi: 'Để mình phóng to phần này.'},
          {en: 'The graph shows a sharp drop in errors after the release.', vi: 'Biểu đồ cho thấy lỗi giảm mạnh sau bản release.'},
          {en: 'Response time went up steadily until we added the index.', vi: 'Thời gian phản hồi tăng đều cho tới khi nhóm thêm index.'},
          {en: 'The key takeaway here is that most of the time was spent waiting on I/O.', vi: 'Điểm quan trọng ở đây là phần lớn thời gian là chờ I/O.'}
        ]
      },
      {
        title: {en: 'Handling questions', vi: 'Xử lý câu hỏi'},
        tip: {en: 'Repeat or rephrase the question first. It gives you time to think and helps remote listeners.', vi: 'Nhắc lại hoặc diễn đạt lại câu hỏi trước. Bạn có thời gian suy nghĩ và người họp online cũng nghe được.'},
        phrases: [
          {en: 'That\'s a great question.', vi: 'Câu hỏi rất hay.'},
          {en: 'If I understand correctly, you\'re asking how we handle retries.', vi: 'Nếu mình hiểu đúng, bạn đang hỏi nhóm xử lý retry thế nào.'},
          {en: 'I\'m not sure about that, but I\'ll find out and get back to you.', vi: 'Mình chưa chắc về điều đó, mình sẽ tìm hiểu và phản hồi lại.'},
          {en: 'That\'s a bit outside the scope of today\'s talk, but happy to discuss it afterwards.', vi: 'Câu đó hơi ngoài phạm vi buổi hôm nay, nhưng mình sẵn lòng trao đổi sau.'},
          {en: 'Does that answer your question?', vi: 'Như vậy đã trả lời câu hỏi của bạn chưa?'}
        ]
      },
      {
        title: {en: 'Closing', vi: 'Kết thúc'},
        phrases: [
          {en: 'To wrap up, here are the three things to remember.', vi: 'Để kết lại, đây là ba điều cần nhớ.'},
          {en: 'The slides and the code are in the shared folder.', vi: 'Slide và code nằm trong thư mục chung.'},
          {en: 'Thank you for listening. Any final questions?', vi: 'Cảm ơn mọi người đã lắng nghe. Còn câu hỏi nào nữa không?'}
        ]
      },
      {
        title: {en: 'Recovering when things go wrong', vi: 'Gỡ rối khi có sự cố lúc thuyết trình'},
        tip: {en: 'Pause, breathe, and use a recovery phrase. The audience forgets small mistakes quickly if you stay calm.', vi: 'Dừng lại, hít thở, dùng một câu gỡ rối. Khán giả quên lỗi nhỏ rất nhanh nếu bạn giữ bình tĩnh.'},
        phrases: [
          {en: 'Sorry, I\'ve lost my train of thought. Let me go back to the diagram.', vi: 'Xin lỗi, mình bị quên ý. Để mình quay lại sơ đồ.'},
          {en: 'Let me put that another way.', vi: 'Để mình diễn đạt lại theo cách khác.'},
          {en: 'Sorry, I mean the payment service, not the gateway.', vi: 'Xin lỗi, ý mình là payment service, không phải gateway.'},
          {en: 'The demo isn\'t cooperating today, so let me show the screenshots instead.', vi: 'Demo hôm nay "dở chứng", để mình cho xem ảnh chụp thay thế.'},
          {en: 'I\'m running a bit over time, so I\'ll skip to the summary.', vi: 'Mình hơi quá giờ nên sẽ chuyển thẳng tới phần tóm tắt.'},
          {en: 'Can everyone still hear me? My connection dropped for a second.', vi: 'Mọi người vẫn nghe được mình chứ? Mạng vừa rớt một chút.'}
        ]
      },
      {
        title: {en: 'Presenting numbers and results', vi: 'Trình bày con số và kết quả'},
        phrases: [
          {en: 'Let me start with the headline: response time is down by forty percent.', vi: 'Bắt đầu bằng điểm chính: thời gian phản hồi giảm 40%.'},
          {en: 'That\'s from about two seconds to just over one second.', vi: 'Tức là từ khoảng hai giây xuống còn hơn một giây một chút.'},
          {en: 'To put that in perspective, it saves our users about ten hours a day in total.', vi: 'Để dễ hình dung, nó giúp người dùng tiết kiệm tổng cộng khoảng mười giờ mỗi ngày.'},
          {en: 'These numbers are from the last thirty days in production.', vi: 'Các con số này lấy từ 30 ngày gần nhất trên production.'},
          {en: 'There\'s one caveat: the data doesn\'t include the holiday week.', vi: 'Có một lưu ý: dữ liệu không bao gồm tuần nghỉ lễ.'},
          {en: 'In short, the change paid off.', vi: 'Tóm lại, thay đổi này đã mang lại hiệu quả.'}
        ]
      },
      {
        title: {en: 'Lunch and learn sessions', vi: 'Buổi chia sẻ nội bộ giờ trưa'},
        phrases: [
          {en: 'Welcome to today\'s lunch and learn. Feel free to eat while I talk.', vi: 'Chào mừng đến buổi chia sẻ giờ trưa. Mọi người cứ ăn trong lúc mình nói nhé.'},
          {en: 'This will take about twenty minutes, plus ten minutes for questions.', vi: 'Buổi này khoảng 20 phút, cộng 10 phút hỏi đáp.'},
          {en: 'No prior knowledge is needed. I\'ll start from the basics.', vi: 'Không cần kiến thức trước. Mình sẽ bắt đầu từ cơ bản.'},
          {en: 'I\'ll share a small demo you can try on your own laptop.', vi: 'Mình sẽ chia sẻ một demo nhỏ để mọi người tự thử trên laptop.'},
          {en: 'If this is useful, I can run a deeper session next month.', vi: 'Nếu hữu ích, tháng sau mình sẽ tổ chức một buổi chuyên sâu hơn.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Five-minute tech sharing', vi: 'Chia sẻ kỹ thuật 5 phút'},
        body: `Today I'd like to share [topic], because [why it matters to the team].
The problem: [what went wrong or what was slow].
What we did: [solution in two or three steps].
The result: [number or outcome].
The key takeaway: [one lesson].
Thanks! Any questions?`
      }
    ]
  },
  {
    id: 'oncall',
    groups: [
      {
        title: {en: 'Raising the alarm', vi: 'Báo động sự cố'},
        tip: {en: 'State the impact first: who is affected, since when, how badly.', vi: 'Nói tác động trước: ai bị ảnh hưởng, từ khi nào, mức độ ra sao.'},
        phrases: [
          {en: 'We have a P1: users haven\'t been able to log in since ten fifteen.', vi: 'Có sự cố P1: người dùng không đăng nhập được từ 10:15.'},
          {en: 'The error rate on the payment API jumped to twenty percent.', vi: 'Tỉ lệ lỗi của API thanh toán tăng vọt lên 20%.'},
          {en: 'I\'m opening an incident channel and starting a bridge call.', vi: 'Mình mở kênh sự cố và bắt đầu cuộc gọi xử lý.'},
          {en: 'I\'ll be the incident commander. Nam, can you take notes?', vi: 'Mình sẽ điều phối sự cố. Nam ghi chép giúp nhé?'},
          {en: 'Is anyone else seeing this, or is it just me?', vi: 'Có ai khác thấy lỗi này không, hay chỉ mình mình?'}
        ]
      },
      {
        title: {en: 'Investigating together', vi: 'Cùng nhau điều tra'},
        phrases: [
          {en: 'What changed in the last hour? Any deployments or config changes?', vi: 'Một giờ qua có gì thay đổi? Có deploy hay đổi config nào không?'},
          {en: 'The logs show connection timeouts to the database.', vi: 'Log cho thấy timeout khi kết nối tới database.'},
          {en: 'I can reproduce it on staging with the same request.', vi: 'Mình tái hiện được trên staging với cùng request.'},
          {en: 'Let\'s rule out the network first.', vi: 'Mình loại trừ khả năng do mạng trước.'},
          {en: 'I\'m checking the dashboards. Give me two minutes.', vi: 'Mình đang xem dashboard. Cho mình hai phút.'},
          {en: 'My hypothesis is that the connection pool is exhausted.', vi: 'Giả thuyết của mình là connection pool đã cạn.'},
          {en: 'Before we restart anything, let\'s take a thread dump.', vi: 'Trước khi restart gì, mình lấy thread dump đã.'}
        ]
      },
      {
        title: {en: 'Mitigating and updating stakeholders', vi: 'Khắc phục và cập nhật cho các bên'},
        tip: {en: 'Send updates on a fixed rhythm, for example every thirty minutes, even if there is no news.', vi: 'Gửi cập nhật theo nhịp cố định, ví dụ 30 phút một lần, kể cả khi chưa có tin mới.'},
        phrases: [
          {en: 'Let\'s roll back to the previous version to stop the bleeding.', vi: 'Rollback về bản trước để chặn thiệt hại đã.'},
          {en: 'The rollback is done, and the error rate is back to normal.', vi: 'Rollback xong, tỉ lệ lỗi đã về bình thường.'},
          {en: 'We\'ve identified the cause and we\'re working on a fix.', vi: 'Nhóm đã xác định nguyên nhân và đang sửa.'},
          {en: 'Next update in thirty minutes.', vi: 'Cập nhật tiếp theo sau 30 phút.'},
          {en: 'The issue is mitigated, but we\'re still monitoring.', vi: 'Sự cố đã được khắc phục tạm thời, nhóm vẫn đang theo dõi.'},
          {en: 'The incident is resolved. We\'ll share a postmortem by Friday.', vi: 'Sự cố đã xử lý xong. Nhóm sẽ gửi báo cáo postmortem trước thứ Sáu.'}
        ]
      },
      {
        title: {en: 'Postmortem', vi: 'Họp rút kinh nghiệm (postmortem)'},
        tip: {en: 'Blameless: ask what in the system allowed the mistake, not who made it.', vi: 'Không đổ lỗi: hỏi điều gì trong hệ thống cho phép lỗi xảy ra, không hỏi ai gây ra.'},
        phrases: [
          {en: 'This is a blameless review. We\'re here to improve the system.', vi: 'Đây là buổi review không đổ lỗi. Mục tiêu là cải thiện hệ thống.'},
          {en: 'The root cause was a missing index on the new column.', vi: 'Nguyên nhân gốc là thiếu index ở cột mới.'},
          {en: 'It took us forty minutes to detect it, because there was no alert.', vi: 'Nhóm mất 40 phút mới phát hiện vì không có cảnh báo.'},
          {en: 'What went well was the fast rollback.', vi: 'Điều làm tốt là rollback nhanh.'},
          {en: 'As a follow-up, we\'ll add a load test to the pipeline.', vi: 'Việc cần làm tiếp: thêm load test vào pipeline.'}
        ]
      },
      {
        title: {en: 'Handing over the on-call shift', vi: 'Bàn giao ca trực on-call'},
        phrases: [
          {en: 'It was a quiet week. Only two low-priority alerts.', vi: 'Tuần này khá yên. Chỉ có hai cảnh báo ưu tiên thấp.'},
          {en: 'There\'s one open issue: the import job is slower than usual. Keep an eye on it.', vi: 'Còn một việc mở: job import chậm hơn bình thường. Để ý giúp nhé.'},
          {en: 'I silenced the disk alert on server three until Monday, because we\'re replacing the disk.', vi: 'Mình tạm tắt cảnh báo ổ đĩa ở server 3 tới thứ Hai vì sắp thay.'},
          {en: 'The runbook for the payment alerts is linked in the channel.', vi: 'Runbook cho cảnh báo thanh toán đã gắn link trong kênh.'},
          {en: 'If you get paged at night and can\'t solve it in thirty minutes, call me.', vi: 'Nếu bị gọi lúc nửa đêm mà 30 phút chưa xử lý được thì gọi mình.'}
        ]
      },
      {
        title: {en: 'Status page messages for customers', vi: 'Thông báo sự cố cho khách hàng'},
        tip: {en: 'Customers want three things: what is affected, whether their money is safe, and when to expect the next update.', vi: 'Khách hàng muốn biết ba điều: cái gì bị ảnh hưởng, tiền của họ có an toàn không, và khi nào có cập nhật tiếp.'},
        phrases: [
          {en: 'We\'re aware that some users can\'t view their statements, and we\'re investigating.', vi: 'Chúng tôi biết một số người dùng không xem được sao kê và đang kiểm tra.'},
          {en: 'Your money and your data are safe. Only the display is affected.', vi: 'Tiền và dữ liệu của bạn vẫn an toàn. Chỉ phần hiển thị bị ảnh hưởng.'},
          {en: 'A fix is being deployed. We\'ll post another update within thirty minutes.', vi: 'Bản sửa đang được triển khai. Chúng tôi sẽ cập nhật tiếp trong vòng 30 phút.'},
          {en: 'The issue has been resolved. All services are working normally.', vi: 'Sự cố đã được khắc phục. Mọi dịch vụ đã hoạt động bình thường.'},
          {en: 'We\'re sorry for the inconvenience, and thank you for your patience.', vi: 'Xin lỗi vì sự bất tiện, và cảm ơn sự kiên nhẫn của bạn.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Incident status update', vi: 'Cập nhật trạng thái sự cố'},
        body: `[Investigating or Identified or Mitigated or Resolved] — [time]
Impact: [who is affected and how].
What we know: [current findings].
What we're doing: [current action].
Next update: [time].`
      }
    ]
  },
  {
    id: 'onboarding',
    groups: [
      {
        title: {en: 'Getting set up', vi: 'Chuẩn bị môi trường làm việc'},
        phrases: [
          {en: 'Who should I ask for access to the repository and Jira?', vi: 'Mình nên hỏi ai để được cấp quyền repository và Jira?'},
          {en: 'Is there an onboarding document or a README I should start with?', vi: 'Có tài liệu onboarding hay README nào mình nên đọc trước không?'},
          {en: 'I followed the setup guide, but the build fails at this step.', vi: 'Mình làm theo hướng dẫn cài đặt nhưng build lỗi ở bước này.'},
          {en: 'Which branch should I base my work on?', vi: 'Mình nên tạo nhánh từ branch nào?'},
          {en: 'Do we have test accounts for the staging environment?', vi: 'Có tài khoản test cho môi trường staging không?'}
        ]
      },
      {
        title: {en: 'Understanding the codebase and the team', vi: 'Tìm hiểu codebase và nhóm'},
        phrases: [
          {en: 'Could you give me a quick overview of the architecture?', vi: 'Bạn giới thiệu nhanh kiến trúc hệ thống giúp mình được không?'},
          {en: 'Which service owns the customer data?', vi: 'Service nào sở hữu dữ liệu khách hàng?'},
          {en: 'Who is the best person to ask about the billing module?', vi: 'Ai là người nên hỏi nhất về module billing?'},
          {en: 'What are the coding conventions for this project?', vi: 'Dự án có quy ước viết code nào?'},
          {en: 'How does the release process work here?', vi: 'Quy trình release ở đây diễn ra thế nào?'},
          {en: 'Is there a good first ticket I could pick up?', vi: 'Có ticket nào phù hợp để mình bắt đầu không?'}
        ]
      },
      {
        title: {en: 'Asking good questions', vi: 'Đặt câu hỏi hiệu quả'},
        tip: {en: 'Show what you already tried. It saves time and shows effort.', vi: 'Nói rõ bạn đã thử những gì. Vừa tiết kiệm thời gian vừa thể hiện sự chủ động.'},
        phrases: [
          {en: 'I\'ve read the docs and searched the code, but I couldn\'t find where this value is set.', vi: 'Mình đã đọc tài liệu và tìm trong code nhưng không thấy giá trị này được set ở đâu.'},
          {en: 'I tried two approaches. Could you tell me which one fits the project better?', vi: 'Mình đã thử hai cách. Bạn xem giúp cách nào hợp với dự án hơn?'},
          {en: 'Sorry if this is a basic question, but why do we use two databases here?', vi: 'Xin lỗi nếu câu hỏi cơ bản, nhưng sao ở đây dùng hai database?'},
          {en: 'Can I shadow you during the next deployment?', vi: 'Lần deploy tới mình đi theo quan sát bạn được không?'},
          {en: 'Thanks, I\'ll write this down in the onboarding doc for the next person.', vi: 'Cảm ơn, mình sẽ ghi vào tài liệu onboarding cho người sau.'}
        ]
      },
      {
        title: {en: 'HR, payroll and policies', vi: 'Nhân sự, lương và chính sách'},
        phrases: [
          {en: 'How many days of annual leave do I get?', vi: 'Tôi có bao nhiêu ngày phép năm?'},
          {en: 'When is payday, and when will I receive my first payslip?', vi: 'Ngày nào trả lương, và khi nào tôi nhận phiếu lương đầu tiên?'},
          {en: 'How do I request leave in the HR system?', vi: 'Làm sao xin nghỉ phép trên hệ thống nhân sự?'},
          {en: 'Does the health insurance also cover my family?', vi: 'Bảo hiểm sức khỏe có áp dụng cho gia đình tôi không?'},
          {en: 'Is there a budget for training or certifications?', vi: 'Có ngân sách cho đào tạo hay chứng chỉ không?'},
          {en: 'What\'s the policy on working from home?', vi: 'Chính sách làm việc tại nhà thế nào?'},
          {en: 'Who do I contact if my laptop needs repairing?', vi: 'Laptop cần sửa thì tôi liên hệ ai?'}
        ]
      },
      {
        title: {en: 'Meeting your buddy or mentor', vi: 'Làm quen với buddy hoặc mentor'},
        phrases: [
          {en: 'Hi, I think you\'re my onboarding buddy. Nice to meet you!', vi: 'Chào, hình như bạn là buddy hướng dẫn mình. Rất vui được gặp!'},
          {en: 'How often should we meet in the first month?', vi: 'Tháng đầu mình nên gặp nhau bao lâu một lần?'},
          {en: 'What do you wish you had known in your first week?', vi: 'Tuần đầu đi làm, bạn ước mình đã biết điều gì?'},
          {en: 'Is it okay to message you when I have small questions?', vi: 'Có câu hỏi nhỏ mình nhắn bạn được không?'},
          {en: 'Who are the key people I should meet early?', vi: 'Những người quan trọng nào mình nên gặp sớm?'}
        ]
      },
      {
        title: {en: 'The end of probation', vi: 'Kết thúc thời gian thử việc'},
        phrases: [
          {en: 'My probation review is next Friday. What should I prepare?', vi: 'Thứ Sáu tới là buổi đánh giá thử việc. Mình nên chuẩn bị gì?'},
          {en: 'In the first two months, I delivered three features and fixed the import bug.', vi: 'Trong hai tháng đầu, mình đã giao ba tính năng và sửa lỗi import.'},
          {en: 'I\'d like feedback on what I should focus on next.', vi: 'Mình muốn nhận góp ý về điều nên tập trung tiếp theo.'},
          {en: 'I\'m really enjoying the team and the work.', vi: 'Mình rất thích nhóm và công việc ở đây.'},
          {en: 'Thank you for confirming my contract. I\'m excited for what\'s next.', vi: 'Cảm ơn đã xác nhận hợp đồng chính thức. Mình rất hào hứng với chặng tiếp theo.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'End of first week check-in', vi: 'Cập nhật cuối tuần đầu tiên'},
        body: `This week I [set up my environment or finished my first ticket or met the team].
I learned [architecture or process].
I'm still unclear about [topic], so I'd like to [ask or pair with someone].
Next week I plan to [goal].`
      }
    ]
  },
  {
    id: 'social',
    groups: [
      {
        title: {en: 'Small talk topics', vi: 'Chủ đề nói chuyện xã giao'},
        tip: {en: 'Safe topics: weather, food, travel, hobbies, weekend plans. Avoid salary, politics and religion.', vi: 'Chủ đề an toàn: thời tiết, ẩm thực, du lịch, sở thích, kế hoạch cuối tuần. Tránh lương, chính trị, tôn giáo.'},
        phrases: [
          {en: 'It\'s really hot today, isn\'t it?', vi: 'Hôm nay nóng thật nhỉ?'},
          {en: 'Have you tried the new coffee shop downstairs?', vi: 'Bạn thử quán cà phê mới ở dưới chưa?'},
          {en: 'Do you have any plans for the holiday?', vi: 'Kỳ nghỉ này bạn có kế hoạch gì chưa?'},
          {en: 'What do you like to do in your free time?', vi: 'Lúc rảnh bạn thích làm gì?'},
          {en: 'I\'ve just started learning to play badminton.', vi: 'Mình mới bắt đầu học chơi cầu lông.'},
          {en: 'That sounds fun. How did you get into it?', vi: 'Nghe vui đấy. Sao bạn lại bắt đầu chơi vậy?'}
        ]
      },
      {
        title: {en: 'Team lunch and after-work events', vi: 'Ăn trưa nhóm và sự kiện sau giờ làm'},
        phrases: [
          {en: 'We\'re going for team lunch. Would you like to join us?', vi: 'Nhóm đi ăn trưa. Bạn đi cùng không?'},
          {en: 'Do you have any food allergies?', vi: 'Bạn có dị ứng món gì không?'},
          {en: 'I\'d recommend the pho here. It\'s really good.', vi: 'Mình gợi ý món phở ở đây. Ngon lắm.'},
          {en: 'Let\'s split the bill.', vi: 'Mình chia tiền nhé.'},
          {en: 'It\'s on me today.', vi: 'Hôm nay mình mời.'},
          {en: 'Thanks for organizing the team building. I had a great time.', vi: 'Cảm ơn đã tổ chức team building. Mình rất vui.'},
          {en: 'I\'ll have to head home early, but enjoy the rest of the evening!', vi: 'Mình phải về sớm, mọi người chơi vui nhé!'}
        ]
      },
      {
        title: {en: 'Compliments and congratulations', vi: 'Khen ngợi và chúc mừng'},
        phrases: [
          {en: 'Congratulations on your promotion! Well deserved.', vi: 'Chúc mừng bạn được thăng chức! Xứng đáng lắm.'},
          {en: 'Great job on the demo today.', vi: 'Buổi demo hôm nay bạn làm tốt lắm.'},
          {en: 'Happy birthday! Hope you have a great day.', vi: 'Chúc mừng sinh nhật! Chúc bạn một ngày tuyệt vời.'},
          {en: 'Welcome to the team! Let me know if you need anything.', vi: 'Chào mừng bạn vào nhóm! Cần gì cứ báo mình.'},
          {en: 'We\'ll miss you. Good luck with your next adventure!', vi: 'Mọi người sẽ nhớ bạn. Chúc may mắn với chặng đường mới!'}
        ]
      },
      {
        title: {en: 'Business trips', vi: 'Đi công tác'},
        phrases: [
          {en: 'I\'d like to check in. I have a reservation under the name Pham.', vi: 'Tôi muốn nhận phòng. Tôi đã đặt dưới tên Pham.'},
          {en: 'Could I get a receipt for my expense report?', vi: 'Cho tôi xin hóa đơn để làm báo cáo chi phí được không?'},
          {en: 'My flight was delayed, so I\'ll be about an hour late to the meeting.', vi: 'Chuyến bay của tôi bị trễ nên tôi sẽ đến họp muộn khoảng một giờ.'},
          {en: 'How do I get to your office from the hotel?', vi: 'Từ khách sạn đến văn phòng bên bạn đi thế nào?'},
          {en: 'It\'s my first time in Singapore. Any recommendations for dinner?', vi: 'Đây là lần đầu tôi đến Singapore. Có gợi ý chỗ ăn tối nào không?'},
          {en: 'Thank you for hosting us. It was great to meet the team in person.', vi: 'Cảm ơn đã đón tiếp. Rất vui được gặp trực tiếp cả nhóm.'}
        ]
      },
      {
        title: {en: 'At the airport and immigration', vi: 'Ở sân bay và cửa nhập cảnh'},
        phrases: [
          {en: 'I\'d like an aisle seat, please.', vi: 'Cho tôi ghế cạnh lối đi. (window seat = ghế cạnh cửa sổ)'},
          {en: 'I\'m here on business. I\'m visiting a client for two weeks.', vi: 'Tôi đến đây công tác, gặp khách hàng trong hai tuần.'},
          {en: 'I\'ll be staying at the Marina Hotel.', vi: 'Tôi sẽ ở khách sạn Marina.'},
          {en: 'Here\'s my return ticket and the invitation letter.', vi: 'Đây là vé khứ hồi và thư mời của tôi.'},
          {en: 'My luggage didn\'t arrive. Where can I report it?', vi: 'Hành lý của tôi không đến. Tôi báo ở đâu?'},
          {en: 'My connecting flight was cancelled. Can you rebook me?', vi: 'Chuyến bay nối chuyến của tôi bị hủy. Anh/chị đổi vé giúp tôi được không?'}
        ]
      },
      {
        title: {en: 'Hotel problems', vi: 'Sự cố ở khách sạn'},
        phrases: [
          {en: 'The Wi-Fi in my room isn\'t working.', vi: 'Wi-Fi trong phòng tôi không hoạt động.'},
          {en: 'Could I have a late checkout? My flight is in the evening.', vi: 'Tôi trả phòng muộn được không? Chuyến bay của tôi vào buổi tối.'},
          {en: 'There\'s a mistake on my bill. I didn\'t use the minibar.', vi: 'Hóa đơn của tôi bị sai. Tôi không dùng minibar.'},
          {en: 'Could you store my luggage until four?', vi: 'Anh/chị giữ hành lý giúp tôi tới 4 giờ được không?'},
          {en: 'Could I get an invoice with my company\'s name on it?', vi: 'Cho tôi xin hóa đơn ghi tên công ty được không?'}
        ]
      },
      {
        title: {en: 'Explaining Vietnamese holidays and culture', vi: 'Giải thích ngày lễ và văn hóa Việt Nam'},
        phrases: [
          {en: 'Tet is the Lunar New Year, our biggest holiday of the year.', vi: 'Tết là Tết Nguyên Đán, ngày lễ lớn nhất trong năm.'},
          {en: 'Most people go back to their hometowns to be with their families.', vi: 'Phần lớn mọi người về quê sum họp gia đình.'},
          {en: 'The office will be closed for about a week during Tet.', vi: 'Văn phòng sẽ nghỉ khoảng một tuần dịp Tết.'},
          {en: 'We give lucky money in red envelopes to children.', vi: 'Người ta lì xì cho trẻ em trong phong bao đỏ.'},
          {en: 'The thirtieth of April and the first of May are public holidays in Vietnam.', vi: 'Ngày 30/4 và 1/5 là ngày nghỉ lễ ở Việt Nam.'},
          {en: 'You should try bun cha when you visit Hanoi. It\'s grilled pork with noodles.', vi: 'Bạn nên thử bún chả khi đến Hà Nội. Đó là thịt nướng ăn với bún.'},
          {en: 'Coffee culture is big here. Have you tried egg coffee?', vi: 'Văn hóa cà phê ở đây rất phổ biến. Bạn đã thử cà phê trứng chưa?'}
        ]
      },
      {
        title: {en: 'Farewells and leaving parties', vi: 'Chia tay đồng nghiệp'},
        phrases: [
          {en: 'It\'s been a pleasure working with you.', vi: 'Rất vui vì đã được làm việc cùng bạn.'},
          {en: 'I\'ve learned so much from you, especially about system design.', vi: 'Mình đã học được rất nhiều từ bạn, nhất là về thiết kế hệ thống.'},
          {en: 'Let\'s keep in touch. Here\'s my personal email.', vi: 'Giữ liên lạc nhé. Đây là email cá nhân của mình.'},
          {en: 'Good luck with your new role. They\'re lucky to have you.', vi: 'Chúc bạn may mắn với công việc mới. Họ thật may mắn khi có bạn.'},
          {en: 'Thank you all for the lovely farewell. I\'ll miss this team.', vi: 'Cảm ơn mọi người vì buổi chia tay thật ấm áp. Mình sẽ nhớ nhóm này.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Small talk at the coffee machine', vi: 'Nói chuyện xã giao ở máy pha cà phê'},
        body: `Hi [name]! How's your week going?
— [answer]. And you?
Pretty busy, we're preparing the [release or demo]. Any plans for the weekend?
— [answer].
That sounds great. Enjoy it! See you at the stand-up.`
      }
    ]
  },
  {
    id: 'livecoding',
    groups: [
      {
        title: {en: 'Understanding the problem', vi: 'Hiểu đề bài'},
        tip: {en: 'Never start coding in silence. Repeat the problem, ask about inputs, outputs and edge cases first.', vi: 'Đừng im lặng mà code ngay. Nhắc lại đề, hỏi về đầu vào, đầu ra và trường hợp biên trước.'},
        phrases: [
          {en: 'Let me make sure I understand the problem correctly.', vi: 'Để mình chắc là đã hiểu đúng đề bài.'},
          {en: 'So the input is an array of integers, and I need to return the two indexes that add up to the target.', vi: 'Vậy đầu vào là mảng số nguyên, mình cần trả về hai chỉ số có tổng bằng target.'},
          {en: 'Can the array be empty or contain negative numbers?', vi: 'Mảng có thể rỗng hoặc có số âm không?'},
          {en: 'Can I assume there is always exactly one solution?', vi: 'Mình có thể giả định luôn có đúng một lời giải không?'},
          {en: 'How large can the input be? That affects which approach I choose.', vi: 'Đầu vào lớn tới mức nào? Điều đó ảnh hưởng tới cách mình chọn.'},
          {en: 'Let me walk through a small example first.', vi: 'Để mình thử với một ví dụ nhỏ trước.'}
        ]
      },
      {
        title: {en: 'Thinking aloud', vi: 'Nói to suy nghĩ'},
        phrases: [
          {en: 'My first idea is a brute-force solution with two loops. That\'s O of n squared.', vi: 'Ý tưởng đầu tiên là brute force với hai vòng lặp, độ phức tạp O(n²) — đọc "O of n squared".'},
          {en: 'We can do better with a hash map, which brings it down to O of n.', vi: 'Có thể tốt hơn bằng hash map, giảm xuống O(n) — "O of n".'},
          {en: 'The trade-off is extra memory for the map.', vi: 'Đánh đổi là tốn thêm bộ nhớ cho map.'},
          {en: 'I\'ll go with the hash map approach, if that\'s okay with you.', vi: 'Mình sẽ chọn cách dùng hash map, nếu anh/chị đồng ý.'},
          {en: 'Here I\'m iterating over the array and checking if the complement is already in the map.', vi: 'Ở đây mình duyệt mảng và kiểm tra phần bù đã có trong map chưa.'},
          {en: 'I\'ll write a helper method for this to keep the main logic clean.', vi: 'Mình viết một hàm phụ để phần logic chính gọn gàng.'},
          {en: 'Give me a second to think about this part.', vi: 'Cho mình một chút để suy nghĩ phần này.'},
          {en: 'I\'m a bit stuck here. Could I get a small hint?', vi: 'Mình hơi bí ở đây. Cho mình xin một gợi ý nhỏ được không?'}
        ]
      },
      {
        title: {en: 'Testing and complexity', vi: 'Kiểm tra và độ phức tạp'},
        phrases: [
          {en: 'Let me trace through the code with the example.', vi: 'Để mình chạy tay đoạn code với ví dụ.'},
          {en: 'What about the edge case where the array has only one element?', vi: 'Còn trường hợp biên khi mảng chỉ có một phần tử thì sao?'},
          {en: 'Oh, I see a bug. This should be less than or equal to, not less than.', vi: 'À, mình thấy bug. Chỗ này phải là nhỏ hơn hoặc bằng, không phải nhỏ hơn.'},
          {en: 'The time complexity is O of n, and the space complexity is also O of n.', vi: 'Độ phức tạp thời gian là O(n), bộ nhớ cũng là O(n).'},
          {en: 'O of n log n, because of the sort.', vi: 'O(n log n) — "O of n log n" vì có bước sắp xếp.'},
          {en: 'If I had more time, I would add input validation and more unit tests.', vi: 'Nếu có thêm thời gian, mình sẽ thêm kiểm tra đầu vào và nhiều unit test hơn.'}
        ]
      },
      {
        title: {en: 'When you finish early or get stuck', vi: 'Khi làm xong sớm hoặc bị bí'},
        phrases: [
          {en: 'I have a working solution. Would you like me to optimize it further?', vi: 'Tôi đã có lời giải chạy được. Anh/chị có muốn tôi tối ưu thêm không?'},
          {en: 'One improvement would be to avoid the extra list and do it in one pass.', vi: 'Một cải tiến là bỏ danh sách phụ và làm trong một lượt duyệt.'},
          {en: 'In production code, I\'d also add input validation and tests.', vi: 'Với code production, tôi sẽ thêm kiểm tra đầu vào và test.'},
          {en: 'I\'m not sure this handles duplicates. Let me test that case.', vi: 'Tôi chưa chắc cách này xử lý được phần tử trùng. Để tôi test trường hợp đó.'},
          {en: 'Let me step back and try a simpler approach.', vi: 'Để tôi lùi lại và thử một cách đơn giản hơn.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Live coding flow', vi: 'Trình tự khi live coding'},
        body: `Let me repeat the problem: [restate].
A few questions: [input size or empty input or duplicates or negative numbers]?
A simple approach is [brute force], which is O of [complexity].
A better approach is [idea], which is O of [complexity], with the trade-off of [memory or readability].
I'll code the better approach now. [code while explaining]
Let me test it with [example] and the edge case [edge case].
Time: O of [..]. Space: O of [..].`
      }
    ]
  },
  {
    id: 'fintech',
    groups: [
      {
        title: {en: 'Cards and statements', vi: 'Thẻ và sao kê'},
        phrases: [
          {en: 'The statement date is the fifth, and the payment due date is the twenty-fifth.', vi: 'Ngày sao kê là mùng 5, hạn thanh toán là ngày 25. (statement date, due date)'},
          {en: 'If you pay the full statement balance, you won\'t be charged interest.', vi: 'Thanh toán đủ dư nợ sao kê thì không bị tính lãi. (statement balance, interest)'},
          {en: 'The minimum payment is five percent of the outstanding balance.', vi: 'Số tiền thanh toán tối thiểu là 5% dư nợ. (minimum payment, outstanding balance)'},
          {en: 'There\'s a late fee if the payment is overdue.', vi: 'Có phí trả chậm nếu quá hạn. (late fee, overdue)'},
          {en: 'The transaction is still pending, so it isn\'t on the statement yet.', vi: 'Giao dịch vẫn đang chờ xử lý nên chưa vào sao kê. (pending transaction)'},
          {en: 'The customer wants to dispute a charge they don\'t recognize.', vi: 'Khách hàng muốn khiếu nại một khoản chi không nhận ra. (dispute a charge)'},
          {en: 'You earn one percent cashback on online purchases.', vi: 'Bạn được hoàn tiền 1% khi mua sắm online. (cashback)'},
          {en: 'The credit limit is fifty million dong, and you\'ve used thirty percent of it.', vi: 'Hạn mức tín dụng là 50 triệu, bạn đã dùng 30%. (credit limit, credit utilization)'}
        ]
      },
      {
        title: {en: 'Payments and settlement', vi: 'Thanh toán và quyết toán'},
        phrases: [
          {en: 'The payment was authorized but not captured yet.', vi: 'Giao dịch đã được cấp phép nhưng chưa được ghi nhận thu tiền. (authorize, capture)'},
          {en: 'Settlement happens at the end of the day in a batch.', vi: 'Quyết toán diễn ra theo lô vào cuối ngày. (settlement, batch)'},
          {en: 'We need to reconcile our records with the bank\'s report.', vi: 'Cần đối soát dữ liệu của mình với báo cáo của ngân hàng. (reconcile, reconciliation)'},
          {en: 'The refund will be credited to your account within five business days.', vi: 'Tiền hoàn sẽ được ghi có vào tài khoản trong 5 ngày làm việc. (refund, credited, business days)'},
          {en: 'The ledger is append-only. We never update or delete entries.', vi: 'Sổ cái chỉ ghi thêm. Không bao giờ sửa hay xóa bút toán. (ledger, entry)'},
          {en: 'Each transfer creates a debit entry and a matching credit entry.', vi: 'Mỗi lệnh chuyển tạo một bút toán ghi nợ và một bút toán ghi có tương ứng. (debit, credit, double-entry)'},
          {en: 'We charge a transaction fee of zero point five percent.', vi: 'Phí giao dịch là 0,5%. (transaction fee)'},
          {en: 'The exchange rate is locked at the time of payment.', vi: 'Tỷ giá được chốt tại thời điểm thanh toán. (exchange rate)'}
        ]
      },
      {
        title: {en: 'Investment and reporting', vi: 'Đầu tư và báo cáo'},
        phrases: [
          {en: 'The portfolio is up eight percent year to date.', vi: 'Danh mục tăng 8% từ đầu năm. (portfolio, year to date / YTD)'},
          {en: 'We had a realized gain on the shares we sold, and an unrealized loss on the rest.', vi: 'Có lãi đã hiện thực trên số cổ phiếu đã bán, và lỗ chưa hiện thực phần còn lại. (realized/unrealized gain/loss)'},
          {en: 'Dividends are paid quarterly.', vi: 'Cổ tức được trả theo quý. (dividend, quarterly)'},
          {en: 'Revenue grew, but the profit margin went down.', vi: 'Doanh thu tăng nhưng biên lợi nhuận giảm. (revenue, profit margin)'},
          {en: 'The numbers in this report are in millions of dong.', vi: 'Số liệu báo cáo này tính theo triệu đồng.'},
          {en: 'We always store amounts as decimals, never as floating-point numbers.', vi: 'Luôn lưu số tiền bằng kiểu decimal, không bao giờ dùng số thực dấu phẩy động.'}
        ]
      },
      {
        title: {en: 'Compliance and audit', vi: 'Tuân thủ và kiểm toán'},
        tip: {en: 'Common in consulting and banking projects: KYC, AML, audit trail, PCI DSS, GDPR, segregation of duties.', vi: 'Hay gặp trong dự án tư vấn và ngân hàng: KYC, AML, audit trail, PCI DSS, GDPR, phân tách nhiệm vụ.'},
        phrases: [
          {en: 'New customers must pass KYC checks before opening an account.', vi: 'Khách hàng mới phải qua kiểm tra KYC (know your customer) trước khi mở tài khoản.'},
          {en: 'Large transfers are flagged for anti-money laundering review.', vi: 'Giao dịch lớn được gắn cờ để rà soát chống rửa tiền (AML).'},
          {en: 'Every change to customer data must be recorded in the audit trail.', vi: 'Mọi thay đổi dữ liệu khách hàng phải được ghi vào nhật ký kiểm toán (audit trail).'},
          {en: 'We don\'t store full card numbers, to reduce our PCI DSS scope.', vi: 'Không lưu đầy đủ số thẻ để giảm phạm vi phải tuân thủ PCI DSS (và tuyệt đối không lưu mã CVV).'},
          {en: 'The person who creates a payment can\'t also approve it.', vi: 'Người tạo lệnh thanh toán không được đồng thời phê duyệt (segregation of duties).'},
          {en: 'The auditors asked for evidence that access is reviewed every quarter.', vi: 'Kiểm toán viên yêu cầu bằng chứng việc rà soát quyền truy cập mỗi quý.'}
        ]
      },
      {
        title: {en: 'Loans and interest', vi: 'Khoản vay và lãi suất'},
        phrases: [
          {en: 'The principal is one hundred million dong, and the interest rate is twelve percent per year.', vi: 'Tiền gốc (principal) 100 triệu đồng, lãi suất 12%/năm.'},
          {en: 'The loan term is twenty-four months, with equal monthly installments.', vi: 'Kỳ hạn vay 24 tháng, trả góp đều hằng tháng. (term, installment)'},
          {en: 'Interest is calculated on the remaining balance.', vi: 'Lãi được tính trên dư nợ còn lại (dư nợ giảm dần).'},
          {en: 'There\'s a fee for early repayment.', vi: 'Có phí khi trả nợ trước hạn (early repayment).'},
          {en: 'The APR includes both the interest and the fees.', vi: 'APR (lãi suất phần trăm hằng năm) gồm cả lãi và các loại phí.'},
          {en: 'You can convert this purchase into a zero-percent installment plan.', vi: 'Bạn có thể chuyển giao dịch này sang trả góp 0%.'},
          {en: 'The payment is overdue, so a late fee has been applied.', vi: 'Khoản thanh toán quá hạn nên đã bị áp phí trả chậm.'}
        ]
      },
      {
        title: {en: 'Answering card questions from users', vi: 'Trả lời câu hỏi về thẻ của người dùng'},
        phrases: [
          {en: 'This charge is an annual fee. It appears once a year on your statement date.', vi: 'Khoản này là phí thường niên, xuất hiện mỗi năm một lần vào ngày sao kê.'},
          {en: 'The amount is held, not charged yet. It will be released if the merchant cancels.', vi: 'Số tiền đang bị tạm giữ, chưa bị trừ. Nó sẽ được trả lại nếu người bán hủy giao dịch.'},
          {en: 'The refund goes back to the same card you paid with.', vi: 'Tiền hoàn sẽ về đúng thẻ bạn đã dùng để thanh toán.'},
          {en: 'Foreign transactions include a currency conversion fee.', vi: 'Giao dịch nước ngoài có phí chuyển đổi ngoại tệ.'},
          {en: 'Your available limit goes up again as soon as your payment is posted.', vi: 'Hạn mức khả dụng sẽ tăng lại ngay khi khoản thanh toán được ghi nhận.'},
          {en: 'For your safety, we can\'t show the full card number in the app.', vi: 'Vì an toàn, ứng dụng không hiển thị đầy đủ số thẻ.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Explaining a card statement to a user', vi: 'Giải thích sao kê thẻ cho người dùng'},
        body: `Your statement date is the [day], and the payment due date is the [day].
Your statement balance is [amount], and the minimum payment is [amount].
If you pay the full statement balance by the due date, you won't be charged interest.
The transaction on [date] is still pending, so it will appear on your next statement.`
      }
    ]
  },
  {
    id: 'mistakes',
    groups: [
      {
        title: {en: 'Uncountable nouns', vi: 'Danh từ không đếm được'},
        tip: {en: 'These words have no plural -s and no "a": information, advice, feedback, equipment, software, hardware, furniture, research, knowledge, progress.', vi: 'Các từ này không thêm -s và không đi với "a": information, advice, feedback, equipment, software, hardware, furniture, research, knowledge, progress.'},
        phrases: [
          {en: 'Thanks for the feedback.', vi: 'Sai: "Thanks for the feedbacks". Đúng: feedback (không có s).'},
          {en: 'Could you send me more information about the API?', vi: 'Sai: "more informations". Đúng: more information / a piece of information.'},
          {en: 'Can I ask you for some advice?', vi: 'Sai: "an advice" / "advices". Đúng: some advice / a piece of advice.'},
          {en: 'We need to install some software on the new laptops.', vi: 'Sai: "softwares". Đúng: software / software tools / applications.'},
          {en: 'We made good progress this week.', vi: 'Sai: "a good progress" / "progresses". Đúng: good progress.'},
          {en: 'All staff must complete the security training.', vi: '"staff" là danh từ tập hợp: sai "staffs", nói "staff members" nếu cần đếm.'}
        ]
      },
      {
        title: {en: 'Verbs that don\'t take a preposition', vi: 'Động từ không đi với giới từ'},
        phrases: [
          {en: 'Let\'s discuss the design tomorrow.', vi: 'Sai: "discuss about". Đúng: discuss something (hoặc "talk about").'},
          {en: 'Can you explain the problem to me?', vi: 'Sai: "explain me the problem". Đúng: explain something to someone.'},
          {en: 'I\'ll contact the vendor today.', vi: 'Sai: "contact with the vendor". Đúng: contact someone.'},
          {en: 'We need to enter the room before nine.', vi: 'Sai: "enter into the room". Đúng: enter the room.'},
          {en: 'Please call me when you\'re free.', vi: 'Sai: "call to me". Đúng: call me.'},
          {en: 'The result depends on the input.', vi: 'Sai: "depends of". Đúng: depend on.'},
          {en: 'I\'m responsible for the payment module.', vi: 'Sai: "responsible of". Đúng: responsible for.'},
          {en: 'She\'s good at debugging.', vi: 'Sai: "good in debugging". Đúng: good at.'}
        ]
      },
      {
        title: {en: 'Tenses Vietnamese speakers often mix up', vi: 'Thì người Việt hay nhầm'},
        tip: {en: 'Use the present perfect for something that started in the past and continues now, or a past action with a result now.', vi: 'Dùng hiện tại hoàn thành cho việc bắt đầu trong quá khứ và còn tiếp diễn, hoặc việc đã làm có kết quả ở hiện tại.'},
        phrases: [
          {en: 'I\'ve worked here since 2021.', vi: 'Sai: "I work here since 2021". Đúng: I\'ve worked / I\'ve been working here since 2021.'},
          {en: 'I\'ve already fixed the bug.', vi: 'Sai: "I already fix the bug". Đúng: I\'ve already fixed (kết quả ở hiện tại).'},
          {en: 'I fixed it yesterday.', vi: 'Có mốc thời gian quá khứ (yesterday) thì dùng quá khứ đơn: fixed, không dùng "have fixed".'},
          {en: 'I\'m working on the login feature this week.', vi: 'Việc đang làm trong giai đoạn này: present continuous, không nói "I work on".'},
          {en: 'I\'ll send it to you after I finish the tests.', vi: 'Sau after/when/before dùng hiện tại: "after I finish", không nói "after I will finish".'},
          {en: 'How long have you been a developer?', vi: 'Sai: "How long are you a developer?". Đúng: How long have you been…'}
        ]
      },
      {
        title: {en: 'Articles and small words', vi: 'Mạo từ và từ nhỏ'},
        tip: {en: 'Singular countable nouns need a, an or the: a bug, the API, an issue.', vi: 'Danh từ đếm được số ít cần a/an/the: a bug, the API, an issue.'},
        phrases: [
          {en: 'I have a question about the ticket.', vi: 'Sai: "I have question". Đúng: a question.'},
          {en: 'She gave a presentation yesterday.', vi: 'Sai: "gave presentation". Đúng: gave a presentation.'},
          {en: 'It\'s an important issue.', vi: 'Dùng "an" trước âm nguyên âm (theo cách đọc, không theo chữ cái): an issue, an API (đọc "ay-pee-eye"), an hour; nhưng "a user" (đọc "you").'},
          {en: 'The server is down again.', vi: 'Dùng "the" khi cả hai bên biết đang nói cái nào.'},
          {en: 'The meeting is on Monday at three.', vi: 'Giới từ thời gian: on + thứ/ngày, at + giờ, in + tháng/năm.'},
          {en: 'I\'m interested in backend development.', vi: 'Sai: "I\'m interesting in". "interested" = tôi thấy hứng thú; "interesting" = cái gì đó thú vị.'}
        ]
      },
      {
        title: {en: 'Word choice', vi: 'Chọn từ'},
        phrases: [
          {en: 'Can you remind me to check the logs?', vi: 'Sai: "Can you remember me". remember = tự nhớ, remind = nhắc người khác.'},
          {en: 'Can I borrow your charger? I lent mine to Nam.', vi: 'borrow = mượn (từ ai), lend = cho mượn.'},
          {en: 'I\'ll make a decision after I do some research.', vi: 'Kết hợp từ: make a decision, do research, take a break, make a mistake.'},
          {en: 'The meeting was postponed to Friday.', vi: 'postpone = hoãn sang thời gian khác; cancel = hủy hẳn.'},
          {en: 'What does this error mean?', vi: 'Sai: "What is this error mean?". Đúng: What does … mean?'},
          {en: 'How do you say this in English?', vi: 'Sai: "How to say this in English?" (chưa là câu hỏi đầy đủ). Đúng: How do you say…'},
          {en: 'I agree with you.', vi: 'Sai: "I am agree". agree là động từ: I agree.'}
        ]
      },
      {
        title: {en: 'Extra words and wrong word order', vi: 'Thừa từ và sai trật tự từ'},
        phrases: [
          {en: 'I really like this approach.', vi: 'Sai: "I very like". very không đứng trước động từ; dùng really like / like … very much.'},
          {en: 'I\'ll return the laptop on Friday.', vi: 'Sai: "return back". return đã có nghĩa "trả lại".'},
          {en: 'Could you repeat that, please?', vi: 'Sai: "repeat again". repeat đã có nghĩa "nhắc lại".'},
          {en: 'Let\'s revert the change.', vi: 'Thường nói "revert the change", không cần "revert back".'},
          {en: 'I usually start work at nine.', vi: 'Trạng từ tần suất đứng trước động từ thường: sai "I start usually".'},
          {en: 'I\'m always on time for meetings.', vi: 'Nhưng với "to be", trạng từ đứng sau: "I\'m always on time" (câu thường không nói "I always am on time").'},
          {en: 'We need to finish the report by Friday.', vi: 'Sai: "We need finish". need + to + động từ.'},
          {en: 'I look forward to hearing from you.', vi: 'Sai: "look forward to hear". Sau "look forward to" dùng V-ing.'}
        ]
      },
      {
        title: {en: 'Words that are easy to confuse in writing', vi: 'Cặp từ dễ nhầm khi viết'},
        phrases: [
          {en: 'The change will affect all users. The effect was immediate.', vi: 'affect = động từ (ảnh hưởng); effect = danh từ (tác động).'},
          {en: 'Don\'t lose your access card. The cable is loose.', vi: 'lose = đánh mất; loose = lỏng.'},
          {en: 'It\'s faster than before. Then we deployed it.', vi: 'than = so sánh; then = sau đó.'},
          {en: 'We had fewer bugs and less downtime.', vi: 'fewer + danh từ đếm được (bugs); less + không đếm được (downtime).'},
          {en: 'It\'s a good library, but its documentation is weak.', vi: 'it\'s = it is; its = của nó.'},
          {en: 'Can you advise me? Thanks for the advice.', vi: 'advise = động từ (khuyên); advice = danh từ (lời khuyên).'},
          {en: 'Please ensure the backup is ready.', vi: 'ensure = đảm bảo; insure = mua bảo hiểm.'},
          {en: 'They\'re in their office over there.', vi: 'they\'re = they are; their = của họ; there = ở đó.'}
        ]
      },
      {
        title: {en: 'Prepositions of time and place', vi: 'Giới từ chỉ thời gian và nơi chốn'},
        phrases: [
          {en: 'The release is on Friday, at five p.m., in November.', vi: 'on + thứ/ngày; at + giờ; in + tháng/năm.'},
          {en: 'Please send it by Friday.', vi: 'by = trước hoặc muộn nhất vào (hạn chót).'},
          {en: 'I\'ll be on leave until Monday.', vi: 'until = cho tới (kéo dài đến lúc đó).'},
          {en: 'I was offline during the meeting, for about ten minutes.', vi: 'during + sự kiện; for + khoảng thời gian.'},
          {en: 'She\'s at the office, in the meeting room on the third floor.', vi: 'at the office; in the room; on the floor (tầng).'},
          {en: 'I\'ll reply in an hour.', vi: 'in an hour = một tiếng nữa kể từ bây giờ; "after an hour" dùng khi kể chuyện đã xảy ra.'}
        ]
      }
    ],
    templates: []
  },
  {
    id: 'qa',
    groups: [
      {
        title: {en: 'Reporting a bug', vi: 'Báo cáo bug'},
        tip: {en: 'A good bug report has steps to reproduce, expected result, actual result and environment.', vi: 'Bug report tốt có các bước tái hiện, kết quả mong đợi, kết quả thực tế và môi trường.'},
        phrases: [
          {en: 'I found a bug on the checkout page.', vi: 'Mình phát hiện một bug ở trang thanh toán.'},
          {en: 'Steps to reproduce: log in, add two items, then apply the voucher.', vi: 'Các bước tái hiện: đăng nhập, thêm hai sản phẩm, rồi áp dụng voucher.'},
          {en: 'Expected result: the total is reduced by ten percent.', vi: 'Kết quả mong đợi: tổng tiền giảm 10%.'},
          {en: 'Actual result: the page shows an error and the total doesn\'t change.', vi: 'Kết quả thực tế: trang báo lỗi và tổng tiền không đổi.'},
          {en: 'It only happens on Safari, not on Chrome.', vi: 'Lỗi chỉ xảy ra trên Safari, không có trên Chrome.'},
          {en: 'It happens intermittently, about one in five times.', vi: 'Lỗi xảy ra không thường xuyên, khoảng một trên năm lần.'},
          {en: 'I\'ve attached a screenshot and the request ID.', vi: 'Mình đã đính kèm ảnh chụp màn hình và request ID.'}
        ]
      },
      {
        title: {en: 'Severity, priority and triage', vi: 'Mức độ nghiêm trọng, ưu tiên và phân loại'},
        phrases: [
          {en: 'It\'s high severity, because users can\'t pay.', vi: 'Mức độ nghiêm trọng cao vì người dùng không thanh toán được.'},
          {en: 'It\'s a cosmetic issue, so it\'s low priority.', vi: 'Đây là lỗi giao diện nhỏ nên ưu tiên thấp.'},
          {en: 'Is this a regression? It worked in the last release.', vi: 'Đây có phải lỗi hồi quy không? Bản trước vẫn chạy được.'},
          {en: 'Is there a workaround for now?', vi: 'Hiện tại có cách tạm thời nào không?'},
          {en: 'This is a duplicate of ticket two four five.', vi: 'Ticket này trùng với ticket 245.'},
          {en: 'I can\'t reproduce it. Could you share the test account you used?', vi: 'Mình không tái hiện được. Bạn chia sẻ tài khoản test đã dùng được không?'}
        ]
      },
      {
        title: {en: 'Responding as a developer', vi: 'Phản hồi với vai trò developer'},
        phrases: [
          {en: 'Thanks for reporting it. I\'m looking into it now.', vi: 'Cảm ơn đã báo. Mình đang xem ngay.'},
          {en: 'It\'s actually working as designed. Let me show you the requirement.', vi: 'Thật ra nó đang chạy đúng thiết kế. Để mình cho bạn xem yêu cầu.'},
          {en: 'The fix is on staging. Could you retest it?', vi: 'Bản sửa đã có trên staging. Bạn test lại giúp nhé?'},
          {en: 'I\'ve added a unit test so it doesn\'t happen again.', vi: 'Mình đã thêm unit test để lỗi không lặp lại.'},
          {en: 'It\'s caused by the third-party service, so I\'ve raised it with them.', vi: 'Nguyên nhân do dịch vụ bên thứ ba nên mình đã báo bên đó.'},
          {en: 'Please reopen the ticket if you still see it.', vi: 'Nếu vẫn thấy lỗi, bạn mở lại ticket nhé.'}
        ]
      },
      {
        title: {en: 'Test environments and data', vi: 'Môi trường test và dữ liệu'},
        phrases: [
          {en: 'Staging is down, so I can\'t verify the fix right now.', vi: 'Staging đang lỗi nên giờ mình chưa kiểm tra được bản sửa.'},
          {en: 'The test data was reset last night, so my test account is gone.', vi: 'Dữ liệu test bị reset tối qua nên tài khoản test của mình mất rồi.'},
          {en: 'Which build is deployed on QA right now?', vi: 'Môi trường QA hiện đang chạy bản build nào?'},
          {en: 'Can we freeze the QA environment until the regression testing is done?', vi: 'Mình giữ nguyên môi trường QA tới khi test hồi quy xong được không?'},
          {en: 'This only happens with real bank data. Can we get an anonymized copy?', vi: 'Lỗi chỉ xảy ra với dữ liệu ngân hàng thật. Có thể lấy bản đã ẩn danh không?'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Bug report', vi: 'Mẫu bug report'},
        body: `Title: [Short summary of the problem]
Environment: [staging or production], [browser or device], [version]
Steps to reproduce:
1. [step]
2. [step]
Expected result: [what should happen]
Actual result: [what happens]
Frequency: [always or sometimes]
Attachments: [screenshot, logs, request ID]`
      }
    ]
  },
  {
    id: 'diplomatic',
    groups: [
      {
        title: {en: 'Softening what you say', vi: 'Làm mềm câu nói'},
        tip: {en: 'Add a softener: "a bit", "slightly", "might", "I\'m afraid", "it seems". Direct translations from Vietnamese can sound rude.', vi: 'Thêm từ làm mềm: "a bit", "slightly", "might", "I\'m afraid", "it seems". Dịch thẳng từ tiếng Việt dễ nghe thô.'},
        phrases: [
          {en: 'This approach might be a bit risky.', vi: 'Thay cho "This approach is wrong".'},
          {en: 'It seems there\'s a small issue with the numbers.', vi: 'Thay cho "Your numbers are wrong".'},
          {en: 'I\'m afraid we won\'t be able to finish it this week.', vi: 'Thay cho "We can\'t finish it".'},
          {en: 'It would be great if you could review it today.', vi: 'Thay cho "Review it today".'},
          {en: 'I was wondering if we could move the meeting to the afternoon.', vi: 'Cách đề nghị rất lịch sự: "I was wondering if…".'},
          {en: 'Would it be possible to get the data by Thursday?', vi: 'Thay cho "Give me the data by Thursday".'},
          {en: 'I\'m not sure that\'s the best option for us.', vi: 'Thay cho "That\'s a bad idea".'},
          {en: 'That\'s not quite what we agreed on.', vi: 'Thay cho "That\'s not what we agreed".'}
        ]
      },
      {
        title: {en: 'Delivering bad news', vi: 'Báo tin xấu'},
        tip: {en: 'Say it early and plainly, give the reason, then offer options. Don\'t hide bad news in a long message.', vi: 'Báo sớm và rõ ràng, nêu lý do, rồi đưa ra phương án. Đừng giấu tin xấu trong tin nhắn dài.'},
        phrases: [
          {en: 'Unfortunately, we found a problem during testing.', vi: 'Rất tiếc, nhóm phát hiện một vấn đề khi kiểm thử.'},
          {en: 'I have some bad news about the release date.', vi: 'Mình có tin không vui về ngày phát hành.'},
          {en: 'We\'re behind schedule by about three days.', vi: 'Nhóm đang chậm tiến độ khoảng ba ngày.'},
          {en: 'The main reason is that the integration took longer than we expected.', vi: 'Lý do chính là phần tích hợp mất thời gian hơn dự kiến.'},
          {en: 'Here are two options: we delay by three days, or we release without the export feature.', vi: 'Có hai phương án: lùi ba ngày, hoặc phát hành không có tính năng xuất file.'},
          {en: 'I take responsibility for the delay, and here\'s how we\'ll avoid it next time.', vi: 'Mình chịu trách nhiệm về việc chậm trễ, và đây là cách để lần sau không lặp lại.'}
        ]
      },
      {
        title: {en: 'Saying "I don\'t know" professionally', vi: 'Nói "tôi không biết" một cách chuyên nghiệp'},
        phrases: [
          {en: 'That\'s a good question. I don\'t know off the top of my head.', vi: 'Câu hỏi hay. Mình chưa trả lời ngay được.'},
          {en: 'I\'d rather not guess. Let me check and get back to you this afternoon.', vi: 'Mình không muốn đoán. Để mình kiểm tra và phản hồi chiều nay.'},
          {en: 'I haven\'t worked with that part of the system yet, but Hoa has.', vi: 'Mình chưa làm phần đó của hệ thống, nhưng Hoa đã làm.'},
          {en: 'I\'m not familiar with that tool, but I\'m happy to look into it.', vi: 'Mình chưa quen công cụ đó, nhưng sẵn sàng tìm hiểu.'}
        ]
      },
      {
        title: {en: 'Disagreeing with someone senior', vi: 'Phản biện người cấp trên'},
        tip: {en: 'Agree with the goal first, then raise the concern with data, then ask a question.', vi: 'Đồng ý với mục tiêu trước, nêu lo ngại kèm dữ liệu, rồi đặt câu hỏi.'},
        phrases: [
          {en: 'I agree with the goal, but I have a concern about the approach.', vi: 'Mình đồng ý với mục tiêu, nhưng có lo ngại về cách làm.'},
          {en: 'Can I offer a different perspective?', vi: 'Mình xin đưa ra một góc nhìn khác được không?'},
          {en: 'Based on last month\'s data, the bottleneck is the database, not the API.', vi: 'Dựa trên số liệu tháng trước, điểm nghẽn là database chứ không phải API.'},
          {en: 'What if we tried it on one service first and measured the result?', vi: 'Nếu mình thử trên một service trước và đo kết quả thì sao?'},
          {en: 'I understand the decision, and I\'ll support it. I just wanted to share the risk.', vi: 'Mình hiểu quyết định và sẽ ủng hộ. Mình chỉ muốn nêu rủi ro.'}
        ]
      },
      {
        title: {en: 'Handling tension and conflict', vi: 'Xử lý căng thẳng và mâu thuẫn'},
        phrases: [
          {en: 'I think we both want the same thing: a stable release.', vi: 'Mình nghĩ cả hai đều muốn cùng một điều: bản phát hành ổn định.'},
          {en: 'Let\'s focus on the problem, not on who caused it.', vi: 'Tập trung vào vấn đề, không phải ai gây ra.'},
          {en: 'I may have misunderstood. Can you tell me more about your concern?', vi: 'Có thể mình hiểu nhầm. Bạn nói thêm về lo ngại của bạn được không?'},
          {en: 'Maybe we should take a short break and come back to this.', vi: 'Có lẽ mình nghỉ một chút rồi quay lại vấn đề này.'},
          {en: 'Should we ask the tech lead to help us decide?', vi: 'Mình có nên nhờ tech lead giúp quyết định không?'}
        ]
      },
      {
        title: {en: 'Expressing feelings professionally', vi: 'Bày tỏ cảm xúc một cách chuyên nghiệp'},
        tip: {en: 'Name the feeling, link it to a fact, and suggest a next step. Avoid "I\'m angry".', vi: 'Gọi tên cảm xúc, gắn với một sự việc, và đề xuất bước tiếp theo. Tránh nói "I\'m angry".'},
        phrases: [
          {en: 'I\'m a bit concerned that the testing time is too short.', vi: 'Mình hơi lo là thời gian test quá ngắn.'},
          {en: 'I have to admit I\'m frustrated that the requirements changed again.', vi: 'Thật lòng mình hơi bực vì yêu cầu lại thay đổi.'},
          {en: 'To be honest, I\'m a little confused about who owns this.', vi: 'Thật ra mình hơi rối, không rõ ai phụ trách việc này.'},
          {en: 'I\'m really excited about this project.', vi: 'Mình rất hào hứng với dự án này.'},
          {en: 'I was disappointed with how the release went, but I think we learned a lot.', vi: 'Mình hơi thất vọng với bản release, nhưng mình nghĩ cả nhóm học được nhiều.'},
          {en: 'I\'m worried we\'re taking on too much. Can we discuss the priorities?', vi: 'Mình lo là nhóm đang nhận quá nhiều việc. Mình bàn lại thứ tự ưu tiên được không?'},
          {en: 'I really appreciate you staying late to help with the fix.', vi: 'Mình thật sự cảm kích vì bạn ở lại muộn để giúp sửa lỗi.'}
        ]
      },
      {
        title: {en: 'Accepting praise and sharing credit', vi: 'Nhận lời khen và chia công cho nhóm'},
        tip: {en: 'Say thank you first. Don\'t reject the compliment, but mention the people who helped.', vi: 'Nói cảm ơn trước. Đừng gạt lời khen đi, nhưng hãy nhắc tới những người đã giúp.'},
        phrases: [
          {en: 'Thank you, I really appreciate that.', vi: 'Cảm ơn, mình thật sự trân trọng điều đó.'},
          {en: 'Thanks! It was a team effort. Lan did most of the testing.', vi: 'Cảm ơn! Đó là công sức của cả nhóm. Lan làm phần lớn việc test.'},
          {en: 'I\'m glad it helped the finance team.', vi: 'Mình vui vì nó giúp được nhóm tài chính.'},
          {en: 'I couldn\'t have done it without Minh\'s review.', vi: 'Nếu không có Minh review thì mình không làm được.'},
          {en: 'Thanks for noticing. I learned a lot from it.', vi: 'Cảm ơn bạn đã để ý. Mình học được rất nhiều từ việc này.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Bad news message', vi: 'Tin nhắn báo tin xấu'},
        body: `Hi [name], I want to flag an issue early.
[What happened], so [impact, for example the release will slip by X days].
The main reason is [reason].
Options: (1) [option A], (2) [option B]. I'd recommend [option] because [reason].
Can we decide by [time]?`
      }
    ]
  },
  {
    id: 'systemtalk',
    groups: [
      {
        title: {en: 'Describing a request flow', vi: 'Mô tả luồng request'},
        tip: {en: 'Use sequence words: first, then, after that, once, finally. Name each component by its role.', vi: 'Dùng từ chỉ trình tự: first, then, after that, once, finally. Gọi mỗi thành phần theo vai trò.'},
        phrases: [
          {en: 'First, the request hits the load balancer.', vi: 'Đầu tiên, request đi tới load balancer. (hit = đến, chạm tới)'},
          {en: 'Then it\'s routed to one of the API instances.', vi: 'Sau đó nó được định tuyến tới một trong các instance API.'},
          {en: 'The API validates the token and checks the user\'s permissions.', vi: 'API kiểm tra token và quyền của người dùng.'},
          {en: 'Once the order is saved, an event is published to the queue.', vi: 'Khi đơn hàng được lưu, một event được publish vào hàng đợi.'},
          {en: 'A worker picks up the event and sends the email asynchronously.', vi: 'Một worker nhận event và gửi email bất đồng bộ.'},
          {en: 'Finally, the client gets a 201 response with the order ID.', vi: 'Cuối cùng, client nhận phản hồi 201 kèm mã đơn hàng.'}
        ]
      },
      {
        title: {en: 'Dependencies and data flow', vi: 'Phụ thuộc và luồng dữ liệu'},
        phrases: [
          {en: 'The payment service is upstream of the notification service.', vi: 'Payment service nằm phía upstream (đầu nguồn) của notification service.'},
          {en: 'If a downstream service is slow, our API becomes slow too.', vi: 'Nếu service phía downstream chậm, API của mình cũng chậm theo.'},
          {en: 'This service is the single source of truth for customer data.', vi: 'Service này là nguồn dữ liệu gốc duy nhất cho dữ liệu khách hàng.'},
          {en: 'The two services are tightly coupled, so we can\'t deploy them separately.', vi: 'Hai service phụ thuộc chặt nên không deploy riêng được. (tightly / loosely coupled)'},
          {en: 'We sync the data every hour with a batch job.', vi: 'Dữ liệu được đồng bộ mỗi giờ bằng batch job.'},
          {en: 'The data flows from the mobile app, through the gateway, into the database.', vi: 'Dữ liệu đi từ app mobile, qua gateway, vào database.'}
        ]
      },
      {
        title: {en: 'Performance and scale', vi: 'Hiệu năng và quy mô'},
        phrases: [
          {en: 'Latency is how long one request takes; throughput is how many requests we handle per second.', vi: 'Latency = độ trễ một request; throughput = số request xử lý mỗi giây.'},
          {en: 'The bottleneck is the database connection pool.', vi: 'Điểm nghẽn là connection pool của database.'},
          {en: 'We can scale out by adding more instances.', vi: 'Có thể scale out (mở rộng ngang) bằng cách thêm instance.'},
          {en: 'Scaling up means moving to a bigger machine.', vi: 'Scale up (mở rộng dọc) là chuyển lên máy mạnh hơn.'},
          {en: 'The service is stateless, so any instance can handle any request.', vi: 'Service không lưu trạng thái nên instance nào cũng xử lý được request nào.'},
          {en: 'Traffic peaks at lunchtime and on payday.', vi: 'Lưu lượng đạt đỉnh vào giờ trưa và ngày nhận lương.'},
          {en: 'Under load, the service degrades gracefully.', vi: 'Khi tải cao, hiệu năng của service xấu đi dần một cách có kiểm soát, không sập đột ngột. (degrade gracefully)'}
        ]
      },
      {
        title: {en: 'Failures and reliability', vi: 'Lỗi và độ tin cậy'},
        phrases: [
          {en: 'The database is a single point of failure.', vi: 'Database đang là điểm lỗi duy nhất (single point of failure).'},
          {en: 'If the cache goes down, we fall back to the database.', vi: 'Nếu cache sập, hệ thống chuyển sang đọc database.'},
          {en: 'The job retries three times with exponential backoff.', vi: 'Job thử lại ba lần với thời gian chờ tăng dần.'},
          {en: 'Failed messages end up in a dead-letter queue.', vi: 'Message lỗi được đưa vào dead-letter queue.'},
          {en: 'We have a replica in another availability zone for failover.', vi: 'Có bản sao ở availability zone khác để chuyển đổi dự phòng.'},
          {en: 'Our target is ninety-nine point nine percent availability.', vi: 'Mục tiêu là độ sẵn sàng 99,9%.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Walking through an architecture diagram', vi: 'Trình bày sơ đồ kiến trúc'},
        body: `At a high level, the system has [number] main parts: [part A], [part B] and [part C].
A typical request starts at [entry point]. Then [step]. Once [event], [next step].
The source of truth for [data] is [service or database].
The main bottleneck today is [component], and we plan to [improvement].
If [component] fails, we [fallback].`
      }
    ]
  },
  {
    id: 'listening',
    groups: [
      {
        title: {en: 'Reduced forms in fast speech', vi: 'Dạng rút gọn khi nói nhanh'},
        tip: {en: 'You don\'t have to say these, but you must recognize them when you hear them.', vi: 'Bạn không bắt buộc phải nói như vậy, nhưng phải nhận ra khi nghe.'},
        phrases: [
          {en: 'I\'m gonna check the logs.', vi: 'gonna = going to.'},
          {en: 'Do you wanna grab a coffee?', vi: 'wanna = want to.'},
          {en: 'I gotta leave at five today.', vi: 'gotta = have got to / have to.'},
          {en: 'It\'s kinda slow on staging.', vi: 'kinda = kind of = hơi, có phần.'},
          {en: 'Lemme take a look.', vi: 'lemme = let me.'},
          {en: 'Whaddaya think?', vi: 'whaddaya = what do you.'},
          {en: 'Dunno, maybe it\'s the cache.', vi: 'dunno = I don\'t know.'},
          {en: 'I shoulda tested it first.', vi: 'shoulda = should have; coulda = could have; woulda = would have.'}
        ]
      },
      {
        title: {en: 'Filler words and what they mean', vi: 'Từ đệm và ý nghĩa'},
        phrases: [
          {en: 'So, basically, the job runs every night.', vi: 'basically = nói tóm lại, về cơ bản — thường chỉ để mở đầu.'},
          {en: 'It\'s, like, really hard to reproduce.', vi: '"like" ở giữa câu = từ đệm, không có nghĩa "giống như".'},
          {en: 'I mean, it works, but it\'s not pretty.', vi: 'I mean = ý mình là (sửa hoặc làm rõ lại).'},
          {en: 'You know, the old reporting service.', vi: 'you know = bạn biết đấy (kiểm tra người nghe theo kịp).'},
          {en: 'To be fair, the requirement changed twice.', vi: 'to be fair = công bằng mà nói.'},
          {en: 'Anyway, let\'s move on.', vi: 'anyway = thôi, dù sao thì (chuyển chủ đề).'},
          {en: 'Actually, I think it\'s a network issue.', vi: 'actually = thật ra (thường để sửa lại hoặc phản biện nhẹ).'}
        ]
      },
      {
        title: {en: 'Casual replies you will hear', vi: 'Câu đáp thân mật hay gặp'},
        phrases: [
          {en: 'Sounds good.', vi: '= Được, nghe ổn đấy (đồng ý).'},
          {en: 'Fair enough.', vi: '= Cũng hợp lý (chấp nhận lý do của bạn).'},
          {en: 'No worries.', vi: '= Không sao đâu.'},
          {en: 'Cheers!', vi: '= Cảm ơn (Anh, Úc) hoặc chúc mừng khi nâng ly.'},
          {en: 'I\'m on it.', vi: '= Mình đang làm ngay.'},
          {en: 'My bad.', vi: '= Lỗi của mình (thân mật).'},
          {en: 'Ping me if you need anything.', vi: '= Cần gì cứ nhắn mình.'},
          {en: 'Let\'s play it by ear.', vi: '= Tùy tình hình rồi tính.'},
          {en: 'I\'ll keep you posted.', vi: '= Mình sẽ cập nhật cho bạn.'},
          {en: 'Not a big deal.', vi: '= Không có gì nghiêm trọng.'}
        ]
      },
      {
        title: {en: 'British vs American English at work', vi: 'Anh-Anh và Anh-Mỹ ở công sở'},
        phrases: [
          {en: 'Let\'s schedule it for next week.', vi: 'schedule: Mỹ "SKED-jool", Anh thường "SHED-jool".'},
          {en: 'Could you send me your CV? Or your résumé?', vi: 'CV (Anh) = résumé (Mỹ).'},
          {en: 'I\'m on holiday next week. I\'m on vacation next week.', vi: 'holiday (Anh) = vacation (Mỹ) = kỳ nghỉ.'},
          {en: 'The meeting room is on the first floor.', vi: 'first floor: Anh = tầng 2 (tầng trệt là ground floor); Mỹ = tầng trệt.'},
          {en: 'Please organise the files. Please organize the files.', vi: 'Chính tả: -ise (Anh), -ize (Mỹ); colour/color; centre/center.'},
          {en: 'Let\'s meet on the fourth of July. Let\'s meet on July fourth.', vi: 'Ngày: Anh 04/07 = 4 tháng 7; Mỹ 07/04 = 4 tháng 7. Dễ nhầm khi đọc ngày dạng số!'}
        ]
      },
      {
        title: {en: 'Asking for repetition without stress', vi: 'Xin nhắc lại mà không ngại'},
        phrases: [
          {en: 'Sorry, I didn\'t quite catch that.', vi: 'Xin lỗi, mình chưa nghe kịp.'},
          {en: 'Could you say that again a bit more slowly?', vi: 'Bạn nói lại chậm hơn một chút được không?'},
          {en: 'Sorry, what does "ballpark" mean here?', vi: 'Xin lỗi, "ballpark" ở đây nghĩa là gì?'},
          {en: 'Could you type that in the chat, please?', vi: 'Bạn gõ vào khung chat giúp mình nhé?'},
          {en: 'Did you say fifteen or fifty?', vi: 'Bạn nói 15 hay 50? (fifTEEN nhấn cuối, FIFty nhấn đầu).'}
        ]
      },
      {
        title: {en: 'International English you will hear', vi: 'Tiếng Anh quốc tế bạn sẽ gặp'},
        tip: {en: 'In global teams, many colleagues aren\'t native speakers. Learn to recognize regional expressions, but use neutral English yourself.', vi: 'Trong nhóm toàn cầu, nhiều đồng nghiệp không phải người bản xứ. Hãy nhận ra các cách nói vùng miền, nhưng bản thân nên dùng tiếng Anh trung tính.'},
        phrases: [
          {en: 'Please revert by end of day.', vi: 'Cách nói hay gặp ở Ấn Độ: "revert" = trả lời, phản hồi (không phải hoàn tác).'},
          {en: 'Kindly do the needful.', vi: 'Ấn Độ: "do the needful" = làm những việc cần thiết.'},
          {en: 'Can we prepone the meeting to ten?', vi: 'Ấn Độ: "prepone" = dời sớm hơn (ngược với postpone).'},
          {en: 'I have a doubt about the API.', vi: 'Ấn Độ: "doubt" = có câu hỏi (không hẳn là nghi ngờ).'},
          {en: 'Can or not?', vi: 'Singapore (Singlish): "Được không?"'},
          {en: 'No worries, mate. She\'ll be right.', vi: 'Úc: "Không sao đâu, rồi sẽ ổn thôi."'},
          {en: 'Cheers for that, it\'s brilliant.', vi: 'Anh: "Cảm ơn nhé, tuyệt lắm." (brilliant = rất tốt)'},
          {en: 'I\'m going to table this for now.', vi: 'Cẩn thận: ở Mỹ "table" = tạm gác lại; ở Anh "table" = đưa ra bàn ngay!'}
        ]
      },
      {
        title: {en: 'Numbers that sound alike', vi: 'Các số dễ nghe nhầm'},
        tip: {en: '-teen numbers stress the end (thirTEEN), -ty numbers stress the start (THIRty). When money or dates matter, confirm the digits.', vi: 'Số -teen nhấn cuối (thirTEEN), số -ty nhấn đầu (THIRty). Khi liên quan tiền hoặc ngày, hãy xác nhận lại từng chữ số.'},
        phrases: [
          {en: 'The meeting is at two thirteen. Two one three.', vi: '2:13 (thirteen) — không phải 2:30 (thirty).'},
          {en: 'Fifteen percent, one five, not fifty.', vi: '15% (fifteen) — không phải 50% (fifty).'},
          {en: 'We need about forty servers. Four zero.', vi: '40 (forty) — không phải 14 (fourteen).'},
          {en: 'Did you say eighteen or eighty?', vi: '18 (eighteen) hay 80 (eighty)?'},
          {en: 'So that\'s nineteen days, one nine, right?', vi: '19 ngày (nineteen) — xác nhận lại bằng từng chữ số.'},
          {en: 'The amount is three hundred thousand, not three million.', vi: '300.000 (three hundred thousand) — không phải 3.000.000 (three million).'}
        ]
      }
    ],
    templates: []
  },
  {
    id: 'release',
    groups: [
      {
        title: {en: 'Planning a release', vi: 'Lên kế hoạch release'},
        phrases: [
          {en: 'The release is scheduled for Thursday at eight p.m.', vi: 'Release được lên lịch lúc 8 giờ tối thứ Năm.'},
          {en: 'The code freeze starts on Tuesday.', vi: 'Code freeze (ngừng merge code mới) bắt đầu từ thứ Ba.'},
          {en: 'There\'s a change freeze during the holiday season.', vi: 'Có change freeze (cấm thay đổi production) trong mùa lễ.'},
          {en: 'Let\'s do a go/no-go check one hour before the deployment.', vi: 'Họp go/no-go một giờ trước khi deploy.'},
          {en: 'All tests are green, and QA has signed off.', vi: 'Tất cả test đã pass, QA đã duyệt (sign off).'},
          {en: 'The database migration is backward compatible, so we can roll back safely.', vi: 'Migration tương thích ngược nên có thể rollback an toàn.'},
          {en: 'Who is on call after the release?', vi: 'Ai trực on-call sau khi release?'}
        ]
      },
      {
        title: {en: 'Deployment strategies', vi: 'Chiến lược triển khai'},
        phrases: [
          {en: 'We\'ll do a rolling deployment, one instance at a time.', vi: 'Triển khai cuốn chiếu (rolling), từng instance một.'},
          {en: 'We\'ll start with a canary release to five percent of traffic.', vi: 'Bắt đầu bằng canary release cho 5% lưu lượng.'},
          {en: 'The feature is behind a feature flag, so we can turn it off without a deployment.', vi: 'Tính năng nằm sau feature flag nên có thể tắt mà không cần deploy.'},
          {en: 'With blue-green deployment, we switch traffic only when the new version is healthy.', vi: 'Với blue-green, chỉ chuyển lưu lượng khi bản mới chạy ổn.'},
          {en: 'The pipeline builds the image, runs the tests and deploys to staging automatically.', vi: 'Pipeline tự build image, chạy test và deploy lên staging.'},
          {en: 'Production deployment needs a manual approval.', vi: 'Deploy production cần phê duyệt thủ công.'}
        ]
      },
      {
        title: {en: 'During and after the deployment', vi: 'Trong và sau khi triển khai'},
        phrases: [
          {en: 'The deployment is in progress. About ten more minutes.', vi: 'Đang deploy. Khoảng 10 phút nữa.'},
          {en: 'The new version is live. I\'m monitoring the error rate.', vi: 'Bản mới đã chạy. Mình đang theo dõi tỉ lệ lỗi.'},
          {en: 'Smoke tests passed on production.', vi: 'Smoke test trên production đã pass.'},
          {en: 'We saw a spike in errors, so we rolled back.', vi: 'Thấy lỗi tăng đột biến nên đã rollback.'},
          {en: 'We need a hotfix for the login issue.', vi: 'Cần một bản hotfix cho lỗi đăng nhập.'},
          {en: 'The release notes are published on the wiki.', vi: 'Release notes đã được đăng trên wiki.'}
        ]
      },
      {
        title: {en: 'The hotfix process', vi: 'Quy trình hotfix'},
        phrases: [
          {en: 'This bug is critical, so we\'ll do a hotfix instead of waiting for the next release.', vi: 'Bug này nghiêm trọng nên làm hotfix, không chờ bản release sau.'},
          {en: 'I\'ve created a hotfix branch from the release tag.', vi: 'Mình đã tạo nhánh hotfix từ tag của bản release.'},
          {en: 'The fix is small and has a test. Can I get a quick review?', vi: 'Bản sửa nhỏ và có test. Mình xin review nhanh được không?'},
          {en: 'After the hotfix is deployed, we\'ll merge it back into main.', vi: 'Sau khi deploy hotfix, mình sẽ merge ngược lại vào main.'},
          {en: 'Let\'s note in the release log why we skipped the normal process.', vi: 'Ghi vào nhật ký release lý do bỏ qua quy trình thông thường.'}
        ]
      },
      {
        title: {en: 'Planned maintenance notices', vi: 'Thông báo bảo trì định kỳ'},
        phrases: [
          {en: 'We\'ll be performing scheduled maintenance on Sunday from one to three a.m.', vi: 'Hệ thống sẽ bảo trì định kỳ vào Chủ nhật từ 1 đến 3 giờ sáng.'},
          {en: 'During this time, the app may be unavailable for a few minutes.', vi: 'Trong thời gian này, ứng dụng có thể không truy cập được vài phút.'},
          {en: 'Card payments will not be affected.', vi: 'Thanh toán bằng thẻ không bị ảnh hưởng.'},
          {en: 'We chose this time because it has the lowest traffic.', vi: 'Chọn khung giờ này vì lưu lượng thấp nhất.'},
          {en: 'The maintenance has been completed, and all services are back online.', vi: 'Việc bảo trì đã hoàn tất, mọi dịch vụ đã hoạt động trở lại.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Release announcement', vi: 'Thông báo release'},
        body: `Release [version] is live on production as of [time].
What's new: [feature 1]; [feature 2].
Fixes: [bug fixes].
Known issues: [none or issue and workaround].
Rollback plan: [how]. On call: [name].
Please report any issues in [channel].`
      },
      {
        title: {en: 'Go/no-go checklist', vi: 'Checklist go/no-go'},
        body: `Tests: [all green or failures].
QA sign-off: [yes or no].
Migration: [backward compatible or needs downtime].
Rollback plan: [tested or not tested].
Monitoring and alerts: [ready].
Decision: [Go or No-go], because [reason].`
      }
    ]
  },
  {
    id: 'remote',
    groups: [
      {
        title: {en: 'Availability and working hours', vi: 'Thời gian làm việc và sẵn sàng'},
        phrases: [
          {en: 'I\'m usually online from nine to six, Vietnam time.', vi: 'Mình thường online từ 9 đến 6 giờ theo giờ Việt Nam.'},
          {en: 'Our overlap with the London team is only two hours.', vi: 'Thời gian trùng giờ làm với nhóm London chỉ có hai tiếng.'},
          {en: 'I\'ll be away from my desk for about an hour.', vi: 'Mình sẽ rời bàn khoảng một tiếng.'},
          {en: 'I\'ve set my status to "focus time" until three.', vi: 'Mình đặt trạng thái "tập trung" đến 3 giờ.'},
          {en: 'I\'m working from the office on Tuesdays and Thursdays.', vi: 'Thứ Ba và thứ Năm mình làm ở văn phòng.'},
          {en: 'It\'s late here, so I\'ll pick this up first thing tomorrow.', vi: 'Ở đây đã muộn, sáng mai mình sẽ xử lý việc này đầu tiên.'}
        ]
      },
      {
        title: {en: 'Video call etiquette', vi: 'Phép lịch sự khi họp video'},
        phrases: [
          {en: 'Let\'s wait one more minute for the others to join.', vi: 'Đợi thêm một phút cho mọi người vào.'},
          {en: 'Sorry, there\'s some background noise. I\'ll mute when I\'m not talking.', vi: 'Xin lỗi, có tiếng ồn. Mình sẽ tắt mic khi không nói.'},
          {en: 'Can I jump in here?', vi: 'Mình xin nói chen một chút được không?'},
          {en: 'Sorry, go ahead. We talked at the same time.', vi: 'Xin lỗi, bạn nói trước đi. Mình nói trùng nhau.'},
          {en: 'Raise your hand in Teams if you\'d like to speak.', vi: 'Giơ tay trên Teams nếu muốn phát biểu.'},
          {en: 'Can everyone turn on their cameras for the introduction?', vi: 'Mọi người bật camera lúc giới thiệu được không?'},
          {en: 'I have a hard stop at four, so I\'ll have to drop off.', vi: 'Mình phải kết thúc đúng 4 giờ nên sẽ rời cuộc họp.'}
        ]
      },
      {
        title: {en: 'Working across time zones', vi: 'Làm việc lệch múi giờ'},
        tip: {en: 'Always write the time zone: "3 p.m. ICT (UTC+7)". Assume the other person will read your message hours later.', vi: 'Luôn ghi múi giờ: "3 p.m. ICT (UTC+7)". Giả định người kia sẽ đọc tin nhắn sau vài tiếng.'},
        phrases: [
          {en: 'Does nine a.m. your time work for you? That\'s three p.m. for me.', vi: '9 giờ sáng giờ bên bạn được không? Bên mình là 3 giờ chiều.'},
          {en: 'I\'ve left a detailed update, so you can continue when you start your day.', vi: 'Mình để lại cập nhật chi tiết để bạn tiếp tục khi bắt đầu ngày làm việc.'},
          {en: 'Let\'s record the session for people in other time zones.', vi: 'Ghi lại buổi họp cho người ở múi giờ khác.'},
          {en: 'Daylight saving time starts this weekend, so our meeting moves by an hour.', vi: 'Giờ mùa hè bắt đầu cuối tuần này nên cuộc họp lệch đi một tiếng.'},
          {en: 'I don\'t expect a reply outside your working hours.', vi: 'Mình không mong bạn trả lời ngoài giờ làm việc.'}
        ]
      },
      {
        title: {en: 'Holidays across countries', vi: 'Ngày nghỉ khi nhóm ở nhiều nước'},
        phrases: [
          {en: 'Next Monday is a public holiday in Vietnam, so our team will be offline.', vi: 'Thứ Hai tới là ngày nghỉ lễ ở Việt Nam nên nhóm sẽ offline.'},
          {en: 'I\'ve added our holidays to the shared team calendar.', vi: 'Mình đã thêm các ngày nghỉ của nhóm vào lịch chung.'},
          {en: 'Is anyone on call during the Christmas period?', vi: 'Có ai trực trong dịp Giáng sinh không?'},
          {en: 'Let\'s avoid releasing right before a long holiday.', vi: 'Tránh phát hành ngay trước kỳ nghỉ dài.'},
          {en: 'Happy holidays! See you all in the new year.', vi: 'Chúc mọi người kỳ nghỉ vui vẻ! Hẹn gặp năm mới.'}
        ]
      },
      {
        title: {en: 'Commenting on shared documents', vi: 'Góp ý trên tài liệu chung'},
        phrases: [
          {en: 'I\'ve left a few comments on the design doc.', vi: 'Mình đã để lại vài comment trên tài liệu thiết kế.'},
          {en: 'Suggestion: could we add a diagram of the payment flow here?', vi: 'Gợi ý: mình thêm sơ đồ luồng thanh toán ở đây được không?'},
          {en: 'I\'m not sure I understand this section. Could you clarify?', vi: 'Mình chưa hiểu phần này lắm. Bạn làm rõ giúp được không?'},
          {en: 'Resolved. I\'ve updated the text.', vi: 'Đã xử lý. Mình đã cập nhật nội dung.'},
          {en: 'Please add your comments by Friday, so we can finalize it next week.', vi: 'Mọi người góp ý trước thứ Sáu để tuần sau chốt nhé.'}
        ]
      },
      {
        title: {en: 'Working from a café or coworking space', vi: 'Làm việc ở quán cà phê hoặc coworking'},
        phrases: [
          {en: 'I\'m working from a café today, so there might be some background noise.', vi: 'Hôm nay mình làm ở quán cà phê nên có thể hơi ồn.'},
          {en: 'I\'ll use my headset and stay on mute when I\'m not speaking.', vi: 'Mình sẽ dùng tai nghe và tắt mic khi không nói.'},
          {en: 'I\'m on public Wi-Fi, so I\'ll connect through the VPN.', vi: 'Mình đang dùng Wi-Fi công cộng nên sẽ kết nối qua VPN.'},
          {en: 'I can\'t share my screen here because people can see it. Can we do it this afternoon?', vi: 'Ở đây không chia sẻ màn hình được vì người khác có thể nhìn thấy. Chiều nay làm được không?'},
          {en: 'I\'ve booked a phone booth at the coworking space for our call.', vi: 'Mình đã đặt phòng gọi riêng ở coworking cho cuộc gọi của mình.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Async handover', vi: 'Bàn giao bất đồng bộ'},
        body: `Handover from [your time zone] to [their time zone], [date]
Done today: [tasks + links].
In progress: [task] — next step is [step].
Blocked: [issue] — I need [decision or access] from [person].
Questions for you: [question].
I'll be back online at [time + time zone].`
      }
    ]
  },
  {
    id: 'aitools',
    groups: [
      {
        title: {en: 'How you use AI at work', vi: 'Bạn dùng AI trong công việc thế nào'},
        phrases: [
          {en: 'I use an AI assistant to draft unit tests, and then I review them.', vi: 'Mình dùng trợ lý AI viết nháp unit test, sau đó tự review.'},
          {en: 'It\'s great for boilerplate code and for explaining unfamiliar code.', vi: 'Nó rất tốt cho code lặp và giải thích code lạ.'},
          {en: 'I never paste customer data or secrets into a public AI tool.', vi: 'Mình không bao giờ dán dữ liệu khách hàng hay secret vào công cụ AI công khai.'},
          {en: 'We follow the company policy on which AI tools are approved.', vi: 'Nhóm tuân theo chính sách công ty về công cụ AI được phép dùng.'},
          {en: 'AI helps me move faster, but I\'m still responsible for the code I commit.', vi: 'AI giúp mình làm nhanh hơn, nhưng mình vẫn chịu trách nhiệm cho code mình commit.'}
        ]
      },
      {
        title: {en: 'Reviewing AI output', vi: 'Kiểm tra kết quả của AI'},
        tip: {en: 'Treat AI output like a pull request from a new teammate: helpful, but verify it.', vi: 'Xem kết quả AI như PR của một đồng nghiệp mới: hữu ích nhưng phải kiểm chứng.'},
        phrases: [
          {en: 'The suggestion looked right, but it used a method that doesn\'t exist.', vi: 'Gợi ý trông đúng nhưng dùng một method không tồn tại.'},
          {en: 'It hallucinated a configuration property, so I checked the official docs.', vi: 'Nó "bịa" ra một thuộc tính cấu hình nên mình đã kiểm tra tài liệu chính thức. (hallucinate)'},
          {en: 'I ran the tests to confirm the generated code actually works.', vi: 'Mình chạy test để xác nhận code được sinh ra thực sự chạy được.'},
          {en: 'The answer was outdated. It was based on an older version of Spring.', vi: 'Câu trả lời đã lỗi thời, dựa trên phiên bản Spring cũ.'},
          {en: 'Can you double-check this part? It was generated by AI.', vi: 'Bạn kiểm tra lại giúp phần này nhé? Phần này do AI sinh ra.'}
        ]
      },
      {
        title: {en: 'Writing a good prompt', vi: 'Viết prompt tốt'},
        phrases: [
          {en: 'I give it the context first: the framework version, the code and the error message.', vi: 'Mình đưa bối cảnh trước: phiên bản framework, đoạn code và thông báo lỗi.'},
          {en: 'I ask it to explain the trade-offs, not just give me an answer.', vi: 'Mình yêu cầu nó giải thích ưu nhược điểm, không chỉ đưa đáp án.'},
          {en: 'I break the task into small steps and check each result.', vi: 'Mình chia nhiệm vụ thành bước nhỏ và kiểm tra từng kết quả.'},
          {en: 'I tell it the constraints, like "no new dependencies" and "use BigDecimal".', vi: 'Mình nêu ràng buộc, ví dụ "không thêm thư viện mới" và "dùng BigDecimal".'}
        ]
      },
      {
        title: {en: 'AI features in products', vi: 'Tính năng AI trong sản phẩm'},
        phrases: [
          {en: 'The AI extracts transactions from the receipt, but the user confirms them before saving.', vi: 'AI trích xuất giao dịch từ hóa đơn, nhưng người dùng xác nhận trước khi lưu.'},
          {en: 'The model\'s output is treated as a draft, never as the final data.', vi: 'Kết quả của model được xem là bản nháp, không phải dữ liệu cuối cùng.'},
          {en: 'If the provider fails, we fail over to a second account.', vi: 'Nếu nhà cung cấp lỗi, hệ thống chuyển sang tài khoản thứ hai.'},
          {en: 'We validate the JSON response against a schema before using it.', vi: 'Kiểm tra JSON trả về theo schema trước khi sử dụng.'},
          {en: 'We track the cost per request and set a monthly budget.', vi: 'Theo dõi chi phí mỗi request và đặt ngân sách hàng tháng.'}
        ]
      },
      {
        title: {en: 'Discussing AI risks with clients', vi: 'Trao đổi rủi ro AI với khách hàng'},
        phrases: [
          {en: 'The model can make mistakes, so a person reviews every result before it\'s saved.', vi: 'Model có thể sai nên một người sẽ duyệt mọi kết quả trước khi lưu.'},
          {en: 'Customer data isn\'t used to train the provider\'s models.', vi: 'Dữ liệu khách hàng không được dùng để huấn luyện model của nhà cung cấp.'},
          {en: 'We log which model version produced each result, for auditing.', vi: 'Ghi lại phiên bản model tạo ra mỗi kết quả, để phục vụ kiểm toán.'},
          {en: 'We test the feature with real examples to measure its accuracy.', vi: 'Kiểm thử tính năng bằng ví dụ thật để đo độ chính xác.'},
          {en: 'If the AI service is unavailable, users can still enter the data manually.', vi: 'Nếu dịch vụ AI không hoạt động, người dùng vẫn nhập dữ liệu thủ công được.'}
        ]
      },
      {
        title: {en: 'Agreeing on team rules for AI coding', vi: 'Thống nhất quy tắc dùng AI khi code trong nhóm'},
        phrases: [
          {en: 'Let\'s agree on when it\'s okay to use AI-generated code.', vi: 'Mình thống nhất khi nào được phép dùng code do AI sinh ra.'},
          {en: 'AI-generated code goes through the same review as any other code.', vi: 'Code do AI sinh ra cũng phải qua review như mọi code khác.'},
          {en: 'Please mention in the PR if a large part was generated.', vi: 'Nếu phần lớn code được sinh ra, vui lòng ghi chú trong PR.'},
          {en: 'We don\'t share client code with tools that aren\'t approved by the client.', vi: 'Không chia sẻ code của khách hàng với công cụ chưa được khách hàng cho phép.'},
          {en: 'Let\'s review these rules again in three months.', vi: 'Ba tháng nữa mình xem lại các quy tắc này.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Explaining how you use AI responsibly', vi: 'Giải thích cách bạn dùng AI có trách nhiệm'},
        body: `I use [tool] mainly for [drafting tests or explaining code or boilerplate].
I always review and run what it generates, because it can be wrong or outdated.
I never paste [customer data or secrets or internal code] into tools that aren't approved.
It saves me about [time] a day, and I'm still responsible for every line I commit.`
      }
    ]
  },
  {
    id: 'offer',
    groups: [
      {
        title: {en: 'Responding to an offer', vi: 'Phản hồi khi nhận offer'},
        tip: {en: 'Thank them, show enthusiasm, then ask for time. You don\'t have to accept on the call.', vi: 'Cảm ơn, thể hiện sự hào hứng, rồi xin thêm thời gian. Không cần nhận ngay trong cuộc gọi.'},
        phrases: [
          {en: 'Thank you so much for the offer. I\'m really excited about the role.', vi: 'Cảm ơn rất nhiều vì offer. Tôi thật sự hào hứng với vị trí này.'},
          {en: 'Could I have a few days to review the details?', vi: 'Tôi có thể xin vài ngày để xem kỹ chi tiết không?'},
          {en: 'Could you send me the offer in writing?', vi: 'Anh/chị gửi offer bằng văn bản giúp tôi được không?'},
          {en: 'Is the salary gross or net?', vi: 'Mức lương là gross (trước thuế) hay net (sau thuế)?'},
          {en: 'How is the performance bonus calculated?', vi: 'Thưởng hiệu suất được tính thế nào?'},
          {en: 'What does the probation period look like?', vi: 'Thời gian thử việc diễn ra thế nào?'}
        ]
      },
      {
        title: {en: 'Negotiating', vi: 'Đàm phán'},
        phrases: [
          {en: 'Based on my experience and the market rate, I was expecting something closer to forty-five million.', vi: 'Dựa trên kinh nghiệm và mặt bằng thị trường, tôi mong mức gần 45 triệu hơn.'},
          {en: 'I have another offer, but this role is my first choice.', vi: 'Tôi có một offer khác, nhưng vị trí này là lựa chọn ưu tiên của tôi.'},
          {en: 'Is there any flexibility on the base salary?', vi: 'Lương cơ bản có thể linh hoạt hơn không?'},
          {en: 'If the salary is fixed, could we discuss a signing bonus or extra leave days?', vi: 'Nếu lương cố định, mình có thể bàn về thưởng ký hợp đồng hoặc thêm ngày phép không?'},
          {en: 'Would it be possible to review the salary after the probation period?', vi: 'Có thể xem xét lại lương sau thời gian thử việc không?'},
          {en: 'If we can agree on that, I\'m ready to accept.', vi: 'Nếu thống nhất được điểm đó, tôi sẵn sàng nhận offer.'}
        ]
      },
      {
        title: {en: 'Notice period and start date', vi: 'Thời gian báo trước và ngày bắt đầu'},
        phrases: [
          {en: 'My notice period is thirty days.', vi: 'Thời gian báo trước nghỉ việc của tôi là 30 ngày.'},
          {en: 'The earliest I can start is the first of December.', vi: 'Sớm nhất tôi có thể bắt đầu là ngày 1 tháng 12.'},
          {en: 'I\'d like to hand over my work properly before I leave.', vi: 'Tôi muốn bàn giao công việc chu đáo trước khi nghỉ.'},
          {en: 'I\'m happy to accept the offer. What are the next steps?', vi: 'Tôi đồng ý nhận offer. Các bước tiếp theo là gì?'},
          {en: 'Unfortunately, I\'ve decided to decline the offer. Thank you for your time.', vi: 'Rất tiếc, tôi quyết định từ chối offer. Cảm ơn anh/chị đã dành thời gian.'}
        ]
      },
      {
        title: {en: 'Resigning professionally', vi: 'Nghỉ việc chuyên nghiệp'},
        phrases: [
          {en: 'Do you have a few minutes? I\'d like to talk to you about something important.', vi: 'Anh/chị có vài phút không? Tôi muốn trao đổi một việc quan trọng.'},
          {en: 'I\'ve decided to accept an offer from another company.', vi: 'Tôi đã quyết định nhận offer từ một công ty khác.'},
          {en: 'It wasn\'t an easy decision. I\'ve learned a lot here.', vi: 'Đây không phải quyết định dễ dàng. Tôi đã học được rất nhiều ở đây.'},
          {en: 'My last working day will be the thirtieth of November.', vi: 'Ngày làm việc cuối cùng của tôi là 30 tháng 11.'},
          {en: 'I\'ll prepare a handover document and help train my replacement.', vi: 'Tôi sẽ chuẩn bị tài liệu bàn giao và hỗ trợ đào tạo người thay thế.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Resignation email', vi: 'Email xin nghỉ việc'},
        body: `Subject: Resignation — [your name]

Dear [manager's name],

Please accept this email as formal notice of my resignation from my role as [position].
My last working day will be [date], in line with my [number]-day notice period.
Thank you for the support and the opportunities during my time here.
I'll do my best to make the handover smooth, including [handover plan].

Best regards,
[your name]`
      },
      {
        title: {en: 'Counter-offer reply', vi: 'Phản hồi để đàm phán offer'},
        body: `Hi [recruiter's name],

Thank you again for the offer. I'm very excited about joining [company].
Based on my [number] years of experience with [skills] and the current market range, I was hoping for a base salary of around [amount].
Is there any flexibility on this? I'm also open to discussing [bonus or leave or review date].

Looking forward to hearing from you.
Best regards,
[your name]`
      }
    ]
  },
  {
    id: 'support',
    groups: [
      {
        title: {en: 'Acknowledging the problem', vi: 'Ghi nhận vấn đề'},
        tip: {en: 'Acknowledge, apologize for the experience, then explain the next step. Don\'t blame the user.', vi: 'Ghi nhận, xin lỗi về trải nghiệm, rồi nói bước tiếp theo. Không đổ lỗi cho người dùng.'},
        phrases: [
          {en: 'Thank you for reporting this, and sorry for the inconvenience.', vi: 'Cảm ơn bạn đã báo, và xin lỗi vì sự bất tiện.'},
          {en: 'I understand how frustrating this must be.', vi: 'Tôi hiểu điều này hẳn rất khó chịu.'},
          {en: 'I\'m sorry you had this experience.', vi: 'Rất tiếc bạn đã gặp trải nghiệm này.'},
          {en: 'Let me look into this for you right away.', vi: 'Để tôi kiểm tra ngay cho bạn.'}
        ]
      },
      {
        title: {en: 'Getting the details', vi: 'Thu thập thông tin'},
        phrases: [
          {en: 'Could you tell me roughly what time this happened?', vi: 'Bạn cho tôi biết khoảng mấy giờ việc này xảy ra được không?'},
          {en: 'Which device and browser are you using?', vi: 'Bạn đang dùng thiết bị và trình duyệt nào?'},
          {en: 'Could you send a screenshot of the error message?', vi: 'Bạn gửi ảnh chụp thông báo lỗi được không?'},
          {en: 'For your security, please don\'t send your password or the full card number.', vi: 'Vì an toàn, vui lòng không gửi mật khẩu hay số thẻ đầy đủ.'},
          {en: 'Have you tried logging out and logging back in?', vi: 'Bạn đã thử đăng xuất rồi đăng nhập lại chưa?'}
        ]
      },
      {
        title: {en: 'Explaining and resolving', vi: 'Giải thích và giải quyết'},
        phrases: [
          {en: 'We\'ve found the cause, and a fix will be released today.', vi: 'Chúng tôi đã tìm ra nguyên nhân, bản sửa sẽ được phát hành hôm nay.'},
          {en: 'In the meantime, you can use the web version as a workaround.', vi: 'Trong lúc chờ, bạn có thể dùng bản web để thay thế.'},
          {en: 'Your payment didn\'t go through, so you haven\'t been charged.', vi: 'Thanh toán chưa thành công nên bạn chưa bị trừ tiền.'},
          {en: 'The duplicate charge will be refunded within five to seven business days.', vi: 'Khoản trừ trùng sẽ được hoàn trong 5–7 ngày làm việc.'},
          {en: 'I\'ve escalated this to our technical team, and I\'ll update you by tomorrow.', vi: 'Tôi đã chuyển việc này lên nhóm kỹ thuật và sẽ cập nhật cho bạn trước ngày mai.'},
          {en: 'Is there anything else I can help you with?', vi: 'Tôi còn có thể giúp gì thêm cho bạn không?'}
        ]
      },
      {
        title: {en: 'Saying no politely', vi: 'Từ chối lịch sự'},
        phrases: [
          {en: 'I\'m afraid that feature isn\'t available yet, but I\'ve shared your feedback with the product team.', vi: 'Rất tiếc tính năng đó chưa có, nhưng tôi đã chuyển góp ý của bạn tới nhóm sản phẩm.'},
          {en: 'Unfortunately, we can\'t change a transaction after it\'s been settled.', vi: 'Rất tiếc, chúng tôi không thể sửa giao dịch sau khi đã quyết toán.'},
          {en: 'What I can do is create a correction request for you.', vi: 'Điều tôi có thể làm là tạo yêu cầu điều chỉnh cho bạn.'}
        ]
      },
      {
        title: {en: 'Chatting with an upset user', vi: 'Chat với người dùng đang bực'},
        phrases: [
          {en: 'I completely understand. Let\'s get this sorted out for you.', vi: 'Tôi hoàn toàn hiểu. Chúng ta cùng giải quyết việc này nhé.'},
          {en: 'Thank you for your patience while I check.', vi: 'Cảm ơn bạn đã kiên nhẫn chờ tôi kiểm tra.'},
          {en: 'I can see the payment on our side, and it\'s being processed.', vi: 'Tôi thấy khoản thanh toán ở phía chúng tôi, và nó đang được xử lý.'},
          {en: 'I\'ve added a note to your case, so you won\'t need to explain it again.', vi: 'Tôi đã ghi chú vào hồ sơ để bạn không cần giải thích lại.'},
          {en: 'I\'ll personally follow up with you tomorrow.', vi: 'Ngày mai tôi sẽ trực tiếp liên hệ lại với bạn.'}
        ]
      },
      {
        title: {en: 'Closing a support case', vi: 'Kết thúc yêu cầu hỗ trợ'},
        phrases: [
          {en: 'I\'m glad that\'s working now.', vi: 'Rất vui vì giờ mọi thứ đã hoạt động.'},
          {en: 'I\'ll close this case, but you can reply to reopen it at any time.', vi: 'Tôi sẽ đóng yêu cầu này, nhưng bạn có thể trả lời để mở lại bất cứ lúc nào.'},
          {en: 'If you have a minute, we\'d appreciate your rating of this conversation.', vi: 'Nếu có chút thời gian, mong bạn đánh giá cuộc trò chuyện này.'},
          {en: 'Thanks for your patience, and have a great day.', vi: 'Cảm ơn sự kiên nhẫn của bạn, chúc một ngày tốt lành.'},
          {en: 'I\'ve passed your suggestion on to the product team.', vi: 'Tôi đã chuyển góp ý của bạn tới nhóm sản phẩm.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Reply to a user complaint', vi: 'Trả lời phàn nàn của người dùng'},
        body: `Hi [name],

Thank you for contacting us, and I'm sorry for the trouble with [problem].
We've checked your case: [what happened, in plain words].
[What we did or will do] by [date].
In the meantime, [workaround].

If you have any other questions, just reply to this email.
Best regards,
[your name], [team]`
      }
    ]
  },
  {
    id: 'hiring',
    groups: [
      {
        title: {en: 'Opening the interview', vi: 'Mở đầu buổi phỏng vấn'},
        phrases: [
          {en: 'Hi, thanks for taking the time to talk with us today.', vi: 'Chào bạn, cảm ơn đã dành thời gian trao đổi hôm nay.'},
          {en: 'I\'m a backend developer on the payments team, and this is my colleague, Lan.', vi: 'Mình là backend developer ở nhóm payments, đây là đồng nghiệp của mình, Lan.'},
          {en: 'We have about an hour. We\'ll start with your background, then a technical discussion, and leave time for your questions.', vi: 'Mình có khoảng một tiếng. Bắt đầu với kinh nghiệm của bạn, rồi thảo luận kỹ thuật, và dành thời gian cho câu hỏi của bạn.'},
          {en: 'There are no trick questions. We\'re interested in how you think.', vi: 'Không có câu hỏi đánh đố. Mình quan tâm cách bạn suy nghĩ.'},
          {en: 'Feel free to think out loud.', vi: 'Bạn cứ thoải mái nói to suy nghĩ của mình.'}
        ]
      },
      {
        title: {en: 'Asking and probing', vi: 'Đặt câu hỏi và hỏi sâu'},
        tip: {en: 'Ask open questions, then follow up with "why" and "what would you do if…". Avoid questions about age, family or religion.', vi: 'Hỏi câu mở, rồi hỏi tiếp "tại sao" và "nếu… thì bạn làm gì". Tránh hỏi về tuổi, gia đình, tôn giáo.'},
        phrases: [
          {en: 'Can you walk me through a project you\'re proud of?', vi: 'Bạn kể chi tiết về một dự án bạn tự hào được không?'},
          {en: 'What was your role in that project, specifically?', vi: 'Cụ thể vai trò của bạn trong dự án đó là gì?'},
          {en: 'Why did you choose that approach over the alternatives?', vi: 'Vì sao bạn chọn cách đó thay vì các phương án khác?'},
          {en: 'What would happen if the traffic grew ten times?', vi: 'Nếu lưu lượng tăng gấp mười thì sao?'},
          {en: 'How would you test that?', vi: 'Bạn sẽ test điều đó như thế nào?'},
          {en: 'That\'s fine. Let\'s move on to the next topic.', vi: 'Không sao. Mình chuyển sang chủ đề tiếp theo nhé.'},
          {en: 'Here\'s a small hint: think about what happens when two requests arrive at once.', vi: 'Gợi ý nhỏ: thử nghĩ chuyện gì xảy ra khi hai request đến cùng lúc.'}
        ]
      },
      {
        title: {en: 'Closing and giving feedback', vi: 'Kết thúc và đánh giá'},
        phrases: [
          {en: 'We\'ve got ten minutes left. What questions do you have for us?', vi: 'Còn mười phút. Bạn có câu hỏi gì cho chúng mình không?'},
          {en: 'Thank you. The recruiter will get back to you within a week.', vi: 'Cảm ơn bạn. Bộ phận tuyển dụng sẽ phản hồi trong vòng một tuần.'},
          {en: 'Strong on Spring and databases, but a bit weak on system design.', vi: 'Mạnh về Spring và database, nhưng hơi yếu phần thiết kế hệ thống.'},
          {en: 'The candidate communicated clearly and asked good clarifying questions.', vi: 'Ứng viên giao tiếp rõ ràng và đặt câu hỏi làm rõ tốt.'},
          {en: 'I\'d recommend moving them to the next round.', vi: 'Mình đề xuất cho ứng viên vào vòng tiếp theo.'},
          {en: 'I\'m leaning towards no hire, mainly because of the gaps in concurrency.', vi: 'Mình nghiêng về không tuyển, chủ yếu vì lỗ hổng kiến thức về concurrency.'}
        ]
      },
      {
        title: {en: 'Probing behavioral answers', vi: 'Hỏi sâu câu trả lời hành vi'},
        tip: {en: 'Ask for "I", not "we". Strong candidates can explain their own actions and results.', vi: 'Hỏi về "tôi", không phải "chúng tôi". Ứng viên giỏi giải thích được hành động và kết quả của chính họ.'},
        phrases: [
          {en: 'What exactly was your part in that?', vi: 'Cụ thể phần việc của bạn trong đó là gì?'},
          {en: 'What did you do when that approach didn\'t work?', vi: 'Bạn đã làm gì khi cách đó không hiệu quả?'},
          {en: 'How did you measure the result?', vi: 'Bạn đo kết quả bằng cách nào?'},
          {en: 'Looking back, what would you do differently?', vi: 'Nhìn lại, bạn sẽ làm khác điều gì?'},
          {en: 'Can you give me a more recent example?', vi: 'Bạn cho tôi một ví dụ gần đây hơn được không?'}
        ]
      },
      {
        title: {en: 'Answering the candidate\'s questions', vi: 'Trả lời câu hỏi của ứng viên'},
        phrases: [
          {en: 'We\'re a team of six backend and two front-end developers.', vi: 'Nhóm có sáu backend và hai front-end developer.'},
          {en: 'A typical week has one planning session, daily stand-ups and a retro every two weeks.', vi: 'Một tuần điển hình có một buổi planning, stand-up hằng ngày và retro hai tuần một lần.'},
          {en: 'We release to production about twice a week.', vi: 'Nhóm phát hành lên production khoảng hai lần mỗi tuần.'},
          {en: 'Honestly, the biggest challenge right now is our legacy reporting module.', vi: 'Thật lòng, thách thức lớn nhất hiện nay là module báo cáo cũ.'},
          {en: 'New joiners get a buddy and a small first ticket in their first week.', vi: 'Người mới có một buddy và một ticket nhỏ trong tuần đầu.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Interview feedback note', vi: 'Ghi chú đánh giá phỏng vấn'},
        body: `Candidate: [name] — Role: [role] — Round: [round]
Strengths: [skill + evidence].
Concerns: [gap + evidence].
Communication: [clear or needs improvement].
Recommendation: [Strong hire or Hire or No hire], because [main reason].`
      }
    ]
  },
  {
    id: 'wellbeing',
    groups: [
      {
        title: {en: 'Talking about workload', vi: 'Nói về khối lượng công việc'},
        tip: {en: 'Raise workload problems early, with facts, and suggest a solution.', vi: 'Nêu vấn đề quá tải sớm, kèm dữ kiện, và đề xuất giải pháp.'},
        phrases: [
          {en: 'I\'m feeling a bit overwhelmed with the number of tasks right now.', vi: 'Hiện mình thấy hơi ngợp với số lượng việc.'},
          {en: 'I\'ve worked late every day this week, and it isn\'t sustainable.', vi: 'Tuần này ngày nào mình cũng làm muộn, như vậy không bền được.'},
          {en: 'Could we look at my priorities together?', vi: 'Mình cùng xem lại thứ tự ưu tiên công việc của mình được không?'},
          {en: 'If I take on the new project, something else will have to wait.', vi: 'Nếu nhận dự án mới thì sẽ có việc khác phải chờ.'},
          {en: 'I think we need one more person on this project.', vi: 'Mình nghĩ dự án này cần thêm một người.'}
        ]
      },
      {
        title: {en: 'Asking for and offering support', vi: 'Xin và đề nghị hỗ trợ'},
        phrases: [
          {en: 'Are you okay? You seem a bit stressed lately.', vi: 'Bạn ổn chứ? Dạo này bạn có vẻ căng thẳng.'},
          {en: 'Is there anything I can take off your plate?', vi: 'Mình có thể đỡ cho bạn việc gì không? (take off your plate = nhận bớt việc)'},
          {en: 'I need to take a few days off to recharge.', vi: 'Mình cần nghỉ vài ngày để lấy lại sức.'},
          {en: 'I have a personal matter to deal with, so I might be slower this week.', vi: 'Mình có việc cá nhân cần lo nên tuần này có thể chậm hơn.'},
          {en: 'Thanks for checking in. I really appreciate it.', vi: 'Cảm ơn bạn đã hỏi thăm. Mình rất trân trọng.'}
        ]
      },
      {
        title: {en: 'Setting boundaries', vi: 'Đặt ranh giới'},
        phrases: [
          {en: 'I don\'t check messages after eight p.m., unless it\'s an emergency.', vi: 'Mình không xem tin nhắn sau 8 giờ tối, trừ trường hợp khẩn cấp.'},
          {en: 'I\'m on leave next week, so please contact Minh for anything urgent.', vi: 'Tuần sau mình nghỉ phép, việc gấp vui lòng liên hệ Minh.'},
          {en: 'Can we schedule this for tomorrow morning instead?', vi: 'Mình dời việc này sang sáng mai được không?'},
          {en: 'I\'ll block two hours of focus time every afternoon.', vi: 'Mỗi chiều mình sẽ chặn hai tiếng để tập trung.'}
        ]
      },
      {
        title: {en: 'Burnout warning signs', vi: 'Dấu hiệu kiệt sức'},
        tip: {en: 'Saying it early is professional, not weak. A tired team makes more mistakes.', vi: 'Nói sớm là chuyên nghiệp, không phải yếu kém. Một nhóm mệt mỏi sẽ mắc nhiều lỗi hơn.'},
        phrases: [
          {en: 'I\'ve been feeling exhausted for a few weeks.', vi: 'Mấy tuần nay mình thấy kiệt sức.'},
          {en: 'I\'m finding it hard to focus, and I\'m making small mistakes.', vi: 'Mình khó tập trung và hay mắc lỗi nhỏ.'},
          {en: 'I think I need a proper break after this release.', vi: 'Mình nghĩ mình cần nghỉ ngơi thật sự sau bản release này.'},
          {en: 'Could we spread the on-call shifts more evenly?', vi: 'Mình chia ca trực đều hơn được không?'},
          {en: 'Let\'s make sure everyone takes their leave this quarter.', vi: 'Hãy đảm bảo mọi người đều nghỉ phép trong quý này.'}
        ]
      },
      {
        title: {en: 'Coming back after leave', vi: 'Quay lại làm việc sau khi nghỉ'},
        phrases: [
          {en: 'I\'m back! Thanks for covering for me last week.', vi: 'Mình đã quay lại! Cảm ơn mọi người đã làm thay tuần trước.'},
          {en: 'I\'m still catching up on emails, so give me until lunch.', vi: 'Mình vẫn đang đọc lại email, cho mình tới trưa nhé.'},
          {en: 'What did I miss? Anything urgent I should know about?', vi: 'Mình đã bỏ lỡ gì? Có việc gì gấp mình cần biết không?'},
          {en: 'I\'m feeling much better now, thanks for asking.', vi: 'Giờ mình khỏe hơn nhiều rồi, cảm ơn đã hỏi thăm.'},
          {en: 'I\'ll take it a bit slower this week while I get back up to speed.', vi: 'Tuần này mình làm chậm lại một chút để bắt nhịp lại.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Raising a workload problem', vi: 'Nêu vấn đề quá tải'},
        body: `Hi [manager], can we talk about my workload?
Right now I'm working on [task A], [task B] and [task C], and I've worked late [number] days this week.
I'm worried that [quality or deadline] will suffer.
Could we [move task or get help or change the deadline]? Which one is the priority for you?`
      }
    ]
  },
  {
    id: 'security',
    groups: [
      {
        title: {en: 'Security review', vi: 'Review bảo mật'},
        phrases: [
          {en: 'Who is allowed to call this endpoint?', vi: 'Ai được phép gọi endpoint này?'},
          {en: 'We check ownership on the server, so users can only see their own cards.', vi: 'Server kiểm tra quyền sở hữu nên người dùng chỉ xem được thẻ của chính họ.'},
          {en: 'This input goes straight into the query. We need to parameterize it.', vi: 'Dữ liệu đầu vào này đi thẳng vào câu query. Cần dùng tham số hóa.'},
          {en: 'The token expires after fifteen minutes, and the refresh token is in an HttpOnly cookie.', vi: 'Token hết hạn sau 15 phút, refresh token nằm trong cookie HttpOnly.'},
          {en: 'Sensitive fields are encrypted at rest.', vi: 'Các trường nhạy cảm được mã hóa khi lưu trữ (at rest).'},
          {en: 'All traffic is encrypted in transit with TLS.', vi: 'Mọi lưu lượng được mã hóa khi truyền (in transit) bằng TLS.'},
          {en: 'We follow the principle of least privilege for service accounts.', vi: 'Tài khoản service tuân theo nguyên tắc đặc quyền tối thiểu.'}
        ]
      },
      {
        title: {en: 'Secrets and logging', vi: 'Secret và logging'},
        tip: {en: 'Never paste a secret in chat, a ticket or a screenshot. If it leaks, rotate it immediately.', vi: 'Không bao giờ dán secret vào chat, ticket hay ảnh chụp. Nếu lộ, đổi (rotate) ngay.'},
        phrases: [
          {en: 'The API key was committed to Git by mistake, so we rotated it right away.', vi: 'API key lỡ bị commit lên Git nên đã đổi key ngay lập tức.'},
          {en: 'Secrets are stored in the vault, not in the config file.', vi: 'Secret lưu trong vault, không để trong file cấu hình.'},
          {en: 'Please don\'t log the full request body. It contains personal data.', vi: 'Đừng log toàn bộ request body. Trong đó có dữ liệu cá nhân.'},
          {en: 'We mask the card number and show only the last four digits.', vi: 'Số thẻ được che, chỉ hiển thị bốn số cuối.'},
          {en: 'The error message shouldn\'t reveal whether the email exists.', vi: 'Thông báo lỗi không được tiết lộ email có tồn tại hay không.'}
        ]
      },
      {
        title: {en: 'Vulnerabilities and incidents', vi: 'Lỗ hổng và sự cố bảo mật'},
        phrases: [
          {en: 'The scanner found a critical vulnerability in one of our dependencies.', vi: 'Công cụ quét phát hiện một lỗ hổng nghiêm trọng trong một thư viện phụ thuộc.'},
          {en: 'There\'s a patch available, so let\'s upgrade the library this sprint.', vi: 'Đã có bản vá, mình nâng cấp thư viện trong sprint này.'},
          {en: 'Is this vulnerability actually exploitable in our setup?', vi: 'Lỗ hổng này có thực sự bị khai thác được trong cấu hình của mình không?'},
          {en: 'We noticed suspicious login attempts from many IP addresses.', vi: 'Phát hiện các lần đăng nhập đáng ngờ từ nhiều địa chỉ IP.'},
          {en: 'We\'ve added rate limiting and temporarily blocked those IPs.', vi: 'Đã thêm giới hạn tần suất và tạm chặn các IP đó.'},
          {en: 'We need to report this to the security team within an hour.', vi: 'Cần báo cáo việc này cho nhóm bảo mật trong vòng một giờ.'}
        ]
      },
      {
        title: {en: 'Phishing and security awareness', vi: 'Nhận diện lừa đảo và ý thức bảo mật'},
        phrases: [
          {en: 'I received a suspicious email asking me to reset my password.', vi: 'Mình nhận được email đáng ngờ yêu cầu đặt lại mật khẩu.'},
          {en: 'Don\'t click the link. Please forward it to the security team.', vi: 'Đừng bấm vào link. Vui lòng chuyển tiếp cho nhóm bảo mật.'},
          {en: 'The sender\'s address looks similar, but the domain is wrong.', vi: 'Địa chỉ người gửi trông giống, nhưng tên miền thì sai.'},
          {en: 'Someone called pretending to be IT and asked for my verification code.', vi: 'Có người gọi giả làm bộ phận IT và hỏi mã xác thực của mình.'},
          {en: 'I think I clicked a bad link. What should I do?', vi: 'Hình như mình bấm phải link độc. Mình nên làm gì?'},
          {en: 'Please lock your screen when you leave your desk.', vi: 'Nhớ khóa màn hình khi rời bàn làm việc.'}
        ]
      },
      {
        title: {en: 'Penetration tests and audit findings', vi: 'Kiểm thử xâm nhập và phát hiện khi audit'},
        phrases: [
          {en: 'The penetration test is scheduled for next week on the staging environment.', vi: 'Đợt kiểm thử xâm nhập được lên lịch tuần sau trên môi trường staging.'},
          {en: 'The report has two high findings and five low ones.', vi: 'Báo cáo có hai phát hiện mức cao và năm mức thấp.'},
          {en: 'We\'ll fix the high findings before the release and plan the rest.', vi: 'Sửa các phát hiện mức cao trước bản release, phần còn lại lên kế hoạch.'},
          {en: 'This finding is a false positive. Here\'s the evidence.', vi: 'Phát hiện này là báo nhầm. Đây là bằng chứng.'},
          {en: 'We\'ve accepted this risk for now, and it\'s documented with an owner and a review date.', vi: 'Tạm chấp nhận rủi ro này, đã ghi lại kèm người phụ trách và ngày xem xét lại.'},
          {en: 'Could the testers retest after we deploy the fixes?', vi: 'Nhóm kiểm thử có thể test lại sau khi mình deploy bản sửa không?'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Security review summary', vi: 'Tóm tắt review bảo mật'},
        body: `Scope: [feature or endpoint].
Authentication: [how users are identified].
Authorization: [roles + ownership check on the server].
Data: [sensitive fields], [encrypted or masked or not logged].
Findings: [issue] — severity [high or medium or low] — fix: [action], owner [name].`
      }
    ]
  },
  {
    id: 'data',
    groups: [
      {
        title: {en: 'Describing trends', vi: 'Mô tả xu hướng'},
        tip: {en: 'Verbs for numbers: increase, rise, grow, go up / decrease, fall, drop, go down / stay flat, peak, bottom out.', vi: 'Động từ cho số liệu: increase, rise, grow, go up / decrease, fall, drop, go down / stay flat, peak, bottom out.'},
        phrases: [
          {en: 'Active users increased by fifteen percent month over month.', vi: 'Người dùng hoạt động tăng 15% so với tháng trước. (month over month / MoM)'},
          {en: 'Revenue dropped sharply in March and then recovered.', vi: 'Doanh thu giảm mạnh trong tháng 3 rồi phục hồi.'},
          {en: 'The error rate has stayed flat at around zero point two percent.', vi: 'Tỉ lệ lỗi đi ngang quanh mức 0,2%.'},
          {en: 'Sign-ups peaked during the campaign.', vi: 'Lượt đăng ký đạt đỉnh trong đợt chiến dịch.'},
          {en: 'Compared to last year, transactions doubled.', vi: 'So với năm ngoái, số giao dịch tăng gấp đôi.'},
          {en: 'There\'s a slight upward trend, but it isn\'t significant yet.', vi: 'Có xu hướng tăng nhẹ, nhưng chưa đáng kể.'}
        ]
      },
      {
        title: {en: 'Explaining a dashboard', vi: 'Giải thích dashboard'},
        phrases: [
          {en: 'This chart shows daily transactions over the last thirty days.', vi: 'Biểu đồ này thể hiện số giao dịch hằng ngày trong 30 ngày qua.'},
          {en: 'The x-axis is the date, and the y-axis is the amount in millions of dong.', vi: 'Trục x là ngày, trục y là số tiền tính theo triệu đồng.'},
          {en: 'Each bar represents one card.', vi: 'Mỗi cột đại diện cho một thẻ.'},
          {en: 'The dotted line is the target.', vi: 'Đường chấm chấm là mục tiêu.'},
          {en: 'You can filter by month and drill down into each category.', vi: 'Có thể lọc theo tháng và xem chi tiết từng danh mục.'},
          {en: 'The data is refreshed every hour.', vi: 'Dữ liệu được làm mới mỗi giờ.'}
        ]
      },
      {
        title: {en: 'Data quality and caveats', vi: 'Chất lượng dữ liệu và lưu ý'},
        phrases: [
          {en: 'These numbers don\'t include refunds yet.', vi: 'Các con số này chưa bao gồm khoản hoàn tiền.'},
          {en: 'The data for last week is incomplete because the import job failed.', vi: 'Dữ liệu tuần trước chưa đầy đủ vì job import bị lỗi.'},
          {en: 'There\'s an outlier on the fifth caused by a test account.', vi: 'Có một giá trị bất thường ngày mùng 5 do tài khoản test.'},
          {en: 'Correlation doesn\'t mean causation.', vi: 'Tương quan không có nghĩa là quan hệ nhân quả.'},
          {en: 'The sample is too small to draw a conclusion.', vi: 'Mẫu quá nhỏ để rút ra kết luận.'},
          {en: 'Which source of truth should we use for these numbers?', vi: 'Mình nên lấy nguồn dữ liệu gốc nào cho các con số này?'}
        ]
      },
      {
        title: {en: 'Ad-hoc data requests', vi: 'Yêu cầu số liệu đột xuất'},
        phrases: [
          {en: 'Could you pull the number of new users for last month?', vi: 'Bạn lấy giúp số người dùng mới tháng trước được không?'},
          {en: 'Do you need it broken down by city or just the total?', vi: 'Bạn cần chia theo thành phố hay chỉ cần tổng?'},
          {en: 'Should I include test accounts and deleted accounts?', vi: 'Có tính cả tài khoản test và tài khoản đã xóa không?'},
          {en: 'I\'ll run the query on a read replica, so it doesn\'t slow down production.', vi: 'Mình sẽ chạy query trên read replica để không làm chậm production.'},
          {en: 'Here are the numbers. I\'ve also attached the query, so you can reuse it.', vi: 'Đây là số liệu. Mình đính kèm cả câu query để bạn dùng lại.'},
          {en: 'If you need this every month, let\'s add it to the dashboard.', vi: 'Nếu tháng nào cũng cần, mình đưa vào dashboard nhé.'}
        ]
      },
      {
        title: {en: 'Explaining a surprising number', vi: 'Giải thích một con số bất thường'},
        phrases: [
          {en: 'This spike looks surprising, so I double-checked the data.', vi: 'Đỉnh tăng này trông bất thường nên mình đã kiểm tra lại dữ liệu.'},
          {en: 'It\'s caused by a one-off campaign, not a real trend.', vi: 'Nó do một chiến dịch một lần gây ra, không phải xu hướng thật.'},
          {en: 'If we exclude test accounts, the growth is closer to five percent.', vi: 'Nếu loại tài khoản test, mức tăng chỉ gần 5%.'},
          {en: 'I\'m not confident in this number yet. Let me confirm it with the finance team.', vi: 'Mình chưa chắc con số này. Để mình xác nhận với nhóm tài chính.'},
          {en: 'The drop on Sunday is because the import job didn\'t run.', vi: 'Mức giảm ngày Chủ nhật là do job import không chạy.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Summarizing a metric', vi: 'Tóm tắt một chỉ số'},
        body: `[Metric] was [value] this [period], [up or down] [percent] compared to [previous period].
The main driver was [reason].
Note: [caveat, for example missing data or a one-off event].
Next step: [action] to [goal].`
      }
    ]
  },
  {
    id: 'git',
    groups: [
      {
        title: {en: 'Branches and commits', vi: 'Nhánh và commit'},
        phrases: [
          {en: 'I\'ll create a feature branch from main.', vi: 'Mình sẽ tạo một feature branch từ main.'},
          {en: 'I\'ve pushed my changes to the remote branch.', vi: 'Mình đã push thay đổi lên nhánh remote.'},
          {en: 'Can you pull the latest changes and try again?', vi: 'Bạn pull thay đổi mới nhất rồi thử lại nhé?'},
          {en: 'I\'ll squash these commits before merging.', vi: 'Mình sẽ gộp (squash) các commit này trước khi merge.'},
          {en: 'The commit message should explain why, not only what.', vi: 'Commit message nên giải thích tại sao, không chỉ là cái gì.'},
          {en: 'I accidentally committed to main. Let me revert it.', vi: 'Mình lỡ commit lên main. Để mình revert lại.'},
          {en: 'Let\'s tag this commit as version two point one.', vi: 'Gắn tag commit này là phiên bản 2.1.'}
        ]
      },
      {
        title: {en: 'Conflicts and history', vi: 'Xung đột và lịch sử'},
        phrases: [
          {en: 'I\'m getting a merge conflict in the pom file.', vi: 'Mình đang bị merge conflict ở file pom.'},
          {en: 'I rebased my branch on main and resolved the conflicts.', vi: 'Mình đã rebase nhánh lên main và giải quyết conflict.'},
          {en: 'Please don\'t force-push to a shared branch.', vi: 'Đừng force-push lên nhánh dùng chung.'},
          {en: 'Let me check the git blame to see who changed this line.', vi: 'Để mình xem git blame xem ai sửa dòng này.'},
          {en: 'I\'ll cherry-pick the fix into the release branch.', vi: 'Mình sẽ cherry-pick bản sửa vào nhánh release.'},
          {en: 'I stashed my local changes before switching branches.', vi: 'Mình đã stash thay đổi local trước khi đổi nhánh.'}
        ]
      },
      {
        title: {en: 'Pull request workflow', vi: 'Quy trình pull request'},
        phrases: [
          {en: 'I\'ve opened a draft pull request so you can see the direction early.', vi: 'Mình mở PR nháp để bạn xem hướng đi sớm.'},
          {en: 'The PR is ready for review.', vi: 'PR đã sẵn sàng để review.'},
          {en: 'The build failed because of a lint error. I\'ll fix it.', vi: 'Build lỗi do lint. Mình sẽ sửa.'},
          {en: 'I need one more approval before I can merge.', vi: 'Mình cần thêm một lượt approve mới merge được.'},
          {en: 'I\'ve addressed all the comments. Could you take another look?', vi: 'Mình đã xử lý hết comment. Bạn xem lại giúp nhé?'},
          {en: 'Merged and deleted the branch.', vi: 'Đã merge và xóa nhánh.'}
        ]
      },
      {
        title: {en: 'Repository conventions', vi: 'Quy ước repository'},
        phrases: [
          {en: 'The main branch is protected, so every change needs a pull request.', vi: 'Nhánh main được bảo vệ nên mọi thay đổi đều cần pull request.'},
          {en: 'Branch names include the ticket number, like feature slash K B dash one two three.', vi: 'Tên nhánh có chứa mã ticket, ví dụ feature/KB-123.'},
          {en: 'We use conventional commits, like feat, fix and chore.', vi: 'Nhóm dùng conventional commits như feat, fix và chore.'},
          {en: 'Please don\'t commit generated files or local configuration.', vi: 'Đừng commit file sinh tự động hay cấu hình local.'},
          {en: 'The code owners file decides who must review each folder.', vi: 'File CODEOWNERS quy định ai phải review từng thư mục.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Commit message', vi: 'Commit message'},
        body: `[type]([scope]): [short summary in the imperative, e.g. "add pagination to transactions API"]

Why: [the problem or ticket].
How: [main idea of the change].
Refs: [ticket ID]`
      }
    ]
  },
  {
    id: 'pairing',
    groups: [
      {
        title: {en: 'Pair programming', vi: 'Pair programming'},
        tip: {en: 'Switch driver and navigator every twenty to thirty minutes. The navigator thinks ahead; the driver types.', vi: 'Đổi vai driver và navigator mỗi 20–30 phút. Navigator suy nghĩ trước; driver gõ code.'},
        phrases: [
          {en: 'Do you want to drive, or shall I?', vi: 'Bạn muốn cầm bàn phím, hay để mình?'},
          {en: 'Let\'s switch roles after this test passes.', vi: 'Test này pass xong thì mình đổi vai.'},
          {en: 'Can you share your screen? I\'ll navigate.', vi: 'Bạn chia sẻ màn hình nhé? Mình sẽ chỉ hướng.'},
          {en: 'What if we extract this into a method first?', vi: 'Hay mình tách đoạn này ra thành method trước?'},
          {en: 'Hold on, I think there\'s a typo on line twelve.', vi: 'Khoan, hình như dòng 12 bị gõ sai.'},
          {en: 'Let\'s write the test first and see it fail.', vi: 'Viết test trước và xem nó fail đã.'},
          {en: 'Let\'s take a five-minute break.', vi: 'Mình nghỉ năm phút nhé.'}
        ]
      },
      {
        title: {en: 'Mentoring and explaining', vi: 'Kèm cặp và giải thích'},
        tip: {en: 'Ask questions that lead to the answer instead of giving it. Check understanding with "Can you explain it back to me?".', vi: 'Đặt câu hỏi dẫn tới đáp án thay vì nói luôn. Kiểm tra hiểu bằng "Bạn giải thích lại cho mình được không?".'},
        phrases: [
          {en: 'What do you think will happen if this value is null?', vi: 'Bạn nghĩ chuyện gì xảy ra nếu giá trị này là null?'},
          {en: 'Good question. Let\'s find the answer together in the docs.', vi: 'Câu hỏi hay. Mình cùng tìm câu trả lời trong tài liệu nhé.'},
          {en: 'Can you explain it back to me in your own words?', vi: 'Bạn giải thích lại cho mình bằng lời của bạn được không?'},
          {en: 'That\'s close. Just one thing to change.', vi: 'Gần đúng rồi. Chỉ cần sửa một chỗ.'},
          {en: 'There\'s no such thing as a stupid question here.', vi: 'Ở đây không có câu hỏi nào là ngớ ngẩn cả.'},
          {en: 'Try it on your own first, and ping me if you\'re stuck for more than thirty minutes.', vi: 'Bạn thử tự làm trước, bí quá 30 phút thì nhắn mình.'},
          {en: 'You\'ve improved a lot this month. Your PRs are much cleaner.', vi: 'Tháng này bạn tiến bộ nhiều. PR của bạn gọn gàng hơn hẳn.'}
        ]
      },
      {
        title: {en: 'Remote pairing', vi: 'Pair programming từ xa'},
        phrases: [
          {en: 'I\'ll share my IDE with Code With Me. Can you join?', vi: 'Mình chia sẻ IDE qua Code With Me. Bạn vào được không?'},
          {en: 'Can you give me control of the keyboard?', vi: 'Bạn cho mình quyền điều khiển bàn phím được không?'},
          {en: 'The text is a bit small on my side. Could you zoom in?', vi: 'Bên mình thấy chữ hơi nhỏ. Bạn phóng to được không?'},
          {en: 'Let\'s push to a shared branch so we can switch drivers easily.', vi: 'Push lên một nhánh chung để dễ đổi người cầm bàn phím.'},
          {en: 'I\'m going to mute for a second. There\'s some noise here.', vi: 'Mình tắt mic một chút. Ở đây hơi ồn.'}
        ]
      },
      {
        title: {en: 'Wrapping up a pairing session', vi: 'Tổng kết sau buổi pair'},
        phrases: [
          {en: 'Let\'s commit what we have and write down the next steps.', vi: 'Commit phần đã làm và ghi lại các bước tiếp theo.'},
          {en: 'We fixed the parser, but the error handling still needs work.', vi: 'Đã sửa xong parser, nhưng phần xử lý lỗi vẫn cần làm tiếp.'},
          {en: 'That was really useful. I learned a new debugging trick.', vi: 'Buổi này rất hữu ích. Mình học được một mẹo debug mới.'},
          {en: 'Shall we pair again tomorrow to finish it?', vi: 'Mai mình pair tiếp để làm xong nhé?'},
          {en: 'I\'ll open the pull request and add you as a co-author.', vi: 'Mình sẽ mở pull request và thêm bạn làm đồng tác giả.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Starting a pairing session', vi: 'Bắt đầu một buổi pair programming'},
        body: `Our goal for this session is [goal], in about [time].
I'll drive first, and you navigate. Let's switch after [the first test passes or 25 minutes].
First, let's write a test for [behavior].
If we get stuck for more than [time], let's take a step back and rethink.`
      }
    ]
  },
  {
    id: 'docs',
    groups: [
      {
        title: {en: 'README and guides', vi: 'README và hướng dẫn'},
        tip: {en: 'Use short imperative steps: "Run", "Copy", "Open". One action per step.', vi: 'Dùng câu mệnh lệnh ngắn: "Run", "Copy", "Open". Mỗi bước một hành động.'},
        phrases: [
          {en: 'This service handles card statements and payments.', vi: 'Service này xử lý sao kê thẻ và thanh toán.'},
          {en: 'Prerequisites: Java twenty-five and Docker.', vi: 'Yêu cầu trước: Java 25 và Docker.'},
          {en: 'Copy the example file and fill in your own values.', vi: 'Sao chép file mẫu rồi điền giá trị của bạn.'},
          {en: 'Run the application with the following command.', vi: 'Chạy ứng dụng bằng lệnh sau.'},
          {en: 'If the port is already in use, change it in the configuration.', vi: 'Nếu cổng đã bị dùng, đổi nó trong cấu hình.'},
          {en: 'Note: never commit the real environment file.', vi: 'Lưu ý: không bao giờ commit file môi trường thật.'}
        ]
      },
      {
        title: {en: 'Architecture decision records', vi: 'Ghi nhận quyết định kiến trúc (ADR)'},
        phrases: [
          {en: 'Context: we need to send notifications without slowing down payments.', vi: 'Bối cảnh: cần gửi thông báo mà không làm chậm thanh toán.'},
          {en: 'Decision: we will publish events to a message queue.', vi: 'Quyết định: sẽ publish event vào message queue.'},
          {en: 'Consequences: notifications may arrive a few seconds late.', vi: 'Hệ quả: thông báo có thể đến muộn vài giây.'},
          {en: 'Status: accepted. This replaces the decision from March.', vi: 'Trạng thái: đã chấp nhận. Thay thế quyết định hồi tháng 3.'},
          {en: 'Alternatives considered: a direct HTTP call and a scheduled job.', vi: 'Các phương án đã cân nhắc: gọi HTTP trực tiếp và job định kỳ.'}
        ]
      },
      {
        title: {en: 'Runbooks', vi: 'Runbook vận hành'},
        phrases: [
          {en: 'Use this runbook when the import job fails.', vi: 'Dùng runbook này khi job import bị lỗi.'},
          {en: 'Step one: check the job status on the admin page.', vi: 'Bước 1: kiểm tra trạng thái job trên trang admin.'},
          {en: 'If the status is "failed", check the logs for the error code.', vi: 'Nếu trạng thái là "failed", kiểm tra log để tìm mã lỗi.'},
          {en: 'Do not restart the job more than twice. Escalate to the on-call engineer.', vi: 'Không restart job quá hai lần. Báo lên kỹ sư trực.'},
          {en: 'Expected result: the job finishes within ten minutes.', vi: 'Kết quả mong đợi: job hoàn thành trong 10 phút.'}
        ]
      },
      {
        title: {en: 'API documentation', vi: 'Tài liệu API'},
        phrases: [
          {en: 'The API is documented with OpenAPI, and the spec is generated from the code.', vi: 'API được mô tả bằng OpenAPI, spec sinh ra từ code.'},
          {en: 'Each endpoint has an example request and response.', vi: 'Mỗi endpoint có ví dụ request và response.'},
          {en: 'This section lists all error codes and what the client should do.', vi: 'Phần này liệt kê mọi mã lỗi và việc client nên làm.'},
          {en: 'Amounts are decimal strings with a currency code, never floating-point numbers.', vi: 'Số tiền là chuỗi số thập phân kèm mã tiền tệ, không bao giờ là số thực dấu phẩy động.'},
          {en: 'Breaking changes are listed in the changelog with a migration guide.', vi: 'Các thay đổi phá vỡ được liệt kê trong changelog kèm hướng dẫn chuyển đổi.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'ADR', vi: 'Mẫu ADR'},
        body: `# ADR [number]: [title]
Status: [proposed or accepted or replaced by ADR X]
Context: [the problem and constraints].
Decision: We will [decision].
Alternatives: [option A] — [why not]; [option B] — [why not].
Consequences: [positive]; [negative or trade-off].`
      },
      {
        title: {en: 'Runbook', vi: 'Mẫu runbook'},
        body: `When to use: [symptom or alert name].
Impact: [who is affected].
Check: 1. [step] 2. [step]
Fix: 1. [step] 2. [step]
Escalate: if [condition], contact [team or on-call] in [channel].`
      }
    ]
  },
  {
    id: 'vocab',
    groups: [
      {
        title: {en: 'People and roles', vi: 'Con người và vai trò'},
        phrases: [
          {en: 'The key stakeholders are the finance team and the bank partner.', vi: 'stakeholder = các bên liên quan.'},
          {en: 'The product owner decides the priorities in the backlog.', vi: 'product owner = người quyết định ưu tiên sản phẩm.'},
          {en: 'Our tech lead reviews every architecture change.', vi: 'tech lead = trưởng nhóm kỹ thuật.'},
          {en: 'The project sponsor approved the budget.', vi: 'sponsor = người bảo trợ/cấp ngân sách cho dự án.'},
          {en: 'The vendor provides the SMS gateway.', vi: 'vendor = nhà cung cấp.'},
          {en: 'Who is the point of contact on the client side?', vi: 'point of contact = đầu mối liên hệ.'}
        ]
      },
      {
        title: {en: 'Planning words', vi: 'Từ ngữ lập kế hoạch'},
        phrases: [
          {en: 'The first milestone is the internal demo at the end of the month.', vi: 'milestone = cột mốc.'},
          {en: 'The main deliverable is a working API with documentation.', vi: 'deliverable = sản phẩm bàn giao.'},
          {en: 'That\'s out of scope for this phase.', vi: 'out of scope = ngoài phạm vi.'},
          {en: 'We have a hard deadline because of the regulation.', vi: 'hard deadline = hạn chót không thể dời.'},
          {en: 'There\'s a dependency on the payment team\'s API.', vi: 'dependency = sự phụ thuộc.'},
          {en: 'We\'ve allocated two developers to this workstream.', vi: 'allocate = phân bổ; workstream = mảng công việc.'},
          {en: 'Let\'s agree on the timeline and the budget.', vi: 'timeline = tiến độ; budget = ngân sách.'}
        ]
      },
      {
        title: {en: 'Measuring and agreements', vi: 'Đo lường và thỏa thuận'},
        phrases: [
          {en: 'Our KPI is the number of active users per month.', vi: 'KPI = chỉ số hiệu suất chính.'},
          {en: 'The SLA says we must respond to critical issues within one hour.', vi: 'SLA = thỏa thuận mức dịch vụ.'},
          {en: 'What\'s the return on investment for this feature?', vi: 'ROI = lợi tức đầu tư.'},
          {en: 'We\'ll sign off on the requirements by Friday.', vi: 'sign off = chính thức phê duyệt.'},
          {en: 'The change request needs approval from the client.', vi: 'change request = yêu cầu thay đổi.'},
          {en: 'This is a proof of concept, not a production-ready solution.', vi: 'proof of concept (PoC) = bản thử nghiệm ý tưởng.'},
          {en: 'The go-live date is the first of March.', vi: 'go-live = ngày chính thức vận hành.'}
        ]
      },
      {
        title: {en: 'Technical verbs you hear every day', vi: 'Động từ kỹ thuật nghe hằng ngày'},
        phrases: [
          {en: 'Let\'s bump the library to the latest patch version.', vi: 'bump = nâng phiên bản (thường là nâng nhỏ).'},
          {en: 'This endpoint is deprecated and will be removed next quarter.', vi: 'deprecate = đánh dấu sắp ngừng hỗ trợ.'},
          {en: 'Please revert that commit. It broke the build.', vi: 'revert = hoàn tác một commit.'},
          {en: 'I scaffolded the new module with the project template.', vi: 'scaffold = tạo khung ban đầu.'},
          {en: 'We patched the server last night.', vi: 'patch = vá lỗi.'},
          {en: 'Can you spin up a test environment for the demo?', vi: 'spin up = dựng nhanh (môi trường, server).'},
          {en: 'We tore down the old cluster after the migration.', vi: 'tear down = gỡ bỏ, dỡ (hạ tầng).'},
          {en: 'Let\'s stub the payment service in this test.', vi: 'stub = giả lập đơn giản một dependency.'},
          {en: 'The job was throttled because we hit the API limit.', vi: 'throttle = bị giới hạn tốc độ.'},
          {en: 'I\'ll hard-code it for now and make it configurable later.', vi: 'hard-code = viết cứng giá trị trong code.'}
        ]
      },
      {
        title: {en: 'Meeting vocabulary', vi: 'Từ vựng cuộc họp'},
        phrases: [
          {en: 'I\'ll send the agenda the day before.', vi: 'agenda = chương trình họp.'},
          {en: 'Lan will take the minutes.', vi: 'minutes = biên bản cuộc họp (không phải "phút").'},
          {en: 'Let\'s review the action items from last week.', vi: 'action items = các việc cần làm sau họp.'},
          {en: 'Any other business before we finish?', vi: 'AOB (any other business) = còn việc gì khác không.'},
          {en: 'The meeting was postponed, not cancelled.', vi: 'postponed = hoãn; cancelled = hủy.'},
          {en: 'Can you chair the meeting while I\'m away?', vi: 'chair = chủ trì cuộc họp.'},
          {en: 'This is a recurring meeting every Tuesday.', vi: 'recurring = định kỳ, lặp lại.'}
        ]
      },
      {
        title: {en: 'Basic contract and legal words', vi: 'Từ vựng hợp đồng và pháp lý cơ bản'},
        phrases: [
          {en: 'We signed an NDA before the client shared their data.', vi: 'NDA = thỏa thuận bảo mật, ký trước khi khách hàng chia sẻ dữ liệu.'},
          {en: 'The contract includes a penalty if we miss the deadline.', vi: 'penalty = khoản phạt.'},
          {en: 'Who owns the intellectual property for this code?', vi: 'intellectual property (IP) = sở hữu trí tuệ.'},
          {en: 'The terms and conditions must be approved by legal.', vi: 'terms and conditions = điều khoản và điều kiện; legal = bộ phận pháp chế.'},
          {en: 'Personal data must be handled according to the data protection law.', vi: 'data protection law = luật bảo vệ dữ liệu cá nhân.'},
          {en: 'The contract can be renewed every year.', vi: 'renew = gia hạn.'}
        ]
      }
    ],
    templates: []
  },
  {
    id: 'product',
    groups: [
      {
        title: {en: 'Discussing user stories', vi: 'Thảo luận user story'},
        phrases: [
          {en: 'As a cardholder, I want to see my due date, so that I don\'t pay late.', vi: 'Cấu trúc user story: As a [ai], I want [gì], so that [vì sao].'},
          {en: 'What problem does this solve for the user?', vi: 'Việc này giải quyết vấn đề gì cho người dùng?'},
          {en: 'How will we know this feature is successful?', vi: 'Làm sao biết tính năng này thành công?'},
          {en: 'Can we ship a smaller version first and learn from it?', vi: 'Mình phát hành bản nhỏ trước để học hỏi được không?'},
          {en: 'This is an edge case. How often does it actually happen?', vi: 'Đây là trường hợp biên. Thực tế nó xảy ra thường xuyên cỡ nào?'}
        ]
      },
      {
        title: {en: 'Giving feedback on designs', vi: 'Góp ý thiết kế'},
        tip: {en: 'Start with what works, then raise technical constraints as questions, not as "no".', vi: 'Bắt đầu bằng điểm tốt, rồi nêu ràng buộc kỹ thuật dưới dạng câu hỏi, không phải "không được".'},
        phrases: [
          {en: 'I like how clean this screen is.', vi: 'Mình thích màn hình này gọn gàng.'},
          {en: 'What should we show while the data is loading?', vi: 'Trong lúc tải dữ liệu thì hiển thị gì?'},
          {en: 'What happens on this screen when the list is empty, or when there\'s an error?', vi: 'Màn hình này xử lý ra sao khi danh sách trống hoặc khi có lỗi?'},
          {en: 'How should this look on a small mobile screen?', vi: 'Trên màn hình điện thoại nhỏ thì trông thế nào?'},
          {en: 'The contrast of this grey text might be too low in dark mode.', vi: 'Độ tương phản chữ xám này có thể quá thấp ở chế độ tối.'},
          {en: 'This animation is nice, but it may be slow on older phones. Is it essential?', vi: 'Hiệu ứng này đẹp nhưng có thể chậm trên điện thoại cũ. Có bắt buộc không?'},
          {en: 'Could we reuse the existing table component here?', vi: 'Mình dùng lại component bảng có sẵn ở đây được không?'}
        ]
      },
      {
        title: {en: 'Technical constraints and estimates', vi: 'Ràng buộc kỹ thuật và ước lượng'},
        phrases: [
          {en: 'The API doesn\'t return that field yet, so we\'d need a backend change.', vi: 'API chưa trả về trường đó nên cần sửa backend.'},
          {en: 'Real-time updates are possible, but polling every minute would be much simpler.', vi: 'Cập nhật real time làm được, nhưng polling mỗi phút đơn giản hơn nhiều.'},
          {en: 'This layout is easy, but the drag-and-drop part will take a few more days.', vi: 'Bố cục này dễ, nhưng phần kéo thả sẽ mất thêm vài ngày.'},
          {en: 'Let\'s build it behind a feature flag and test it with a few users.', vi: 'Làm sau feature flag và thử với một vài người dùng.'}
        ]
      },
      {
        title: {en: 'Discussing metrics with a product manager', vi: 'Bàn về chỉ số với product manager'},
        phrases: [
          {en: 'What metric do we want this feature to improve?', vi: 'Mình muốn tính năng này cải thiện chỉ số nào?'},
          {en: 'We can track how many users finish the flow and where they drop off.', vi: 'Có thể theo dõi bao nhiêu người hoàn tất luồng và họ bỏ dở ở đâu.'},
          {en: 'The conversion rate went from twelve to fifteen percent after the change.', vi: 'Tỉ lệ chuyển đổi tăng từ 12% lên 15% sau thay đổi.'},
          {en: 'Should we run an A/B test before rolling it out to everyone?', vi: 'Có nên chạy A/B test trước khi triển khai cho mọi người không?'},
          {en: 'We need about two weeks of data before we can draw conclusions.', vi: 'Cần khoảng hai tuần dữ liệu mới có thể kết luận.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Feedback on a design', vi: 'Góp ý cho một thiết kế'},
        body: `I really like [what works well].
A few questions: what should happen when [loading or empty or error]?
On mobile, [concern].
Technically, [part] needs [backend change or extra days], so could we [simpler alternative] for the first version?`
      }
    ]
  },
  {
    id: 'phone',
    groups: [
      {
        title: {en: 'Making and answering calls', vi: 'Gọi và nghe máy'},
        phrases: [
          {en: 'Hello, this is Kira from the backend team at Kira Life.', vi: 'Xin chào, tôi là Kira, nhóm backend của Kira Life.'},
          {en: 'I\'m calling about the API integration.', vi: 'Tôi gọi về việc tích hợp API.'},
          {en: 'Is now a good time to talk?', vi: 'Bây giờ anh/chị tiện nói chuyện không?'},
          {en: 'Could I speak to someone from technical support?', vi: 'Tôi có thể nói chuyện với bộ phận hỗ trợ kỹ thuật không?'},
          {en: 'Speaking. How can I help you?', vi: 'Tôi đây. Tôi giúp gì được cho anh/chị? (khi người ta hỏi đúng tên mình)'},
          {en: 'One moment, please. I\'ll put you through.', vi: 'Xin chờ một chút, tôi chuyển máy cho anh/chị.'}
        ]
      },
      {
        title: {en: 'During the call', vi: 'Trong cuộc gọi'},
        phrases: [
          {en: 'Sorry, the line is bad. Could you repeat that?', vi: 'Xin lỗi, đường truyền kém. Anh/chị nhắc lại được không?'},
          {en: 'Let me read that back to you: the reference number is K-B-four-five-two.', vi: 'Để tôi đọc lại: mã tham chiếu là KB452.'},
          {en: 'Could you spell your email address, please?', vi: 'Anh/chị đánh vần email giúp tôi được không?'},
          {en: 'I\'m writing that down now.', vi: 'Tôi đang ghi lại.'},
          {en: 'Could you send me the details by email as well?', vi: 'Anh/chị gửi thêm chi tiết qua email được không?'}
        ]
      },
      {
        title: {en: 'Messages and ending the call', vi: 'Để lại lời nhắn và kết thúc'},
        phrases: [
          {en: 'He\'s not available right now. Can I take a message?', vi: 'Anh ấy hiện không có ở đây. Tôi ghi lại lời nhắn nhé?'},
          {en: 'Could you ask her to call me back when she\'s free?', vi: 'Nhờ chị nhắn cô ấy gọi lại cho tôi khi rảnh nhé?'},
          {en: 'Hi, this is Kira. I\'m calling about the failed transfers. Please call me back on this number.', vi: 'Lời nhắn thoại mẫu: tên, lý do gọi, đề nghị gọi lại.'},
          {en: 'Thanks for your help. Have a nice day.', vi: 'Cảm ơn sự hỗ trợ. Chúc một ngày tốt lành.'}
        ]
      },
      {
        title: {en: 'Conference calls and dial-in', vi: 'Họp qua điện thoại và quay số tham gia'},
        phrases: [
          {en: 'Please dial in using the number in the invite, then enter the meeting ID.', vi: 'Vui lòng gọi vào số trong lời mời, rồi nhập mã cuộc họp.'},
          {en: 'Hi, Kira joining. Sorry I\'m a few minutes late.', vi: 'Chào mọi người, Kira vừa vào. Xin lỗi mình đến muộn vài phút.'},
          {en: 'Who just joined?', vi: 'Ai vừa tham gia vậy?'},
          {en: 'There\'s an echo. Could everyone who isn\'t speaking please mute?', vi: 'Đang bị vọng tiếng. Ai không nói vui lòng tắt mic nhé.'},
          {en: 'Sorry, could you say your name before you speak? It\'s hard to tell voices apart.', vi: 'Xin lỗi, mọi người nói tên trước khi phát biểu được không? Khó phân biệt giọng.'}
        ]
      },
      {
        title: {en: 'Confirming an appointment or delivery', vi: 'Xác nhận lịch hẹn hoặc giao hàng'},
        phrases: [
          {en: 'I\'m calling to confirm our meeting on Thursday at two.', vi: 'Tôi gọi để xác nhận cuộc hẹn vào thứ Năm lúc 2 giờ.'},
          {en: 'Could you remind me of the address?', vi: 'Anh/chị nhắc lại giúp tôi địa chỉ được không?'},
          {en: 'The new laptops are being delivered to our office tomorrow, right?', vi: 'Laptop mới sẽ được giao tới văn phòng chúng tôi ngày mai, đúng không?'},
          {en: 'Please call reception when you arrive, and someone will come down.', vi: 'Khi đến nơi vui lòng gọi lễ tân, sẽ có người xuống đón.'},
          {en: 'Thanks for confirming. See you on Thursday.', vi: 'Cảm ơn đã xác nhận. Hẹn gặp thứ Năm.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Calling a vendor\'s support line', vi: 'Gọi tới tổng đài hỗ trợ của nhà cung cấp'},
        body: `Hello, this is [name] from [company]. Our account ID is [ID].
I'm calling because [problem] since [time].
We've already tried [steps].
Could you check [request]? Is there a ticket number I can use to follow up?
Thank you. Could you also send a summary by email to [address]?`
      }
    ]
  },
  {
    id: 'cv',
    groups: [
      {
        title: {en: 'Action verbs for achievements', vi: 'Động từ hành động khi kể thành tích'},
        tip: {en: 'Start each CV bullet with a past-tense action verb, then add the result with a number. Avoid "responsible for".', vi: 'Mỗi gạch đầu dòng CV bắt đầu bằng động từ quá khứ, rồi thêm kết quả kèm con số. Tránh "responsible for".'},
        phrases: [
          {en: 'Designed and built a REST API for credit card statements used by ten thousand customers.', vi: 'designed, built = thiết kế, xây dựng.'},
          {en: 'Reduced report generation time by sixty percent by adding indexes and caching.', vi: 'reduced … by … = giảm … được …'},
          {en: 'Migrated five services from Spring Boot 2 to Spring Boot 3 with zero downtime.', vi: 'migrated = chuyển đổi, nâng cấp.'},
          {en: 'Led a team of three developers to deliver the payment module on time.', vi: 'led = dẫn dắt.'},
          {en: 'Automated the release pipeline, cutting deployment time from one hour to ten minutes.', vi: 'automated = tự động hóa; cutting … from … to … = giảm từ … xuống …'},
          {en: 'Mentored two junior developers who now work independently.', vi: 'mentored = kèm cặp.'},
          {en: 'Improved test coverage from forty to eighty-five percent.', vi: 'improved … from … to … = cải thiện từ … lên …'},
          {en: 'Collaborated with the product and QA teams to define acceptance criteria.', vi: 'collaborated with = phối hợp với.'}
        ]
      },
      {
        title: {en: 'Summary and skills', vi: 'Phần giới thiệu và kỹ năng'},
        phrases: [
          {en: 'Backend developer with five years of experience in Java and Spring Boot.', vi: 'Câu mở đầu CV: vai trò + số năm kinh nghiệm + công nghệ chính.'},
          {en: 'Experienced in building secure financial APIs and event-driven systems.', vi: 'experienced in = có kinh nghiệm về.'},
          {en: 'Strong background in SQL performance tuning.', vi: 'strong background in = nền tảng vững về.'},
          {en: 'Familiar with Docker, Kubernetes and CI/CD pipelines.', vi: 'familiar with = đã làm quen, biết dùng (mức thấp hơn experienced).'},
          {en: 'Fluent in Vietnamese, professional working proficiency in English.', vi: 'Cách ghi trình độ ngôn ngữ: fluent / professional working proficiency.'},
          {en: 'Open to backend and full-stack roles in fintech.', vi: 'open to = sẵn sàng với cơ hội…'}
        ]
      },
      {
        title: {en: 'Networking messages', vi: 'Tin nhắn kết nối'},
        phrases: [
          {en: 'Hi Anna, I saw your post about the backend role at your company.', vi: 'Mở đầu tin nhắn LinkedIn: nêu lý do liên hệ.'},
          {en: 'I have five years of experience with Java and Spring, and I think I\'d be a good fit.', vi: 'Nêu ngắn gọn điểm phù hợp.'},
          {en: 'Would you be open to a short call to tell me more about the team?', vi: 'Đề nghị một cuộc gọi ngắn.'},
          {en: 'Could you refer me for this position?', vi: 'Bạn giới thiệu (refer) mình cho vị trí này được không?'},
          {en: 'Thanks for connecting! Great to meet you at the meetup.', vi: 'Cảm ơn đã kết nối! Rất vui được gặp ở buổi meetup.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'CV bullet formula', vi: 'Công thức gạch đầu dòng CV'},
        body: `[Action verb] [what you did] [using which technology], [result with a number].
Example: Built an idempotent payment API with Spring Boot and MySQL, preventing duplicate charges for 50,000 monthly transactions.`
      },
      {
        title: {en: 'LinkedIn headline and summary', vi: 'Headline và phần giới thiệu LinkedIn'},
        body: `Headline: [Role] | [Main tech] | [Domain]
Example: Backend Developer | Java, Spring Boot, MySQL | Fintech

Summary: I'm a [role] with [number] years of experience building [kind of systems].
Recently, I [achievement with a number].
I enjoy [what you like], and I'm currently interested in [goal or topic].`
      }
    ]
  },
  {
    id: 'linking',
    groups: [
      {
        title: {en: 'Comparing two options', vi: 'So sánh hai phương án'},
        tip: {en: 'For "X vs Y" questions: say what both have in common, then the key difference, then when you would choose each.', vi: 'Với câu hỏi "X vs Y": nêu điểm chung, rồi khác biệt chính, rồi khi nào chọn cái nào.'},
        phrases: [
          {en: 'Both of them solve the same problem, but in different ways.', vi: 'Cả hai đều giải quyết cùng một vấn đề, nhưng theo cách khác nhau.'},
          {en: 'The main difference is that Kafka keeps messages, whereas RabbitMQ deletes them after they\'re acknowledged.', vi: 'whereas = trong khi đó (đối lập).'},
          {en: 'REST is simpler. On the other hand, gRPC is faster for internal calls.', vi: 'On the other hand = mặt khác.'},
          {en: 'Unlike a HashMap, a ConcurrentHashMap is safe for concurrent writes.', vi: 'Unlike X, Y … = không giống X, Y…'},
          {en: 'MySQL is a better fit for transactions, while MongoDB is more flexible for documents.', vi: 'a better fit for = phù hợp hơn cho.'},
          {en: 'Virtual threads are much cheaper than platform threads.', vi: 'much + so sánh hơn: much cheaper, much faster, much simpler.'},
          {en: 'It\'s by far the most common cause of slow queries.', vi: 'by far the most… = …nhất, hơn hẳn.'},
          {en: 'In most cases I\'d choose the first option, unless we need replay.', vi: 'unless = trừ khi.'}
        ]
      },
      {
        title: {en: 'Cause and effect', vi: 'Nguyên nhân và kết quả'},
        phrases: [
          {en: 'The job failed because the file was too large.', vi: 'because + mệnh đề.'},
          {en: 'The delay was due to a missing API key.', vi: 'due to + danh từ = do, bởi vì.'},
          {en: 'The cache expired at the same time, which led to a spike in database load.', vi: 'which led to = điều đó dẫn tới.'},
          {en: 'As a result, users saw timeouts for ten minutes.', vi: 'As a result = kết quả là.'},
          {en: 'That\'s why we added random jitter to the TTL.', vi: 'That\'s why = đó là lý do.'},
          {en: 'Since the service is stateless, we can scale it easily.', vi: 'Since = vì (lý do đã biết).'},
          {en: 'If the token expires, the interceptor refreshes it; otherwise, the request continues.', vi: 'otherwise = nếu không thì.'}
        ]
      },
      {
        title: {en: 'Structuring an explanation', vi: 'Sắp xếp ý khi giải thích'},
        phrases: [
          {en: 'There are three main reasons.', vi: 'Có ba lý do chính.'},
          {en: 'First of all, it\'s simpler to maintain.', vi: 'Trước hết, nó dễ bảo trì hơn.'},
          {en: 'On top of that, it\'s cheaper to run.', vi: 'Thêm vào đó, chi phí vận hành thấp hơn.'},
          {en: 'However, there\'s one drawback.', vi: 'Tuy nhiên, có một nhược điểm.'},
          {en: 'For example, when two users pay at the same time…', vi: 'Ví dụ, khi hai người dùng thanh toán cùng lúc…'},
          {en: 'In other words, the database is the bottleneck.', vi: 'Nói cách khác, database là điểm nghẽn.'},
          {en: 'To sum up, I\'d go with the queue-based design.', vi: 'Tóm lại, mình sẽ chọn thiết kế dùng hàng đợi.'}
        ]
      },
      {
        title: {en: 'Trade-offs and conditions', vi: 'Đánh đổi và điều kiện'},
        phrases: [
          {en: 'The trade-off is more complexity for better performance.', vi: 'Đánh đổi là phức tạp hơn để có hiệu năng tốt hơn.'},
          {en: 'It depends on the read-to-write ratio.', vi: 'Còn tùy vào tỉ lệ đọc/ghi.'},
          {en: 'As long as the consumer is idempotent, retries are safe.', vi: 'As long as = miễn là.'},
          {en: 'Even if Redis goes down, the API still works, just more slowly.', vi: 'Even if = kể cả khi.'},
          {en: 'It works well up to a point, but beyond a few hundred million rows we\'d need partitioning.', vi: 'up to a point = tới một mức nào đó.'}
        ]
      },
      {
        title: {en: 'Giving examples and adding detail', vi: 'Đưa ví dụ và bổ sung chi tiết'},
        phrases: [
          {en: 'For instance, a refund should create a new ledger entry.', vi: 'For instance = ví dụ như.'},
          {en: 'Some data, such as card numbers, must never be logged.', vi: 'such as = chẳng hạn như.'},
          {en: 'In particular, the export job is very slow.', vi: 'In particular = đặc biệt là.'},
          {en: 'That is to say, we only need the summary, not the details.', vi: 'That is to say = nghĩa là, tức là.'},
          {en: 'To give you an idea, the table has about fifty million rows.', vi: 'To give you an idea = để bạn hình dung.'},
          {en: 'What\'s more, it doesn\'t need any new infrastructure.', vi: 'What\'s more = hơn nữa.'}
        ]
      },
      {
        title: {en: 'Contrast and concession', vi: 'Đối lập và nhượng bộ'},
        phrases: [
          {en: 'Although the fix is small, it touches the payment flow, so we need a full test.', vi: 'although + mệnh đề = mặc dù.'},
          {en: 'Even though we were short on time, we didn\'t skip the review.', vi: 'even though = dù cho (nhấn mạnh hơn although).'},
          {en: 'Despite the delay, the client was happy with the result.', vi: 'despite + danh từ = bất chấp, mặc dù.'},
          {en: 'The first approach is faster. However, it\'s harder to maintain.', vi: 'However = tuy nhiên (đứng đầu câu, có dấu phẩy).'},
          {en: 'It works, but it isn\'t pretty.', vi: 'but = nhưng (dùng trong câu nói thường ngày).'},
          {en: 'In spite of the extra cost, we chose the managed database.', vi: 'in spite of + danh từ = mặc dù (giống despite).'}
        ]
      }
    ],
    templates: [
      {
        title: {en: '"X vs Y" answer', vi: 'Khung trả lời "X vs Y"'},
        body: `Both [X] and [Y] are used for [shared purpose].
The main difference is that [X] [key property], whereas [Y] [key property].
[X] is better when [situation]. On the other hand, [Y] is a better fit for [situation].
In my last project, we chose [X or Y] because [reason], and the trade-off was [cost].`
      }
    ]
  },
  {
    id: 'techdebt',
    groups: [
      {
        title: {en: 'Describing legacy code', vi: 'Mô tả legacy code'},
        phrases: [
          {en: 'This module was written ten years ago and has no tests.', vi: 'Module này viết từ mười năm trước và không có test.'},
          {en: 'The business logic is mixed with the database code.', vi: 'Logic nghiệp vụ bị trộn lẫn với code database.'},
          {en: 'Nobody on the team fully understands how this part works.', vi: 'Không ai trong nhóm hiểu hết phần này hoạt động thế nào.'},
          {en: 'It\'s a two-thousand-line class that does everything.', vi: 'Đó là một class 2.000 dòng làm mọi thứ (god class).'},
          {en: 'Every small change here breaks something else.', vi: 'Sửa nhỏ ở đây cũng làm hỏng chỗ khác.'},
          {en: 'The library we use is no longer maintained.', vi: 'Thư viện đang dùng không còn được bảo trì.'}
        ]
      },
      {
        title: {en: 'Making the case for refactoring', vi: 'Thuyết phục để được refactor'},
        tip: {en: 'Managers care about risk, speed and cost. Translate tech debt into those words, with numbers.', vi: 'Quản lý quan tâm rủi ro, tốc độ và chi phí. Chuyển nợ kỹ thuật thành những từ đó, kèm con số.'},
        phrases: [
          {en: 'Changes in this area take three times longer than anywhere else.', vi: 'Thay đổi ở khu vực này mất thời gian gấp ba chỗ khác.'},
          {en: 'Half of last quarter\'s production bugs came from this module.', vi: 'Một nửa số bug production quý trước đến từ module này.'},
          {en: 'If we don\'t upgrade, we\'ll lose security patches next year.', vi: 'Nếu không nâng cấp, năm sau sẽ không còn bản vá bảo mật.'},
          {en: 'I\'m not suggesting a big rewrite. Let\'s improve it step by step.', vi: 'Mình không đề xuất viết lại toàn bộ. Cải thiện từng bước thôi.'},
          {en: 'Could we spend about twenty percent of each sprint on tech debt?', vi: 'Mình dành khoảng 20% mỗi sprint cho nợ kỹ thuật được không?'},
          {en: 'We\'ll refactor the parts we touch for new features first.', vi: 'Ưu tiên refactor phần nào phải sửa cho tính năng mới.'}
        ]
      },
      {
        title: {en: 'Refactoring safely', vi: 'Refactor an toàn'},
        phrases: [
          {en: 'First, let\'s add characterization tests to capture the current behavior.', vi: 'Trước tiên, thêm test ghi lại hành vi hiện tại (characterization test).'},
          {en: 'We\'ll use the strangler pattern and move one endpoint at a time.', vi: 'Dùng strangler pattern, chuyển từng endpoint một.'},
          {en: 'The behavior stays exactly the same. Only the structure changes.', vi: 'Hành vi giữ nguyên hoàn toàn. Chỉ cấu trúc thay đổi.'},
          {en: 'Let\'s keep refactoring and feature changes in separate pull requests.', vi: 'Tách refactor và thay đổi tính năng thành các PR riêng.'},
          {en: 'We\'ll run the old and new code in parallel and compare the results.', vi: 'Chạy song song code cũ và mới rồi so sánh kết quả.'}
        ]
      },
      {
        title: {en: 'Upgrading frameworks and runtimes', vi: 'Nâng cấp framework và runtime'},
        phrases: [
          {en: 'Spring Boot two is out of support, so we need to upgrade this year.', vi: 'Spring Boot 2 đã hết hỗ trợ nên năm nay cần nâng cấp.'},
          {en: 'Let\'s upgrade one minor version at a time and fix deprecations as we go.', vi: 'Nâng từng phiên bản nhỏ một và sửa các phần deprecated dần dần.'},
          {en: 'The upgrade is mostly mechanical, but the security configuration needs a manual rewrite.', vi: 'Phần lớn việc nâng cấp là cơ học, nhưng cấu hình bảo mật cần viết lại thủ công.'},
          {en: 'We\'ll run both versions in staging for a week before switching.', vi: 'Chạy cả hai phiên bản trên staging một tuần trước khi chuyển hẳn.'},
          {en: 'Moving to Java twenty-five gives us virtual threads and long-term support.', vi: 'Chuyển sang Java 25 mang lại virtual thread và hỗ trợ dài hạn.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Tech debt proposal', vi: 'Đề xuất xử lý nợ kỹ thuật'},
        body: `Problem: [module] is [old or untested or tightly coupled].
Impact: [numbers: slower changes, bugs, incidents, security risk].
Proposal: [small step-by-step plan], about [effort] over [time].
Risk if we wait: [what gets worse].
How we'll measure success: [metric].`
      }
    ]
  },
  {
    id: 'meetup',
    groups: [
      {
        title: {en: 'Starting a conversation', vi: 'Bắt chuyện'},
        phrases: [
          {en: 'Hi, I\'m Kira. Is this your first time at this meetup?', vi: 'Chào, mình là Kira. Đây là lần đầu bạn đến meetup này à?'},
          {en: 'What did you think of the last talk?', vi: 'Bạn thấy bài nói vừa rồi thế nào?'},
          {en: 'What kind of projects are you working on?', vi: 'Bạn đang làm dự án kiểu gì?'},
          {en: 'Oh, you\'re using Kotlin? How do you like it compared to Java?', vi: 'Ồ, bạn dùng Kotlin à? So với Java bạn thấy sao?'},
          {en: 'I work on backend services for a fintech app.', vi: 'Mình làm backend service cho một ứng dụng fintech.'}
        ]
      },
      {
        title: {en: 'Asking the speaker a question', vi: 'Đặt câu hỏi cho diễn giả'},
        tip: {en: 'Thank the speaker, give one line of context, then ask one clear question.', vi: 'Cảm ơn diễn giả, nói một câu bối cảnh, rồi hỏi một câu rõ ràng.'},
        phrases: [
          {en: 'Thanks for the great talk. I have a question about the migration.', vi: 'Cảm ơn bài nói rất hay. Mình có câu hỏi về phần migration.'},
          {en: 'In our team, we have a similar problem with slow reports.', vi: 'Nhóm mình cũng gặp vấn đề tương tự với báo cáo chậm.'},
          {en: 'How did you convince management to invest in this?', vi: 'Làm sao anh thuyết phục ban lãnh đạo đầu tư cho việc này?'},
          {en: 'What would you do differently if you started again?', vi: 'Nếu làm lại từ đầu, anh sẽ làm khác điều gì?'},
          {en: 'Are the slides going to be shared?', vi: 'Slide có được chia sẻ không ạ?'}
        ]
      },
      {
        title: {en: 'Keeping in touch', vi: 'Giữ liên lạc'},
        phrases: [
          {en: 'It was great talking to you. Shall we connect on LinkedIn?', vi: 'Rất vui được nói chuyện. Mình kết nối LinkedIn nhé?'},
          {en: 'Here\'s my card. Feel free to message me.', vi: 'Đây là danh thiếp của mình. Cứ nhắn mình nhé.'},
          {en: 'I\'d love to hear how your migration goes.', vi: 'Mình rất muốn biết việc migration bên bạn diễn ra thế nào.'},
          {en: 'I\'m going to grab some food. Nice meeting you!', vi: 'Mình đi lấy đồ ăn đây. Rất vui được gặp bạn! (cách kết thúc cuộc trò chuyện lịch sự)'}
        ]
      },
      {
        title: {en: 'Open source and online communities', vi: 'Mã nguồn mở và cộng đồng online'},
        phrases: [
          {en: 'I opened an issue on GitHub with the steps to reproduce.', vi: 'Mình đã mở issue trên GitHub kèm các bước tái hiện.'},
          {en: 'Is anyone working on this issue? I\'d like to pick it up.', vi: 'Có ai đang làm issue này không? Mình muốn nhận.'},
          {en: 'I\'ve read the contributing guide and signed the CLA.', vi: 'Mình đã đọc hướng dẫn đóng góp và ký CLA.'},
          {en: 'Thanks for maintaining this library. It saved us a lot of time.', vi: 'Cảm ơn đã duy trì thư viện này. Nó giúp nhóm mình tiết kiệm rất nhiều thời gian.'},
          {en: 'I asked the question on Stack Overflow and included a minimal example.', vi: 'Mình đặt câu hỏi trên Stack Overflow kèm một ví dụ tối giản.'}
        ]
      },
      {
        title: {en: 'Online networking events', vi: 'Sự kiện networking online'},
        phrases: [
          {en: 'Hi everyone, I\'m Kira, a backend developer from Hanoi.', vi: 'Chào mọi người, mình là Kira, backend developer ở Hà Nội.'},
          {en: 'I\'m here to learn how other teams handle payments at scale.', vi: 'Mình tham gia để học cách các nhóm khác xử lý thanh toán quy mô lớn.'},
          {en: 'I\'ll drop my LinkedIn in the chat.', vi: 'Mình sẽ để link LinkedIn trong khung chat.'},
          {en: 'Great question in the chat. I\'d love to hear the speaker\'s answer too.', vi: 'Câu hỏi hay trong chat. Mình cũng muốn nghe diễn giả trả lời.'},
          {en: 'Thanks for organizing this. Will the recording be shared?', vi: 'Cảm ơn đã tổ chức. Bản ghi có được chia sẻ không?'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Thirty-second introduction', vi: 'Giới thiệu bản thân trong 30 giây'},
        body: `Hi, I'm [name]. I'm a [role] at [company], working on [product or domain].
Lately I've been [interesting thing you're doing], which has been [challenging or fun] because [reason].
I came today to learn more about [topic]. What brings you here?`
      }
    ]
  },
  {
    id: 'workshop',
    groups: [
      {
        title: {en: 'Facilitating', vi: 'Điều phối buổi workshop'},
        phrases: [
          {en: 'The goal of today\'s workshop is to agree on the new onboarding flow.', vi: 'Mục tiêu workshop hôm nay là thống nhất luồng onboarding mới.'},
          {en: 'Let\'s spend ten minutes writing ideas on sticky notes, individually.', vi: 'Mỗi người dành mười phút viết ý tưởng lên giấy note.'},
          {en: 'There are no bad ideas at this stage.', vi: 'Ở giai đoạn này không có ý tưởng nào là tồi.'},
          {en: 'Let\'s group similar ideas together.', vi: 'Mình gom các ý tưởng giống nhau lại.'},
          {en: 'Everyone gets three votes. Put a dot on the ideas you like most.', vi: 'Mỗi người có ba phiếu. Chấm vào ý tưởng bạn thích nhất.'},
          {en: 'We\'re running short on time, so let\'s pick the top two.', vi: 'Sắp hết giờ, mình chọn hai ý tưởng đứng đầu.'}
        ]
      },
      {
        title: {en: 'Contributing ideas', vi: 'Đóng góp ý tưởng'},
        phrases: [
          {en: 'What if we let users scan the receipt instead of typing?', vi: 'Nếu cho người dùng quét hóa đơn thay vì gõ tay thì sao?'},
          {en: 'Building on Lan\'s idea, we could also send a reminder.', vi: 'Phát triển thêm từ ý của Lan, mình có thể gửi thêm lời nhắc.'},
          {en: 'This might be a bit crazy, but hear me out.', vi: 'Ý này hơi điên rồ, nhưng nghe mình nói hết đã.'},
          {en: 'I like the direction, but how would we measure success?', vi: 'Mình thích hướng này, nhưng đo thành công bằng cách nào?'},
          {en: 'Can we park this idea for later? It\'s a bit out of scope.', vi: 'Mình tạm gác ý này lại được không? Nó hơi ngoài phạm vi.'}
        ]
      },
      {
        title: {en: 'Deciding and next steps', vi: 'Ra quyết định và bước tiếp theo'},
        phrases: [
          {en: 'Do we have consensus on this, or should we vote?', vi: 'Mình đã đồng thuận chưa, hay cần biểu quyết?'},
          {en: 'Can everyone live with this decision?', vi: 'Mọi người có chấp nhận được quyết định này không?'},
          {en: 'Let\'s build a quick prototype and test it with five users.', vi: 'Làm nhanh một prototype và thử với năm người dùng.'},
          {en: 'I\'ll share the photos of the board and a summary after the session.', vi: 'Sau buổi này mình sẽ chia sẻ ảnh bảng và bản tóm tắt.'}
        ]
      },
      {
        title: {en: 'Running an online workshop', vi: 'Điều phối workshop online'},
        phrases: [
          {en: 'I\'ve shared the Miro board link in the chat.', vi: 'Mình đã chia sẻ link bảng Miro trong chat.'},
          {en: 'Please add your sticky notes in the left column.', vi: 'Mọi người thêm giấy note vào cột bên trái.'},
          {en: 'I\'ll start a five-minute timer.', vi: 'Mình bật đồng hồ đếm ngược năm phút.'},
          {en: 'Let\'s go into breakout rooms of three people for ten minutes.', vi: 'Chia phòng nhỏ, mỗi phòng ba người, trong 10 phút.'},
          {en: 'Can each group share its top idea in one minute?', vi: 'Mỗi nhóm chia sẻ ý tưởng hàng đầu trong một phút được không?'}
        ]
      },
      {
        title: {en: 'Closing a workshop', vi: 'Kết thúc workshop'},
        phrases: [
          {en: 'Let\'s quickly recap what we decided today.', vi: 'Mình tóm tắt nhanh những gì đã quyết hôm nay.'},
          {en: 'Each idea we picked needs an owner and a date.', vi: 'Mỗi ý tưởng được chọn cần một người phụ trách và một hạn.'},
          {en: 'On a scale of one to five, how useful was this session?', vi: 'Trên thang 1 đến 5, buổi này hữu ích tới mức nào?'},
          {en: 'I\'ll share the board and the action items by tomorrow.', vi: 'Mai mình sẽ chia sẻ bảng và danh sách việc cần làm.'},
          {en: 'Thanks, everyone, for your energy and ideas.', vi: 'Cảm ơn mọi người vì năng lượng và ý tưởng.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Workshop agenda', vi: 'Agenda của workshop'},
        body: `Goal: by the end of this session, we'll [outcome].
1. Context (5 min): [problem].
2. Ideas (10 min): everyone writes ideas on sticky notes.
3. Group and vote (10 min): three votes each.
4. Next steps (5 min): owners and dates.`
      }
    ]
  },
  {
    id: 'walkthrough',
    groups: [
      {
        title: {en: 'Giving the big picture first', vi: 'Nói bức tranh tổng thể trước'},
        tip: {en: 'Start with what the code does and why, then walk through it in the order a request flows.', vi: 'Bắt đầu bằng code làm gì và tại sao, rồi đi theo thứ tự luồng request.'},
        phrases: [
          {en: 'At a high level, this class calculates the monthly statement.', vi: 'Nhìn tổng quát, class này tính sao kê hằng tháng.'},
          {en: 'The entry point is this controller method.', vi: 'Điểm bắt đầu là method này trong controller.'},
          {en: 'I\'ll walk you through it in the order the request flows.', vi: 'Mình sẽ đi qua theo thứ tự luồng request.'},
          {en: 'Most of the logic lives in the service layer.', vi: 'Phần lớn logic nằm ở tầng service.'},
          {en: 'You can ignore this part for now. It\'s just mapping.', vi: 'Tạm bỏ qua phần này. Nó chỉ là mapping dữ liệu.'}
        ]
      },
      {
        title: {en: 'Explaining the details', vi: 'Giải thích chi tiết'},
        phrases: [
          {en: 'Here we load the transactions for the billing period.', vi: 'Ở đây mình tải các giao dịch trong kỳ sao kê.'},
          {en: 'This loop groups them by category.', vi: 'Vòng lặp này nhóm chúng theo danh mục.'},
          {en: 'This check makes sure the user owns the card.', vi: 'Đoạn kiểm tra này đảm bảo người dùng sở hữu thẻ.'},
          {en: 'If the list is empty, we return early.', vi: 'Nếu danh sách rỗng thì trả về sớm.'},
          {en: 'We round only at the end, to avoid rounding errors.', vi: 'Chỉ làm tròn ở bước cuối để tránh sai số.'},
          {en: 'This is the tricky part, so let me slow down.', vi: 'Đây là phần khó, để mình nói chậm lại.'},
          {en: 'This looks strange, but it\'s there because of a bug in the old API.', vi: 'Trông lạ nhưng có lý do: để xử lý một bug của API cũ.'}
        ]
      },
      {
        title: {en: 'Inviting questions', vi: 'Mời đặt câu hỏi'},
        phrases: [
          {en: 'Does that make sense so far?', vi: 'Đến đây có hợp lý không?'},
          {en: 'Is there any part you\'d like me to go over again?', vi: 'Có phần nào bạn muốn mình giải thích lại không?'},
          {en: 'Feel free to stop me if something isn\'t clear.', vi: 'Có gì chưa rõ cứ ngắt lời mình nhé.'},
          {en: 'Would it help if I drew it on the whiteboard?', vi: 'Mình vẽ lên bảng có dễ hiểu hơn không?'}
        ]
      },
      {
        title: {en: 'Explaining configuration files', vi: 'Giải thích file cấu hình'},
        phrases: [
          {en: 'This YAML file defines the settings for each environment.', vi: 'File YAML này định nghĩa cấu hình cho từng môi trường.'},
          {en: 'The placeholders in capital letters are filled in from environment variables.', vi: 'Các placeholder viết hoa được điền giá trị từ biến môi trường.'},
          {en: 'This property turns the feature on only in staging.', vi: 'Thuộc tính này chỉ bật tính năng ở staging.'},
          {en: 'The connection pool size is set to ten here.', vi: 'Kích thước connection pool được đặt là 10 ở đây.'},
          {en: 'If this value is missing, the application fails at startup on purpose.', vi: 'Nếu thiếu giá trị này, ứng dụng cố ý lỗi khi khởi động.'}
        ]
      },
      {
        title: {en: 'Explaining a SQL query', vi: 'Giải thích một câu SQL'},
        phrases: [
          {en: 'This query finds customers who spent more than ten million this month.', vi: 'Query này tìm khách hàng chi tiêu hơn mười triệu trong tháng này.'},
          {en: 'First, it joins transactions with cards to get the owner.', vi: 'Đầu tiên, nó join bảng giao dịch với bảng thẻ để lấy chủ thẻ.'},
          {en: 'The WHERE clause keeps only settled transactions in the current month.', vi: 'Mệnh đề WHERE chỉ giữ giao dịch đã quyết toán trong tháng hiện tại.'},
          {en: 'Then it groups by customer and keeps the totals above the limit.', vi: 'Sau đó group theo khách hàng và giữ các tổng vượt ngưỡng.'},
          {en: 'It uses the index on card and date, so it runs in under a second.', vi: 'Nó dùng index trên thẻ và ngày nên chạy dưới một giây.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Code walkthrough script', vi: 'Kịch bản giải thích code'},
        body: `At a high level, this code [what it does] so that [why it matters].
The entry point is [class or method].
First, it [step 1]. Then it [step 2]. Finally, it [step 3].
The tricky part is [part], because [reason].
Does that make sense so far? Any part you'd like me to go over again?`
      }
    ]
  },
  {
    id: 'cloud',
    groups: [
      {
        title: {en: 'Where things run', vi: 'Hệ thống chạy ở đâu'},
        phrases: [
          {en: 'The service runs in the Singapore region, across two availability zones.', vi: 'Service chạy ở region Singapore, trên hai availability zone.'},
          {en: 'Static files are served from a CDN close to the users.', vi: 'File tĩnh được phân phối qua CDN gần người dùng.'},
          {en: 'We use a managed database, so the provider handles backups and patches.', vi: 'Dùng database được quản lý (managed) nên nhà cung cấp lo backup và vá lỗi.'},
          {en: 'Files are stored in an object storage bucket, not on the server disk.', vi: 'File lưu trong bucket object storage, không lưu trên ổ đĩa server.'},
          {en: 'The database is in a private subnet with no public access.', vi: 'Database nằm trong subnet riêng, không truy cập công khai được.'},
          {en: 'The containers run on Kubernetes, behind an ingress controller.', vi: 'Container chạy trên Kubernetes, phía sau ingress controller.'}
        ]
      },
      {
        title: {en: 'Scaling and cost', vi: 'Mở rộng và chi phí'},
        phrases: [
          {en: 'Autoscaling adds instances when CPU goes above seventy percent.', vi: 'Autoscaling thêm instance khi CPU vượt 70%.'},
          {en: 'We scale down at night to save cost.', vi: 'Ban đêm giảm quy mô để tiết kiệm chi phí.'},
          {en: 'Our cloud bill went up by thirty percent last month.', vi: 'Hóa đơn cloud tháng trước tăng 30%.'},
          {en: 'Most of the cost comes from data transfer, not compute.', vi: 'Phần lớn chi phí là truyền dữ liệu, không phải tính toán.'},
          {en: 'We could use reserved instances for the steady workload.', vi: 'Có thể dùng reserved instance cho tải ổn định.'},
          {en: 'Let\'s tag every resource with the team and the environment.', vi: 'Gắn tag cho mọi tài nguyên theo nhóm và môi trường.'}
        ]
      },
      {
        title: {en: 'Infrastructure as code and environments', vi: 'Hạ tầng dạng code và môi trường'},
        phrases: [
          {en: 'All infrastructure is defined in Terraform and reviewed like normal code.', vi: 'Toàn bộ hạ tầng định nghĩa bằng Terraform và được review như code bình thường.'},
          {en: 'Please don\'t change settings manually in the console.', vi: 'Đừng đổi cấu hình thủ công trên console.'},
          {en: 'We have three environments: development, staging and production.', vi: 'Có ba môi trường: development, staging và production.'},
          {en: 'Staging should be as close to production as possible.', vi: 'Staging nên giống production nhất có thể.'},
          {en: 'Backups are taken every night and kept for thirty days.', vi: 'Backup mỗi đêm và lưu trong 30 ngày.'},
          {en: 'When did we last test restoring from a backup?', vi: 'Lần cuối mình thử khôi phục từ backup là khi nào?'}
        ]
      },
      {
        title: {en: 'Working with cloud provider support', vi: 'Làm việc với hỗ trợ của nhà cung cấp cloud'},
        phrases: [
          {en: 'I\'ve opened a support case with the provider about the database latency.', vi: 'Mình đã mở yêu cầu hỗ trợ với nhà cung cấp về độ trễ database.'},
          {en: 'Their status page shows an incident in our region.', vi: 'Trang trạng thái của họ đang báo sự cố ở region của mình.'},
          {en: 'We\'re hitting a service quota. We need to request an increase.', vi: 'Nhóm đang chạm hạn mức dịch vụ. Cần xin tăng hạn mức.'},
          {en: 'Our support plan only guarantees a reply within one business day.', vi: 'Gói hỗ trợ của mình chỉ cam kết phản hồi trong một ngày làm việc.'},
          {en: 'Let\'s set up a billing alert so we\'re not surprised next month.', vi: 'Đặt cảnh báo chi phí để tháng sau không bị bất ngờ.'}
        ]
      }
    ],
    templates: []
  },
  {
    id: 'testingtalk',
    groups: [
      {
        title: {en: 'Kinds of tests', vi: 'Các loại test'},
        phrases: [
          {en: 'Unit tests check one class in isolation, and they run in milliseconds.', vi: 'Unit test kiểm tra một class tách biệt, chạy trong vài mili giây.'},
          {en: 'Integration tests check that our code works with a real database.', vi: 'Integration test kiểm tra code chạy đúng với database thật.'},
          {en: 'End-to-end tests go through the whole system, like a real user.', vi: 'Test end-to-end đi qua toàn hệ thống như người dùng thật.'},
          {en: 'A smoke test is a quick check that the main features still work.', vi: 'Smoke test là kiểm tra nhanh các tính năng chính vẫn chạy.'},
          {en: 'A regression test makes sure an old bug doesn\'t come back.', vi: 'Regression test đảm bảo bug cũ không quay lại.'},
          {en: 'We run a load test before every big release.', vi: 'Chạy load test trước mỗi bản phát hành lớn.'}
        ]
      },
      {
        title: {en: 'Discussing coverage and quality', vi: 'Thảo luận về độ phủ và chất lượng'},
        phrases: [
          {en: 'Coverage is eighty percent, but the important question is what isn\'t covered.', vi: 'Độ phủ là 80%, nhưng câu hỏi quan trọng là phần nào chưa được phủ.'},
          {en: 'We should test the edge cases, not only the happy path.', vi: 'Nên test các trường hợp biên, không chỉ luồng chạy suôn sẻ.'},
          {en: 'This test is too tightly coupled to the implementation.', vi: 'Test này phụ thuộc quá chặt vào cách cài đặt.'},
          {en: 'The test name should describe the behavior, like "rejects an expired card".', vi: 'Tên test nên mô tả hành vi, ví dụ "rejects an expired card".'},
          {en: 'Let\'s use a fixed clock so the test doesn\'t depend on the date.', vi: 'Dùng đồng hồ cố định để test không phụ thuộc ngày hiện tại.'},
          {en: 'The pipeline is red. Nobody merges until it\'s green again.', vi: 'Pipeline đang đỏ. Không ai merge cho tới khi xanh lại.'}
        ]
      },
      {
        title: {en: 'Test data', vi: 'Dữ liệu test'},
        phrases: [
          {en: 'Each test creates its own data and cleans it up.', vi: 'Mỗi test tự tạo dữ liệu và tự dọn dẹp.'},
          {en: 'We never use real customer data in test environments.', vi: 'Không bao giờ dùng dữ liệu khách hàng thật ở môi trường test.'},
          {en: 'Let\'s use a builder to create test objects with sensible defaults.', vi: 'Dùng builder để tạo object test với giá trị mặc định hợp lý.'},
          {en: 'The seed data for staging is anonymized.', vi: 'Dữ liệu mẫu cho staging đã được ẩn danh hóa.'}
        ]
      },
      {
        title: {en: 'Bug bashes and exploratory testing', vi: 'Bug bash và kiểm thử khám phá'},
        phrases: [
          {en: 'We\'re holding a bug bash on Thursday. Everyone tests the new app for an hour.', vi: 'Thứ Năm tổ chức bug bash: mọi người cùng test app mới trong một giờ.'},
          {en: 'Try to break it. Use strange inputs and unusual flows.', vi: 'Cố gắng làm hỏng nó. Dùng dữ liệu lạ và luồng bất thường.'},
          {en: 'Please log every issue in the shared sheet, even small ones.', vi: 'Ghi mọi lỗi vào bảng chung, kể cả lỗi nhỏ.'},
          {en: 'I found a crash when I rotate the phone during a payment.', vi: 'Mình phát hiện app crash khi xoay điện thoại lúc đang thanh toán.'},
          {en: 'Let\'s triage the findings tomorrow morning.', vi: 'Sáng mai mình phân loại các lỗi tìm được.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Test plan summary', vi: 'Tóm tắt kế hoạch kiểm thử'},
        body: `Scope: [feature].
Unit tests: [business rules covered].
Integration tests: [database or external API with Testcontainers or stubs].
Edge cases: [empty input or concurrency or expired data or permission denied].
Not covered: [what and why], risk [low or medium].`
      }
    ]
  },
  {
    id: 'consulting',
    groups: [
      {
        title: {en: 'Engagements and contracts', vi: 'Dự án tư vấn và hợp đồng'},
        tip: {en: 'In consulting, a project for a client is often called an "engagement".', vi: 'Trong tư vấn, một dự án cho khách hàng thường được gọi là "engagement".'},
        phrases: [
          {en: 'I\'m currently on a banking engagement in Singapore.', vi: 'Hiện tôi đang tham gia một engagement (dự án) ngân hàng ở Singapore.'},
          {en: 'The statement of work defines the scope and the deliverables.', vi: 'Statement of work (SOW) quy định phạm vi và sản phẩm bàn giao.'},
          {en: 'That request is outside the SOW, so it needs a change request.', vi: 'Yêu cầu đó nằm ngoài SOW nên cần một change request.'},
          {en: 'The kickoff meeting with the client is on Monday.', vi: 'Buổi kickoff (khởi động dự án) với khách hàng vào thứ Hai.'},
          {en: 'We report progress to the steering committee every month.', vi: 'Hằng tháng báo cáo tiến độ lên ban chỉ đạo (steering committee).'},
          {en: 'The engagement partner signs off on all client deliverables.', vi: 'Partner phụ trách dự án phê duyệt mọi sản phẩm gửi khách hàng.'}
        ]
      },
      {
        title: {en: 'Time and staffing', vi: 'Thời gian và nhân sự'},
        phrases: [
          {en: 'Please submit your timesheet by Friday.', vi: 'Vui lòng nộp timesheet (bảng chấm công) trước thứ Sáu.'},
          {en: 'Which charge code should I use for this task?', vi: 'Mình nên dùng mã tính phí (charge code) nào cho việc này?'},
          {en: 'Internal training isn\'t billable to the client.', vi: 'Đào tạo nội bộ không được tính phí (billable) cho khách hàng.'},
          {en: 'My utilization was low last month because I was between projects.', vi: 'Tỉ lệ sử dụng (utilization) tháng trước thấp vì tôi đang giữa hai dự án.'},
          {en: 'I\'m on the bench this week, so I can help with the proposal.', vi: 'Tuần này tôi chưa có dự án (on the bench) nên có thể hỗ trợ làm proposal.'},
          {en: 'Part of the team works onsite at the client, and the rest works offshore.', vi: 'Một phần nhóm làm onsite tại khách hàng, phần còn lại làm offshore.'}
        ]
      },
      {
        title: {en: 'Working with clients', vi: 'Làm việc với khách hàng'},
        phrases: [
          {en: 'Let\'s align on the client\'s expectations before the workshop.', vi: 'Mình thống nhất kỳ vọng của khách hàng trước buổi workshop.'},
          {en: 'I\'ll prepare a short deck for the client presentation.', vi: 'Tôi sẽ chuẩn bị một bộ slide ngắn cho buổi trình bày với khách hàng.'},
          {en: 'Our recommendation is to modernize the payment module first.', vi: 'Đề xuất của chúng tôi là hiện đại hóa module thanh toán trước.'},
          {en: 'This information is confidential, so please don\'t share it outside the engagement team.', vi: 'Thông tin này là bảo mật, vui lòng không chia sẻ ra ngoài nhóm dự án.'},
          {en: 'We need the client\'s approval before we access production data.', vi: 'Cần khách hàng phê duyệt trước khi truy cập dữ liệu production.'},
          {en: 'Let\'s document every decision so we have a clear audit trail.', vi: 'Ghi lại mọi quyết định để có dấu vết kiểm toán rõ ràng.'}
        ]
      },
      {
        title: {en: 'Proposals and commercial terms', vi: 'Đề xuất và điều khoản thương mại'},
        phrases: [
          {en: 'We\'re preparing a proposal in response to the client\'s RFP.', vi: 'Nhóm đang chuẩn bị đề xuất để trả lời RFP (request for proposal, hồ sơ mời gửi đề xuất) của khách hàng.'},
          {en: 'Is this a fixed-price engagement or time and materials?', vi: 'Dự án này là trọn gói (fixed price) hay tính theo thời gian và nguồn lực (time and materials)?'},
          {en: 'With a fixed price, the scope must be very clear before we start.', vi: 'Với trọn gói, phạm vi phải rất rõ ràng trước khi bắt đầu.'},
          {en: 'I\'ll estimate the effort for the technical part of the proposal.', vi: 'Tôi sẽ ước lượng công sức cho phần kỹ thuật của đề xuất.'},
          {en: 'We should list our assumptions and what\'s out of scope.', vi: 'Nên liệt kê các giả định và những gì nằm ngoài phạm vi.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Weekly client status email', vi: 'Email báo cáo tình trạng hằng tuần cho khách hàng'},
        body: `Subject: [Project name] — weekly status, week of [date]

Overall status: [Green or Amber or Red].
Completed this week: [items].
Planned next week: [items].
Risks and issues: [risk] — mitigation: [action], owner [name].
Decisions needed from you: [decision] by [date].`
      }
    ]
  },
  {
    id: 'jargon',
    groups: [
      {
        title: {en: 'Everyday developer jargon', vi: 'Tiếng lóng dev hằng ngày'},
        phrases: [
          {en: 'Let\'s cover the happy path first, then the edge cases.', vi: 'happy path = luồng chạy suôn sẻ; edge case = trường hợp biên.'},
          {en: 'Can you do a quick sanity check before I deploy?', vi: 'sanity check = kiểm tra nhanh xem có gì vô lý không.'},
          {en: 'This code is a bit of spaghetti. Everything depends on everything.', vi: 'spaghetti code = code rối như mì.'},
          {en: 'What does this magic number mean? Let\'s make it a constant.', vi: 'magic number = con số "thần bí" không giải thích.'},
          {en: 'That\'s just a band-aid. We still need a proper fix.', vi: 'band-aid = giải pháp chữa cháy tạm thời.'},
          {en: 'We\'re dogfooding the new app internally before the launch.', vi: 'dogfooding = tự dùng sản phẩm của mình trước.'},
          {en: 'Our bus factor is one: only Nam knows the billing code.', vi: 'bus factor = số người mà nếu nghỉ thì dự án gặp nguy.'},
          {en: 'This flag is a footgun. It\'s too easy to delete production data with it.', vi: 'footgun = tính năng dễ khiến người dùng tự hại mình.'}
        ]
      },
      {
        title: {en: 'Fun expressions you will hear', vi: 'Thành ngữ vui hay gặp'},
        phrases: [
          {en: 'Well, it works on my machine.', vi: '"Máy em chạy được mà" — câu đùa kinh điển khi lỗi chỉ xảy ra ở máy khác.'},
          {en: 'I found the bug by explaining it to a rubber duck.', vi: 'rubber duck debugging = giải thích code cho "con vịt cao su" và tự tìm ra lỗi.'},
          {en: 'I started fixing a test and ended up upgrading the whole build tool. Classic yak shaving.', vi: 'yak shaving = chuỗi việc phụ kéo dài trước khi làm được việc chính.'},
          {en: 'We spent an hour on the button color. Total bikeshedding.', vi: 'bikeshedding = tranh luận lâu về chuyện nhỏ, bỏ qua chuyện lớn.'},
          {en: 'Deploying on a Friday afternoon? Brave.', vi: 'Đùa về việc deploy chiều thứ Sáu — dễ phải sửa lỗi cuối tuần.'},
          {en: '"It\'s a one-line change." Famous last words.', vi: 'famous last words = câu nói tự tin trước khi mọi thứ hỏng.'},
          {en: 'It\'s not a bug, it\'s a feature.', vi: 'Câu đùa khi một lỗi được "biện minh" là tính năng.'},
          {en: 'Have you tried turning it off and on again?', vi: 'Câu đùa kinh điển của bộ phận IT: thử tắt đi bật lại chưa?'}
        ]
      },
      {
        title: {en: 'Reacting naturally', vi: 'Phản ứng tự nhiên'},
        phrases: [
          {en: 'Ha, I know that feeling.', vi: 'Haha, mình hiểu cảm giác đó.'},
          {en: 'Oh no, not again!', vi: 'Ôi không, lại nữa à!'},
          {en: 'Nice one!', vi: 'Hay đấy! / Làm tốt lắm!'},
          {en: 'That\'s a relief.', vi: 'Nhẹ cả người.'},
          {en: 'Fingers crossed for the release.', vi: 'Cầu may cho bản release nhé. (fingers crossed = chúc may mắn)'},
          {en: 'Just kidding. I\'ll fix it now.', vi: 'Đùa thôi. Mình sửa ngay đây.'}
        ]
      },
      {
        title: {en: 'Business and startup buzzwords', vi: 'Từ thời thượng trong kinh doanh và startup'},
        phrases: [
          {en: 'Let\'s ship an MVP first and learn from real users.', vi: 'MVP = minimum viable product, sản phẩm tối thiểu đủ dùng.'},
          {en: 'The company pivoted from lending to payments.', vi: 'pivot = đổi hướng kinh doanh.'},
          {en: 'We have about eighteen months of runway.', vi: 'runway = số tháng công ty còn hoạt động được với tiền hiện có.'},
          {en: 'This feature should move the needle on retention.', vi: 'move the needle = tạo khác biệt rõ rệt; retention = tỉ lệ giữ chân người dùng.'},
          {en: 'Let\'s circle back to this next week.', vi: 'circle back = quay lại bàn sau.'},
          {en: 'We need buy-in from the finance team.', vi: 'buy-in = sự đồng thuận, ủng hộ.'},
          {en: 'What\'s the business value of this feature?', vi: 'business value = giá trị kinh doanh.'},
          {en: 'That\'s a quick win. Let\'s do it this sprint.', vi: 'quick win = việc nhỏ làm nhanh mà có kết quả.'}
        ]
      }
    ],
    templates: []
  },
  {
    id: 'storytelling',
    groups: [
      {
        title: {en: 'Setting the scene', vi: 'Đặt bối cảnh'},
        tip: {en: 'Use the past simple for the main events and the past continuous for the background: "I was working on X when Y happened."', vi: 'Dùng quá khứ đơn cho sự kiện chính, quá khứ tiếp diễn cho bối cảnh: "I was working on X when Y happened."'},
        phrases: [
          {en: 'A couple of years ago, I was working on a payment platform for a bank.', vi: 'Vài năm trước, tôi đang làm một nền tảng thanh toán cho ngân hàng.'},
          {en: 'At that time, the team had just moved to microservices.', vi: 'Lúc đó, nhóm vừa mới chuyển sang microservices. (had just + V3)'},
          {en: 'We were preparing for a big release when the problem started.', vi: 'Nhóm đang chuẩn bị một bản release lớn thì vấn đề bắt đầu.'},
          {en: 'The context is important here: it was the end of the quarter.', vi: 'Bối cảnh rất quan trọng: lúc đó là cuối quý.'}
        ]
      },
      {
        title: {en: 'Moving the story forward', vi: 'Dẫn dắt câu chuyện'},
        phrases: [
          {en: 'At first, we thought it was a network issue.', vi: 'Ban đầu, nhóm nghĩ là lỗi mạng.'},
          {en: 'Then we noticed that only one region was affected.', vi: 'Sau đó, nhóm nhận ra chỉ một region bị ảnh hưởng.'},
          {en: 'It turned out that a config change had disabled the cache.', vi: 'Hóa ra một thay đổi cấu hình đã tắt cache. (it turned out that = hóa ra)'},
          {en: 'Meanwhile, the support team was getting a lot of calls.', vi: 'Trong khi đó, nhóm hỗ trợ nhận rất nhiều cuộc gọi.'},
          {en: 'As soon as we reverted the change, everything went back to normal.', vi: 'Ngay khi hoàn tác thay đổi, mọi thứ trở lại bình thường.'},
          {en: 'Eventually, we added a check to the pipeline.', vi: 'Cuối cùng, nhóm đã thêm một bước kiểm tra vào pipeline.'}
        ]
      },
      {
        title: {en: 'Ending with a result and a lesson', vi: 'Kết bằng kết quả và bài học'},
        phrases: [
          {en: 'In the end, we fixed it in under an hour.', vi: 'Cuối cùng, nhóm sửa xong trong chưa tới một giờ.'},
          {en: 'As a result, the error rate dropped to almost zero.', vi: 'Kết quả là tỉ lệ lỗi giảm gần như về không.'},
          {en: 'Looking back, I would have added monitoring much earlier.', vi: 'Nhìn lại, lẽ ra tôi nên thêm giám sát sớm hơn nhiều. (would have + V3)'},
          {en: 'The main thing I learned was to check recent changes first.', vi: 'Điều chính tôi học được là kiểm tra các thay đổi gần nhất trước.'},
          {en: 'Since then, we\'ve never had the same problem again.', vi: 'Từ đó đến nay, nhóm chưa gặp lại vấn đề đó. (since then + hiện tại hoàn thành)'}
        ]
      },
      {
        title: {en: 'A success story in thirty seconds', vi: 'Kể chuyện thành công trong 30 giây'},
        phrases: [
          {en: 'Last quarter, our monthly report took twenty minutes to load.', vi: 'Quý trước, báo cáo tháng mất 20 phút mới tải xong.'},
          {en: 'I found that it ran one query per customer.', vi: 'Mình phát hiện nó chạy một query cho mỗi khách hàng.'},
          {en: 'I rewrote it as a single aggregated query with the right index.', vi: 'Mình viết lại thành một query tổng hợp duy nhất với index phù hợp.'},
          {en: 'Now it loads in under ten seconds, and the finance team uses it every day.', vi: 'Giờ nó tải dưới 10 giây, và nhóm tài chính dùng nó mỗi ngày.'},
          {en: 'It taught me to measure before I optimize.', vi: 'Nó dạy mình phải đo trước khi tối ưu.'}
        ]
      },
      {
        title: {en: 'A short story about learning from a mistake', vi: 'Kể ngắn về một lần học từ sai lầm'},
        phrases: [
          {en: 'Early in my career, I deployed a change on a Friday evening without a rollback plan.', vi: 'Hồi mới đi làm, mình deploy một thay đổi vào tối thứ Sáu mà không có kế hoạch rollback.'},
          {en: 'It broke the login page, and I spent the whole night fixing it.', vi: 'Nó làm hỏng trang đăng nhập, và mình mất cả đêm để sửa.'},
          {en: 'Since then, I always check how to roll back before I deploy.', vi: 'Từ đó, mình luôn kiểm tra cách rollback trước khi deploy.'},
          {en: 'I also avoid releasing right before a weekend if I can.', vi: 'Mình cũng tránh phát hành ngay trước cuối tuần nếu có thể.'},
          {en: 'It was painful, but it made me a much more careful engineer.', vi: 'Đó là trải nghiệm đau, nhưng nó giúp mình trở thành kỹ sư cẩn thận hơn nhiều.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Story frame', vi: 'Khung kể chuyện'},
        body: `[Time ago], I was working on [project], and [background].
One day, [problem happened].
At first, we thought [first idea]. Then we noticed [clue].
It turned out that [root cause].
So I [action], and as a result, [result with a number].
Looking back, [lesson].`
      }
    ]
  },
  {
    id: 'questions',
    groups: [
      {
        title: {en: 'Indirect questions sound more polite', vi: 'Câu hỏi gián tiếp nghe lịch sự hơn'},
        tip: {en: 'In indirect questions, use normal word order: "Do you know where the logs are?", not "where are the logs".', vi: 'Trong câu hỏi gián tiếp, dùng trật tự câu bình thường: "Do you know where the logs are?", không phải "where are the logs".'},
        phrases: [
          {en: 'Do you know where the deployment script is?', vi: 'Bạn có biết script deploy nằm ở đâu không? (không nói "where is the script")'},
          {en: 'Could you tell me when the release is planned?', vi: 'Bạn cho mình biết khi nào dự kiến release được không?'},
          {en: 'I was wondering whether we could extend the deadline.', vi: 'Mình đang băn khoăn liệu có thể gia hạn deadline không.'},
          {en: 'Do you happen to know who owns this service?', vi: 'Bạn có tình cờ biết ai phụ trách service này không?'},
          {en: 'Would you mind explaining how the retry works?', vi: 'Bạn giải thích giúp cơ chế retry hoạt động thế nào được không?'}
        ]
      },
      {
        title: {en: 'Follow-up and clarifying questions', vi: 'Câu hỏi tiếp và câu hỏi làm rõ'},
        phrases: [
          {en: 'What do you mean by "soon"?', vi: '"Sớm" ở đây là khoảng bao lâu?'},
          {en: 'Could you give me an example?', vi: 'Bạn cho mình một ví dụ được không?'},
          {en: 'What happens if the user is offline?', vi: 'Nếu người dùng mất mạng thì sao?'},
          {en: 'Why did we choose this approach?', vi: 'Vì sao mình chọn cách làm này?'},
          {en: 'How would we measure that?', vi: 'Mình đo điều đó bằng cách nào?'},
          {en: 'Is there anything else I should know before I start?', vi: 'Có điều gì khác mình nên biết trước khi bắt đầu không?'}
        ]
      },
      {
        title: {en: 'Question tags and checking', vi: 'Câu hỏi đuôi và xác nhận'},
        phrases: [
          {en: 'The fix is on staging, isn\'t it?', vi: 'Bản sửa đã có trên staging rồi, phải không?'},
          {en: 'You haven\'t merged it yet, have you?', vi: 'Bạn chưa merge phải không?'},
          {en: 'We can deploy on Friday, can\'t we?', vi: 'Thứ Sáu mình deploy được, đúng không?'},
          {en: 'So the plan is to release on Monday. Is that right?', vi: 'Vậy kế hoạch là release thứ Hai. Đúng không?'},
          {en: 'Did I get that right?', vi: 'Mình hiểu vậy có đúng không?'}
        ]
      },
      {
        title: {en: 'Common question mistakes', vi: 'Lỗi hay gặp khi đặt câu hỏi'},
        phrases: [
          {en: 'What does this function return?', vi: 'Sai: "What this function returns?". Câu hỏi trực tiếp cần trợ động từ does.'},
          {en: 'Where did you put the file?', vi: 'Sai: "Where you put the file?". Quá khứ cần did.'},
          {en: 'Why isn\'t the build working?', vi: 'Sai: "Why the build is not working?". Đảo is lên trước chủ ngữ.'},
          {en: 'How long does the job take?', vi: 'Sai: "How long the job takes?".'},
          {en: 'Who changed this config?', vi: 'Khi hỏi về chủ ngữ (who/what), không cần did: "Who changed", không phải "Who did change".'}
        ]
      },
      {
        title: {en: 'Asking for opinions', vi: 'Hỏi ý kiến người khác'},
        phrases: [
          {en: 'What\'s your take on this approach?', vi: 'Bạn nghĩ sao về cách làm này? (what\'s your take = ý kiến của bạn)'},
          {en: 'How do you feel about moving the release to Monday?', vi: 'Bạn thấy sao nếu dời release sang thứ Hai?'},
          {en: 'Would you do it differently?', vi: 'Bạn có làm khác không?'},
          {en: 'Am I missing anything?', vi: 'Mình có bỏ sót gì không?'},
          {en: 'Is there a better way to do this?', vi: 'Có cách nào tốt hơn không?'},
          {en: 'Any concerns before we go ahead?', vi: 'Có lo ngại gì trước khi mình tiến hành không?'}
        ]
      }
    ],
    templates: []
  },
  {
    id: 'leadership',
    groups: [
      {
        title: {en: 'Setting direction', vi: 'Định hướng'},
        phrases: [
          {en: 'Our goal this quarter is to make payments faster and more reliable.', vi: 'Mục tiêu quý này là làm thanh toán nhanh hơn và ổn định hơn.'},
          {en: 'Here\'s why this matters for our users.', vi: 'Đây là lý do việc này quan trọng với người dùng.'},
          {en: 'If we have to choose, reliability comes before new features.', vi: 'Nếu phải chọn, độ ổn định được ưu tiên hơn tính năng mới.'},
          {en: 'Let\'s agree on what "done" means for this project.', vi: 'Mình thống nhất thế nào là "xong" cho dự án này.'},
          {en: 'I\'ll make the final call if we can\'t agree, but I want to hear everyone first.', vi: 'Mình sẽ quyết định cuối cùng nếu không thống nhất được, nhưng muốn nghe mọi người trước.'}
        ]
      },
      {
        title: {en: 'Delegating', vi: 'Giao việc'},
        tip: {en: 'Delegate the outcome, not every step. Say what done looks like and when to check in.', vi: 'Giao kết quả, không giao từng bước. Nói rõ thế nào là xong và khi nào cập nhật lại.'},
        phrases: [
          {en: 'Could you own the export feature from design to release?', vi: 'Bạn phụ trách tính năng xuất file từ thiết kế tới release được không?'},
          {en: 'You decide how to build it. Just keep the API contract we agreed on.', vi: 'Bạn tự quyết cách làm. Chỉ cần giữ đúng API contract đã thống nhất.'},
          {en: 'Let\'s check in on Wednesday to see how it\'s going.', vi: 'Thứ Tư mình cập nhật xem tiến độ thế nào nhé.'},
          {en: 'This is a good chance for you to learn the payments domain.', vi: 'Đây là cơ hội tốt để bạn học nghiệp vụ thanh toán.'},
          {en: 'If you get stuck, come to me early. That\'s not a failure.', vi: 'Nếu bí, cứ tìm mình sớm. Đó không phải là thất bại.'}
        ]
      },
      {
        title: {en: 'Motivating and protecting the team', vi: 'Động viên và bảo vệ nhóm'},
        phrases: [
          {en: 'Great work, everyone. The release went smoothly because of your preparation.', vi: 'Mọi người làm tốt lắm. Release suôn sẻ là nhờ sự chuẩn bị của các bạn.'},
          {en: 'I know this sprint was tough. Thanks for pushing through.', vi: 'Mình biết sprint này vất vả. Cảm ơn mọi người đã cố gắng.'},
          {en: 'I\'ll talk to the product owner about the scope, so you can focus on the code.', vi: 'Mình sẽ trao đổi với product owner về phạm vi để các bạn tập trung code.'},
          {en: 'Let\'s not add more work this sprint. We\'re already at capacity.', vi: 'Sprint này không nhận thêm việc nữa. Nhóm đã kín năng lực.'},
          {en: 'It\'s my responsibility as the lead, not yours.', vi: 'Đó là trách nhiệm của mình với vai trò lead, không phải của bạn.'}
        ]
      },
      {
        title: {en: 'Running a one-on-one as a lead', vi: 'Điều phối buổi 1-1 với vai trò lead'},
        phrases: [
          {en: 'This is your time. What would you like to talk about?', vi: 'Đây là thời gian của bạn. Bạn muốn nói về điều gì?'},
          {en: 'How are you feeling about your workload?', vi: 'Bạn thấy khối lượng công việc hiện tại thế nào?'},
          {en: 'What\'s one thing I could do to support you better?', vi: 'Có điều gì mình có thể làm để hỗ trợ bạn tốt hơn?'},
          {en: 'Last time you mentioned wanting more backend work. Here\'s an opportunity.', vi: 'Lần trước bạn nói muốn làm nhiều backend hơn. Đây là một cơ hội.'},
          {en: 'I\'ve noticed you\'ve been quieter in meetings. Is everything okay?', vi: 'Mình để ý dạo này bạn ít phát biểu trong họp. Mọi việc ổn chứ?'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Kickoff for a new team project', vi: 'Khởi động một dự án mới của nhóm'},
        body: `The goal of this project is [goal], because [why it matters].
Success means [measurable result] by [date].
[Name] will own [area], and [name] will own [area].
Our main risks are [risk], and we'll handle them by [plan].
We'll check progress every [frequency]. Questions so far?`
      }
    ]
  },
  {
    id: 'estimates',
    groups: [
      {
        title: {en: 'Giving an estimate', vi: 'Đưa ra ước lượng'},
        tip: {en: 'Give a range and your confidence, not a single exact number.', vi: 'Đưa ra một khoảng và mức độ tự tin, không đưa một con số chính xác duy nhất.'},
        phrases: [
          {en: 'My rough estimate is three to five days.', vi: 'Ước lượng sơ bộ của mình là ba đến năm ngày.'},
          {en: 'Best case two days, worst case a week, if the API is unclear.', vi: 'Tốt nhất hai ngày, tệ nhất một tuần nếu API không rõ ràng.'},
          {en: 'I\'m about eighty percent confident in that number.', vi: 'Mình tự tin khoảng 80% với con số đó.'},
          {en: 'That estimate doesn\'t include testing and code review.', vi: 'Ước lượng đó chưa bao gồm test và code review.'},
          {en: 'Can I give you a better estimate after a one-day spike?', vi: 'Sau một ngày spike, mình đưa ước lượng chính xác hơn được không?'},
          {en: 'It\'s hard to estimate until we see the data.', vi: 'Khó ước lượng cho tới khi xem được dữ liệu.'}
        ]
      },
      {
        title: {en: 'Committing and protecting a commitment', vi: 'Cam kết và giữ cam kết'},
        phrases: [
          {en: 'I can commit to the API by Friday. The UI will follow next week.', vi: 'Mình cam kết API trước thứ Sáu. UI sẽ xong tuần sau.'},
          {en: 'That\'s a target, not a promise, because of the dependency on the bank.', vi: 'Đó là mục tiêu, chưa phải lời hứa, vì còn phụ thuộc phía ngân hàng.'},
          {en: 'If the scope changes, the date will change too.', vi: 'Nếu phạm vi thay đổi thì ngày cũng sẽ thay đổi.'},
          {en: 'We\'re still on track for Friday.', vi: 'Nhóm vẫn đúng tiến độ cho thứ Sáu.'},
          {en: 'Friday is at risk. I\'ll know for sure by Wednesday.', vi: 'Ngày thứ Sáu đang có rủi ro trễ. Tới thứ Tư mình sẽ biết chắc.'}
        ]
      },
      {
        title: {en: 'Pushing back on unrealistic deadlines', vi: 'Phản biện deadline không thực tế'},
        phrases: [
          {en: 'I want to hit that date too, but it isn\'t realistic with the current scope.', vi: 'Mình cũng muốn kịp ngày đó, nhưng với phạm vi hiện tại thì không thực tế.'},
          {en: 'To make that date, we\'d have to drop the reports or add a developer.', vi: 'Để kịp ngày đó, phải bỏ phần báo cáo hoặc thêm một developer.'},
          {en: 'If we rush this, the risk of a production bug is high, especially for payments.', vi: 'Nếu làm vội, rủi ro lỗi production rất cao, nhất là với thanh toán.'},
          {en: 'What\'s driving the deadline? Maybe we can deliver the most important part first.', vi: 'Điều gì quyết định deadline này? Có thể mình giao phần quan trọng nhất trước.'}
        ]
      },
      {
        title: {en: 'Estimation techniques', vi: 'Kỹ thuật ước lượng'},
        phrases: [
          {en: 'Let\'s play planning poker. Everyone reveals their card at the same time.', vi: 'Mình chơi planning poker. Mọi người lật bài cùng lúc.'},
          {en: 'Story points measure complexity and risk, not hours.', vi: 'Story point đo độ phức tạp và rủi ro, không phải số giờ.'},
          {en: 'Compared to the login story, this one feels about twice as big.', vi: 'So với story đăng nhập, story này lớn khoảng gấp đôi.'},
          {en: 'For the roadmap, let\'s use T-shirt sizes: small, medium, large.', vi: 'Với lộ trình, dùng kích cỡ áo: S, M, L.'},
          {en: 'Our velocity has been around thirty points per sprint.', vi: 'Velocity của nhóm khoảng 30 điểm mỗi sprint.'},
          {en: 'Anything bigger than thirteen points should be split.', vi: 'Story nào lớn hơn 13 điểm thì nên chia nhỏ.'}
        ]
      },
      {
        title: {en: 'Mid-sprint status updates', vi: 'Cập nhật tiến độ giữa sprint'},
        phrases: [
          {en: 'We\'re on track. Five of the eight stories are done.', vi: 'Nhóm đang đúng tiến độ. Năm trên tám story đã xong.'},
          {en: 'We\'re slightly behind, but we can still make the sprint goal.', vi: 'Nhóm hơi chậm, nhưng vẫn có thể đạt mục tiêu sprint.'},
          {en: 'The payment story is at risk because the sandbox isn\'t ready.', vi: 'Story thanh toán đang có rủi ro vì môi trường sandbox chưa sẵn sàng.'},
          {en: 'We won\'t finish the report story this sprint. I suggest we move it to the next one.', vi: 'Story báo cáo không xong trong sprint này. Mình đề xuất chuyển sang sprint sau.'},
          {en: 'The burndown chart shows we\'re about two days behind.', vi: 'Biểu đồ burndown cho thấy nhóm chậm khoảng hai ngày.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Estimate with assumptions', vi: 'Ước lượng kèm giả định'},
        body: `Estimate: [range], with about [percent] confidence.
Assumptions: [API is ready or no design changes or test data available].
Not included: [testing or review or deployment].
Biggest risk: [risk]. I'll update the estimate by [date] after [spike or clarification].`
      }
    ]
  },
  {
    id: 'frontend',
    groups: [
      {
        title: {en: 'Layout and spacing', vi: 'Bố cục và khoảng cách'},
        phrases: [
          {en: 'Can we add more padding inside the card?', vi: 'Thêm padding (khoảng cách bên trong) cho thẻ được không?'},
          {en: 'There\'s too much margin between the two sections.', vi: 'Khoảng cách margin (bên ngoài) giữa hai phần quá lớn.'},
          {en: 'The button isn\'t vertically centered.', vi: 'Nút chưa được căn giữa theo chiều dọc.'},
          {en: 'Let\'s align the labels to the left and the amounts to the right.', vi: 'Căn nhãn sang trái và số tiền sang phải.'},
          {en: 'The text overflows the container on small screens.', vi: 'Chữ bị tràn khỏi khung trên màn hình nhỏ.'},
          {en: 'Use a grid with two columns on desktop and one column on mobile.', vi: 'Dùng grid hai cột trên desktop và một cột trên mobile.'},
          {en: 'The dropdown is hidden behind the header. It\'s a z-index issue.', vi: 'Dropdown bị header che. Đó là lỗi z-index.'}
        ]
      },
      {
        title: {en: 'Responsive and theming', vi: 'Responsive và giao diện'},
        phrases: [
          {en: 'At the tablet breakpoint, the table should become a list of cards.', vi: 'Ở breakpoint tablet, bảng nên chuyển thành danh sách thẻ.'},
          {en: 'There\'s a horizontal scroll on the phone. Something is too wide.', vi: 'Trên điện thoại có thanh cuộn ngang. Có phần tử nào đó quá rộng.'},
          {en: 'The text contrast is too low in dark mode.', vi: 'Độ tương phản chữ quá thấp ở chế độ tối.'},
          {en: 'Let\'s use the design tokens instead of hard-coded colors.', vi: 'Dùng design token thay vì mã màu viết cứng.'},
          {en: 'The font size is too small to read comfortably.', vi: 'Cỡ chữ quá nhỏ, khó đọc.'}
        ]
      },
      {
        title: {en: 'Browser and accessibility issues', vi: 'Lỗi trình duyệt và khả năng truy cập'},
        phrases: [
          {en: 'It works in Chrome, but the date picker looks broken in Safari.', vi: 'Chạy được trên Chrome, nhưng date picker bị vỡ trên Safari.'},
          {en: 'Can you open the dev tools and check the console for errors?', vi: 'Bạn mở dev tools và xem console có lỗi gì không?'},
          {en: 'Try a hard refresh. It might be a cached version.', vi: 'Thử tải lại cứng (hard refresh). Có thể đang là bản cache.'},
          {en: 'This icon button needs an accessible label for screen readers.', vi: 'Nút icon này cần nhãn truy cập cho trình đọc màn hình.'},
          {en: 'You can\'t reach this menu with the keyboard.', vi: 'Không dùng bàn phím để tới được menu này.'},
          {en: 'The focus outline disappeared after the last change.', vi: 'Viền focus biến mất sau lần sửa gần nhất.'}
        ]
      },
      {
        title: {en: 'Loading and updating data', vi: 'Tải và cập nhật dữ liệu'},
        phrases: [
          {en: 'Let\'s show a skeleton screen instead of a spinner while the list loads.', vi: 'Hiện khung xương (skeleton) thay vì vòng xoay khi danh sách đang tải.'},
          {en: 'The button should be disabled while the request is in progress.', vi: 'Nút nên bị vô hiệu hóa khi request đang chạy.'},
          {en: 'We update the UI optimistically and roll back if the request fails.', vi: 'Cập nhật giao diện ngay (optimistic) và hoàn tác nếu request lỗi.'},
          {en: 'The list should refresh after the user saves the form.', vi: 'Danh sách nên được làm mới sau khi người dùng lưu form.'},
          {en: 'Show a clear error message with a retry button.', vi: 'Hiện thông báo lỗi rõ ràng kèm nút thử lại.'}
        ]
      }
    ],
    templates: []
  },
  {
    id: 'mobile',
    groups: [
      {
        title: {en: 'Releases and stores', vi: 'Phát hành và chợ ứng dụng'},
        phrases: [
          {en: 'The new version is waiting for App Store review.', vi: 'Phiên bản mới đang chờ App Store duyệt.'},
          {en: 'Google Play rejected the build because of a permission issue.', vi: 'Google Play từ chối bản build vì vấn đề quyền truy cập.'},
          {en: 'We\'ll release it to ten percent of users first with a staged rollout.', vi: 'Phát hành cho 10% người dùng trước theo kiểu staged rollout.'},
          {en: 'We can push this fix over the air without a store release.', vi: 'Có thể đẩy bản sửa này qua OTA mà không cần phát hành lên store.'},
          {en: 'Many users are still on an old app version, so the API must stay backward compatible.', vi: 'Nhiều người vẫn dùng bản app cũ nên API phải tương thích ngược.'},
          {en: 'Let\'s force an update for versions older than two point zero.', vi: 'Bắt buộc cập nhật với các bản cũ hơn 2.0.'}
        ]
      },
      {
        title: {en: 'Device and network behavior', vi: 'Hành vi thiết bị và mạng'},
        phrases: [
          {en: 'The app crashes on Android twelve when the camera opens.', vi: 'App bị crash trên Android 12 khi mở camera.'},
          {en: 'What happens when the user loses the connection halfway through a payment?', vi: 'Chuyện gì xảy ra khi người dùng mất mạng giữa lúc thanh toán?'},
          {en: 'We cache the last statement so it works offline.', vi: 'Lưu cache sao kê gần nhất để dùng được khi offline.'},
          {en: 'Push notifications don\'t arrive when the app is in the background.', vi: 'Thông báo đẩy không đến khi app chạy nền.'},
          {en: 'The token is stored in the secure keychain, not in plain storage.', vi: 'Token được lưu trong keychain bảo mật, không lưu dạng thường.'},
          {en: 'The battery usage went up after the last release.', vi: 'Mức tiêu thụ pin tăng sau bản phát hành gần nhất.'}
        ]
      },
      {
        title: {en: 'Replying to app store reviews', vi: 'Trả lời đánh giá trên chợ ứng dụng'},
        phrases: [
          {en: 'Thanks for your feedback, and sorry about the trouble with logging in.', vi: 'Cảm ơn góp ý, và xin lỗi vì sự cố đăng nhập.'},
          {en: 'We\'ve fixed this in version two point three. Please update the app.', vi: 'Lỗi này đã được sửa ở phiên bản 2.3. Vui lòng cập nhật ứng dụng.'},
          {en: 'Could you contact our support team so we can look at your account?', vi: 'Bạn liên hệ bộ phận hỗ trợ để chúng tôi kiểm tra tài khoản nhé?'},
          {en: 'Dark mode is on our roadmap for next quarter.', vi: 'Chế độ tối nằm trong lộ trình quý tới.'},
          {en: 'We\'re glad you like the new statement screen!', vi: 'Rất vui vì bạn thích màn hình sao kê mới!'}
        ]
      }
    ],
    templates: []
  },
  {
    id: 'acceptance',
    groups: [
      {
        title: {en: 'Given, When, Then', vi: 'Cấu trúc Given – When – Then'},
        tip: {en: 'Given = the starting situation, When = the action, Then = the expected result. One behavior per scenario.', vi: 'Given = bối cảnh ban đầu, When = hành động, Then = kết quả mong đợi. Mỗi kịch bản một hành vi.'},
        phrases: [
          {en: 'Given a cardholder with an outstanding balance of two million dong,', vi: 'Given: cho trước một chủ thẻ có dư nợ hai triệu đồng,'},
          {en: 'When they pay the full statement balance before the due date,', vi: 'When: khi họ thanh toán đủ dư nợ sao kê trước hạn,'},
          {en: 'Then no interest is charged for that cycle.', vi: 'Then: thì không bị tính lãi cho kỳ đó.'},
          {en: 'And the statement shows the payment as completed.', vi: 'And: và sao kê hiển thị khoản thanh toán là đã hoàn tất.'},
          {en: 'Given the user is not the owner of the card, when they open it, then they see a not found error.', vi: 'Kịch bản phân quyền: không phải chủ thẻ thì nhận lỗi không tìm thấy.'}
        ]
      },
      {
        title: {en: 'Writing clear criteria', vi: 'Viết tiêu chí rõ ràng'},
        phrases: [
          {en: 'The criteria should be testable, so let\'s avoid words like "fast" or "easy".', vi: 'Tiêu chí phải kiểm tra được, nên tránh từ như "nhanh" hay "dễ".'},
          {en: 'Instead of "fast", let\'s say "the page loads in under two seconds".', vi: 'Thay vì "nhanh", hãy nói "trang tải dưới hai giây".'},
          {en: 'What should happen if the file is larger than ten megabytes?', vi: 'Nếu file lớn hơn 10 MB thì sao?'},
          {en: 'Let\'s add a scenario for the error case.', vi: 'Thêm một kịch bản cho trường hợp lỗi.'},
          {en: 'This criterion describes the implementation. Let\'s describe the behavior instead.', vi: 'Tiêu chí này đang mô tả cách cài đặt. Hãy mô tả hành vi.'},
          {en: 'Is this in scope, or should it be a separate story?', vi: 'Việc này trong phạm vi, hay nên là một story riêng?'}
        ]
      },
      {
        title: {en: 'Non-functional requirements', vi: 'Yêu cầu phi chức năng'},
        phrases: [
          {en: 'The page must load in under two seconds for ninety-five percent of requests.', vi: 'Trang phải tải dưới hai giây với 95% số request.'},
          {en: 'Only the card owner can see the statement.', vi: 'Chỉ chủ thẻ mới xem được sao kê.'},
          {en: 'Every change to the limit must be recorded in the audit log.', vi: 'Mọi thay đổi hạn mức phải được ghi vào nhật ký kiểm toán.'},
          {en: 'The screen must work with a keyboard and a screen reader.', vi: 'Màn hình phải dùng được bằng bàn phím và trình đọc màn hình.'},
          {en: 'The service must keep working if the notification provider is down.', vi: 'Service phải tiếp tục hoạt động nếu nhà cung cấp thông báo bị lỗi.'},
          {en: 'All user-facing text must be available in English and Vietnamese.', vi: 'Mọi nội dung chữ phải có tiếng Anh và tiếng Việt.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'User story with acceptance criteria', vi: 'User story kèm acceptance criteria'},
        body: `As a [type of user], I want [goal], so that [benefit].

Scenario: [happy path]
Given [starting situation]
When [action]
Then [expected result]

Scenario: [error case]
Given [situation]
When [invalid action]
Then [error message or behavior]`
      }
    ]
  },
  {
    id: 'sdinterview',
    groups: [
      {
        title: {en: 'Clarifying requirements', vi: 'Làm rõ yêu cầu'},
        tip: {en: 'Spend the first five minutes on requirements. Interviewers watch whether you ask before you design.', vi: 'Dành 5 phút đầu cho yêu cầu. Người phỏng vấn quan sát xem bạn có hỏi trước khi thiết kế không.'},
        phrases: [
          {en: 'Before I start, can I ask a few questions about the requirements?', vi: 'Trước khi bắt đầu, tôi hỏi vài câu về yêu cầu được không?'},
          {en: 'What are the most important features for the first version?', vi: 'Tính năng nào quan trọng nhất cho phiên bản đầu?'},
          {en: 'How many users do we expect, and how many requests per second at peak?', vi: 'Dự kiến bao nhiêu người dùng, và bao nhiêu request mỗi giây lúc cao điểm?'},
          {en: 'Is it more read-heavy or write-heavy?', vi: 'Hệ thống thiên về đọc hay về ghi?'},
          {en: 'Which matters more here: consistency or availability?', vi: 'Ở đây điều gì quan trọng hơn: tính nhất quán hay tính sẵn sàng?'},
          {en: 'Are there any latency requirements, for example under two hundred milliseconds?', vi: 'Có yêu cầu về độ trễ không, ví dụ dưới 200 ms?'},
          {en: 'Can I assume we don\'t need to support multiple regions at first?', vi: 'Tôi có thể giả định ban đầu chưa cần hỗ trợ nhiều region không?'}
        ]
      },
      {
        title: {en: 'Estimating scale', vi: 'Ước lượng quy mô'},
        phrases: [
          {en: 'Let me do a quick back-of-the-envelope estimate.', vi: 'Để tôi ước lượng nhanh trên giấy (back-of-the-envelope).'},
          {en: 'Ten million requests a day is roughly a hundred and twenty requests per second on average.', vi: '10 triệu request/ngày ≈ 120 request/giây trung bình.'},
          {en: 'At peak, let\'s assume five times the average.', vi: 'Lúc cao điểm, giả định gấp năm lần mức trung bình.'},
          {en: 'Each record is about one kilobyte, so that\'s around ten gigabytes a day.', vi: 'Mỗi bản ghi khoảng 1 KB, tức khoảng 10 GB mỗi ngày.'},
          {en: 'Over five years, we\'d need about eighteen terabytes of storage.', vi: 'Trong năm năm, cần khoảng 18 TB lưu trữ.'}
        ]
      },
      {
        title: {en: 'High-level design and deep dive', vi: 'Thiết kế tổng thể và đi sâu'},
        phrases: [
          {en: 'Let me start with a simple high-level design, and then we can go deeper.', vi: 'Tôi bắt đầu với thiết kế tổng thể đơn giản, rồi mình đi sâu hơn.'},
          {en: 'The main components are an API layer, a database, a cache and a queue.', vi: 'Thành phần chính gồm tầng API, database, cache và hàng đợi.'},
          {en: 'Here\'s the data model: a users table, an orders table and a payments table.', vi: 'Đây là mô hình dữ liệu: bảng users, orders và payments.'},
          {en: 'Which part would you like me to go deeper into?', vi: 'Anh/chị muốn tôi đi sâu vào phần nào?'},
          {en: 'The bottleneck here would be the database writes, so let\'s talk about partitioning.', vi: 'Điểm nghẽn ở đây sẽ là việc ghi database, nên mình nói về partitioning.'},
          {en: 'To handle failures, I\'d add retries with backoff and a dead-letter queue.', vi: 'Để xử lý lỗi, tôi thêm retry có backoff và dead-letter queue.'}
        ]
      },
      {
        title: {en: 'Trade-offs and wrapping up', vi: 'Đánh đổi và tổng kết'},
        phrases: [
          {en: 'There\'s a trade-off here between simplicity and scalability.', vi: 'Ở đây có sự đánh đổi giữa đơn giản và khả năng mở rộng.'},
          {en: 'I\'d start with the simpler option and change it when we actually need to.', vi: 'Tôi sẽ bắt đầu với phương án đơn giản và chỉ đổi khi thực sự cần.'},
          {en: 'If we had ten times more traffic, I\'d shard the database by user ID.', vi: 'Nếu lưu lượng gấp mười, tôi sẽ shard database theo user ID.'},
          {en: 'To summarize the design: …', vi: 'Tóm tắt thiết kế: …'},
          {en: 'With more time, I\'d also look at monitoring, security and cost.', vi: 'Nếu có thêm thời gian, tôi sẽ xem thêm giám sát, bảo mật và chi phí.'}
        ]
      },
      {
        title: {en: 'Writing SQL out loud', vi: 'Vừa viết SQL vừa giải thích'},
        phrases: [
          {en: 'I\'ll join orders with customers on the customer ID.', vi: 'Tôi join bảng orders với customers theo customer ID.'},
          {en: 'Then I group by customer and sum the amounts.', vi: 'Rồi group by theo khách hàng và tính tổng số tiền.'},
          {en: 'I\'ll filter the date range in the WHERE clause, before grouping.', vi: 'Tôi lọc khoảng ngày trong WHERE, trước khi group.'},
          {en: 'I\'ll use HAVING to keep only customers above the threshold.', vi: 'Dùng HAVING để chỉ giữ khách hàng vượt ngưỡng.'},
          {en: 'To get the top three per category, I\'d use row number over a partition by category.', vi: 'Để lấy top 3 mỗi danh mục, tôi dùng ROW_NUMBER với partition theo category.'},
          {en: 'For performance, I\'d want an index on customer ID and created date.', vi: 'Về hiệu năng, tôi cần index trên customer ID và created date.'}
        ]
      },
      {
        title: {en: 'When the interviewer challenges your design', vi: 'Khi người phỏng vấn phản biện thiết kế'},
        tip: {en: 'A challenge is an invitation to discuss trade-offs, not a sign you failed. Stay calm and reason out loud.', vi: 'Bị phản biện là lời mời bàn về đánh đổi, không phải dấu hiệu bạn trượt. Giữ bình tĩnh và suy luận thành tiếng.'},
        phrases: [
          {en: 'That\'s a good point. If the cache goes down, the database would get all the traffic.', vi: 'Ý hay. Nếu cache sập, toàn bộ lưu lượng sẽ dồn vào database.'},
          {en: 'To handle that, I\'d add rate limiting and let the cache warm up gradually.', vi: 'Để xử lý, tôi sẽ thêm giới hạn tần suất và cho cache nạp dần.'},
          {en: 'You\'re right, a single database would become a bottleneck at that scale.', vi: 'Anh/chị nói đúng, một database duy nhất sẽ thành điểm nghẽn ở quy mô đó.'},
          {en: 'I chose this for simplicity, but I\'d change it if the requirements grow.', vi: 'Tôi chọn cách này vì đơn giản, nhưng sẽ đổi nếu yêu cầu tăng lên.'},
          {en: 'Could you tell me which part concerns you most? I can go deeper there.', vi: 'Anh/chị lo nhất phần nào? Tôi có thể đi sâu vào phần đó.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'System design interview structure', vi: 'Khung trả lời phỏng vấn system design'},
        body: `1. Requirements: "Let me clarify a few things first: [features], [users and traffic], [read versus write], [consistency versus availability]."
2. Estimates: "Roughly [requests per second] and [storage per year]."
3. High-level design: "The main components are [API], [database], [cache], [queue]."
4. Deep dive: "The hardest part is [component], so let's go deeper there."
5. Trade-offs: "I chose [option] over [option] because [reason]; the cost is [trade-off]."
6. Wrap-up: "To summarize, [design]. With more time, I'd look at [monitoring, security or cost]."`
      }
    ]
  },
  {
    id: 'dialogues',
    groups: [
      {
        title: {en: 'How to practise a dialogue', vi: 'Cách luyện một đoạn hội thoại'},
        tip: {en: 'Listen to the whole dialogue once. Then read one role aloud and say the other role\'s lines from memory, or practise with a friend. Swap roles, then try it without looking.', vi: 'Nghe cả đoạn hội thoại một lần. Rồi đọc to một vai và tự nhớ để nói lời của vai kia, hoặc luyện cùng bạn bè. Đổi vai, rồi thử nói không nhìn.'},
        phrases: [
          {en: 'Let\'s do a quick role-play. I\'ll be the client, and you\'ll be the developer.', vi: 'Mình đóng vai nhanh nhé. Mình làm khách hàng, bạn làm developer.'},
          {en: 'Can we try that again? This time, I\'ll start.', vi: 'Mình thử lại nhé? Lần này mình bắt đầu.'},
          {en: 'Let\'s switch roles.', vi: 'Mình đổi vai nhé.'},
          {en: 'That sounded natural. Maybe slow down a little at the end.', vi: 'Nghe tự nhiên đấy. Có lẽ nói chậm lại một chút ở đoạn cuối.'}
        ]
      }
    ],
    templates: [
      {
        title: {en: 'Stand-up with a blocker', vi: 'Stand-up có vướng mắc'},
        body: `Lead: Good morning, everyone. Minh, do you want to start?
Minh: Sure. Yesterday I finished the validation for the transfer API. Today I'll write the integration tests. I'm blocked on the sandbox credentials from the bank.
Lead: How long have you been waiting?
Minh: Since Monday. I've followed up twice.
Lead: Okay, I'll escalate it after the stand-up. Can you work on something else in the meantime?
Minh: Yes, I'll pick up the export ticket until then.`
      },
      {
        title: {en: 'Asking a teammate for help', vi: 'Nhờ đồng nghiệp giúp'},
        body: `You: Hi Lan, do you have five minutes? I'm stuck on a bug in the billing job.
Lan: Sure, what's going on?
You: The job sometimes creates two invoices for the same customer. I've checked the logs, and both runs start at the same time.
Lan: Are you running more than one instance?
You: Yes, three pods.
Lan: Then each pod runs the scheduled job. You need a lock, like ShedLock.
You: That makes sense. Thanks a lot, I'll try it now.`
      },
      {
        title: {en: 'Clarifying a requirement with a client', vi: 'Làm rõ yêu cầu với khách hàng'},
        body: `Client: We need the report to be real time.
You: Thanks. Just to make sure I understand, do you need it updated within seconds, or would every few minutes be enough?
Client: Every five minutes is fine, actually.
You: Great, that makes it much simpler. Who will use the report, and how often?
Client: The finance team, every morning.
You: Understood. So a report refreshed every five minutes, mainly used in the morning. I'll send a short summary by email today.`
      },
      {
        title: {en: 'Opening a job interview', vi: 'Mở đầu buổi phỏng vấn'},
        body: `Interviewer: Hi, thanks for joining. Can you hear me okay?
You: Yes, loud and clear. Thank you for having me.
Interviewer: Great. Could you start by telling me a little about yourself?
You: Sure. I'm a backend developer with five years of experience, mostly with Java and Spring Boot in fintech. Recently, I led the migration of our payment service with zero downtime. I'm looking for a role with larger systems and an international team, which is why I applied here.
Interviewer: Sounds good. Let's start with some Java questions.`
      },
      {
        title: {en: 'Incident call', vi: 'Cuộc gọi xử lý sự cố'},
        body: `Lead: Thanks for joining quickly. What do we know so far?
You: Since ten fifteen, about twenty percent of payments are failing with timeouts.
Lead: Did anything change recently?
You: Yes, we deployed a new version at ten.
Lead: Then let's roll back first and investigate after.
You: Rolling back now. I'll update the channel in ten minutes.
You: The rollback is done, and the error rate is back to normal.
Lead: Great job. Let's do a postmortem tomorrow.`
      },
      {
        title: {en: 'Negotiating an offer', vi: 'Đàm phán offer'},
        body: `Recruiter: We're happy to offer you the position, with a base salary of forty million dong.
You: Thank you, I'm really excited about the role. Based on my experience and the market, I was hoping for something closer to forty-five.
Recruiter: I understand. Forty-five is above our band, but I could check whether we can do forty-three.
You: That would work if we could also review the salary after the probation period.
Recruiter: That sounds reasonable. I'll confirm with the hiring manager and come back to you tomorrow.
You: Perfect, thank you.`
      },
      {
        title: {en: 'Discussing a code review comment', vi: 'Thảo luận về comment review code'},
        body: `Reviewer: I left a comment on the transfer service. This check and the update aren't atomic.
You: Thanks. Do you mean two requests could pass the balance check at the same time?
Reviewer: Exactly. Then the balance could go negative.
You: Good catch. I'll use a conditional update, so the database does the check and the update in one statement.
Reviewer: Sounds good. Could you also add a test with two concurrent requests?
You: Sure, I'll push the changes this afternoon.`
      },
      {
        title: {en: 'Renegotiating scope in sprint planning', vi: 'Thỏa thuận lại phạm vi trong sprint planning'},
        body: `Product owner: Can we fit the export feature and the new dashboard into this sprint?
You: I'd like to, but together they're about forty points, and our capacity is thirty.
Product owner: Which one is riskier?
You: The dashboard, because the API isn't ready yet.
Product owner: Okay, let's commit to the export feature and do a spike on the dashboard.
You: That works. We'll share what we learn from the spike in the review.`
      },
      {
        title: {en: 'Asking for a raise in a one-on-one', vi: 'Xin tăng lương trong buổi 1-1'},
        body: `You: Thanks for making time. I'd like to talk about my compensation.
Manager: Of course. Go ahead.
You: Over the last year, I led the payment migration, reduced report time by sixty percent, and mentored two new developers.
Manager: Yes, those were important contributions.
You: Based on that and the market rate for my role, I'd like to discuss a salary review.
Manager: That's fair. I'll prepare a proposal for the review cycle next month.
You: Thank you. Could we agree on a date to follow up?`
      },
      {
        title: {en: 'Small talk at lunch', vi: 'Nói chuyện lúc ăn trưa'},
        body: `Colleague: Is this seat free?
You: Yes, go ahead! How's your week going?
Colleague: Busy, but good. We're launching the mobile app on Friday.
You: Oh, nice! Are you nervous about it?
Colleague: A little. What about you, any plans for the weekend?
You: I'm going to Vung Tau with my family. Have you been there?
Colleague: Not yet. Let me know if you find a good seafood place!`
      },
      {
        title: {en: 'Apologizing for a mistake', vi: 'Xin lỗi vì mắc lỗi'},
        body: `You: Hi, I need to tell you about a mistake I made.
Lead: Okay, what happened?
You: I ran the cleanup script against staging instead of my local database, and some test data was deleted.
Lead: Is anything affected in production?
You: No, only staging. I've already restored most of the data from last night's backup.
Lead: Good that you told me quickly. What will prevent this next time?
You: I'll add a confirmation prompt to the script that shows the target environment.`
      },
      {
        title: {en: 'Disagreeing in a design meeting', vi: 'Phản biện trong buổi họp thiết kế'},
        body: `Architect: I think we should split this into three microservices.
You: I see the benefit for scaling. Can I share a concern?
Architect: Sure.
You: We're only four developers, and the domains are still changing. Three services would add a lot of deployment and monitoring work.
Architect: That's a fair point. What would you suggest?
You: A modular monolith with clear module boundaries for now, and we split a module out when there's a real reason.
Architect: Okay, let's write that down as a decision and revisit it in six months.`
      },
      {
        title: {en: 'Handing over before leave', vi: 'Bàn giao trước khi nghỉ phép'},
        body: `You: Hi Nam, thanks for covering for me next week. Do you have ten minutes?
Nam: Sure.
You: There are two open tickets. The import fix is in review, and the export feature is about half done.
Nam: Is anything urgent?
You: Only the import fix. If QA finds a problem, the steps to reproduce are in the ticket.
Nam: Got it. Who should I ask about the bank API?
You: Lan knows it well. I've also written everything in the handover note.`
      },
      {
        title: {en: 'Round 1 follow-ups: HashMap', vi: 'Vòng 1 – câu hỏi bám đuổi: HashMap'},
        body: `Interviewer: How does HashMap work internally?
You: It's an array of buckets. The key's hash code decides the bucket, and equals finds the right entry inside it.
Interviewer: What happens when two keys land in the same bucket?
You: They're stored as a linked list, and if the bucket reaches eight entries and the table has at least sixty-four buckets, it turns into a red-black tree. Otherwise, the map resizes instead.
Interviewer: And when does the map resize?
You: When it's about seventy-five percent full, the default load factor. It doubles the array and redistributes the entries.
Interviewer: Is it safe to use from several threads?
You: No. For concurrent access, I'd use ConcurrentHashMap.`
      },
      {
        title: {en: 'Round 3 follow-ups: @Transactional', vi: 'Vòng 3 – câu hỏi bám đuổi: @Transactional'},
        body: `Interviewer: How does @Transactional work?
You: Spring creates a proxy around the bean. The proxy starts a transaction before the method and commits or rolls back after it.
Interviewer: What if a method in the same class calls it?
You: The call doesn't go through the proxy, so the annotation is ignored. I'd move the method to another bean.
Interviewer: Does it roll back on every exception?
You: By default only on unchecked exceptions. For checked ones, I set rollbackFor.
Interviewer: When would you use REQUIRES_NEW?
You: For something that must be saved even if the main transaction fails, like an audit record of a failed payment.`
      },
      {
        title: {en: 'Round 5 discussion: rate limiter', vi: 'Vòng 5 – thảo luận: rate limiter'},
        body: `Interviewer: Design a rate limiter for our public API.
You: Before I start, is the limit per user, per API key or per IP? And roughly how many requests per second?
Interviewer: Per API key, around five thousand requests per second in total.
You: Then I'd use a token bucket per key, stored in Redis, so all API instances share the same counters.
Interviewer: How do you avoid race conditions between instances?
You: The check and the update run atomically in one Lua script.
Interviewer: What happens if Redis is down?
You: I'd fail open for most endpoints, so users aren't blocked, but fail closed for sensitive ones, like login.`
      },
      {
        title: {en: 'Round 6: why PwC and a follow-up', vi: 'Vòng 6 – vì sao chọn PwC và câu hỏi tiếp'},
        body: `Interviewer: Why do you want to join PwC?
You: I want to work on large, business-critical systems for clients in different industries, where security and reliability really matter. That matches my experience in fintech.
Interviewer: Consulting can mean changing projects and tight deadlines. How do you feel about that?
You: I see it as a chance to learn quickly. When deadlines are tight, I agree on priorities early and cut scope, not quality.
Interviewer: Where do you see yourself in a few years?
You: As a senior engineer who can lead the technical design of a module and support the client directly.`
      },
      {
        title: {en: 'Round 2 follow-ups: deadlocks and virtual threads', vi: 'Vòng 2 – câu hỏi bám đuổi: deadlock và virtual thread'},
        body: `Interviewer: What is a deadlock?
You: Two threads each hold a lock and wait forever for the lock the other one holds.
Interviewer: How would you find one in production?
You: I'd take a thread dump with jstack. It reports the deadlocked threads and which locks they're waiting for.
Interviewer: And how do you prevent it?
You: Always acquire locks in the same order, keep lock scopes small, and use tryLock with a timeout when the order can't be guaranteed.
Interviewer: Do virtual threads change any of this?
You: They don't prevent deadlocks. They make blocking cheap, but the locking rules stay the same.`
      },
      {
        title: {en: 'Round 4 follow-ups: isolation and indexes', vi: 'Vòng 4 – câu hỏi bám đuổi: isolation và index'},
        body: `Interviewer: What isolation level does MySQL use by default?
You: Repeatable read, in InnoDB.
Interviewer: Can two transfers still overdraw an account at that level?
You: Yes, if both read the balance and then update it. I'd prevent it with a conditional update, a locking read, or optimistic locking with a version column.
Interviewer: Your query is slow. What's the first thing you do?
You: I run EXPLAIN to see whether it uses an index or scans the whole table.
Interviewer: And if it does a full scan?
You: I'd add a composite index that matches the WHERE and ORDER BY, with the equality columns first, and check the plan again.`
      },
      {
        title: {en: 'Calling the IT helpdesk', vi: 'Gọi IT helpdesk'},
        body: `IT: IT helpdesk, how can I help?
You: Hi, this is Kira from the backend team. I haven't been able to connect to the VPN since this morning.
IT: What error do you see?
You: It says "authentication failed", but my password works for email.
IT: Your VPN certificate may have expired. I'll send you a link to renew it.
You: Great, thanks. Is there a ticket number?
IT: Yes, it's I T four five eight two. Call us back if it still doesn't work.`
      },
      {
        title: {en: 'Rescheduling a meeting', vi: 'Dời lịch họp'},
        body: `You: Hi Anna, I'm sorry, but something urgent came up. Could we move our meeting this afternoon?
Anna: Sure. When works for you?
You: Would tomorrow at ten work?
Anna: Ten is tricky for me. How about eleven?
You: Eleven is perfect. I'll update the invite.
Anna: Thanks for letting me know early.`
      },
      {
        title: {en: 'Client demo with questions', vi: 'Demo cho khách hàng kèm câu hỏi'},
        body: `You: That's the new export feature. Any questions so far?
Client: Yes. Can users export more than one month at a time?
You: Right now it's one month, but we could add a date range in the next sprint.
Client: That would be useful. And is the file password protected?
You: Not yet. Since it contains financial data, I'd recommend we add that before go-live.
Client: Agreed. Please add both to the backlog.
You: Will do. I'll send you a short summary after the call.`
      },
      {
        title: {en: 'Receiving feedback on your pull request', vi: 'Nhận phản hồi về pull request của bạn'},
        body: `Reviewer: Your PR looks good overall, but the service class is doing too much.
You: Thanks for the feedback. Which part do you think should move?
Reviewer: The CSV parsing. It's not really business logic.
You: That's fair. I'll extract it into a separate parser class with its own tests.
Reviewer: Great. One more thing: the method name "process" is a bit vague.
You: Good point. I'll rename it to "importStatement". I'll push the changes in an hour.`
      },
      {
        title: {en: 'Daily report when you are behind', vi: 'Báo cáo daily khi đang bị trễ'},
        body: `Lead: Kira, how's the reconciliation report going?
You: I'm about a day behind. The bank file format was different from the spec, so I had to change the parser.
Lead: Will it affect Friday's release?
You: The core report will still be ready on Friday. The export to Excel might move to Monday.
Lead: Okay. Do you need help?
You: A quick review of the parser this afternoon would help a lot.
Lead: I'll ask Minh to take a look.`
      },
      {
        title: {en: 'Daily demo with a tricky question', vi: 'Demo hằng ngày có câu hỏi khó'},
        body: `You: Today I'd like to show the new payment reminder. When a statement is created, the user gets three reminders before the due date.
PO: Nice. What happens if the user already paid?
You: The job checks the payment status before sending, so paid bills don't get reminders.
PO: And if two instances run the job at the same time?
You: Each reminder is claimed with a database lock, so it's only sent once.
PO: Great. Can users turn reminders off?
You: Not yet. I'll add that to the backlog and we can discuss it in refinement.`
      },
      {
        title: {en: 'Morning chat in the lift', vi: 'Chào hỏi buổi sáng trong thang máy'},
        body: `Colleague: Morning! Which floor?
You: Seven, please. Thanks.
Colleague: You're on the payments team, right?
You: That's right. I'm Kira. Nice to finally meet you in person.
Colleague: Same here. Busy day ahead?
You: Pretty busy. We have a release this afternoon. How about you?
Colleague: Mostly meetings. Good luck with the release!`
      },
      {
        title: {en: 'Swapping an on-call shift', vi: 'Nhờ đổi ca trực'},
        body: `You: Hi Nam, can I ask you a favour?
Nam: Sure, what's up?
You: I'm on call next weekend, but I have a family event. Could we swap shifts?
Nam: Which weekend would I take instead?
You: I can take yours at the end of the month.
Nam: That works for me.
You: Thanks a lot! I'll update the on-call calendar and tell the team.`
      }
    ]
  },
  {
    id: 'travel',
    groups: [
      {
        title: {en: 'At a restaurant', vi: 'Ở nhà hàng'},
        phrases: [
          {en: 'Hi, do you have a table for two?', vi: 'Chào, còn bàn cho hai người không?'},
          {en: 'Could we see the menu, please?', vi: 'Cho chúng tôi xem thực đơn nhé.'},
          {en: 'What would you recommend?', vi: 'Bạn gợi ý món gì?'},
          {en: 'I\'m allergic to peanuts. Does this dish contain any?', vi: 'Tôi dị ứng đậu phộng. Món này có không?'},
          {en: 'Could I have the bill, please? Can I pay by card?', vi: 'Cho tôi tính tiền. Tôi trả bằng thẻ được không?'},
          {en: 'Is the service charge included?', vi: 'Đã bao gồm phí phục vụ chưa?'}
        ]
      },
      {
        title: {en: 'Shopping and paying', vi: 'Mua sắm và thanh toán'},
        phrases: [
          {en: 'How much is this?', vi: 'Cái này bao nhiêu tiền?'},
          {en: 'Do you have this in a smaller size?', vi: 'Có cỡ nhỏ hơn không?'},
          {en: 'I\'m just looking, thanks.', vi: 'Tôi chỉ xem thôi, cảm ơn.'},
          {en: 'My card was declined. Can I try another one?', vi: 'Thẻ tôi bị từ chối. Tôi thử thẻ khác được không?'},
          {en: 'Can I get a tax refund form?', vi: 'Cho tôi xin mẫu hoàn thuế được không?'},
          {en: 'Could I return this? I have the receipt.', vi: 'Tôi trả lại món này được không? Tôi có hóa đơn.'}
        ]
      },
      {
        title: {en: 'Getting around', vi: 'Đi lại'},
        phrases: [
          {en: 'How do I get to the city center from here?', vi: 'Từ đây đi vào trung tâm thành phố thế nào?'},
          {en: 'Which platform does the train to the airport leave from?', vi: 'Tàu ra sân bay khởi hành ở sân ga nào?'},
          {en: 'Could you take me to this address, please?', vi: 'Anh/chị chở tôi tới địa chỉ này nhé.'},
          {en: 'How long does it take by taxi?', vi: 'Đi taxi mất bao lâu?'},
          {en: 'Is this the right stop for the museum?', vi: 'Đây có phải trạm dừng tới bảo tàng không?'},
          {en: 'I think I\'m lost. Could you show me on the map?', vi: 'Hình như tôi bị lạc. Anh/chị chỉ giúp trên bản đồ được không?'}
        ]
      },
      {
        title: {en: 'Problems and emergencies abroad', vi: 'Sự cố và khẩn cấp ở nước ngoài'},
        phrases: [
          {en: 'I\'ve lost my passport. Where is the nearest police station?', vi: 'Tôi bị mất hộ chiếu. Đồn cảnh sát gần nhất ở đâu?'},
          {en: 'I need to contact the Vietnamese embassy.', vi: 'Tôi cần liên hệ Đại sứ quán Việt Nam.'},
          {en: 'Is there a pharmacy near here? I need something for a fever.', vi: 'Gần đây có nhà thuốc không? Tôi cần thuốc hạ sốt.'},
          {en: 'Please call an ambulance.', vi: 'Làm ơn gọi xe cấp cứu.'},
          {en: 'My bag was stolen. I need a police report for my insurance.', vi: 'Túi của tôi bị lấy cắp. Tôi cần biên bản của cảnh sát để làm bảo hiểm.'},
          {en: 'I missed my flight. What are my options?', vi: 'Tôi bị lỡ chuyến bay. Tôi có những lựa chọn nào?'}
        ]
      }
    ],
    templates: []
  }
];
