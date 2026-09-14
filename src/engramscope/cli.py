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

    args = parser.parse_args()
    if args.command == "serve":
        os.environ["ENGRAMSCOPE_DB"] = args.db
        import uvicorn

        uvicorn.run("engramscope.api:app", host=args.host, port=args.port, reload=False)
    else:
        parser.print_help()
