-- Prompt history: every saved version of a template, append-only. A trigger on prompt_templates writes the row, so
-- versions saved by the API and by later migrations (which bump "version") are both kept. Restoring an old version
-- saves it again as a new version. Existing templates start with their current version.

CREATE TABLE prompt_template_versions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID        NOT NULL REFERENCES prompt_templates (id),
    version     INT         NOT NULL,
    content     TEXT        NOT NULL,
    description TEXT,
    active      BOOLEAN     NOT NULL,
    updated_by  UUID REFERENCES users (id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ux_prompt_template_versions UNIQUE (template_id, version)
);

INSERT INTO prompt_template_versions (template_id, version, content, description, active, updated_by, created_at)
SELECT id, version, content, description, active, updated_by, updated_at FROM prompt_templates;

CREATE FUNCTION prompt_template_versions_record() RETURNS trigger AS $fn$
BEGIN
    INSERT INTO prompt_template_versions (template_id, version, content, description, active, updated_by, created_at)
    VALUES (NEW.id, NEW.version, NEW.content, NEW.description, NEW.active, NEW.updated_by, NEW.updated_at)
    ON CONFLICT (template_id, version) DO NOTHING;
    RETURN NEW;
END
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER tr_prompt_templates_version
    AFTER INSERT OR UPDATE OF version ON prompt_templates
    FOR EACH ROW EXECUTE FUNCTION prompt_template_versions_record();

CREATE FUNCTION prompt_template_versions_append_only() RETURNS trigger AS $fn$
BEGIN
    RAISE EXCEPTION 'prompt_template_versions is append-only';
END
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER tr_prompt_template_versions_append_only
    BEFORE UPDATE OR DELETE ON prompt_template_versions
    FOR EACH ROW EXECUTE FUNCTION prompt_template_versions_append_only();
