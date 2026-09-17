# Scan command examples

```bash
# Default: current workspace + supported home agent memory locations
npx --yes --package=github:hailneed/agentmemora#main agentmemora

# A specific workspace + supported home agent memory locations
npx --yes --package=github:hailneed/agentmemora#main agentmemora scan --path "$HOME/projects/my-app"

# A specific workspace only
npx --yes --package=github:hailneed/agentmemora#main agentmemora scan --path "$HOME/projects/my-app" --no-home
```
