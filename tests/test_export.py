import json
from pathlib import Path
import pytest

from engramscope import EngramScope, export_events
from engramscope.models import OperationEventCreate
from engramscope.cli import main


def test_export_events_jsonl_content(tmp_path):
    lens = EngramScope(tmp_path / "events.db")
    lens.record(
        OperationEventCreate(
            provider="mem0",
            operation="recall",
            namespace="user:alice",
            query="preferred database",
            latency_ms=15.5,
            input_summary={"query": "preferred database"},
            output_summary={"hits": 2},
        )
    )
    lens.record(
        OperationEventCreate(
            provider="custom",
            operation="write",
            namespace="user:bob",
            key="city",
            latency_ms=8.2,
            input_summary={"key": "city", "value": "Paris"},
            output_summary={"status": "active"},
        )
    )

    jsonl_output = lens.export_events(format="jsonl")
    lines = [line for line in jsonl_output.strip().split("\n") if line]
    assert len(lines) == 2

    # Verify each line is valid JSON and preserves required fields
    records = [json.loads(line) for line in lines]
    providers = {r["provider"] for r in records}
    assert providers == {"mem0", "custom"}

    for r in records:
        assert "created_at" in r
        assert "latency_ms" in r
        assert "namespace" in r
        assert "provider" in r
        assert "operation" in r
        assert "input_summary" in r
        assert "output_summary" in r


def test_export_events_provider_filter(tmp_path):
    lens = EngramScope(tmp_path / "events.db")
    lens.record(OperationEventCreate(provider="mem0", operation="read", namespace="ns1"))
    lens.record(OperationEventCreate(provider="other", operation="read", namespace="ns2"))

    filtered = lens.export_events(provider="mem0")
    lines = [line for line in filtered.strip().split("\n") if line]
    assert len(lines) == 1
    record = json.loads(lines[0])
    assert record["provider"] == "mem0"


def test_export_events_to_file(tmp_path):
    lens = EngramScope(tmp_path / "events.db")
    lens.record(OperationEventCreate(provider="mem0", operation="write", namespace="ns1"))

    out_file = tmp_path / "exported.jsonl"
    lens.export_events(output=out_file)

    assert out_file.exists()
    content = out_file.read_text(encoding="utf-8")
    lines = [line for line in content.strip().split("\n") if line]
    assert len(lines) == 1
    assert json.loads(lines[0])["provider"] == "mem0"


def test_export_events_unsupported_format(tmp_path):
    lens = EngramScope(tmp_path / "events.db")
    with pytest.raises(ValueError, match="Unsupported export format"):
        lens.export_events(format="csv")


def test_export_events_cli(tmp_path, monkeypatch, capsys):
    db_path = tmp_path / "cli_events.db"
    lens = EngramScope(db_path)
    lens.record(OperationEventCreate(provider="cli_provider", operation="recall", namespace="ns"))

    out_file = tmp_path / "cli_out.jsonl"
    monkeypatch.setattr(
        "sys.argv",
        ["engramscope", "export-events", "--db", str(db_path), "--format", "jsonl", "--output", str(out_file)],
    )
    main()

    assert out_file.exists()
    records = [json.loads(line) for line in out_file.read_text(encoding="utf-8").strip().split("\n") if line]
    assert len(records) == 1
    assert records[0]["provider"] == "cli_provider"

    # Test CLI stdout output
    monkeypatch.setattr(
        "sys.argv",
        ["engramscope", "export-events", "--db", str(db_path), "--format", "jsonl"],
    )
    main()
    captured = capsys.readouterr()
    stdout_records = [json.loads(line) for line in captured.out.strip().split("\n") if line]
    assert len(stdout_records) == 1
    assert stdout_records[0]["provider"] == "cli_provider"
