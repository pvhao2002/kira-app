import { describe, expect, it } from 'vitest';
import { readAgentOutput } from './import';

describe('readAgentOutput', () => {
  it('takes the model name and the JSON body out of what a sandboxed agent printed', () => {
    const out = readAgentOutput('CANNOT_CALL_API\nX-Model-Name: gpt-5.1\n```json\n{ "match": { "homeTeam": "A" }, "odds": [ { "x": 1 } ] }\n```\nGood luck!');
    expect(out.model).toBe('gpt-5.1');
    expect(JSON.parse(out.json!)).toEqual({ match: { homeTeam: 'A' }, odds: [{ x: 1 }] });
    expect(out.error).toBe('');
  });

  it('accepts bare JSON and explains what is wrong otherwise', () => {
    expect(readAgentOutput(' {"a":1} ').json).toBe('{"a":1}');
    expect(readAgentOutput('no json here').error).toContain('No JSON object');
    expect(readAgentOutput('{"a": 1,}').error).toContain('not valid JSON');
  });
});
