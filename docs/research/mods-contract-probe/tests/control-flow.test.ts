import { expect, test } from 'claude-code/testing';

test('positive control reaches the stub once', async ($, on) => {
  let dispatched = 0;
  on('tool.call', () => {
    dispatched += 1;
    return { result: 'stub result' };
  });
  const answer = await $.tool.call({ tool: 'Bash', command: 'positive' });
  expect(dispatched).toBe(1);
  expect(answer.result).toBe('stub result');
});

test('failure handler denies before the stub is reached', async ($, on) => {
  let dispatched = 0;
  on('tool.call', () => {
    dispatched += 1;
    return { result: 'stub result' };
  });
  const answer = await $.tool.call({ tool: 'Bash', command: 'throw-before' });
  expect(dispatched).toBe(0);
  expect(answer.deny).toBe('Chio unavailable before dispatch');
});

test('failure after dispatch preserves the original without redispatch', async ($, on) => {
  let dispatched = 0;
  on('tool.call', () => {
    dispatched += 1;
    return { result: 'stub result' };
  });
  const answer = await $.tool.call({ tool: 'Bash', command: 'throw-after' });
  expect(dispatched).toBe(1);
  expect(answer.result).toBe('stub result');
});

test('a failed hook without a handler is skipped and the stub runs', async ($, on) => {
  let dispatched = 0;
  on('tool.call', () => {
    dispatched += 1;
    return { result: 'stub result' };
  });
  const answer = await $.tool.call({ tool: 'Read', file_path: 'never-read.txt' });
  expect(dispatched).toBe(1);
  expect(answer.result).toBe('stub result');
});
