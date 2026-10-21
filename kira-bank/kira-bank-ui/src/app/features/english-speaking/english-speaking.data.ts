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

export type TrackId = 'interview' | 'meetings' | 'standup' | 'reports' | 'techstack';

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
    week: 1, phase: {en: 'Foundation', vi: 'Nền tảng'}, tracks: ['standup'],
    focus: {en: 'Pronounce your daily tech vocabulary and introduce yourself', vi: 'Phát âm từ vựng kỹ thuật hằng ngày và giới thiệu bản thân'},
    tasks: [
      {en: 'Listen and repeat 20 tech terms: Java, Spring Boot, Angular, deploy, cache, queue, schema, endpoint…', vi: 'Nghe và nhắc lại 20 thuật ngữ: Java, Spring Boot, Angular, deploy, cache, queue, schema, endpoint…'},
      {en: 'Write and record a 60-second self-introduction.', vi: 'Viết và ghi âm phần giới thiệu bản thân 60 giây.'},
      {en: 'Learn the 3-part stand-up structure: yesterday, today, blockers.', vi: 'Học cấu trúc stand-up 3 phần: hôm qua, hôm nay, vướng mắc.'}
    ]
  },
  {
    week: 2, phase: {en: 'Foundation', vi: 'Nền tảng'}, tracks: ['standup', 'meetings'],
    focus: {en: 'Speak in every stand-up using the template', vi: 'Nói trong mọi buổi stand-up theo mẫu'},
    tasks: [
      {en: 'Give a stand-up update in English every working day (record at least 3).', vi: 'Báo cáo stand-up bằng tiếng Anh mỗi ngày làm việc (ghi âm ít nhất 3 lần).'},
      {en: 'Practise 10 clarifying phrases: "Could you repeat that?", "Just to confirm…".', vi: 'Luyện 10 câu hỏi lại cho rõ: "Could you repeat that?", "Just to confirm…".'},
      {en: 'Shadow one 5-minute engineering video at 0.75× speed, then at 1×.', vi: 'Shadowing một video kỹ thuật 5 phút ở tốc độ 0.75×, sau đó 1×.'}
    ]
  },
  {
    week: 3, phase: {en: 'Foundation', vi: 'Nền tảng'}, tracks: ['meetings'],
    focus: {en: 'Ask for help and describe a blocker clearly', vi: 'Nhờ giúp đỡ và mô tả vướng mắc rõ ràng'},
    tasks: [
      {en: 'Describe one real bug: what you expected, what happened, what you tried.', vi: 'Mô tả một bug thật: kỳ vọng gì, thực tế ra sao, đã thử những gì.'},
      {en: 'Practise polite agreeing and disagreeing phrases in a mock discussion.', vi: 'Luyện các câu đồng ý/phản đối lịch sự trong một buổi thảo luận giả lập.'},
      {en: 'Write a Slack/Teams message asking for a code review, then read it aloud.', vi: 'Viết tin nhắn Slack/Teams nhờ review code rồi đọc to.'}
    ]
  },
  {
    week: 4, phase: {en: 'Team routines', vi: 'Thói quen trong nhóm'}, tracks: ['reports'],
    focus: {en: 'Deliver your first weekly report', vi: 'Trình bày báo cáo tuần đầu tiên'},
    tasks: [
      {en: 'Fill the weekly report template with this week\'s real work.', vi: 'Điền mẫu báo cáo tuần bằng công việc thật của tuần này.'},
      {en: 'Present it out loud in under 3 minutes and record it.', vi: 'Trình bày to trong dưới 3 phút và ghi âm lại.'},
      {en: 'Learn 5 phrases for risks and delays.', vi: 'Học 5 mẫu câu nói về rủi ro và chậm tiến độ.'}
    ]
  },
  {
    week: 5, phase: {en: 'Team routines', vi: 'Thói quen trong nhóm'}, tracks: ['reports', 'meetings'],
    focus: {en: 'Sprint review and bi-weekly report', vi: 'Sprint review và báo cáo 2 tuần'},
    tasks: [
      {en: 'Prepare a bi-weekly / sprint summary with goals, done, carried over and metrics.', vi: 'Chuẩn bị tổng kết 2 tuần/sprint: mục tiêu, đã xong, chuyển sprint sau, số liệu.'},
      {en: 'Practise demo phrases: "Let me walk you through…", "As you can see…".', vi: 'Luyện câu demo: "Let me walk you through…", "As you can see…".'},
      {en: 'Give one retrospective point for each: went well, to improve, action.', vi: 'Đưa một ý retro cho mỗi phần: làm tốt, cần cải thiện, hành động.'}
    ]
  },
  {
    week: 6, phase: {en: 'Team routines', vi: 'Thói quen trong nhóm'}, tracks: ['meetings'],
    focus: {en: 'Lead a short meeting or discussion', vi: 'Dẫn dắt một buổi họp/thảo luận ngắn'},
    tasks: [
      {en: 'Open, steer and close a 15-minute meeting using the meeting phrases.', vi: 'Mở đầu, điều phối và kết thúc buổi họp 15 phút bằng các mẫu câu họp.'},
      {en: 'Summarise action items with owners and deadlines out loud.', vi: 'Nói tóm tắt các việc cần làm kèm người phụ trách và hạn chót.'},
      {en: 'Negotiate a scope or deadline change in a role-play.', vi: 'Đóng vai thương lượng thay đổi phạm vi hoặc deadline.'}
    ]
  },
  {
    week: 7, phase: {en: 'Technical discussion', vi: 'Thảo luận kỹ thuật'}, tracks: ['techstack'],
    focus: {en: 'Explain your backend: Java, Spring Boot, database', vi: 'Giải thích backend: Java, Spring Boot, database'},
    tasks: [
      {en: 'Explain the request flow of one API: controller → service → repository → DB.', vi: 'Giải thích luồng xử lý một API: controller → service → repository → DB.'},
      {en: 'Talk for 2 minutes about a transaction, index or N+1 problem you solved.', vi: 'Nói 2 phút về một vấn đề transaction, index hoặc N+1 bạn đã xử lý.'},
      {en: 'Learn to say numbers and units naturally: "two hundred milliseconds", "ten K requests".', vi: 'Tập đọc số và đơn vị tự nhiên: "two hundred milliseconds", "ten K requests".'}
    ]
  },
  {
    week: 8, phase: {en: 'Technical discussion', vi: 'Thảo luận kỹ thuật'}, tracks: ['techstack'],
    focus: {en: 'Explain your frontend and integration', vi: 'Giải thích frontend và tích hợp'},
    tasks: [
      {en: 'Describe an Angular component: inputs, state (Signals), API calls and error states.', vi: 'Mô tả một component Angular: input, state (Signals), gọi API và trạng thái lỗi.'},
      {en: 'Explain authentication with JWT and refresh tokens in simple English.', vi: 'Giải thích xác thực bằng JWT và refresh token bằng tiếng Anh đơn giản.'},
      {en: 'Compare two options (e.g. REST vs messaging) using pros and cons phrases.', vi: 'So sánh hai lựa chọn (ví dụ REST và messaging) bằng mẫu câu ưu/nhược điểm.'}
    ]
  },
  {
    week: 9, phase: {en: 'Technical discussion', vi: 'Thảo luận kỹ thuật'}, tracks: ['techstack', 'meetings'],
    focus: {en: 'Code review and architecture debate', vi: 'Code review và tranh luận kiến trúc'},
    tasks: [
      {en: 'Give 5 code-review comments politely, using suggestion phrases.', vi: 'Viết và nói 5 nhận xét code review lịch sự bằng mẫu câu gợi ý.'},
      {en: 'Defend a design decision and respond to a challenge without sounding defensive.', vi: 'Bảo vệ một quyết định thiết kế và phản hồi phản biện mà không gay gắt.'},
      {en: 'Explain an incident: impact, root cause, fix, prevention.', vi: 'Trình bày một sự cố: ảnh hưởng, nguyên nhân gốc, cách sửa, phòng ngừa.'}
    ]
  },
  {
    week: 10, phase: {en: 'Interview readiness', vi: 'Sẵn sàng phỏng vấn'}, tracks: ['interview'],
    focus: {en: 'Tell your career story', vi: 'Kể câu chuyện sự nghiệp'},
    tasks: [
      {en: 'Polish a 2-minute "Tell me about yourself" answer.', vi: 'Hoàn thiện câu trả lời 2 phút cho "Tell me about yourself".'},
      {en: 'Prepare 3 STAR stories: a hard bug, a performance win, a team conflict.', vi: 'Chuẩn bị 3 câu chuyện STAR: bug khó, cải thiện hiệu năng, mâu thuẫn trong nhóm.'},
      {en: 'Record each story and cut filler words ("uh", "like").', vi: 'Ghi âm từng câu chuyện và cắt bớt từ đệm ("uh", "like").'}
    ]
  },
  {
    week: 11, phase: {en: 'Interview readiness', vi: 'Sẵn sàng phỏng vấn'}, tracks: ['interview', 'techstack'],
    focus: {en: 'Technical interview out loud', vi: 'Phỏng vấn kỹ thuật bằng lời'},
    tasks: [
      {en: 'Answer 10 common Java/Spring questions aloud (JVM, GC, Spring beans, transactions).', vi: 'Trả lời to 10 câu hỏi Java/Spring phổ biến (JVM, GC, Spring bean, transaction).'},
      {en: 'Think aloud while solving one coding problem.', vi: 'Vừa giải một bài coding vừa nói ra suy nghĩ.'},
      {en: 'Walk through a system design: requirements, components, data, scaling.', vi: 'Trình bày một bài system design: yêu cầu, thành phần, dữ liệu, mở rộng.'}
    ]
  },
  {
    week: 12, phase: {en: 'Interview readiness', vi: 'Sẵn sàng phỏng vấn'}, tracks: ['interview'],
    focus: {en: 'Mock interview, negotiation and review', vi: 'Phỏng vấn thử, đàm phán và tổng kết'},
    tasks: [
      {en: 'Do a full 45-minute mock interview with a friend or AI and record it.', vi: 'Phỏng vấn thử 45 phút với bạn bè hoặc AI và ghi âm lại.'},
      {en: 'Practise salary and offer conversation phrases.', vi: 'Luyện mẫu câu trao đổi lương và offer.'},
      {en: 'Compare today\'s recording with week 1 and pick the next 3 weak spots.', vi: 'So sánh bản ghi âm hôm nay với tuần 1 và chọn 3 điểm yếu tiếp theo.'}
    ]
  }
];

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
      }
    ],
    templates: [
      {
        title: {en: '"Tell me about yourself" (2 minutes)', vi: '"Tell me about yourself" (2 phút)'},
        body: `I'm [name], a Java full-stack developer with [X] years of experience.
Right now I work at [company], where I build [type of product] using Spring Boot on the back end and Angular on the front end.
One project I'm proud of is [project]: I [key action], which [measurable result].
Before that, I [previous role / key experience].
I'm interested in this role because [reason linked to the company or product], and I'd like to grow in [area].`
      },
      {
        title: {en: 'STAR story', vi: 'Câu chuyện STAR'},
        body: `Situation: At [company], [context and problem].
Task: I was responsible for [goal].
Action: First, I [step 1]. Then I [step 2]. Finally, I [step 3].
Result: [number / impact]. What I learned was [lesson].`
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
      }
    ],
    templates: []
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
      }
    ],
    templates: [
      {
        title: {en: 'Daily stand-up', vi: 'Stand-up hằng ngày'},
        body: `Yesterday I [finished / worked on] [task], and [result or status].
Today I'm going to [main task]. I also plan to [secondary task].
Blockers: [none / I'm waiting for … / I need help with …].`
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
      }
    ],
    templates: [
      {
        title: {en: 'Weekly report', vi: 'Báo cáo tuần'},
        body: `Summary: Overall we are [on track / slightly behind] for [milestone].
Done this week:
- [feature / fix] — [impact]
In progress:
- [task] — [percentage]% done, expected by [day]
Risks / blockers:
- [risk] — [mitigation]
Next week:
- [priority 1]
- [priority 2]`
      },
      {
        title: {en: 'Bi-weekly / sprint review', vi: 'Báo cáo 2 tuần / sprint review'},
        body: `Sprint goal: [goal] — [achieved / partly achieved].
Delivered: [X] of [Y] stories ([story points] points).
Highlights: [demo item 1], [demo item 2].
Carried over: [story] because [reason].
Metrics: [bugs fixed / response time / test coverage].
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
        body: `Impact: From [time] to [time], [users / feature] were affected: [symptom].
Root cause: [cause].
Fix: We [rolled back / patched / scaled] [component].
Prevention: [test / alert / process change], owned by [name], due [date].`
      }
    ]
  }
];
