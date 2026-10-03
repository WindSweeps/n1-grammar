"""Build a self-contained offline HTML grammar atlas using only the standard library."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
entries = []
for filename in ('a.json', 'b.json', 'c.json'):
    entries.extend(json.loads((root / 'data' / filename).read_text()))
required = ('id', 'category', 'pattern', 'meaning', 'connection', 'nuance', 'example', 'translation', 'cue', 'contrast', 'related', 'sources')
assert len(entries) == 108, f'Expected 108 entries, got {len(entries)}'
assert len({entry['id'] for entry in entries}) == len(entries), 'Duplicate IDs'
ids = {entry['id'] for entry in entries}
for entry in entries:
    entry['pattern'] = entry['pattern'].replace('〔N2衔接〕', '').replace('（N2衔接）', '').replace('（标注N2衔接）', '')
    assert all(key in entry for key in required), entry['id']
    assert all(entry[key] for key in required[:10]), entry['id']
    assert all(key in ids for key in entry['related']), entry['id']
    assert all(source['url'].startswith('https://') for source in entry['sources']), entry['id']
payload = json.dumps(entries, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
template = (root / 'index.html.in').read_text()
assert template.count('__GRAMMAR_DATA__') == 1
(root / 'index.html').write_text(template.replace('__GRAMMAR_DATA__', payload))
print(f'Built {len(entries)} entries: {root / "index.html"}')
