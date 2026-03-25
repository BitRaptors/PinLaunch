#!/usr/bin/env bash
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
RULES_FILE="$PROJECT_ROOT/.archie/rules.json"
[ ! -f "$RULES_FILE" ] && exit 0
TOOL_INPUT=$(cat || true)
[ -z "$TOOL_INPUT" ] && exit 0
FILE_PATH=$(echo "$TOOL_INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input',{}).get('file_path', d.get('tool_input',{}).get('path','')))
except: print('')
" 2>/dev/null || echo "")
TOOL_NAME=$(echo "$TOOL_INPUT" | python3 -c "
import sys, json
try: print(json.load(sys.stdin).get('tool_name',''))
except: print('')
" 2>/dev/null || echo "")
case "$TOOL_NAME" in Write|Edit|MultiEdit) ;; *) exit 0 ;; esac
[ -z "$FILE_PATH" ] && exit 0
# Skip files outside project root (e.g. /tmp/)
case "$FILE_PATH" in "$PROJECT_ROOT"*) ;; /*) exit 0 ;; esac
python3 -c "
import json, sys, os, re
fp = '$FILE_PATH'
try: rules = json.load(open('$RULES_FILE')).get('rules', [])
except: sys.exit(0)
# Read file content for content-based checks
content = ''
try:
    tool_data = json.loads('$TOOL_INPUT'.replace(chr(10), ' ') if '$TOOL_INPUT' else '{}')
    content = tool_data.get('tool_input', {}).get('content', '') or tool_data.get('tool_input', {}).get('new_string', '')
except: pass
errors = []
warns = []
for r in rules:
    check = r.get('check', '')
    desc = r.get('description', '')
    sev = r.get('severity', 'warn')
    if check == 'file_placement':
        dirs = r.get('allowed_dirs', [])
        if dirs and not any(fp.startswith(d) for d in dirs):
            (errors if sev == 'error' else warns).append(desc)
    elif check == 'naming':
        pat = r.get('pattern', '')
        if pat and not re.match(pat, os.path.basename(fp)):
            (errors if sev == 'error' else warns).append(desc)
    elif check == 'chain_violation' and content:
        for kw in r.get('violation_keywords', []):
            if kw.lower() in content.lower():
                chain_path = ' -> '.join(r.get('chain_path', [])[:4])
                downstream = r.get('downstream', [])[:3]
                msg = f'[Chain] {desc}'
                if downstream: msg += f' Breaks: {chr(44).join(downstream)}'
                (errors if sev == 'error' else warns).append(msg)
                break
    elif check == 'tradeoff_violation' and content:
        for sig in r.get('violation_signals', []):
            if sig.lower() in content.lower():
                (errors if sev == 'error' else warns).append(f'[Trade-off] {desc}')
                break
    elif check == 'dependency_direction' and content:
        applies = r.get('applies_to', '')
        if applies and fp.startswith(applies):
            for forbidden in r.get('forbidden_imports', []):
                if re.search(r'(?:import|from).*[\"\\x27].*' + re.escape(forbidden), content):
                    (errors if sev == 'error' else warns).append(desc)
                    break
for w in warns[:3]:
    print(f'[Archie] Warning: {w}')
for e in errors:
    print(f'[Archie] BLOCKED: {e}')
    print('  Ask the user to approve this override.')
if errors: sys.exit(2)
" 2>/dev/null || exit 0
