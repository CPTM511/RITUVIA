#!/usr/bin/env python3
from pathlib import Path
import hashlib, json, sys
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'source-manifest.json').read_text())
errors=[]
for item in manifest['files']:
 p=root/item['path']
 if not p.exists(): errors.append(f"missing: {item['path']}")
 elif p.is_file():
  h=hashlib.sha256(p.read_bytes()).hexdigest()
  if h!=item['sha256']: errors.append(f"hash mismatch: {item['path']}")
print('RITUVIA pack verification:', 'PASS' if not errors else 'FAIL')
for e in errors: print('-',e)
sys.exit(1 if errors else 0)
