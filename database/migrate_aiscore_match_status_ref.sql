use kira;

-- Bang tra cuu y nghia statusId va matchStatus tu AiScore API (bong da, sport_id = 1).
-- status_id: trang thai chi tiet cua tran (HT, FT, ET, ...).
-- match_status: trang thai gop (chua da, dang da, ket thuc, ...).

create table if not exists aiscore_match_status_ref
(
    ref_id       int auto_increment primary key,
    status_type  enum ('status_id', 'match_status') not null
        comment 'status_id = events.status_id; match_status = matchStatus gop tu API',
    code         int                                not null
        comment 'Gia tri so tu AiScore (statusId hoac matchStatus)',
    sport_id     int                                not null default 1
        comment '1 = football; mo rong cho mon khac sau nay',
    label        varchar(50)                        not null
        comment 'Nhan hien thi tren AiScore (FT, HT, ...)',
    description  varchar(255)                       null
        comment 'Mo ta tieng Viet / nghia nghiep vu',
    is_in_play   tinyint(1)                         not null default 0
        comment '1 = tran dang dien ra',
    is_terminal  tinyint(1)                         not null default 0
        comment '1 = tran da ket thuc hoac bi huy/hoan (khong con live)',
    sort_order   int                                not null default 0,
    created_at   datetime                           default now(),
    updated_at   datetime                           default now() on update now(),
    unique key uk_aiscore_match_status_ref (status_type, sport_id, code),
    index idx_aiscore_match_status_ref_type (status_type, sport_id, sort_order)
) engine = InnoDB
  row_format = dynamic
  comment = 'Tra cuu y nghia statusId va matchStatus (AiScore football)';

-- status_id: trang thai chi tiet tran dau
insert into aiscore_match_status_ref (status_type, code, sport_id, label, description, is_in_play, is_terminal, sort_order)
values
    ('status_id', 0, 1, '', 'Khong su dung / khong hien thi', 0, 0, 0),
    ('status_id', 1, 1, '-', 'Chua dau (Not started)', 0, 0, 10),
    ('status_id', 2, 1, '1H', 'Hiep 1 dang dien ra', 1, 0, 20),
    ('status_id', 3, 1, 'HT', 'Giu hiep (Half time)', 0, 0, 30),
    ('status_id', 4, 1, '2H', 'Hiep 2 dang dien ra', 1, 0, 40),
    ('status_id', 5, 1, 'ET', 'Hiep phu (Extra time)', 1, 0, 50),
    ('status_id', 6, 1, 'ET-HT', 'Nghi giua hiep phu', 0, 0, 55),
    ('status_id', 7, 1, 'Penalties', 'Luan luu penalty', 1, 0, 60),
    ('status_id', 8, 1, 'FT', 'Ket thuc sau 90 phut (Full time)', 0, 1, 70),
    ('status_id', 9, 1, 'Postponed', 'Hoan tran', 0, 1, 80),
    ('status_id', 10, 1, 'Interrupted', 'Gian doan', 0, 0, 90),
    ('status_id', 11, 1, 'Cut', 'Cat ngan / bo do', 0, 1, 100),
    ('status_id', 12, 1, 'Canceled', 'Huy tran', 0, 1, 110),
    ('status_id', 13, 1, 'Pending', 'Cho xac dinh (TBD)', 0, 0, 120),
    ('status_id', 105, 1, 'AET', 'Ket thuc sau hiep phu (After extra time)', 0, 1, 130),
    ('status_id', 110, 1, 'AP', 'Thang bang penalty (After penalties)', 0, 1, 140)
as new
on duplicate key update
    label       = new.label,
    description = new.description,
    is_in_play  = new.is_in_play,
    is_terminal = new.is_terminal,
    sort_order  = new.sort_order,
    updated_at  = now();

-- match_status: trang thai gop (map voi match.matchStatus tu API)
insert into aiscore_match_status_ref (status_type, code, sport_id, label, description, is_in_play, is_terminal, sort_order)
values
    ('match_status', 1, 1, 'NS', 'Chua dau (Not started)', 0, 0, 10),
    ('match_status', 2, 1, 'LIVE', 'Dang dien ra (gom 1H, HT, 2H, ET, ...)', 1, 0, 20),
    ('match_status', 3, 1, 'FT', 'Da ket thuc', 0, 1, 30),
    ('match_status', 4, 1, 'POSTPONED', 'Hoan tran', 0, 1, 40),
    ('match_status', 8, 1, 'PENDING', 'Cho xac dinh', 0, 0, 50)
as new
on duplicate key update
    label       = new.label,
    description = new.description,
    is_in_play  = new.is_in_play,
    is_terminal = new.is_terminal,
    sort_order  = new.sort_order,
    updated_at  = now();
