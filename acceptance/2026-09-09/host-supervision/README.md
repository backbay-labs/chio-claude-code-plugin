# Native host lifetime after launcher failure

The first actual-Claude forced gateway crash retained exactly one resource write, but the native process outlived its launcher. The observer waited until its 180-second deadline and then stopped the test process group. That failed lifecycle observation is retained under before and is not a passing crash case.

The repaired launcher starts the native host through a separate trusted supervisor. A private inherited pipe signals the parent lifetime. The sandboxed host never receives the pipe. Parent death stops the host process group, with a bounded SIGKILL fallback. Only the supervisor sees the private launch specification; operator/provider credentials remain outside the guest.

The cold-installed candidate passed the same actual-host/actual-kernel crash cutpoint without a probe timeout. One write occurred before the crash. After recovering the dead-owner lock, restart remained fenced. Explicit export, read and acknowledgement of the retained result permitted a later read without repeating the write. Four additional current-artifact cases passed: useful work with native/forbidden probes, substituted host result, aggregate budget, and lost host response. The component suite passed 29 tests without skips.

All seven real-host runs used pinned Claude 2.1.267 with the exact recorded SHA256 and a local Messages fixture. Authenticated Anthropic acceptance remains missing. Other fault cutpoints and complete I01-I08/lifecycle/publication qualification remain open.
