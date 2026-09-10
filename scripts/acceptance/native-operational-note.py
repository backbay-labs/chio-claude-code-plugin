#!/usr/bin/env python3
"""Extract bounded operational timings from already executed native Claude cases.

This performs no provider inference or resource requests. Native MCP intervals
include the entire protected tool route; they are not incremental kernel cost.
"""
import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", type=Path, action="append", required=True, help="Existing case directory containing launch.json and run.json")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    rows = []
    for directory in args.run:
        launch = json.loads((directory / "launch.json").read_text())
        run = json.loads((directory / "run.json").read_text())
        argv = json.loads((Path(launch["control"]) / "host-supervisor.json").read_text())["args"]
        debug = Path(argv[argv.index("--debug-file") + 1])
        pending, intervals, headers = {}, [], []
        connection_start, connection_end = None, None
        for line in debug.read_text().splitlines():
            match = re.match(r'^(\S+) \[DEBUG\] MCP server "chio": (.+)$', line)
            if not match:
                continue
            stamp, message = match.groups()
            moment = datetime.fromisoformat(stamp)
            if message.startswith("Starting connection with timeout"):
                connection_start = moment
                headers.append(line)
            elif message.startswith("Connection established with capabilities"):
                connection_end = moment
                headers.append(line)
            elif message.startswith("Calling MCP tool: "):
                tool = message.removeprefix("Calling MCP tool: ")
                if tool in pending:
                    raise RuntimeError("Overlapping same-tool timing is ambiguous")
                pending[tool] = moment
                headers.append(line)
            else:
                done = re.match(r"Tool '([^']+)' (completed successfully in|failed after) ([^:]+)", message)
                if not done:
                    continue
                tool, native_status, rounded = done.groups()
                if tool not in pending:
                    raise RuntimeError("Tool completion has no retained native start")
                started = pending.pop(tool)
                headers.append(f'{stamp} [DEBUG] MCP server "chio": {done.group(0)}')
                intervals.append({"tool": tool, "startedAt": started.isoformat(), "finishedAt": moment.isoformat(),
                                  "milliseconds": round((moment - started).total_seconds() * 1000, 3),
                                  "nativeTransportStatus": native_status, "nativeRoundedDuration": rounded})
        if pending:
            raise RuntimeError("Incomplete native tool interval in selected run")
        rows.append({"runDirectory": str(directory), "archiveBoundLaunch": launch,
                     "originalDebugLog": str(debug), "originalDebugSha256": hashlib.sha256(debug.read_bytes()).hexdigest(),
                     "nativeTimingHeaders": headers, "nativeToolIntervals": intervals,
                     "mcpConnectionMilliseconds": round((connection_end - connection_start).total_seconds() * 1000, 3) if connection_start and connection_end else None,
                     "harnessElapsedSeconds": run["elapsedSeconds"], "terminal": run["terminal"],
                     "elapsedBoundary": "Starts before launcher subprocess; ends after independent post-run observer/snapshot. Includes subscription helper, model inference, native host, and verification overhead. It is not precise launcher-only duration."})
    report = {"claim": "bounded retained operational observations, not an incremental latency benchmark", "runs": rows,
              "incrementalChioOverhead": None,
              "missingComparison": "No matched direct-resource native MCP timing was retained. Tool intervals include the resource server and complete gateway/kernel route. Model and observer time must not be attributed to Chio.",
              "smallestPairedObservation": "One matched read_text_file request for the same immutable local file through the current native Chio MCP route and through a separately isolated read-only direct MCP baseline, capturing native call/result timestamps in both. Keep host, resource image, content, warm state, and model tool arguments fixed. Report the two raw intervals and their difference without generalizing a single pair.",
              "startupBoundary": "Native MCP connection time is separately visible. Parent authentication-helper startup and complete launcher startup were not separately timestamped.",
              "providerSpend": "Not measured; subscription inference and whole-model duration are not incremental Chio cost."}
    with args.output.open("x") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    print(json.dumps({"runs": len(rows), "toolIntervals": sum(len(row["nativeToolIntervals"]) for row in rows), "incrementalOverheadClaim": False}))


if __name__ == "__main__":
    main()
