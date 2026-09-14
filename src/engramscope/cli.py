from __future__ import annotations

import argparse
import os


def main() -> None:
    parser = argparse.ArgumentParser(prog="engramscope", description="DevTools for AI-agent memory")
    sub = parser.add_subparsers(dest="command")

    serve = sub.add_parser("serve", help="Start the EngramScope API and dashboard")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8765)
    serve.add_argument("--db", default="engramscope.db")

    export_cmd = sub.add_parser("export-events", help="Export operation events to JSONL")
    export_cmd.add_argument("--db", default="engramscope.db", help="Path to SQLite database")
    export_cmd.add_argument("--format", default="jsonl", choices=["jsonl"], help="Export format (default: jsonl)")
    export_cmd.add_argument("--provider", default=None, help="Filter events by provider name")
    export_cmd.add_argument("--limit", type=int, default=None, help="Maximum number of events to export")
    export_cmd.add_argument("--output", "-o", default=None, help="Output file path (prints to stdout if omitted)")

    args = parser.parse_args()
    if args.command == "serve":
        os.environ["ENGRAMSCOPE_DB"] = args.db
        import uvicorn

        uvicorn.run("engramscope.api:app", host=args.host, port=args.port, reload=False)
    elif args.command == "export-events":
        from .service import EngramScope

        lens = EngramScope(args.db)
        out = lens.export_events(
            output=args.output,
            format=args.format,
            provider=args.provider,
            limit=args.limit,
        )
        if not args.output and out:
            print(out, end="")
    else:
        parser.print_help()
