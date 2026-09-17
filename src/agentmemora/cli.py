from __future__ import annotations

import argparse
import os


def main() -> None:
    parser = argparse.ArgumentParser(prog="agentmemora", description="DevTools for AI-agent memory")
    sub = parser.add_subparsers(dest="command")
    serve = sub.add_parser("serve", help="Start the AgentMemora API and dashboard")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8765)
    serve.add_argument("--db", default="agentmemora.db")
    args = parser.parse_args()
    if args.command == "serve":
        os.environ["AGENTMEMORA_DB"] = args.db
        import uvicorn
        uvicorn.run("agentmemora.api:app", host=args.host, port=args.port, reload=False)
    else:
        parser.print_help()
