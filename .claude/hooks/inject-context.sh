#!/usr/bin/env bash
RULES_FILE="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")/.archie/rules.json"
[ ! -f "$RULES_FILE" ] && exit 0
USER_INPUT=$(cat || true)
[ -z "$USER_INPUT" ] && exit 0
PROMPT=$(echo "$USER_INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('user_prompt', ''))
except: print('')
" 2>/dev/null || echo "")
[ -z "$PROMPT" ] && exit 0
python3 << PYEOF
import json
prompt_lower = """$PROMPT""".lower()
try:
    rules = json.load(open("$RULES_FILE")).get("rules", [])
except: exit(0)
matched = [r for r in rules if any(k.lower() in prompt_lower for k in r.get("keywords", []))]
matched += [r for r in rules if r.get("severity") == "error" and r not in matched]
if matched:
    print("[Archie] Architecture rules:")
    for r in matched[:10]:
        print(f"  - {r.get('description', r.get('id', ''))}")
PYEOF
