use kira;

alter table event_prediction
    add column if not exists actual_ft_goal_str varchar(10) null after error_message,
    add column if not exists result_hdc enum ('WIN', 'LOSE', 'VOID', 'NONE') null after actual_ft_goal_str,
    add column if not exists result_ou enum ('WIN', 'LOSE', 'VOID', 'NONE') null after result_hdc,
    add column if not exists settled_at datetime null after result_ou;

create index if not exists idx_event_prediction_version_result_hdc
    on event_prediction (prediction_version_id, result_hdc, settled_at);

create index if not exists idx_event_prediction_version_result_ou
    on event_prediction (prediction_version_id, result_ou, settled_at);
