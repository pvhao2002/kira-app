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
  selector: 'app-tu-vi-pvhao',
  imports: [RouterLink],
  templateUrl: './tu-vi-pvhao.html',
  styleUrl: '../tu-vi-be-ngoc/tu-vi-be-ngoc.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TuViPvhao {
  readonly stories: TuViStory[] = [
    {
      id: 'than-so-hoc',
      title: 'Thần số học đối chiếu',
      subtitle: '23-08-2002: đường đời 8, ngày sinh 23/5',
      icon: 'pin',
      tone: 'gold',
      summary: 'Đối chiếu ngày sinh với khí chất cá nhân: tham vọng, linh hoạt, thực tế và áp lực thành tựu.',
      pages: [
        {
          label: 'Đường đời',
          title: 'Đường đời 8',
          kicker: 'Tham vọng, quản trị, thực tế',
          tone: 'ink',
          panels: [
            {
              icon: 'leaderboard',
              title: 'Muốn tạo kết quả rõ',
              text: '23-08-2002 cộng lại thành 8, thường gắn với năng lực quản trị, tham vọng và nhu cầu thấy thành quả cụ thể từ công sức mình bỏ ra.',
            },
            {
              icon: 'account_tree',
              title: 'Có đầu óc hệ thống',
              text: 'Số 8 hợp với việc nhìn bức tranh lớn, phân bổ nguồn lực, tối ưu quy trình và chịu trách nhiệm cho kết quả cuối.',
            },
            {
              icon: 'warning',
              title: 'Áp lực thành tựu',
              text: 'Mặt trái là dễ tự đo giá trị bằng việc mình làm được gì. Khi chậm tiến, Hào có thể tự nghiêm khắc với bản thân hơn mức cần thiết.',
            },
          ],
          keywords: ['Số 8', 'Thành tựu', 'Quản trị'],
        },
        {
          label: 'Ngày sinh',
          title: 'Ngày sinh 23/5',
          kicker: 'Linh hoạt, giao tiếp, thích tự do',
          tone: 'mint',
          panels: [
            {
              icon: 'forum',
              title: 'Tư duy nhanh',
              text: 'Số 23 rút về 5, gợi ý khả năng thích nghi, giao tiếp và xoay chuyển nhanh khi môi trường thay đổi.',
            },
            {
              icon: 'travel_explore',
              title: 'Không thích bị bó',
              text: 'Hào dễ mất hứng nếu công việc quá lặp lại, thiếu không gian thử nghiệm hoặc không cho mình cảm giác đang tiến lên.',
            },
            {
              icon: 'balance',
              title: 'Cần một trục chính',
              text: 'Số 5 cần tự do, số 8 cần thành tựu. Hai lực này đẹp nhất khi Hào có một mục tiêu lớn nhưng cách đi đủ linh hoạt.',
            },
          ],
          keywords: ['23/5', 'Linh hoạt', 'Tự do'],
        },
        {
          label: 'Năm sinh',
          title: 'Năm sinh 2002 → 4',
          kicker: 'Bài học xây nền và kỷ luật',
          tone: 'rose',
          panels: [
            {
              icon: 'foundation',
              title: 'Nền móng là gốc',
              text: '2002 rút về 4, nhắc Hào rằng tài năng chỉ thật sự mạnh khi được đặt trên nền kỷ luật, quy trình và khả năng làm đều.',
            },
            {
              icon: 'construction',
              title: 'Không ngại việc khó',
              text: 'Số 4 giúp Hào chịu được những giai đoạn xây nền, học sâu, sửa lỗi và làm việc chưa ai nhìn thấy ngay.',
            },
            {
              icon: 'hourglass_top',
              title: 'Bớt nóng với kết quả',
              text: 'Khi số 8 muốn thắng nhanh, số 4 nhắc rằng đường bền mới giữ được thành quả lâu.',
            },
          ],
          keywords: ['Số 4', 'Kỷ luật', 'Xây nền'],
        },
        {
          label: '2026',
          title: 'Năm cá nhân 2026',
          kicker: 'Năng lượng số 5',
          tone: 'gold',
          panels: [
            {
              icon: 'moving',
              title: 'Năm của thay đổi',
              text: '23 + 8 + 2026 rút về 5, hợp mở hướng mới, thử cách làm mới, dịch chuyển môi trường hoặc làm mới một kế hoạch cũ.',
            },
            {
              icon: 'scatter_plot',
              title: 'Cẩn thận phân tán',
              text: 'Năm số 5 nhiều cơ hội nhưng cũng nhiều nhiễu. Nếu ôm quá nhiều hướng, Hào dễ thấy bận mà chưa chắc tiến.',
            },
            {
              icon: 'flag',
              title: 'Một trục, nhiều thử nghiệm',
              text: 'Cách đi đẹp: giữ một mục tiêu chính, cho phép mình thử nghiệm quanh mục tiêu đó, rồi chốt lại bằng dữ liệu thật.',
            },
          ],
          keywords: ['2026', 'Thay đổi', 'Tập trung'],
        },
      ],
    },
    {
      id: 'cung-hoang-dao',
      title: 'Cung hoàng đạo Xử Nữ',
      subtitle: '23/08 - giáp ranh, đọc theo hướng Xử Nữ tham khảo',
      icon: 'grain',
      tone: 'mint',
      summary: 'Một câu chuyện về tiêu chuẩn cao, tư duy phân tích, sự thực tế và thói quen tự soi lỗi.',
      pages: [
        {
          label: 'Xử Nữ',
          title: 'Khí chất Xử Nữ',
          kicker: 'Phân tích, kỹ tính, thực tế',
          tone: 'mint',
          panels: [
            {
              icon: 'query_stats',
              title: 'Nhìn ra chi tiết',
              text: 'Ngày 23/08 nằm sát ranh cung, nên phần này đọc theo Xử Nữ tham khảo. Nét nổi bật là khả năng soi cấu trúc, lỗi nhỏ và cách tối ưu.',
            },
            {
              icon: 'rule',
              title: 'Tiêu chuẩn cao',
              text: 'Hào dễ không hài lòng với câu trả lời nửa vời. Khi làm việc, thường muốn hiểu bản chất thay vì chỉ làm cho xong.',
            },
            {
              icon: 'build',
              title: 'Thực tế hơn mơ mộng',
              text: 'Xử Nữ giúp Hào kéo ý tưởng về mặt đất: cái gì đo được, sửa được, vận hành được thì mới thật sự có giá trị.',
            },
          ],
          keywords: ['Xử Nữ', 'Phân tích', 'Thực tế'],
        },
        {
          label: 'Mặt trong',
          title: 'Dễ tự soi lỗi',
          kicker: 'Thấy điểm chưa ổn trước khi thấy mình tốt',
          tone: 'rose',
          panels: [
            {
              icon: 'search',
              title: 'Khó bỏ qua lỗi nhỏ',
              text: 'Một chi tiết lệch có thể nằm trong đầu Hào khá lâu. Điều này giúp làm việc kỹ, nhưng cũng dễ khiến bản thân căng.',
            },
            {
              icon: 'psychology',
              title: 'Tự phê bình mạnh',
              text: 'Khi chưa đạt kỳ vọng, Hào có thể phân tích mình sai ở đâu rất nhanh, đôi khi nhanh hơn cả việc công nhận phần mình đã làm tốt.',
            },
            {
              icon: 'spa',
              title: 'Cách cân bằng',
              text: 'Hãy sửa lỗi như một kỹ sư, nhưng đối xử với mình như một người bạn. Lỗi là dữ liệu, không phải bản án.',
            },
          ],
          keywords: ['Tự soi', 'Tiêu chuẩn', 'Dữ liệu'],
        },
        {
          label: 'Đối chiếu',
          title: 'Xử Nữ gặp số 8',
          kicker: 'Muốn làm tốt và muốn thắng rõ',
          tone: 'gold',
          panels: [
            {
              icon: 'workspace_premium',
              title: 'Chất lượng đi cùng thành tựu',
              text: 'Xử Nữ muốn làm đúng, số 8 muốn có kết quả lớn. Kết hợp này hợp với công việc cần tiêu chuẩn, trách nhiệm và năng lực triển khai.',
            },
            {
              icon: 'speed',
              title: 'Dễ tự ép tiến độ',
              text: 'Khi vừa muốn tốt vừa muốn nhanh, Hào dễ tự đẩy mình vào trạng thái luôn thiếu một chút nữa mới đủ.',
            },
            {
              icon: 'balance',
              title: 'Bài học',
              text: 'Đẹp nhất là biết khi nào cần hoàn hảo, khi nào chỉ cần đủ tốt để đi tiếp.',
            },
          ],
          keywords: ['Chất lượng', 'Thành tựu', 'Đủ tốt'],
        },
        {
          label: 'Tình cảm',
          title: 'Xử Nữ khi thương',
          kicker: 'Ít phô, nhiều hành động',
          tone: 'ink',
          panels: [
            {
              icon: 'favorite',
              title: 'Thương bằng chăm chút',
              text: 'Hào có thể không nói quá nhiều lời hoa mỹ, nhưng dễ thể hiện bằng việc sửa giúp, nhắc nhở, chuẩn bị và ở đó khi cần.',
            },
            {
              icon: 'chat_bubble',
              title: 'Cần bớt phân tích người yêu',
              text: 'Tình cảm không phải lúc nào cũng là bài toán. Có lúc người kia cần được lắng nghe trước khi được góp ý.',
            },
            {
              icon: 'handshake',
              title: 'Người hợp',
              text: 'Hợp với người tinh tế, biết tôn trọng nhịp làm việc, nhưng cũng kéo Hào ra khỏi guồng tự ép mình quá lâu.',
            },
          ],
          keywords: ['Hành động', 'Tinh tế', 'Lắng nghe'],
        },
      ],
    },
    {
      id: 'tong-quan',
      title: 'Lá số tổng quan',
      subtitle: 'Nam Nhâm Ngọ 2002, sinh giờ Hợi',
      icon: 'auto_stories',
      tone: 'cover',
      summary: 'Một cuốn tổng quan về bản mệnh tham khảo dựa trên ngày sinh, năm sinh và giờ Hợi.',
      pages: [
        {
          label: 'Bìa',
          title: 'Tử Vi Phạm Văn Hào',
          kicker: 'Nam, 23-08-2002, 21:30 giờ Hợi',
          tone: 'cover',
          panels: [
            {
              icon: 'badge',
              title: 'Thông tin nền',
              text: 'Phạm Văn Hào, nam, sinh ngày 23-08-2002, giờ sinh 21:30, quy về giờ Hợi theo giờ Việt Nam.',
            },
            {
              icon: 'auto_stories',
              title: 'Cách đọc',
              text: 'Trang này không an sao chi tiết. Nội dung dùng ngày sinh, năm sinh và giờ sinh để kể một bản phân tích tham khảo, mềm và dễ đọc.',
            },
            {
              icon: 'favorite',
              title: 'Ghi chú nhẹ',
              text: 'Tử vi, thần số học và cung hoàng đạo ở đây là chất liệu suy ngẫm, không phải kết luận tuyệt đối về số phận.',
            },
          ],
          keywords: ['Phạm Văn Hào', 'Nhâm Ngọ', 'Giờ Hợi'],
        },
        {
          label: 'Bản mệnh',
          title: 'Có chí tiến',
          kicker: 'Tự chủ và muốn đi đường dài',
          tone: 'mint',
          panels: [
            {
              icon: 'trending_up',
              title: 'Không thích đứng yên',
              text: 'Khí chất của Hào nghiêng về việc tự nâng cấp bản thân. Khi thấy mình chưa đủ giỏi, phản ứng thường là học, sửa, làm lại.',
            },
            {
              icon: 'shield_person',
              title: 'Cần tự chủ',
              text: 'Hào hợp với môi trường cho mình quyền quyết định, quyền chịu trách nhiệm và quyền chứng minh năng lực qua kết quả thật.',
            },
            {
              icon: 'foundation',
              title: 'Hợp xây nền dài hạn',
              text: 'Đường đẹp không phải thắng nhanh, mà là tích lũy kỹ năng, uy tín và hệ thống riêng để càng về sau càng vững.',
            },
          ],
          keywords: ['Tự chủ', 'Nâng cấp', 'Đường dài'],
        },
        {
          label: 'Giờ Hợi',
          title: 'Độ sâu nội tâm',
          kicker: 'Bên ngoài lý trí, bên trong nhiều suy nghĩ',
          tone: 'ink',
          panels: [
            {
              icon: 'nightlight',
              title: 'Nghĩ nhiều sau màn hình',
              text: 'Giờ Hợi thường gợi một phần nội tâm sâu, hay tự xử lý trong im lặng. Hào có thể nói ít về áp lực nhưng đầu óc vẫn chạy liên tục.',
            },
            {
              icon: 'water_drop',
              title: 'Cần khoảng lặng',
              text: 'Sau những lúc phải quyết nhanh hoặc giao tiếp nhiều, Hào cần thời gian một mình để sắp lại suy nghĩ.',
            },
            {
              icon: 'wb_sunny',
              title: 'Điểm cân bằng',
              text: 'Đừng chỉ sống bằng chế độ hiệu suất. Có những khoảng nghỉ không làm Hào chậm đi, mà giúp đi bền hơn.',
            },
          ],
          keywords: ['Giờ Hợi', 'Nội tâm', 'Khoảng lặng'],
        },
        {
          label: '2026',
          title: 'Một năm mở hướng',
          kicker: 'Có cơ hội nhưng cần trục chính',
          tone: 'gold',
          panels: [
            {
              icon: 'explore',
              title: 'Nhiều hướng để thử',
              text: 'Năm 2026 hợp mở thêm cách làm mới, sản phẩm mới, kỹ năng mới hoặc môi trường mới.',
            },
            {
              icon: 'filter_center_focus',
              title: 'Đừng dàn trải',
              text: 'Điều quan trọng là chọn một trục chính. Mọi thử nghiệm nên phục vụ trục đó, thay vì kéo Hào sang quá nhiều phía.',
            },
            {
              icon: 'flag',
              title: 'Lời nhắn',
              text: 'Nếu giữ được kỷ luật mềm và sự tò mò, 2026 có thể là năm mở khóa một phiên bản linh hoạt hơn của Hào.',
            },
          ],
          keywords: ['2026', 'Mở hướng', 'Tập trung'],
        },
      ],
    },
    {
      id: 'su-nghiep-23-25',
      title: 'Sự nghiệp 23-25 tuổi',
      subtitle: 'Từ tự chịu trách nhiệm đến chốt hướng nghề',
      icon: 'rocket_launch',
      tone: 'gold',
      summary: 'Giai đoạn chuyển pha của Hào: bớt thử lan man, tăng trách nhiệm và chọn đường nghề rõ hơn.',
      pages: [
        {
          label: 'Tuổi 23',
          title: 'Năm 2025: chuyển pha',
          kicker: 'Từ học/làm sang chịu trách nhiệm',
          tone: 'gold',
          panels: [
            {
              icon: 'flag',
              title: 'Tự đứng vào vai chính',
              text: 'Tuổi 23 là lúc Hào bắt đầu thấy rõ: không ai có thể chịu trách nhiệm thay mình về hướng nghề, kỷ luật và kết quả dài hạn.',
            },
            {
              icon: 'task_alt',
              title: 'Kết quả thật quan trọng',
              text: 'Giai đoạn này nên ưu tiên việc tạo sản phẩm, portfolio, kinh nghiệm hoặc chỉ số đo được thay vì chỉ học rời rạc.',
            },
            {
              icon: 'foundation',
              title: 'Xây nền trước khi bật',
              text: 'Không cần vội chứng minh lớn. Điều cần nhất là một nền kỹ năng chắc, một nhịp làm đều và một thái độ đáng tin.',
            },
          ],
          keywords: ['2025', 'Chuyển pha', 'Trách nhiệm'],
        },
        {
          label: 'Tuổi 24',
          title: 'Năm 2026: nhiều cơ hội thử',
          kicker: 'Năng lượng số 5 dễ mở hướng',
          tone: 'mint',
          panels: [
            {
              icon: 'moving',
              title: 'Có nhiều cửa mở',
              text: '2026 hợp thử môi trường, cách làm, dự án hoặc vai trò mới. Hào có thể gặp cơ hội đến nhanh hơn bình thường.',
            },
            {
              icon: 'scatter_plot',
              title: 'Dễ phân tán',
              text: 'Điểm cần canh là ôm quá nhiều thứ cùng lúc: học một ít, làm một ít, đổi kế hoạch liên tục rồi cuối cùng chưa có mũi nhọn.',
            },
            {
              icon: 'analytics',
              title: 'Thử bằng dữ liệu',
              text: 'Hào nên cho mỗi thử nghiệm một mốc đo rõ: học được gì, kiếm được gì, có tăng kỹ năng không, có đáng đi tiếp không.',
            },
          ],
          keywords: ['2026', 'Thử nghiệm', 'Tập trung'],
        },
        {
          label: 'Tuổi 25',
          title: 'Năm 2027: chốt hướng nghiêm túc',
          kicker: 'Một nghề chính, một bộ kỹ năng lõi',
          tone: 'ink',
          panels: [
            {
              icon: 'filter_center_focus',
              title: 'Chọn mũi nhọn',
              text: 'Tuổi 25 nên chốt rõ Hào muốn trở thành người giỏi về mảng nào. Không cần đóng mọi cánh cửa, nhưng phải có một trục chính.',
            },
            {
              icon: 'rule',
              title: 'Kỷ luật thay cảm hứng',
              text: 'Cảm hứng giúp bắt đầu, nhưng kỷ luật mới tạo khoảng cách. Năm này càng làm đều, càng có lợi thế lớn về sau.',
            },
            {
              icon: 'psychology',
              title: 'Bớt chứng minh khắp nơi',
              text: 'Hào không cần thắng trong mọi cuộc tranh luận hoặc mọi phép so sánh. Chứng minh tốt nhất là kết quả được tích lũy qua thời gian.',
            },
          ],
          keywords: ['2027', 'Mũi nhọn', 'Kỷ luật'],
        },
        {
          label: 'Hướng hợp',
          title: 'Kiểu nghề hợp Hào',
          kicker: 'Kỹ thuật, hệ thống, dữ liệu, vận hành',
          tone: 'rose',
          panels: [
            {
              icon: 'hub',
              title: 'Tư duy hệ thống',
              text: 'Hào hợp việc cần hiểu cấu trúc, tối ưu luồng, quản trị tài nguyên hoặc biến một thứ rối thành mô hình chạy được.',
            },
            {
              icon: 'database',
              title: 'Dữ liệu và sản phẩm',
              text: 'Các hướng như kỹ thuật, dữ liệu, sản phẩm, tài chính hoặc quản trị vận hành đều hợp nếu Hào chịu xây nền đủ sâu.',
            },
            {
              icon: 'leaderboard',
              title: 'Có thể lên vai trò quản lý',
              text: 'Khi kỹ năng cứng đủ chắc, Hào có duyên đi lên vai trò điều phối, quản lý nhóm, quản lý dự án hoặc chịu trách nhiệm kết quả.',
            },
          ],
          keywords: ['Hệ thống', 'Dữ liệu', 'Quản trị'],
        },
      ],
    },
    {
      id: 'tai-chinh-giau-co',
      title: 'Tài chính và khả năng giàu có',
      subtitle: 'Đường đời 8, tiền đi cùng hệ thống và kỷ luật',
      icon: 'savings',
      tone: 'mint',
      summary: 'Một lát cắt về tham vọng tiền bạc, rủi ro muốn thắng nhanh và cách xây tài chính bền.',
      pages: [
        {
          label: 'Tiềm năng',
          title: 'Có duyên quản trị tiền',
          kicker: 'Số 8 thích tài nguyên và kết quả',
          tone: 'gold',
          panels: [
            {
              icon: 'leaderboard',
              title: 'Tham vọng là nhiên liệu',
              text: 'Đường đời 8 cho Hào động lực đạt thành tựu, tạo vị thế và kiểm soát nguồn lực. Nếu đi đúng, đây là cấu hình có tiềm năng tài chính tốt.',
            },
            {
              icon: 'account_balance',
              title: 'Hợp quản trị tài nguyên',
              text: 'Hào có thể nhạy với bài toán tiền, hiệu suất, chi phí, lợi nhuận hoặc cách biến kỹ năng thành giá trị cụ thể.',
            },
            {
              icon: 'balance',
              title: 'Tiền cần đi cùng đạo lý',
              text: 'Số 8 mạnh nhất khi biết dùng quyền lực đúng cách: rõ nguyên tắc, giữ chữ tín và không lấy thắng nhanh đổi lấy nền dài hạn.',
            },
          ],
          keywords: ['Số 8', 'Quản trị tiền', 'Thành tựu'],
        },
        {
          label: 'Giàu có',
          title: 'Giàu khi có hệ thống',
          kicker: 'Kỹ năng khó thay thế, uy tín rõ ràng',
          tone: 'mint',
          panels: [
            {
              icon: 'build_circle',
              title: 'Kỹ năng tạo đòn bẩy',
              text: 'Khả năng giàu của Hào tăng mạnh khi có kỹ năng khó thay thế: kỹ thuật sâu, tư duy sản phẩm, dữ liệu, tài chính hoặc vận hành.',
            },
            {
              icon: 'verified',
              title: 'Uy tín biến thành cơ hội',
              text: 'Làm được việc, giữ cam kết và chịu trách nhiệm tốt sẽ kéo về dự án, lời mời, vai trò hoặc nguồn thu tốt hơn.',
            },
            {
              icon: 'settings',
              title: 'Hệ thống hơn may mắn',
              text: 'Hào hợp xây quy trình kiếm tiền lặp lại được: thu nhập chính vững, kỹ năng tăng giá, dự phòng đủ và đầu tư có luật.',
            },
          ],
          keywords: ['Hệ thống', 'Uy tín', 'Đòn bẩy'],
        },
        {
          label: 'Cảnh báo',
          title: 'Muốn thắng nhanh',
          kicker: 'Rủi ro đến từ áp lực thành tựu',
          tone: 'rose',
          panels: [
            {
              icon: 'warning',
              title: 'Dễ ôm rủi ro',
              text: 'Khi muốn bứt phá nhanh, Hào dễ bị hút bởi cơ hội nghe rất lớn nhưng thiếu dữ liệu. Càng hấp dẫn càng cần kiểm chứng lạnh.',
            },
            {
              icon: 'speed',
              title: 'Tự ép bằng thành tựu',
              text: 'Nếu lấy tiền hoặc vị trí để đo toàn bộ giá trị bản thân, Hào dễ lao quá sức và ra quyết định nóng khi thấy mình bị tụt lại.',
            },
            {
              icon: 'front_hand',
              title: 'Không vay rủi ro vì sĩ diện',
              text: 'Tránh dùng nợ, đòn bẩy hoặc lời hứa lợi nhuận cao chỉ để chứng minh mình có gan. Gan tốt nhất là biết dừng đúng lúc.',
            },
          ],
          keywords: ['Rủi ro', 'Thắng nhanh', 'Kỷ luật'],
        },
        {
          label: 'Cách đi',
          title: 'Luật tiền riêng',
          kicker: 'Dự phòng, nguyên tắc, kỹ năng lõi',
          tone: 'ink',
          panels: [
            {
              icon: 'savings',
              title: 'Dự phòng tiền mặt',
              text: 'Trước khi nghĩ lớn, Hào nên có quỹ dự phòng đủ sống vài tháng. Quỹ này giúp ra quyết định nghề nghiệp và đầu tư tỉnh hơn.',
            },
            {
              icon: 'rule',
              title: 'Đầu tư có nguyên tắc',
              text: 'Mỗi khoản đầu tư cần có lý do vào, ngưỡng dừng, thời gian giữ và mức rủi ro chấp nhận. Không quyết bằng cảm giác muốn gỡ.',
            },
            {
              icon: 'school',
              title: 'Xây kỹ năng khó thay thế',
              text: 'Tiền lớn bền hơn khi Hào sở hữu năng lực người khác cần: giải quyết vấn đề khó, quản trị hệ thống hoặc tạo sản phẩm có giá trị.',
            },
          ],
          keywords: ['Dự phòng', 'Nguyên tắc', 'Kỹ năng lõi'],
        },
      ],
    },
    {
      id: 'van-han-2026-2030',
      title: 'Vận hạn 2026-2030',
      subtitle: 'Từng năm: cơ hội, áp lực và cách đi',
      icon: 'calendar_month',
      tone: 'ink',
      summary: 'Một lịch đọc tham khảo cho 5 năm tới, cụ thể theo hướng cơ hội, rủi ro và hành động.',
      pages: [
        {
          label: '2026',
          title: '2026: mở hướng mới',
          kicker: 'Nhiều thay đổi, cần tránh phân tán',
          tone: 'gold',
          panels: [
            {
              icon: 'moving',
              title: 'Trọng tâm',
              text: 'Đây là năm Hào nên thử hướng mới có kiểm soát: môi trường, dự án, kỹ năng hoặc cách kiếm tiền mới quanh một mục tiêu chính.',
            },
            {
              icon: 'door_open',
              title: 'Cơ hội',
              text: 'Cơ hội đến qua thay đổi nhanh, kết nối mới hoặc việc cần khả năng xoay xở. Nếu linh hoạt đúng chỗ, Hào mở được nhiều cửa.',
            },
            {
              icon: 'shield',
              title: 'Rủi ro & lời khuyên',
              text: 'Rủi ro lớn là bận mà loãng. Hãy giữ một trục chính, chỉ thử những thứ có thể đo kết quả trong 30-60 ngày.',
            },
          ],
          keywords: ['2026', 'Mở hướng', 'Không phân tán'],
        },
        {
          label: '2027',
          title: '2027: chốt kỷ luật',
          kicker: 'Nghề chính và kỹ năng lõi',
          tone: 'mint',
          panels: [
            {
              icon: 'filter_center_focus',
              title: 'Trọng tâm',
              text: 'Năm này cần chọn rõ kỹ năng hoặc nghề chính để đào sâu. Hào càng bớt nhảy hướng, lợi thế càng dày.',
            },
            {
              icon: 'workspace_premium',
              title: 'Cơ hội',
              text: 'Có thể nhận vai trò nghiêm túc hơn, dự án dài hơi hơn hoặc một người tin tưởng giao việc vì thấy Hào bắt đầu chắc tay.',
            },
            {
              icon: 'warning',
              title: 'Rủi ro & lời khuyên',
              text: 'Dễ thấy chậm và sốt ruột. Đừng phá nền vì muốn đổi cảm giác; hãy đo tiến bộ bằng sản phẩm thật và kỹ năng thật.',
            },
          ],
          keywords: ['2027', 'Kỷ luật', 'Kỹ năng lõi'],
        },
        {
          label: '2028',
          title: '2028: tăng tiền và vai trò',
          kicker: 'Nếu nền đủ chắc',
          tone: 'rose',
          panels: [
            {
              icon: 'trending_up',
              title: 'Trọng tâm',
              text: 'Nếu 2027 đã đào sâu, 2028 hợp tăng thu nhập, nhận trách nhiệm lớn hơn hoặc bước vào vị trí có quyền quyết định rõ hơn.',
            },
            {
              icon: 'account_balance_wallet',
              title: 'Cơ hội',
              text: 'Cơ hội tài chính tốt hơn đến từ uy tín, dự án lớn, năng lực quản trị hoặc khả năng biến kiến thức thành kết quả đo được.',
            },
            {
              icon: 'balance',
              title: 'Rủi ro & lời khuyên',
              text: 'Khi tiền và vai trò tăng, cái tôi cũng dễ căng. Hào nên giữ người góp ý thật và nguyên tắc tài chính rõ.',
            },
          ],
          keywords: ['2028', 'Tăng tiền', 'Vai trò'],
        },
        {
          label: '2029',
          title: '2029: áp lực trách nhiệm',
          kicker: 'Quản trị sức khỏe tinh thần',
          tone: 'ink',
          panels: [
            {
              icon: 'weight',
              title: 'Trọng tâm',
              text: 'Năm này dễ có nhiều trách nhiệm hơn: gia đình, công việc, tiền bạc hoặc kỳ vọng cá nhân. Hào cần học cách phân tải.',
            },
            {
              icon: 'groups_2',
              title: 'Cơ hội',
              text: 'Nếu quản trị tốt, đây là năm chứng minh độ trưởng thành: biết giao việc, biết giữ lời và biết nói không đúng lúc.',
            },
            {
              icon: 'self_improvement',
              title: 'Rủi ro & lời khuyên',
              text: 'Đừng biến im lặng thành cách chịu đựng duy nhất. Ngủ, vận động, nói chuyện với người tin được và nghỉ đúng lúc là chiến lược, không phải yếu.',
            },
          ],
          keywords: ['2029', 'Trách nhiệm', 'Sức khỏe tinh thần'],
        },
        {
          label: '2030',
          title: '2030: tái cấu trúc tham vọng',
          kicker: 'Chọn hướng lớn hơn nhưng bền hơn',
          tone: 'gold',
          panels: [
            {
              icon: 'account_tree',
              title: 'Trọng tâm',
              text: 'Hào có xu hướng nhìn lại tham vọng: mình muốn lớn theo kiểu nào, trả giá bằng gì, và mô hình sống nào giữ được đường dài.',
            },
            {
              icon: 'rocket_launch',
              title: 'Cơ hội',
              text: 'Hợp nâng cấp nghề, mở hướng kinh doanh nhỏ, lên vai trò quản lý hoặc chọn một chiến lược tài chính nghiêm túc hơn.',
            },
            {
              icon: 'spa',
              title: 'Rủi ro & lời khuyên',
              text: 'Đừng chọn lớn chỉ vì sợ bị xem thường. Hướng lớn nhất là hướng vừa có thành tựu, vừa không làm Hào đánh mất đời sống bên trong.',
            },
          ],
          keywords: ['2030', 'Tham vọng', 'Bền hơn'],
        },
      ],
    },
    {
      id: 'tinh-cach-an-sau',
      title: 'Tính cách ẩn sâu',
      subtitle: 'Lý trí, trách nhiệm, áp lực và phần mềm bên trong',
      icon: 'psychology',
      tone: 'rose',
      summary: 'Một cuốn soi kỹ cách Hào tự vận hành: thích kết quả, tự gồng, nhưng cũng cần được công nhận.',
      pages: [
        {
          label: 'Bên ngoài',
          title: 'Lý trí và trách nhiệm',
          kicker: 'Thích chứng minh bằng kết quả',
          tone: 'mint',
          panels: [
            {
              icon: 'task_alt',
              title: 'Nói bằng việc làm',
              text: 'Hào thường không thích giải thích quá nhiều nếu kết quả có thể tự nói. Khi đã nhận trách nhiệm, sẽ muốn làm cho ra hình.',
            },
            {
              icon: 'code',
              title: 'Thích thứ có logic',
              text: 'Những việc có cấu trúc, quy luật, hệ thống hoặc dữ liệu rõ thường làm Hào thấy dễ vào guồng hơn.',
            },
            {
              icon: 'workspace_premium',
              title: 'Cần cảm giác có ích',
              text: 'Một phần bên trong muốn biết rằng sự có mặt của mình tạo ra giá trị thật, không chỉ tồn tại cho qua ngày.',
            },
          ],
          keywords: ['Lý trí', 'Kết quả', 'Có ích'],
        },
        {
          label: 'Áp lực',
          title: 'Dễ tự ép mình',
          kicker: 'Khi tiêu chuẩn biến thành gánh nặng',
          tone: 'rose',
          panels: [
            {
              icon: 'fitness_center',
              title: 'Gồng mà không nói',
              text: 'Hào có thể đang mệt nhưng vẫn tiếp tục làm, vì trong đầu có một giọng nói rằng mình phải cố thêm chút nữa.',
            },
            {
              icon: 'visibility_off',
              title: 'Khó nhận mình cần nghỉ',
              text: 'Khi quá quen với việc tự xử lý, Hào dễ xem mệt mỏi là chuyện bình thường, đến khi cơ thể hoặc cảm xúc báo động rõ.',
            },
            {
              icon: 'battery_alert',
              title: 'Dấu hiệu cần để ý',
              text: 'Dễ cáu, khó ngủ, không còn hứng thú với thứ từng thích, hoặc thấy mọi việc đều thành nhiệm vụ phải hoàn thành.',
            },
          ],
          keywords: ['Tự ép', 'Mệt', 'Cần nghỉ'],
        },
        {
          label: 'Điểm yếu',
          title: 'Muốn kiểm soát',
          kicker: 'Vì sợ kết quả lệch khỏi tay mình',
          tone: 'ink',
          panels: [
            {
              icon: 'tune',
              title: 'Thích nắm rõ biến số',
              text: 'Khi thông tin mập mờ, Hào dễ muốn kéo mọi thứ về trạng thái có thể tính được, đo được, kiểm soát được.',
            },
            {
              icon: 'sync_problem',
              title: 'Khó giao việc khi chưa tin',
              text: 'Nếu chưa tin người khác đủ chắc, Hào có xu hướng tự làm cho nhanh và đúng ý, nhưng lâu dài sẽ dễ quá tải.',
            },
            {
              icon: 'handshake',
              title: 'Bài học',
              text: 'Kiểm soát tốt nhất không phải tự làm hết, mà là đặt tiêu chuẩn rõ, giao đúng người và chấp nhận có phần không hoàn hảo.',
            },
          ],
          keywords: ['Kiểm soát', 'Tin người', 'Giao việc'],
        },
        {
          label: 'Mặt mềm',
          title: 'Cần được công nhận',
          kicker: 'Không phải khoe, chỉ là cần được thấy',
          tone: 'gold',
          panels: [
            {
              icon: 'favorite',
              title: 'Có phần rất cần được hiểu',
              text: 'Bên dưới vẻ tự lập là nhu cầu được công nhận rằng mình đã cố, đã chịu trách nhiệm, đã làm tốt theo cách riêng.',
            },
            {
              icon: 'chat_bubble',
              title: 'Nói nhu cầu sớm hơn',
              text: 'Không cần đợi đến khi hụt hẫng mới nói. Một câu “mình cần feedback rõ hơn” có thể làm nhẹ rất nhiều thứ.',
            },
            {
              icon: 'wb_sunny',
              title: 'Phiên bản đẹp',
              text: 'Hào đẹp nhất khi vừa có năng lực, vừa không bắt mình phải mạnh một mình mọi lúc.',
            },
          ],
          keywords: ['Công nhận', 'Được hiểu', 'Mềm lại'],
        },
      ],
    },
    {
      id: 'cong-viec-tai-chinh',
      title: 'Công việc và tài chính',
      subtitle: 'Kỹ thuật, hệ thống, dữ liệu, uy tín và tích lũy',
      icon: 'work',
      tone: 'gold',
      summary: 'Một cuốn về hướng nghề hợp khí chất: tư duy cấu trúc, làm thật, tích lũy kỹ năng và tránh thắng nhanh.',
      pages: [
        {
          label: 'Hướng nghề',
          title: 'Hợp việc có hệ thống',
          kicker: 'Kỹ thuật, dữ liệu, sản phẩm, tài chính',
          tone: 'mint',
          panels: [
            {
              icon: 'hub',
              title: 'Tư duy cấu trúc',
              text: 'Hào hợp những việc cần phân tích luồng, xây hệ thống, tối ưu quy trình hoặc biến dữ liệu rời rạc thành thứ chạy được.',
            },
            {
              icon: 'developer_mode',
              title: 'Kỹ thuật và sản phẩm',
              text: 'Các hướng như kỹ thuật phần mềm, data, backend, automation, sản phẩm số hoặc quản trị vận hành đều hợp chất logic và thực tế.',
            },
            {
              icon: 'query_stats',
              title: 'Tài chính cũng hợp nếu đủ kỷ luật',
              text: 'Số 8 có duyên với tiền và quản trị nguồn lực, nhưng cần đi cùng số 4: nguyên tắc, kiểm soát rủi ro, không ham thắng nhanh.',
            },
          ],
          keywords: ['Kỹ thuật', 'Dữ liệu', 'Hệ thống'],
        },
        {
          label: 'Cách làm',
          title: 'Uy tín là tài sản',
          kicker: 'Làm đều, làm chắc, giữ lời',
          tone: 'ink',
          panels: [
            {
              icon: 'verified_user',
              title: 'Càng đáng tin càng có giá',
              text: 'Với Hào, tài sản lớn không chỉ là kỹ năng mà là uy tín: giao việc được, giữ deadline được, sửa lỗi được.',
            },
            {
              icon: 'stacked_line_chart',
              title: 'Tích lũy theo tầng',
              text: 'Đừng chỉ học thứ đang hot. Hãy xây tầng nền: tư duy hệ thống, giao tiếp kỹ thuật, tài chính cá nhân, quản lý thời gian.',
            },
            {
              icon: 'speed',
              title: 'Tránh vội chứng minh',
              text: 'Khi muốn chứng minh nhanh, Hào dễ ôm quá nhiều hoặc chọn đường tắt. Đường bền vẫn là lợi thế lớn hơn.',
            },
          ],
          keywords: ['Uy tín', 'Tầng nền', 'Bền'],
        },
        {
          label: 'Tiền bạc',
          title: 'Kiếm và giữ tiền',
          kicker: 'Kỹ năng trước, lợi nhuận sau',
          tone: 'gold',
          panels: [
            {
              icon: 'savings',
              title: 'Tiền đến từ năng lực',
              text: 'Hợp kiếm tiền bằng kỹ năng khó thay thế, khả năng giải quyết vấn đề và độ tin cậy trong công việc.',
            },
            {
              icon: 'account_balance_wallet',
              title: 'Cần luật chơi riêng',
              text: 'Nên có nguyên tắc rõ: phần học, phần dự phòng, phần đầu tư, phần trải nghiệm. Có luật thì ít bị cảm xúc kéo đi.',
            },
            {
              icon: 'warning',
              title: 'Cẩn thận muốn thắng lớn',
              text: 'Số 8 dễ bị hấp dẫn bởi kết quả lớn. Điều cần nhớ: quản trị rủi ro cũng là một dạng bản lĩnh.',
            },
          ],
          keywords: ['Kỹ năng', 'Dự phòng', 'Rủi ro'],
        },
        {
          label: '2026',
          title: 'Công việc năm 2026',
          kicker: 'Mở cơ hội nhưng giữ trục',
          tone: 'rose',
          panels: [
            {
              icon: 'rocket_launch',
              title: 'Có thể thử hướng mới',
              text: '2026 hợp mở một dự án phụ, thử một kỹ năng mới hoặc đổi cách làm để tăng tốc.',
            },
            {
              icon: 'filter_center_focus',
              title: 'Không đánh mất trọng tâm',
              text: 'Mỗi cơ hội nên được hỏi: nó có phục vụ mục tiêu chính của mình không? Nếu không, có thể chỉ là nhiễu đẹp.',
            },
            {
              icon: 'event_available',
              title: 'Kết luận mềm',
              text: 'Năm này đẹp nếu Hào vừa dám thử, vừa biết chốt. Tự do cần đi cùng kỷ luật thì mới ra tiền và ra nghề.',
            },
          ],
          keywords: ['Thử nghiệm', 'Trục chính', 'Kỷ luật'],
        },
      ],
    },
    {
      id: 'tinh-duyen',
      title: 'Tình duyên',
      subtitle: 'Yêu bằng trách nhiệm, hành động và sự ổn định',
      icon: 'favorite',
      tone: 'rose',
      summary: 'Một cuốn cụ thể mềm về kiểu yêu của Hào: ít phô, nhiều làm, cần người tinh tế và bình yên.',
      pages: [
        {
          label: 'Kiểu yêu',
          title: 'Không quá phô',
          kicker: 'Thương bằng hành động',
          tone: 'rose',
          panels: [
            {
              icon: 'construction',
              title: 'Làm nhiều hơn nói',
              text: 'Hào có thể không phải kiểu nói ngọt liên tục, nhưng khi thương sẽ muốn giúp, sửa, lo, gánh và làm cho người kia yên tâm.',
            },
            {
              icon: 'shield_heart',
              title: 'Có trách nhiệm trong yêu',
              text: 'Khi đã nghiêm túc, Hào thường muốn mối quan hệ có hướng đi, có sự rõ ràng, không chỉ vui nhất thời.',
            },
            {
              icon: 'chat_bubble',
              title: 'Điểm cần học',
              text: 'Người yêu không chỉ cần giải pháp. Có lúc họ cần được nghe Hào nói cảm xúc, dù câu nói còn vụng.',
            },
          ],
          keywords: ['Hành động', 'Trách nhiệm', 'Cảm xúc'],
        },
        {
          label: 'Người hợp',
          title: 'Người dễ hút Hào',
          kicker: 'Tinh tế, ổn định, có chiều sâu',
          tone: 'mint',
          panels: [
            {
              icon: 'spa',
              title: 'Người làm mình dịu lại',
              text: 'Hào dễ hợp người không làm mọi thứ thành áp lực, biết lắng nghe và có cách sống ổn định.',
            },
            {
              icon: 'psychology',
              title: 'Có chiều sâu riêng',
              text: 'Người có mục tiêu, biết suy nghĩ, có đời sống nội tâm và không quá hời hợt sẽ khiến Hào nể.',
            },
            {
              icon: 'block',
              title: 'Mẫu nên tránh',
              text: 'Người quá mập mờ, thích kiểm tra cảm xúc hoặc thiếu nhất quán dễ làm Hào bật chế độ phân tích và phòng thủ.',
            },
          ],
          keywords: ['Tinh tế', 'Ổn định', 'Nhất quán'],
        },
        {
          label: 'Bài học',
          title: 'Tình cảm cần mềm',
          kicker: 'Đừng biến yêu thành bài toán',
          tone: 'gold',
          panels: [
            {
              icon: 'calculate',
              title: 'Không phải gì cũng tối ưu',
              text: 'Trong tình yêu, đúng chưa chắc đủ. Có những lúc người kia cần cảm giác được chọn, được nghe, được ôm bằng lời.',
            },
            {
              icon: 'sentiment_satisfied',
              title: 'Bớt sửa, thêm hiểu',
              text: 'Khi người kia kể chuyện buồn, hãy hỏi trước: “Bạn cần mình nghe hay cần mình góp ý?” Câu này cứu nhiều cuộc trò chuyện.',
            },
            {
              icon: 'favorite_border',
              title: 'Cách yêu đẹp',
              text: 'Hào yêu đẹp nhất khi giữ được trách nhiệm nhưng không quên sự dịu dàng.',
            },
          ],
          keywords: ['Dịu dàng', 'Lắng nghe', 'Không tối ưu'],
        },
        {
          label: 'Cam kết',
          title: 'Mốc tình cảm đẹp',
          kicker: 'Khi sự nghiệp và nội tâm ổn',
          tone: 'ink',
          panels: [
            {
              icon: 'event',
              title: 'Không cần vội',
              text: 'Với Hào, cam kết đẹp nhất khi bản thân đã có trục công việc tương đối ổn và không dùng tình yêu để lấp áp lực cá nhân.',
            },
            {
              icon: 'handshake',
              title: 'Chọn người cùng xây',
              text: 'Người hợp lâu dài là người có thể nói chuyện về tiền bạc, công việc, gia đình và cảm xúc mà không né tránh.',
            },
            {
              icon: 'verified',
              title: 'Thước đo',
              text: 'Một mối quan hệ đẹp không làm Hào yếu đi. Nó làm Hào bớt phải gồng một mình.',
            },
          ],
          keywords: ['Cam kết', 'Cùng xây', 'Bớt gồng'],
        },
      ],
    },
    {
      id: 'mat-toi-tam-ly',
      title: 'Mặt tối tâm lý',
      subtitle: 'Sợ thất bại, sợ bị xem thường, im lặng và tự gồng',
      icon: 'dark_mode',
      tone: 'ink',
      summary: 'Một cuốn đọc chậm về phần áp lực bên trong: thành tựu, tự trọng và cách học nghỉ.',
      pages: [
        {
          label: 'Bóng tối',
          title: 'Sợ thất bại',
          kicker: 'Không chỉ sợ thua, mà sợ mình không đủ',
          tone: 'ink',
          panels: [
            {
              icon: 'falling',
              title: 'Thất bại chạm tự trọng',
              text: 'Với Hào, thất bại không chỉ là một việc chưa xong. Nó có thể bị cảm như bằng chứng rằng mình chưa đủ giỏi.',
            },
            {
              icon: 'visibility_off',
              title: 'Hay tự xử lý một mình',
              text: 'Khi áp lực lớn, Hào có xu hướng im, rút vào công việc hoặc tự tìm cách sửa trước khi để ai biết mình đang rối.',
            },
            {
              icon: 'favorite',
              title: 'Sự thật mềm hơn',
              text: 'Một lần sai không định nghĩa năng lực. Nó chỉ cho biết hệ thống hiện tại cần thêm dữ liệu, thời gian hoặc hỗ trợ.',
            },
          ],
          keywords: ['Thất bại', 'Tự trọng', 'Hỗ trợ'],
        },
        {
          label: 'Xem thường',
          title: 'Sợ bị xem thường',
          kicker: 'Nên càng cố chứng minh',
          tone: 'rose',
          panels: [
            {
              icon: 'workspace_premium',
              title: 'Muốn được công nhận',
              text: 'Hào có thể không nói ra, nhưng rất cần cảm giác người khác thấy được công sức và năng lực thật của mình.',
            },
            {
              icon: 'bolt',
              title: 'Dễ phản ứng bằng thành tích',
              text: 'Khi cảm thấy bị đánh giá thấp, phản xạ có thể là làm nhiều hơn, giỏi hơn, chứng minh mạnh hơn.',
            },
            {
              icon: 'self_improvement',
              title: 'Cách hóa giải',
              text: 'Không phải ai cũng cần được thuyết phục. Chọn đúng người để chứng minh, còn lại để kết quả đi đường dài nói thay.',
            },
          ],
          keywords: ['Công nhận', 'Chứng minh', 'Chọn người'],
        },
        {
          label: 'Tự gồng',
          title: 'Im lặng và tự gồng',
          kicker: 'Mạnh quá lâu cũng mệt',
          tone: 'gold',
          panels: [
            {
              icon: 'fitness_center',
              title: 'Tự biến mình thành trụ',
              text: 'Hào dễ quen với vai người xử lý vấn đề. Nhưng nếu lúc nào cũng là trụ, sẽ có ngày quên mất mình cũng cần được đỡ.',
            },
            {
              icon: 'battery_1_bar',
              title: 'Cạn pin âm thầm',
              text: 'Vấn đề không phải Hào không chịu được áp lực. Vấn đề là chịu quá lâu mà không xả đúng cách.',
            },
            {
              icon: 'groups',
              title: 'Nên có người tin được',
              text: 'Một người bạn, một mentor, một người yêu biết lắng nghe: chỉ cần một nơi an toàn cũng đã làm áp lực nhẹ đi nhiều.',
            },
          ],
          keywords: ['Tự gồng', 'Cạn pin', 'Nơi an toàn'],
        },
        {
          label: 'Hóa giải',
          title: 'Không dùng thành tựu để đo mình',
          kicker: 'Giá trị của Hào lớn hơn kết quả',
          tone: 'mint',
          panels: [
            {
              icon: 'spa',
              title: 'Nghỉ là chiến lược',
              text: 'Nghỉ không làm Hào yếu đi. Nghỉ đúng lúc giúp não sắp lại vấn đề và giúp cơ thể không phải trả nợ quá muộn.',
            },
            {
              icon: 'edit_note',
              title: 'Viết lại tiêu chuẩn',
              text: 'Thay vì “mình phải thắng”, hãy thử “mình cần tiến bộ có hệ thống”. Câu sau bền hơn và ít làm mình đau.',
            },
            {
              icon: 'wb_sunny',
              title: 'Bản lĩnh mềm',
              text: 'Bản lĩnh đẹp nhất không phải lúc nào cũng cứng. Đó là biết lúc nào nên tiến, lúc nào nên nghỉ, và lúc nào nên nhờ người khác đi cùng.',
            },
          ],
          keywords: ['Nghỉ', 'Tiến bộ', 'Bản lĩnh mềm'],
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
