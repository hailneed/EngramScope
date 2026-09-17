from agentmemora import AgentMemora

lens = AgentMemora("agentmemora-demo.db")
first, _ = lens.remember(key="project.database", value="PostgreSQL", source="conversation#1")
second, conflict = lens.remember(key="project.database", value="MongoDB", source="conversation#9")
print("current:", second.value)
print("conflict:", bool(conflict))
print("timeline:", [m.value for m in lens.timeline("project.database")])
print("recall:", [(h.memory.value, h.score) for h in lens.recall("project database")])
