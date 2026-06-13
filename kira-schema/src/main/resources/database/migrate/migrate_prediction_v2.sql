use kira;

alter table event_prediction
    add column if not exists goal_str_pick varchar(100) null after prematch_ou_price_b;

update prediction_version
set is_active = 0
where code in ('base_data', 'odds_movement');

insert into prediction_version (code, display_name, description, is_active, sort_order)
values ('NO_PRICE', 'No Price',
        'Match historical hdc/ou/corner open and pre-match lines without prices.',
        1, 1),
       ('WITH_PRICE', 'With Price',
        'Match historical hdc/ou/corner open and pre-match lines with price_a and price_b.',
        1, 2),
       ('WITH_LEAGUE_NO_PRICE', 'With League No Price',
        'Match historical hdc/ou/corner lines and league without prices.',
        1, 3)
on duplicate key update display_name = values(display_name),
                        description  = values(description),
                        is_active    = values(is_active),
                        sort_order   = values(sort_order);
