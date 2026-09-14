# Contributing

EngramScope is early and contributions are welcome.

## Good first contributions
- Add an adapter for a memory framework.
- Improve recall explanation / scoring.
- Add a benchmark scenario.
- Improve the dashboard.
- Add an export format.

## Local setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
pytest
engramscope serve
```

Please keep PRs focused and include tests for behavior changes.
