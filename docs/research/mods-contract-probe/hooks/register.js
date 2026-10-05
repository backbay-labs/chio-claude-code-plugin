export function register(on) {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (e.command === 'throw-before') throw new Error('pre-dispatch failure');
    const result = await next(e);
    if (e.command === 'throw-after') throw new Error('post-dispatch failure');
    return result;
  }).catch(($, e, next) => {
    if (next.called) return next(e);
    return { deny: 'Chio unavailable before dispatch' };
  });

  on('tool.call', { tool: 'Read' }, () => {
    throw new Error('unguarded failure');
  });
}
