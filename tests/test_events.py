from engramscope import EngramScope
from engramscope.models import OperationEventCreate


def test_record_external_operation(tmp_path):
    lens = EngramScope(tmp_path / "events.db")
    event = lens.record(
        OperationEventCreate(
            provider="mem0",
            operation="recall",
            namespace="user_id:alice",
            query="preferred editor",
            latency_ms=12.4,
            output_summary={"result_count": 3},
        )
    )

    events = lens.events()
    assert len(events) == 1
    assert events[0].id == event.id
    assert events[0].provider == "mem0"
    assert events[0].output_summary["result_count"] == 3


def test_reference_memory_emits_write_and_conflict_events(tmp_path):
    lens = EngramScope(tmp_path / "events.db")
    lens.remember(key="project.database", value="PostgreSQL")
    lens.remember(key="project.database", value="MongoDB")

    operations = [event.operation for event in lens.events()]
    assert "write" in operations
    assert "conflict" in operations
