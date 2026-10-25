const { tokenize, parseArguments } = require('../../src/services/prefixCommands');

describe('prefix command parsing', () => {
  test('tokenizes quoted values and URLs', () => {
    expect(tokenize('addapi name:"my api" endpoint:https://example.com/bypass?url=x')).toEqual([
      'addapi', 'name:my api', 'endpoint:https://example.com/bypass?url=x'
    ]);
  });

  test('parses named and positional arguments', () => {
    const parsed = parseArguments('https://example.com name:"test provider" timeout_ms:45000');
    expect(parsed.positional).toEqual(['https://example.com']);
    expect(parsed.named.get('name')).toBe('test provider');
    expect(parsed.named.get('timeout_ms')).toBe('45000');
  });
});
