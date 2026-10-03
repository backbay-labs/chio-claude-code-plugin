#!/usr/bin/env python3
"""An isolated real terminal for the native-host acceptance driver."""
import errno
import codecs
import fcntl
import json
import os
import pty
import selectors
import signal
import struct
import subprocess
import sys
import termios
import pyte

master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 110, 0, 0))

def terminal_session():
    os.setsid()
    fcntl.ioctl(0, termios.TIOCSCTTY, 0)

child = subprocess.Popen(sys.argv[1:], stdin=slave, stdout=slave, stderr=slave, preexec_fn=terminal_session)
os.close(slave)
screen = pyte.Screen(110, 40)
stream = pyte.Stream(screen)
decoder = codecs.getincrementaldecoder("utf8")("replace")

def output(chunk):
    os.write(1, chunk)
    stream.feed(decoder.decode(chunk))
    frame = json.dumps({"screen": "\n".join(screen.display)}, ensure_ascii=False).encode() + b"\n"
    offset = 0
    while offset < len(frame):
        offset += os.write(3, frame[offset:])

def terminate(signum, frame):
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass

signal.signal(signal.SIGTERM, terminate)
signal.signal(signal.SIGINT, terminate)
selector = selectors.DefaultSelector()
selector.register(master, selectors.EVENT_READ, "terminal")
selector.register(0, selectors.EVENT_READ, "input")
try:
    while True:
        for key, _ in selector.select(0.5):
            try:
                chunk = os.read(key.fd, 65536)
            except OSError as error:
                if key.data == "terminal" and error.errno == errno.EIO:
                    chunk = b""
                else:
                    raise
            if key.data == "terminal":
                if not chunk:
                    selector.unregister(master)
                    break
                output(chunk)
            elif chunk:
                os.write(master, chunk)
            else:
                selector.unregister(0)
        if master not in [key.fd for key in selector.get_map().values()]:
            break
        if child.poll() is not None:
            # Drain the final terminal output before returning its exit status.
            while True:
                try:
                    chunk = os.read(master, 65536)
                except OSError as error:
                    if error.errno == errno.EIO:
                        break
                    raise
                if not chunk:
                    break
                output(chunk)
            break
finally:
    selector.close()
    os.close(master)
try:
    code = child.wait(timeout=6)
except subprocess.TimeoutExpired:
    os.killpg(child.pid, signal.SIGKILL)
    code = child.wait()
sys.exit(code if code >= 0 else 128 - code)
