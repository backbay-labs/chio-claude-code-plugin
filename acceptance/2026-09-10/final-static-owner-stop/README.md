# Completed final-static owners stopped

The completed Claude budget, expiry and supplemental parallel owners were stopped
through the supported identity-checked helper on ports 59222, 59223 and 59227.
The operator configuration, policy, signing-key, session configuration and journal
files retained identical digests. Both resource and audit volumes remain present
for each owner; no labeled resource container remains active. Live SQLite store
checkpoint bytes are not claimed to stay byte-identical during shutdown.

The interrupted native owner and storage owners were left untouched for later
recovery. This reduces the test environment's memory use without resetting
protected authority or evidence. No new native case was launched during this
cleanup. The safe stop record retains exact commands, helper hash, protected file
digests and independent volume/container checks without credential values.
