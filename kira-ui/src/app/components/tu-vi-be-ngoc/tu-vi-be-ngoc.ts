import {ChangeDetectionStrategy, Component, computed, signal} from '@angular/core';
import {RouterLink} from '@angular/router';

interface TuViPanel {
  icon: string;
  title: string;
  text: string;
}

interface TuViPage {
  label: string;
  title: string;
  kicker: string;
  tone: TuViTone;
  panels: TuViPanel[];
  keywords: string[];
}

interface TuViStory {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: TuViTone;
  summary: string;
  pages: TuViPage[];
}

type TuViTone = 'cover' | 'mint' | 'rose' | 'gold' | 'ink';

@Component({
  selector: 'app-tu-vi-be-ngoc',
  imports: [RouterLink],
  templateUrl: './tu-vi-be-ngoc.html',
  styleUrl: './tu-vi-be-ngoc.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TuViBeNgoc {
  readonly stories: TuViStory[] = [
    {
      id: 'than-so-hoc',
      title: 'Thần số học đối chiếu',
      subtitle: '31-10-2004 soi cùng Tử Vi, Thiên Phủ',
      icon: 'pin',
      tone: 'gold',
      summary: 'Đối chiếu ngày sinh với lá số để nhìn cùng một chân dung từ hai lăng kính.',
      pages: [
        {
          label: 'Đường đời',
          title: 'Đường đời 11/2',
          kicker: 'Trực giác mạnh, cảm xúc sâu',
          tone: 'ink',
          panels: [
            {
              icon: 'flare',
              title: 'Con số 11',
              text: '31-10-2004 cộng lại thành 11, thường được đọc là trực giác mạnh, lý tưởng cao, dễ cảm được năng lượng của người khác.',
            },
            {
              icon: 'groups_2',
              title: 'Rút về số 2',
              text: 'Số 2 làm Ngọc nhạy với quan hệ, cần cảm giác hòa hợp, nhưng cũng dễ bị ảnh hưởng bởi thái độ của người mình thương.',
            },
            {
              icon: 'psychology_alt',
              title: 'Đối chiếu tử vi',
              text: 'Tử Vi, Thiên Phủ cho cái trục vững; 11/2 thêm độ nhạy. Vì vậy Ngọc vừa mạnh, vừa dễ rung động sâu.',
            },
          ],
          keywords: ['11/2', 'Trực giác', 'Nhạy cảm'],
        },
        {
          label: 'Ngày sinh',
          title: 'Ngày sinh 31/4',
          kicker: 'Cần cấu trúc và sự chắc chắn',
          tone: 'mint',
          panels: [
            {
              icon: 'view_module',
              title: '31 rút về 4',
              text: 'Số 4 thích nền tảng, kế hoạch, sự rõ ràng. Đây là lý do Ngọc khó chịu với những thứ mập mờ hoặc nói mà không làm.',
            },
            {
              icon: 'architecture',
              title: 'Tự xây đời mình',
              text: '31/4 không ngại cực nếu thấy việc đó có ý nghĩa. Nhưng nó cũng dễ làm Ngọc tự biến mình thành người phải gồng.',
            },
            {
              icon: 'verified',
              title: 'Khớp với Thiên Phủ',
              text: 'Thiên Phủ thích ổn định và tích lũy. Khi đi cùng 31/4, bài học là xây chậm, chắc, nhưng đừng quá cứng với mình.',
            },
          ],
          keywords: ['31/4', 'Cấu trúc', 'Ổn định'],
        },
        {
          label: 'Năm sinh',
          title: 'Năm sinh 2004 → 6',
          kicker: 'Tình thương và trách nhiệm',
          tone: 'rose',
          panels: [
            {
              icon: 'family_restroom',
              title: 'Bài học số 6',
              text: 'Năm sinh 2004 rút về 6, nhấn vào gia đình, tình thương, trách nhiệm và nhu cầu chăm sóc người quan trọng.',
            },
            {
              icon: 'volunteer_activism',
              title: 'Dễ thương bằng việc làm',
              text: 'Ngọc có thể không nói quá ngọt, nhưng hay thể hiện bằng quan tâm, nhắc nhở, lo xa và cố làm mọi thứ tốt hơn.',
            },
            {
              icon: 'warning',
              title: 'Mặt trái',
              text: 'Số 6 dễ ôm vai người chăm sóc. Nếu không có ranh giới, Ngọc dễ mệt vì yêu thương mà quên hỏi mình cần gì.',
            },
          ],
          keywords: ['Số 6', 'Gia đình', 'Chăm sóc'],
        },
        {
          label: '2026',
          title: 'Năm cá nhân 2026',
          kicker: 'Năng lượng số 6',
          tone: 'gold',
          panels: [
            {
              icon: 'calendar_month',
              title: 'Một năm chữa lành',
              text: '31 + 10 + 2026 rút về 6, hợp để ổn định nếp sống, làm rõ quan hệ, chăm sức khỏe tinh thần và sửa lại nền tảng.',
            },
            {
              icon: 'home',
              title: 'Quan hệ là trọng tâm',
              text: 'Năm này dễ kéo Ngọc nhìn kỹ ai làm mình yên, ai làm mình hao. Không cần nhiều người, cần người chất lượng.',
            },
            {
              icon: 'spa',
              title: 'Lời nhắn',
              text: 'Đừng chỉ chăm người khác. Năm số 6 đẹp nhất khi Ngọc học chăm chính mình bằng sự kiên nhẫn như cách Ngọc từng chăm người mình thương.',
            },
          ],
          keywords: ['Năm cá nhân 6', 'Chữa lành', 'Ổn định'],
        },
      ],
    },
    {
      id: 'cung-hoang-dao',
      title: 'Cung hoàng đạo Bọ Cạp',
      subtitle: '31/10 - chiều sâu, trực giác và sức hút thầm lặng',
      icon: 'scuba_diving',
      tone: 'ink',
      summary: 'Một mẩu truyện đối chiếu Bọ Cạp với lá số: yêu sâu, nhìn thấu, kín lòng và cần cảm giác an toàn.',
      pages: [
        {
          label: 'Bọ Cạp',
          title: 'Khí chất Bọ Cạp',
          kicker: 'Sâu, kín, có lực hút riêng',
          tone: 'ink',
          panels: [
            {
              icon: 'dark_mode',
              title: 'Không dễ đọc vị',
              text: 'Sinh ngày 31/10 thuộc cung Bọ Cạp, kiểu người không phô hết cảm xúc ra ngoài. Ngọc có thể cười rất nhẹ, nhưng bên trong đã quan sát được nhiều lớp.',
            },
            {
              icon: 'visibility',
              title: 'Trực giác mạnh',
              text: 'Bọ Cạp thường cảm được điều không nói ra: một ánh mắt lạ, một câu trả lời né tránh, một khoảng im không bình thường.',
            },
            {
              icon: 'local_fire_department',
              title: 'Sức hút thầm',
              text: 'Sức hút của Ngọc không nằm ở ồn ào, mà ở cảm giác có chiều sâu, có bí mật, có một phần nội tâm người khác muốn tìm hiểu.',
            },
          ],
          keywords: ['Bọ Cạp', 'Trực giác', 'Chiều sâu'],
        },
        {
          label: 'Cảm xúc',
          title: 'Cảm xúc rất sâu',
          kicker: 'Thương sâu, đau cũng sâu',
          tone: 'rose',
          panels: [
            {
              icon: 'favorite',
              title: 'Không nửa vời',
              text: 'Khi Bọ Cạp thật sự để tâm, cảm xúc thường đi rất sâu. Ngọc không thích kiểu quan hệ hời hợt, lúc gần lúc xa, nói yêu nhưng thiếu hành động.',
            },
            {
              icon: 'lock',
              title: 'Khó mở, khó đóng',
              text: 'Ngọc mở lòng chậm vì cần tin. Nhưng khi đã tin, việc đóng lại cũng không đơn giản; thường phải qua nhiều thất vọng tích tụ.',
            },
            {
              icon: 'water_drop',
              title: 'Dễ giấu cơn buồn',
              text: 'Bọ Cạp hay tự giữ nỗi đau cho riêng mình. Nhìn ngoài tưởng ổn, nhưng bên trong có thể đang tự phân tích từng chi tiết rất lâu.',
            },
          ],
          keywords: ['Thương sâu', 'Khó tin', 'Dễ giấu'],
        },
        {
          label: 'Tình yêu',
          title: 'Bọ Cạp khi yêu',
          kicker: 'Cần trung thành và rõ ràng',
          tone: 'gold',
          panels: [
            {
              icon: 'handshake',
              title: 'Trung thành là gốc',
              text: 'Ngọc hợp với người nhất quán, biết giữ lời, không tạo cảm giác phải đoán. Với Bọ Cạp, sự mập mờ dễ làm trái tim bật chế độ phòng thủ.',
            },
            {
              icon: 'psychology_alt',
              title: 'Hay thử độ thật lòng',
              text: 'Không nhất thiết thử người khác bằng lời, nhưng Ngọc sẽ âm thầm quan sát: người đó có nhớ điều nhỏ không, có ở lại lúc mình khó không.',
            },
            {
              icon: 'warning',
              title: 'Điểm cần mềm',
              text: 'Đừng biến im lặng thành bài kiểm tra quá lâu. Nếu cần được trấn an, nói ra sẽ tốt hơn là để người kia đoán trong bóng tối.',
            },
          ],
          keywords: ['Trung thành', 'Rõ ràng', 'Trấn an'],
        },
        {
          label: 'Đối chiếu',
          title: 'Bọ Cạp gặp Tử Vi',
          kicker: 'Một người sâu nhưng cần ổn định',
          tone: 'mint',
          panels: [
            {
              icon: 'stars',
              title: 'Tử Vi giữ trục',
              text: 'Tử Vi, Thiên Phủ trong lá số cho cảm giác tự trọng, nguyên tắc và cần ổn định. Bọ Cạp thêm chiều sâu cảm xúc và độ nhạy với sự thật.',
            },
            {
              icon: 'balance',
              title: 'Mạnh nhưng không nên gồng',
              text: 'Sự kết hợp này làm Ngọc có nội lực tốt, nhưng cũng dễ tự ép mình phải kiểm soát mọi thứ. Mạnh nhất là khi biết mềm đúng lúc.',
            },
            {
              icon: 'spa',
              title: 'Lời nhắn',
              text: 'Nếu cảm xúc quá sâu, hãy cho nó một lối ra tử tế: viết, nói, nghỉ, hoặc chọn người đủ an toàn để được yếu một chút.',
            },
          ],
          keywords: ['Tử Vi', 'Thiên Phủ', 'Mềm đúng lúc'],
        },
      ],
    },
    {
      id: 'tong-quan',
      title: 'Lá số tổng quan',
      subtitle: 'Bản mệnh, tính cách, công việc, tình cảm, cuộc sống',
      icon: 'auto_stories',
      tone: 'cover',
      summary: 'Một cuốn mở đầu nhẹ nhàng để đọc toàn cảnh lá số Ngọc Bi trong năm 2026.',
      pages: [
        {
          label: 'Bìa',
          title: 'Tử Vi Bé Ngọc',
          kicker: 'Lá số tham khảo năm 2026',
          tone: 'cover',
          panels: [
            {
              icon: 'badge',
              title: 'Thông tin lá số',
              text: 'Ngọc Bi, sinh năm 2004 - Giáp Thân, Dương nữ, giờ Giáp Dần, năm xem Bính Ngọ 2026.',
            },
            {
              icon: 'auto_stories',
              title: 'Cách đọc',
              text: 'Mỗi trang là một góc nhỏ về bản mệnh, công việc, tình cảm, người thân và lời nhắn trong năm.',
            },
            {
              icon: 'favorite',
              title: 'Ghi chú nhẹ',
              text: 'Nội dung mang tính tham khảo và giải trí, dùng để nhìn mình mềm mại hơn, không phải kết luận tuyệt đối.',
            },
          ],
          keywords: ['Ngọc Bi', 'Giáp Thân', '2026'],
        },
        {
          label: 'Mệnh',
          title: 'Tổng quan bản mệnh',
          kicker: 'Tử Vi, Thiên Phủ tại mệnh',
          tone: 'mint',
          panels: [
            {
              icon: 'stars',
              title: 'Chất lãnh đạo ấm',
              text: 'Mệnh có Tử Vi và Thiên Phủ gợi ý nội tâm có trục, thích làm việc có nguyên tắc và muốn mọi thứ rõ ràng.',
            },
            {
              icon: 'verified',
              title: 'Tự trọng cao',
              text: 'Khi đã quyết điều gì, Bé Ngọc thường muốn làm cho đàng hoàng, ít thích qua loa hay đẩy trách nhiệm.',
            },
            {
              icon: 'water_drop',
              title: 'Cần giữ độ mềm',
              text: 'Càng căng thẳng càng dễ tự ép mình. Bài học hay nhất là biết nghỉ đúng lúc và nói ra điều mình cần.',
            },
          ],
          keywords: ['Bản lĩnh', 'Ổn định', 'Tự trọng'],
        },
        {
          label: 'Tính cách',
          title: 'Tính cách',
          kicker: 'Chủ động, quan sát, sống có tâm',
          tone: 'rose',
          panels: [
            {
              icon: 'psychology',
              title: 'Nhìn nhanh vấn đề',
              text: 'Ngọc có khả năng quan sát sắc, dễ nhận ra ai đang thật lòng, việc nào đang lệch nhịp.',
            },
            {
              icon: 'shield_person',
              title: 'Hay ôm việc vào mình',
              text: 'Điểm mạnh là trách nhiệm, nhưng nếu ôm quá nhiều sẽ mệt. Chia việc và chia cảm xúc đều là kỹ năng quan trọng.',
            },
            {
              icon: 'local_fire_department',
              title: 'Bên ngoài bình tĩnh',
              text: 'Bên trong có lửa và sự nhạy cảm. Khi được tôn trọng, Ngọc tỏa ra rất ấm và đáng tin.',
            },
          ],
          keywords: ['Quan sát', 'Trách nhiệm', 'Ấm áp'],
        },
        {
          label: 'Công việc',
          title: 'Công việc và học tập',
          kicker: 'Hợp việc có cấu trúc và cần độ bền',
          tone: 'gold',
          panels: [
            {
              icon: 'work',
              title: 'Thiên hướng tổ chức',
              text: 'Lá số gợi ý hợp môi trường cần sắp xếp, quản lý thông tin, lập kế hoạch, chăm chút quy trình.',
            },
            {
              icon: 'query_stats',
              title: 'Mạnh về phân tích',
              text: 'Khi có đủ dữ kiện, Ngọc suy nghĩ kỹ và ra quyết định chắc. Hợp học kỹ năng có tính ứng dụng dài hạn.',
            },
            {
              icon: 'speed',
              title: 'Cần tránh cầu toàn',
              text: 'Đừng đợi mọi thứ hoàn hảo mới bắt đầu. Năm 2026 nên ưu tiên tiến độ đều, mỗi ngày tốt lên một chút.',
            },
          ],
          keywords: ['Quản lý', 'Phân tích', 'Bền bỉ'],
        },
        {
          label: 'Tình cảm',
          title: 'Tình cảm',
          kicker: 'Sâu sắc, kén chọn, cần sự rõ ràng',
          tone: 'rose',
          panels: [
            {
              icon: 'diversity_1',
              title: 'Thương bằng hành động',
              text: 'Ngọc không nhất thiết nói nhiều, nhưng khi đã thương ai thì để ý những điều nhỏ và muốn chăm sóc thật tốt.',
            },
            {
              icon: 'chat_bubble',
              title: 'Nói sớm để nhẹ lòng',
              text: 'Tình cảm dễ bền hơn khi hai bên nói thẳng nhu cầu, ranh giới và điều đang buồn thay vì để tích lại.',
            },
            {
              icon: 'diamond',
              title: 'Giá trị của mình',
              text: 'Đừng hạ thấp tiêu chuẩn chỉ vì sợ mất lòng. Người hợp sẽ tôn trọng nhịp sống và sự tự trọng của Ngọc.',
            },
          ],
          keywords: ['Sâu sắc', 'Rõ ràng', 'Tôn trọng'],
        },
        {
          label: 'Cuộc sống',
          title: 'Cuộc sống và phúc đức',
          kicker: 'Được nâng đỡ khi giữ nhịp sống ổn định',
          tone: 'mint',
          panels: [
            {
              icon: 'spa',
              title: 'Phúc đến từ nếp sống',
              text: 'Khi ăn ngủ điều độ, học và làm có lịch, năng lượng tốt hơn và quyết định cũng sáng hơn.',
            },
            {
              icon: 'wb_sunny',
              title: 'Ra ngoài nhiều hơn',
              text: 'Lá số có chất nội tâm mạnh, nên cần chủ động tiếp xúc môi trường lành mạnh để cân bằng cảm xúc.',
            },
            {
              icon: 'self_improvement',
              title: 'Giảm áp lực vô hình',
              text: 'Không phải việc nào cũng cần tự mình gánh. Biết nhờ giúp đỡ là một cách giữ phúc cho mình.',
            },
          ],
          keywords: ['Cân bằng', 'Nhịp sống', 'Nâng đỡ'],
        },
        {
          label: 'Người thân',
          title: 'Người thân',
          kicker: 'Gắn kết nhưng cần mềm lời',
          tone: 'gold',
          panels: [
            {
              icon: 'family_restroom',
              title: 'Tình thương có sẵn',
              text: 'Với người thân, Ngọc thường quan tâm bằng việc làm. Đôi khi im lặng nhưng thật ra nghĩ rất nhiều.',
            },
            {
              icon: 'groups',
              title: 'Huynh đệ bạn bè',
              text: 'Các mối quan hệ gần cần sự công bằng. Nếu cảm thấy bị xem nhẹ, hãy nói bằng lời bình tĩnh trước.',
            },
            {
              icon: 'volunteer_activism',
              title: 'Mềm không phải yếu',
              text: 'Một câu nói dịu lại có thể giữ hòa khí, trong khi lòng mình vẫn giữ được quan điểm riêng.',
            },
          ],
          keywords: ['Gia đình', 'Công bằng', 'Dịu dàng'],
        },
        {
          label: 'Tài lộc',
          title: 'Tài bạch và quan lộc',
          kicker: 'Tiền đến từ năng lực bền bỉ',
          tone: 'ink',
          panels: [
            {
              icon: 'savings',
              title: 'Kiếm tiền bằng kỹ năng',
              text: 'Tài lộc hợp với đường học nghề chắc tay, làm việc có uy tín, tích lũy chậm mà bền.',
            },
            {
              icon: 'account_balance_wallet',
              title: 'Quản tiền có kế hoạch',
              text: 'Nên tách tiền chi tiêu, học tập và dự phòng. Khi tài chính rõ, tâm trí cũng bớt rối.',
            },
            {
              icon: 'trending_up',
              title: 'Cơ hội tăng dần',
              text: 'Quan lộc hợp cách đi từ nền tảng. Không cần nóng với thành công nhanh, vì đường dài mới là thế mạnh.',
            },
          ],
          keywords: ['Kỹ năng', 'Tích lũy', 'Đường dài'],
        },
        {
          label: '2026',
          title: 'Lời nhắn năm 2026',
          kicker: 'Bính Ngọ - 23 tuổi',
          tone: 'cover',
          panels: [
            {
              icon: 'flag',
              title: 'Chọn một mục tiêu chính',
              text: 'Năm nay nên gom năng lượng vào một hướng quan trọng: học, việc, sức khỏe, hoặc một kỹ năng có thể theo lâu dài.',
            },
            {
              icon: 'health_and_safety',
              title: 'Chăm sóc tinh thần',
              text: 'Đừng để lịch dày kín làm mình hết vui. Một ngày yên ổn cũng là một thành tựu đáng quý.',
            },
            {
              icon: 'favorite_border',
              title: 'Giữ người chất lượng',
              text: 'Quan hệ tốt là nơi mình được nói thật, được nghỉ, được lớn lên mà không phải diễn vai.',
            },
          ],
          keywords: ['Tập trung', 'Sức khỏe', 'Yêu mình'],
        },
      ],
    },
    {
      id: 'su-nghiep-23-25',
      title: 'Sự nghiệp 23-25 tuổi',
      subtitle: 'Gom nền, chọn trục chính, rồi bật lên',
      icon: 'rocket_launch',
      tone: 'gold',
      summary: 'Giai đoạn đầu trưởng thành: không cần thắng nhanh, cần chọn đúng nhịp và làm bền.',
      pages: [
        {
          label: 'Tuổi 23',
          title: 'Năm 2026: gom nền',
          kicker: 'Ổn định nhịp học/làm',
          tone: 'gold',
          panels: [
            {
              icon: 'filter_center_focus',
              title: 'Chọn một trục chính',
              text: 'Năm 2026 nên gom năng lượng vào một hướng quan trọng: học, việc, kỹ năng hoặc sức khỏe tinh thần. Càng ít phân tán, Ngọc càng dễ thấy mình tiến.',
            },
            {
              icon: 'event_available',
              title: 'Sửa lại lịch sống',
              text: 'Công việc tốt hơn khi nếp ngủ, ăn, học và nghỉ rõ hơn. Với Ngọc, nền sinh hoạt ổn là nền sự nghiệp ổn.',
            },
            {
              icon: 'self_improvement',
              title: 'Đừng tự ép quá sớm',
              text: 'Tuổi 23 là năm chỉnh nhịp. Chưa cần thắng lớn, chỉ cần biết mình đang đi hướng nào và giữ được độ đều.',
            },
          ],
          keywords: ['2026', 'Gom nền', 'Đều nhịp'],
        },
        {
          label: 'Tuổi 24',
          title: 'Năm 2027: rõ cơ hội',
          kicker: 'Kỹ năng dài hạn bắt đầu có đất',
          tone: 'mint',
          panels: [
            {
              icon: 'lightbulb',
              title: 'Cơ hội hiện hình',
              text: 'Nếu 2026 đã chỉnh nền, 2027 dễ cho Ngọc thấy việc nào hợp mình hơn. Cơ hội đến qua người hướng dẫn, dự án nhỏ hoặc một vai trò cần sự tỉ mỉ.',
            },
            {
              icon: 'school',
              title: 'Học thứ dùng được lâu',
              text: 'Nên ưu tiên kỹ năng có thể tích lũy: phân tích, quản lý quy trình, giao tiếp rõ, viết lách, ngoại ngữ hoặc công cụ chuyên môn.',
            },
            {
              icon: 'rule',
              title: 'Kỷ luật mềm',
              text: 'Không cần ép mình thành cỗ máy. Nhưng cần một lịch làm việc đủ rõ để cảm xúc không kéo Ngọc đổi hướng liên tục.',
            },
          ],
          keywords: ['2027', 'Cơ hội', 'Kỹ năng dài hạn'],
        },
        {
          label: 'Tuổi 25',
          title: 'Năm 2028: có thể bật lên',
          kicker: 'Nếu không đổi hướng quá nhiều',
          tone: 'rose',
          panels: [
            {
              icon: 'trending_up',
              title: 'Thành quả bắt đầu rõ',
              text: 'Năm 2028 hợp để Ngọc nhận vai trò lớn hơn, làm việc có tiếng nói hơn hoặc được tin vì đã chứng minh sự bền bỉ trước đó.',
            },
            {
              icon: 'workspace_premium',
              title: 'Uy tín là vốn quý',
              text: 'Lá số này không cần ồn ào để nổi bật. Khi Ngọc làm đúng hẹn, giữ lời và chăm chi tiết, người khác tự nhớ đến năng lực của Ngọc.',
            },
            {
              icon: 'warning',
              title: 'Tránh cầu toàn quá mức',
              text: 'Điểm nghẽn là chờ mọi thứ hoàn hảo mới dám bước. Tuổi 25 nên học cách đưa việc ra ánh sáng khi đã đủ tốt.',
            },
          ],
          keywords: ['2028', 'Bật lên', 'Uy tín'],
        },
        {
          label: 'Hướng hợp',
          title: 'Kiểu nghề hợp Ngọc',
          kicker: 'Tổ chức, quan sát, phân tích',
          tone: 'ink',
          panels: [
            {
              icon: 'account_tree',
              title: 'Chăm quy trình',
              text: 'Ngọc hợp việc cần nhìn mối nối giữa các bước, sắp xếp dữ liệu, chăm chất lượng và giữ cho mọi thứ chạy gọn hơn.',
            },
            {
              icon: 'visibility',
              title: 'Quan sát tốt',
              text: 'Lợi thế nằm ở khả năng nhận ra chi tiết người khác bỏ qua: thái độ khách hàng, lỗi nhỏ, nhịp đội nhóm hoặc rủi ro âm thầm.',
            },
            {
              icon: 'groups_2',
              title: 'Lãnh đạo mềm',
              text: 'Khi trưởng thành, Ngọc có thể dẫn dắt bằng sự ổn định và tinh tế hơn là bằng áp lực. Càng bình tĩnh, càng có lực.',
            },
          ],
          keywords: ['Tổ chức', 'Phân tích', 'Làm bền'],
        },
      ],
    },
    {
      id: 'tai-chinh-giau-co',
      title: 'Tài chính và khả năng giàu có',
      subtitle: 'Chậm mà chắc, tiền đến từ kỹ năng và sự tin cậy',
      icon: 'savings',
      tone: 'mint',
      summary: 'Đọc về cách Ngọc giữ tiền, kiếm tiền và xây sự giàu có theo kiểu bền bỉ.',
      pages: [
        {
          label: 'Dòng tiền',
          title: 'Tiền đến từ kỹ năng',
          kicker: 'Càng giỏi thật, càng dễ giữ tiền',
          tone: 'mint',
          panels: [
            {
              icon: 'build_circle',
              title: 'Kỹ năng là mỏ chính',
              text: 'Ngọc hợp kiếm tiền từ năng lực được mài lâu: chuyên môn, sự chỉn chu, khả năng chăm việc và làm người khác thấy yên tâm.',
            },
            {
              icon: 'verified',
              title: 'Sự tin cậy sinh tiền',
              text: 'Lá số này đẹp ở chữ tín. Khi người khác tin Ngọc giữ được chất lượng, cơ hội tài chính sẽ đến tự nhiên hơn.',
            },
            {
              icon: 'stacked_line_chart',
              title: 'Tích lũy đều',
              text: 'Không phải kiểu một đêm đổi đời. Dòng tiền của Ngọc hợp tăng theo từng bậc nhỏ, rõ nguồn, rõ kế hoạch.',
            },
          ],
          keywords: ['Kỹ năng', 'Tin cậy', 'Tích lũy'],
        },
        {
          label: 'Giàu có',
          title: 'Giàu kiểu chậm mà chắc',
          kicker: 'Không hợp nóng vội',
          tone: 'gold',
          panels: [
            {
              icon: 'hourglass_top',
              title: 'Chậm không phải thua',
              text: 'Khả năng giàu có của Ngọc nằm ở đường dài: biết giữ uy tín, biết học thêm, biết quản lý chi tiêu và không phá nền vì cảm xúc nhất thời.',
            },
            {
              icon: 'real_estate_agent',
              title: 'Tài sản từ nền tảng',
              text: 'Hợp tích lũy bằng quỹ dự phòng, kỹ năng tăng thu nhập, tài sản nhỏ nhưng chắc, hơn là chạy theo lời hứa lợi nhuận nhanh.',
            },
            {
              icon: 'psychology',
              title: 'Giàu khi tâm ổn',
              text: 'Khi tâm lý ổn, Ngọc ra quyết định tiền bạc sáng hơn. Khi buồn hoặc bất an, cần tránh mua sắm để tự an ủi quá tay.',
            },
          ],
          keywords: ['Chậm chắc', 'Tài sản', 'Tâm ổn'],
        },
        {
          label: 'Cảnh báo',
          title: 'Dễ chi vì cảm xúc',
          kicker: 'Nhất là cho người mình thương',
          tone: 'rose',
          panels: [
            {
              icon: 'favorite',
              title: 'Chi để chăm người khác',
              text: 'Ngọc có thể rộng tay với người thân, người yêu hoặc bạn bè thân. Tốt bụng là đẹp, nhưng cần biết phần nào là yêu thương, phần nào là tự quên mình.',
            },
            {
              icon: 'shopping_bag',
              title: 'Chi để tự trấn an',
              text: 'Khi căng thẳng, Ngọc dễ muốn mua một thứ gì đó để thấy mình đỡ nặng. Trước khi chi lớn, hãy để cảm xúc nguội qua một đêm.',
            },
            {
              icon: 'front_hand',
              title: 'Ranh giới tài chính',
              text: 'Không nên cho mượn hoặc gánh hộ quá khả năng. Người thương Ngọc thật sẽ không bắt Ngọc mất an toàn để chứng minh tình cảm.',
            },
          ],
          keywords: ['Cảm xúc', 'Ranh giới', 'Người thân'],
        },
        {
          label: 'Cách đi',
          title: 'Bốn ngăn tiền',
          kicker: 'Sống, học, dự phòng, đầu tư bản thân',
          tone: 'ink',
          panels: [
            {
              icon: 'wallet',
              title: 'Tách tiền rõ',
              text: 'Ngọc nên có bốn ngăn: tiền sống, tiền học, tiền dự phòng và tiền đầu tư bản thân. Tách ra rồi sẽ bớt cảm giác tiền cứ tự biến mất.',
            },
            {
              icon: 'edit_note',
              title: 'Ghi lại dòng chảy',
              text: 'Không cần bảng quá phức tạp. Chỉ cần cuối tuần nhìn lại mình đã chi cho điều gì, có đáng không, có lặp lại vì cảm xúc không.',
            },
            {
              icon: 'compare_arrows',
              title: 'Đừng so đường tiền',
              text: 'So với người khác dễ làm Ngọc vội. Lá số này hợp giàu bằng nhịp riêng: ít nhiễu, ít khoe, nhưng càng về sau càng chắc.',
            },
          ],
          keywords: ['4 ngăn', 'Dự phòng', 'Đầu tư bản thân'],
        },
      ],
    },
    {
      id: 'van-han-2026-2030',
      title: 'Vận hạn 2026-2030',
      subtitle: 'Từng năm: trọng tâm, cơ hội, rủi ro và lời khuyên',
      icon: 'calendar_month',
      tone: 'ink',
      summary: 'Một lịch đọc tham khảo cho 5 năm tới, cụ thể nhưng không đóng khung số phận.',
      pages: [
        {
          label: '2026',
          title: '2026: ổn định lại nhịp sống',
          kicker: 'Chữa lành quan hệ, gom nền tinh thần',
          tone: 'gold',
          panels: [
            {
              icon: 'track_changes',
              title: 'Trọng tâm',
              text: 'Ổn định nhịp học/làm, chăm lại giấc ngủ, cảm xúc và những quan hệ thân. Đây là năm sửa nền hơn là lao vào thắng lớn.',
            },
            {
              icon: 'wb_sunny',
              title: 'Cơ hội',
              text: 'Có cơ hội làm rõ ai thật sự đồng hành với Ngọc, đồng thời tìm lại một kỹ năng hoặc định hướng từng bị bỏ dở.',
            },
            {
              icon: 'shield',
              title: 'Rủi ro & lời khuyên',
              text: 'Dễ ôm chuyện gia đình hoặc tình cảm vào người. Hãy đặt lịch nghỉ, nói rõ giới hạn và chọn một việc chính để làm đến nơi.',
            },
          ],
          keywords: ['2026', 'Chữa lành', 'Ổn định'],
        },
        {
          label: '2027',
          title: '2027: thử thách định hướng',
          kicker: 'Kỷ luật quyết định độ tiến',
          tone: 'mint',
          panels: [
            {
              icon: 'explore',
              title: 'Trọng tâm',
              text: 'Ngọc cần chọn hướng rõ hơn: học sâu một kỹ năng, nhận một vai trò mới hoặc quyết định mình muốn xây loại cuộc sống nào.',
            },
            {
              icon: 'door_open',
              title: 'Cơ hội',
              text: 'Cơ hội đến qua người hướng dẫn, nhóm làm việc hoặc dự án cần sự tỉ mỉ. Nếu Ngọc giữ lời, uy tín sẽ tăng nhanh.',
            },
            {
              icon: 'warning',
              title: 'Rủi ro & lời khuyên',
              text: 'Dễ nản khi kết quả chưa đẹp ngay. Đừng đổi hướng vì một tuần mệt; hãy đo tiến bộ theo tháng.',
            },
          ],
          keywords: ['2027', 'Định hướng', 'Kỷ luật'],
        },
        {
          label: '2028',
          title: '2028: cơ hội tăng nếu có nền',
          kicker: 'Bật lên bằng năng lực thật',
          tone: 'rose',
          panels: [
            {
              icon: 'rocket_launch',
              title: 'Trọng tâm',
              text: 'Đây là năm hợp mở rộng vai trò, tăng thu nhập hoặc nhận trách nhiệm lớn hơn nếu hai năm trước đã xây đủ nền.',
            },
            {
              icon: 'workspace_premium',
              title: 'Cơ hội',
              text: 'Có thể được nhìn nhận bởi sự chắc chắn, khả năng chăm chi tiết và cách Ngọc xử lý việc khó mà không ồn ào.',
            },
            {
              icon: 'balance',
              title: 'Rủi ro & lời khuyên',
              text: 'Càng nhiều cơ hội càng cần chọn lọc. Đừng nhận mọi thứ chỉ vì sợ làm người khác thất vọng.',
            },
          ],
          keywords: ['2028', 'Bật lên', 'Chọn lọc'],
        },
        {
          label: '2029',
          title: '2029: lọc quan hệ',
          kicker: 'Tránh ôm cảm xúc quá lâu',
          tone: 'ink',
          panels: [
            {
              icon: 'groups_2',
              title: 'Trọng tâm',
              text: 'Năm này nhấn vào chất lượng quan hệ. Ngọc sẽ thấy rõ ai làm mình nhẹ hơn, ai khiến mình phải đoán và gồng quá nhiều.',
            },
            {
              icon: 'favorite',
              title: 'Cơ hội',
              text: 'Nếu biết nói thật cảm xúc, Ngọc có thể xây quan hệ sâu và trưởng thành hơn, cả trong tình cảm lẫn bạn bè thân.',
            },
            {
              icon: 'waves',
              title: 'Rủi ro & lời khuyên',
              text: 'Dễ giữ buồn trong lòng rồi lạnh đi. Hãy nói sớm, nói mềm, và đừng để một mối quan hệ hút hết năng lượng sống.',
            },
          ],
          keywords: ['2029', 'Lọc quan hệ', 'Nói mềm'],
        },
        {
          label: '2030',
          title: '2030: chốt hướng trưởng thành',
          kicker: 'Công việc và tình cảm rõ nét hơn',
          tone: 'gold',
          panels: [
            {
              icon: 'flag',
              title: 'Trọng tâm',
              text: 'Ngọc có xu hướng muốn một hướng sống rõ: công việc bền hơn, tình cảm nghiêm túc hơn, và ít chấp nhận sự mập mờ.',
            },
            {
              icon: 'real_estate_agent',
              title: 'Cơ hội',
              text: 'Hợp đặt nền cho tài chính, học chuyên sâu, thay đổi môi trường làm việc hoặc bàn chuyện dài hạn nếu tình cảm đủ chắc.',
            },
            {
              icon: 'self_improvement',
              title: 'Rủi ro & lời khuyên',
              text: 'Đừng biến trưởng thành thành gánh nặng phải ổn mọi lúc. Hướng đi đẹp nhất là vừa có kế hoạch, vừa có khoảng thở.',
            },
          ],
          keywords: ['2030', 'Trưởng thành', 'Dài hạn'],
        },
      ],
    },
    {
      id: 'mat-toi-tam-ly',
      title: 'Mặt tối tâm lý',
      subtitle: 'Vùng bóng bên trong lá số',
      icon: 'dark_mode',
      tone: 'ink',
      summary: 'Một cuốn đọc chậm về nỗi sợ bị xem thường, nhu cầu kiểm soát và cách tự làm mềm mình.',
      pages: [
        {
          label: 'Bóng tối',
          title: 'Vỏ bình tĩnh',
          kicker: 'Không lạnh, chỉ đang tự giữ mình',
          tone: 'ink',
          panels: [
            {
              icon: 'nightlight',
              title: 'Bình tĩnh như áo giáp',
              text: 'Ngọc có thể trông rất ổn kể cả khi bên trong đang chao. Vẻ bình tĩnh giúp giữ thể diện, nhưng cũng làm người khác khó nhận ra lúc Ngọc cần được ôm.',
            },
            {
              icon: 'visibility_off',
              title: 'Giấu tổn thương kỹ',
              text: 'Khi bị chạm vào lòng tự trọng, phản ứng đầu tiên thường không phải khóc mà là im, quan sát, rồi tự thu mình lại.',
            },
            {
              icon: 'favorite',
              title: 'Điểm cần nhớ',
              text: 'Mặt tối này không xấu. Nó từng bảo vệ Ngọc. Chỉ là lớn hơn rồi, mình có thể chọn cách bảo vệ dịu hơn.',
            },
          ],
          keywords: ['Bình tĩnh', 'Tự vệ', 'Nhạy cảm'],
        },
        {
          label: 'Kiểm soát',
          title: 'Nỗi sợ mất kiểm soát',
          kicker: 'Khi mọi thứ lệch khỏi kế hoạch',
          tone: 'rose',
          panels: [
            {
              icon: 'tune',
              title: 'Muốn mọi thứ rõ ràng',
              text: 'Tử Vi, Thiên Phủ cho cảm giác cần trật tự. Khi sự việc mập mờ, Ngọc dễ tự nghĩ nhiều để tìm lại cảm giác an toàn.',
            },
            {
              icon: 'sync_problem',
              title: 'Dễ căng vì điều nhỏ',
              text: 'Một tin nhắn chậm, một thái độ lạ, một lời hứa chưa chắc cũng có thể làm đầu óc chạy nhiều vòng.',
            },
            {
              icon: 'self_improvement',
              title: 'Cách hạ nhiệt',
              text: 'Hãy hỏi: “Mình đang cần sự thật, hay đang cần cảm giác được trấn an?” Câu hỏi này kéo Ngọc về hiện tại rất nhanh.',
            },
          ],
          keywords: ['An toàn', 'Rõ ràng', 'Trấn an'],
        },
        {
          label: 'Phòng thủ',
          title: 'Khi tự trọng thành phòng thủ',
          kicker: 'Sợ bị xem thường nên tự đứng cao',
          tone: 'gold',
          panels: [
            {
              icon: 'shield',
              title: 'Không muốn bị thương hại',
              text: 'Ngọc có thể ngại cho người khác thấy mình yếu, vì sâu bên trong rất sợ bị đánh giá là phiền, yếu đuối hoặc không đủ giỏi.',
            },
            {
              icon: 'bolt',
              title: 'Lời nói sắc khi đau',
              text: 'Khi tổn thương bị dồn lâu, lời nói có thể trở nên lạnh hoặc gắt. Thật ra đó là phần tự trọng đang cố giành lại vị trí.',
            },
            {
              icon: 'handshake',
              title: 'Hóa giải',
              text: 'Tập nói sớm bằng câu mềm: “Điều này làm mình hơi chạnh lòng.” Nói sớm thì không cần nói đau.',
            },
          ],
          keywords: ['Tự trọng', 'Ranh giới', 'Nói sớm'],
        },
        {
          label: 'Chữa lành',
          title: 'Cách hóa giải',
          kicker: 'Không thắng bóng tối, chỉ cần hiểu nó',
          tone: 'mint',
          panels: [
            {
              icon: 'spa',
              title: 'Cho mình quyền cần người khác',
              text: 'Không phải lúc nào mạnh cũng là tự làm một mình. Có ngày mạnh mẽ nhất là biết nói: “Mình cần bạn ở đây.”',
            },
            {
              icon: 'edit_note',
              title: 'Viết ra trước khi phản ứng',
              text: 'Khi lòng tự trọng nổi lên, hãy viết ba dòng: mình thấy gì, mình sợ gì, mình thật sự cần gì.',
            },
            {
              icon: 'wb_sunny',
              title: 'Bản lĩnh mềm',
              text: 'Phiên bản đẹp nhất của Ngọc không phải người không tổn thương, mà là người biết chăm phần tổn thương đó rất tử tế.',
            },
          ],
          keywords: ['Hiểu mình', 'Mềm lại', 'Tử tế'],
        },
      ],
    },
    {
      id: 'tinh-cach-an-sau',
      title: 'Tính cách ẩn sâu',
      subtitle: 'Điểm mạnh, điểm yếu và cơ chế tự bảo vệ',
      icon: 'psychology',
      tone: 'rose',
      summary: 'Một cuốn soi kỹ phần tính cách ít nói ra: trách nhiệm, overthinking, khó buông và lúc thất vọng.',
      pages: [
        {
          label: 'Nhìn thấy',
          title: 'Điểm mạnh nhìn thấy',
          kicker: 'Có trách nhiệm và biết quan sát',
          tone: 'mint',
          panels: [
            {
              icon: 'task_alt',
              title: 'Đáng tin trong việc khó',
              text: 'Ngọc thường không hứa bừa. Khi đã nhận, Ngọc muốn làm đến nơi đến chốn, vì danh dự cá nhân nằm trong chất lượng việc mình làm.',
            },
            {
              icon: 'center_focus_strong',
              title: 'Quan sát tinh',
              text: 'Ngọc dễ nhận ra thay đổi nhỏ trong giọng nói, nét mặt, cách người khác cư xử. Đây là trực giác xã hội khá mạnh.',
            },
            {
              icon: 'local_fire_department',
              title: 'Có lửa bên trong',
              text: 'Bên ngoài có thể điềm, nhưng bên trong là kiểu người không thích thua chính mình.',
            },
          ],
          keywords: ['Đáng tin', 'Tinh ý', 'Có lửa'],
        },
        {
          label: 'Ẩn sâu',
          title: 'Điểm yếu ít ai biết',
          kicker: 'Overthinking và khó buông',
          tone: 'rose',
          panels: [
            {
              icon: 'all_inclusive',
              title: 'Nghĩ nhiều để tự bảo vệ',
              text: 'Ngọc không nghĩ nhiều vì yếu. Ngọc nghĩ nhiều vì muốn chuẩn bị trước mọi khả năng để không bị động.',
            },
            {
              icon: 'inventory_2',
              title: 'Giữ chuyện cũ lâu',
              text: 'Những câu nói nhỏ nhưng chạm tự trọng có thể nằm lại rất lâu. Ngọc có thể tha thứ, nhưng không dễ quên cảm giác lúc đó.',
            },
            {
              icon: 'hourglass_top',
              title: 'Mệt vì không buông vai',
              text: 'Một phần bên trong luôn muốn làm người hiểu chuyện. Nhưng người hiểu chuyện quá lâu cũng cần được hiểu lại.',
            },
          ],
          keywords: ['Overthinking', 'Khó buông', 'Hiểu chuyện'],
        },
        {
          label: 'Tự vệ',
          title: 'Cơ chế tự bảo vệ',
          kicker: 'Im lặng, rút lui, tự làm lấy',
          tone: 'ink',
          panels: [
            {
              icon: 'do_not_disturb_on',
              title: 'Im để khỏi nổ',
              text: 'Khi cảm xúc quá đầy, Ngọc có xu hướng im trước. Im không phải không quan tâm, mà là sợ nói ra sẽ quá sắc.',
            },
            {
              icon: 'lock',
              title: 'Tự đóng cửa lòng',
              text: 'Nếu ai đó làm Ngọc thất vọng nhiều lần, Ngọc không cần cãi lớn. Cửa sẽ đóng chậm, nhưng khá chắc.',
            },
            {
              icon: 'construction',
              title: 'Tự sửa mọi thứ',
              text: 'Ngọc dễ chọn cách tự xử lý, tự ổn, tự chịu. Điểm này mạnh trong công việc nhưng dễ cô đơn trong tình cảm.',
            },
          ],
          keywords: ['Im lặng', 'Rút lui', 'Tự chịu'],
        },
        {
          label: 'Trưởng thành',
          title: 'Phiên bản trưởng thành hơn',
          kicker: 'Mạnh mà vẫn biết mềm',
          tone: 'gold',
          panels: [
            {
              icon: 'forum',
              title: 'Nói nhu cầu rõ hơn',
              text: 'Không cần giải thích quá nhiều. Chỉ cần nói đúng: “Mình cần sự rõ ràng”, “Mình cần được tôn trọng”, “Mình cần nghỉ.”',
            },
            {
              icon: 'balance',
              title: 'Bớt ôm trách nhiệm lạ',
              text: 'Không phải cảm xúc của ai Ngọc cũng phải chữa. Không phải kỳ vọng của ai Ngọc cũng phải gánh.',
            },
            {
              icon: 'emoji_objects',
              title: 'Đẹp nhất khi tự do',
              text: 'Khi Ngọc không còn cố chứng minh mình ổn, sự thông minh và ấm áp tự nhiên sẽ hiện ra nhiều hơn.',
            },
          ],
          keywords: ['Rõ nhu cầu', 'Bớt gánh', 'Tự do'],
        },
      ],
    },
    {
      id: 'tinh-duyen',
      title: 'Tình duyên và tuổi cưới',
      subtitle: 'Số lần yêu lớn, kiểu người hợp và mốc kết hôn đẹp',
      icon: 'favorite',
      tone: 'rose',
      summary: 'Một cuốn cụ thể mềm về chuyện yêu: xu hướng 2-3 mối sâu, bài học cảm xúc và tuổi cưới tham khảo.',
      pages: [
        {
          label: 'Kiểu yêu',
          title: 'Kiểu yêu của Ngọc',
          kicker: 'Chậm mở lòng, sâu khi đã tin',
          tone: 'rose',
          panels: [
            {
              icon: 'favorite',
              title: 'Không yêu hời hợt',
              text: 'Ngọc có xu hướng quan sát trước khi trao lòng. Khi đã tin, tình cảm không chỉ là thích mà còn là muốn đồng hành và chăm nhau.',
            },
            {
              icon: 'visibility',
              title: 'Cần sự chắc chắn',
              text: 'Người làm Ngọc yên không nhất thiết quá hào nhoáng, nhưng phải rõ ràng, giữ lời và không để Ngọc đoán ý quá lâu.',
            },
            {
              icon: 'chat_bubble',
              title: 'Điểm cần học',
              text: 'Đừng bắt người kia tự hiểu hết. Tình yêu đẹp hơn khi Ngọc nói thẳng điều mình cần bằng giọng mềm.',
            },
          ],
          keywords: ['Sâu sắc', 'Chậm tin', 'Rõ ràng'],
        },
        {
          label: 'Rung động',
          title: 'Người dễ làm Ngọc rung động',
          kicker: 'Điềm, thật, có trách nhiệm',
          tone: 'mint',
          panels: [
            {
              icon: 'handshake',
              title: 'Người nói được làm được',
              text: 'Ngọc dễ bị thu hút bởi người ổn định, biết giữ lời, có định hướng và không làm tình cảm thành trò kéo co.',
            },
            {
              icon: 'psychology',
              title: 'Người hiểu khoảng lặng',
              text: 'Vì Ngọc có nhiều lớp cảm xúc, người hợp là người không ép Ngọc phải vui ngay, nhưng cũng không bỏ mặc khi Ngọc im.',
            },
            {
              icon: 'block',
              title: 'Mẫu nên tránh',
              text: 'Người mập mờ, thích thử lòng, nóng lạnh thất thường dễ kích hoạt nỗi sợ mất kiểm soát và làm Ngọc mệt rất nhanh.',
            },
          ],
          keywords: ['Giữ lời', 'Điềm', 'Không mập mờ'],
        },
        {
          label: 'Mối lớn',
          title: 'Số lần yêu lớn',
          kicker: 'Xu hướng 2-3 mối tình sâu',
          tone: 'gold',
          panels: [
            {
              icon: 'looks_two',
              title: 'Hai đến ba lần sâu',
              text: 'Theo hướng đọc tham khảo, Ngọc có xu hướng có 2-3 mối tình thật sự để lại dấu ấn, không tính những rung động ngắn hoặc chưa đủ sâu.',
            },
            {
              icon: 'school',
              title: 'Một mối là bài học',
              text: 'Trong đó dễ có một mối dạy Ngọc về ranh giới: yêu không phải tự chịu hết, cũng không phải hạ tiêu chuẩn để giữ người.',
            },
            {
              icon: 'diamond',
              title: 'Mối bền đến muộn hơn',
              text: 'Tình cảm ổn thường đến khi Ngọc hiểu rõ mình cần gì, không còn chọn người chỉ vì cảm xúc mạnh lúc đầu.',
            },
          ],
          keywords: ['2-3 mối sâu', 'Ranh giới', 'Trưởng thành'],
        },
        {
          label: 'Tuổi cưới',
          title: 'Tuổi đẹp để cưới',
          kicker: '25-27 hoặc 29-31',
          tone: 'ink',
          panels: [
            {
              icon: 'celebration',
              title: 'Mốc 25-27',
              text: 'Nếu công việc và nội tâm đã ổn, 25-27 là khoảng đẹp để tính chuyện cam kết vì còn nhiều năng lượng xây dựng cùng nhau.',
            },
            {
              icon: 'verified_user',
              title: 'Mốc 29-31',
              text: 'Nếu muốn chắc chắn hơn, 29-31 hợp với phiên bản chín chắn, ít áp lực chứng minh, biết chọn người vì bình yên lâu dài.',
            },
            {
              icon: 'favorite_border',
              title: 'Điều kiện đẹp nhất',
              text: 'Tuổi chỉ là mốc tham khảo. Đẹp nhất vẫn là cưới khi Ngọc được là mình, được tôn trọng và hai người có cùng cách xây đời sống.',
            },
          ],
          keywords: ['25-27', '29-31', 'Bình yên'],
        },
      ],
    },
    {
      id: 'khia-canh-tiep',
      title: 'Các khía cạnh tiếp theo',
      subtitle: 'Bạn bè, tiền bạc, sức khỏe tinh thần, gia đình, 2026',
      icon: 'explore',
      tone: 'mint',
      summary: 'Một cuốn gợi mở thêm nhiều hướng đọc nếu muốn phát triển trang này thành bộ truyện dài.',
      pages: [
        {
          label: 'Quan hệ',
          title: 'Bạn bè và vòng quan hệ',
          kicker: 'Ai làm Ngọc sáng, ai làm Ngọc hao',
          tone: 'mint',
          panels: [
            {
              icon: 'groups',
              title: 'Hợp người tử tế rõ ràng',
              text: 'Ngọc hợp với người nói thẳng, sống có trước sau, không biến tình bạn thành cuộc thi hơn thua âm thầm.',
            },
            {
              icon: 'battery_alert',
              title: 'Dễ hao vì người tiêu cực',
              text: 'Ngọc nhạy với không khí xung quanh, nên ở lâu cạnh người than phiền, mập mờ hoặc hay đổ lỗi sẽ rất nhanh xuống năng lượng.',
            },
            {
              icon: 'filter_vintage',
              title: 'Vòng nhỏ mà chất',
              text: 'Không cần quá nhiều bạn. Một vài người an toàn, vui lành và biết tôn trọng ranh giới đã đủ làm đời sống nhẹ hơn.',
            },
          ],
          keywords: ['Bạn bè', 'Năng lượng', 'Ranh giới'],
        },
        {
          label: 'Tiền bạc',
          title: 'Tiền và thói quen tiêu',
          kicker: 'Chậm chắc, tránh chi vì cảm xúc',
          tone: 'gold',
          panels: [
            {
              icon: 'savings',
              title: 'Hợp tích lũy dài hạn',
              text: 'Ngọc hợp kiểu tiền đến từ kỹ năng, uy tín và sự đều đặn. Càng có kế hoạch, tài chính càng bớt làm tâm trí rối.',
            },
            {
              icon: 'shopping_bag',
              title: 'Cẩn thận mua để tự an ủi',
              text: 'Khi căng thẳng, Ngọc có thể muốn mua thứ gì đó để thấy mình ổn hơn. Không sai, nhưng cần một hạn mức mềm.',
            },
            {
              icon: 'account_balance_wallet',
              title: 'Công thức nhẹ',
              text: 'Tách tiền thành ba ngăn: sống, học, dự phòng. Chỉ cần rõ ba ngăn này, Ngọc đã tự tạo cảm giác an toàn rất tốt.',
            },
          ],
          keywords: ['Tích lũy', 'Hạn mức', 'An toàn'],
        },
        {
          label: 'Tinh thần',
          title: 'Sức khỏe tinh thần',
          kicker: 'Dấu hiệu quá tải và cách cân bằng',
          tone: 'rose',
          panels: [
            {
              icon: 'warning',
              title: 'Dấu hiệu quá tải',
              text: 'Ngọc nên để ý lúc mình dễ cáu, muốn biến mất, ngủ không sâu hoặc thấy việc nhỏ cũng nặng. Đó là tín hiệu cần nghỉ.',
            },
            {
              icon: 'self_improvement',
              title: 'Cách cân bằng',
              text: 'Đi bộ, viết vài dòng, tắt thông báo một lúc, ăn đúng bữa. Những việc rất nhỏ lại kéo Ngọc về thân thể nhanh nhất.',
            },
            {
              icon: 'health_and_safety',
              title: 'Đừng tự chữa một mình mãi',
              text: 'Nếu một nỗi buồn lặp lại quá lâu, hãy nói với người đáng tin hoặc tìm hỗ trợ phù hợp. Mạnh mẽ không đồng nghĩa cô độc.',
            },
          ],
          keywords: ['Quá tải', 'Nghỉ', 'Hỗ trợ'],
        },
        {
          label: '2026',
          title: 'Năm 2026 theo từng mùa',
          kicker: 'Gom lực, thử thách, ổn định',
          tone: 'cover',
          panels: [
            {
              icon: 'filter_1',
              title: 'Đầu năm: gom lực',
              text: 'Đầu năm hợp đặt lại nếp sống, học kỹ năng, dọn bớt những quan hệ hoặc thói quen làm mình tốn sức.',
            },
            {
              icon: 'filter_2',
              title: 'Giữa năm: thử cảm xúc',
              text: 'Giữa năm dễ có việc khiến Ngọc phải chọn rõ: tiếp tục gồng hay nói thật nhu cầu của mình.',
            },
            {
              icon: 'filter_3',
              title: 'Cuối năm: ổn định lại',
              text: 'Cuối năm hợp chốt một hướng bền: công việc nền tảng, quan hệ chất lượng, kế hoạch tài chính hoặc chăm sóc bản thân.',
            },
          ],
          keywords: ['Đầu năm', 'Giữa năm', 'Cuối năm'],
        },
      ],
    },
  ];

  readonly activeStoryId = signal<string | null>(null);
  readonly currentPage = signal(0);
  readonly flipDirection = signal<'next' | 'prev' | null>(null);
  readonly isLibrary = computed(() => this.activeStoryId() === null);
  readonly activeStory = computed(
    () => this.stories.find((story) => story.id === this.activeStoryId()) ?? this.stories[0],
  );
  readonly activePage = computed(() => this.activeStory().pages[this.currentPage()]);
  readonly pageProgress = computed(
    () => ((this.currentPage() + 1) / this.activeStory().pages.length) * 100,
  );

  openStory(storyId: string): void {
    this.activeStoryId.set(storyId);
    this.currentPage.set(0);
    this.flipDirection.set(null);
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  closeStory(): void {
    this.activeStoryId.set(null);
    this.currentPage.set(0);
    this.flipDirection.set(null);
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  goHome(): void {
    this.turnTo(0, 'prev');
  }

  previous(): void {
    this.turnTo(this.currentPage() - 1, 'prev');
  }

  next(): void {
    this.turnTo(this.currentPage() + 1, 'next');
  }

  private turnTo(index: number, direction: 'next' | 'prev'): void {
    if (index < 0 || index >= this.activeStory().pages.length || index === this.currentPage()) {
      return;
    }

    this.flipDirection.set(direction);
    window.setTimeout(() => {
      this.currentPage.set(index);
      window.setTimeout(() => this.flipDirection.set(null), 260);
    }, 160);
  }
}
