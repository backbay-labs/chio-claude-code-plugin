# Actual Claude host delivery qualification

Status: unaccepted. The model transport is a local deterministic Messages
fixture. No authenticated Anthropic-provider result is claimed.

Seven scenarios passed through stock Claude 2.1.266, a cold-installed plugin
and the current kernel/resource owner: useful workflow plus disabled paths,
fresh forbidden read, fresh forbidden write, 25 native tools unavailable,
complete gateway response loss, restart fenced, and explicit recovery followed
by a useful read. Resource bytes and dispatches were observed independently.

The loss run executed exactly one original write. The actual host never received
its completion and the launcher exited 2 with unresolved state. Restart retained
the fence. The operator exported and read the exact original result, then
acknowledged it without redispatch. The recovered host read succeeded with exit
0. Failed protected actions now exit 3 even when the host's model turn ends
normally. Native-only inventory checks make no protected resource request.

The first capability-schema failure and fast-provider acknowledgement race are
retained. The repair confirms actual host results in its Messages history
before forwarding the next model turn. It also accepts actual host stdout
events. Merely sending the HTTP result never confirms host receipt.

Reproduce with scripts/acceptance/kernel-host.py and its --plugin argument
pointing to the installed artifact. The host-response-loss scenario requires
--fault-injector pointing to ARC scripts/acceptance/drop-host-response.mjs.
The preload changes transport delivery only; installed package and host files
remain unchanged. Preserve original configuration and journal for restart and
operator recovery. Do not replace authority to recover an unknown effect.

Remaining gates include authenticated model access, full approvals/budget and
revocation cases, additional failure boundaries and qualified publication.
