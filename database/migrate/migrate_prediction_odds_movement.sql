use kira;

insert into prediction_version (code, display_name, description, is_active, sort_order)
values (
    'odds_movement',
    'Odds Movement',
    'Match historical events by line movement direction (open to pre-match) and price relations at open and pre-match; vote HDC/O-U from top scores using pre-match lines.',
    1,
    2
)
on duplicate key update display_name = values(display_name),
                        description  = values(description),
                        is_active    = values(is_active),
                        sort_order   = values(sort_order);
