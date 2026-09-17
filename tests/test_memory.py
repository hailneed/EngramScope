from agentmemora import AgentMemora


def test_conflict_creates_history(tmp_path):
    lens = AgentMemora(tmp_path / "test.db")
    first, conflict = lens.remember(key="project.database", value="PostgreSQL", source="chat#1")
    assert conflict is None
    second, conflict = lens.remember(key="project.database", value="MongoDB", source="chat#2")
    assert conflict is not None
    assert conflict.previous.status == "historical"
    assert second.supersedes == first.id
    timeline = lens.timeline("project.database")
    assert [m.value for m in timeline] == ["PostgreSQL", "MongoDB"]
    assert [m.status for m in timeline] == ["historical", "active"]


def test_recall_returns_explanation(tmp_path):
    lens = AgentMemora(tmp_path / "test.db")
    lens.remember(key="project.database", value="PostgreSQL", source="chat#1")
    hits = lens.recall("project database")
    assert hits and hits[0].memory.key == "project.database"
    assert "lexical_overlap" in hits[0].reason
