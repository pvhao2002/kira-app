delimiter //
drop event if exists ev_daily_attendance_init //
create event if not exists ev_daily_attendance_init
    on schedule every 12 hour
        starts now()
    do
    begin
        insert ignore into tecum_attendance (tecum_account_id, attendance_date, status)
        select ta.tecum_account_id, curdate(), 'ABSENT'
        from tecum_account ta;
    end //
