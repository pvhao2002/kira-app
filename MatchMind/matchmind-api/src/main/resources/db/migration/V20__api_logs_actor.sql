-- UX-052: the signed-in admin behind an import / settle / override. NULL for provider (agent) calls.
ALTER TABLE external_api_requests ADD COLUMN actor VARCHAR(64);
