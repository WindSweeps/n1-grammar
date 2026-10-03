"""Build a self-contained offline HTML grammar atlas using only the standard library."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent
entries = []
for filename in ('a.json', 'b.json', 'c.json'):
    entries.extend(json.loads((root / 'data' / filename).read_text()))
required = ('id', 'category', 'pattern', 'meaning', 'connection', 'nuance', 'example', 'translation', 'cue', 'contrast', 'related', 'sources')
assert len(entries) == 108, f'Expected 108 entries, got {len(entries)}'
assert len({entry['id'] for entry in entries}) == len(entries), 'Duplicate IDs'
ids = {entry['id'] for entry in entries}
annotations = {}
for filename in ('readings-a.json', 'readings-b.json', 'readings-c.json'):
    part = json.loads((root / 'data' / filename).read_text())
    assert not annotations.keys() & part.keys(), f'Duplicate annotation IDs in {filename}'
    annotations.update(part)
assert annotations.keys() == ids, 'Every grammar entry must have checked readings'
ruby = re.compile(r'\[([^\[\]|]+)\|([ぁ-ゖー]+)\]')
kanji = re.compile(r'[㐀-䶿一-鿿々〆ヵヶ]')
def normalize_pattern(value):
    return value.replace('〔N2衔接〕', '').replace('（N2衔接）', '').replace('（标注N2衔接）', '')

for entry in entries:
    fields = annotations[entry['id']]
    assert 'example' in fields and 'pattern' in fields, entry['id']
    for field, annotated in fields.items():
        assert field in required[:10] and field not in ('id', 'category', 'translation'), (entry['id'], field)
        assert ruby.sub(lambda match: match[1], annotated) == entry[field], (entry['id'], field, 'Annotation changed source')
        assert not re.search(r'[\[\]|]', ruby.sub('', annotated)), (entry['id'], field, 'Malformed reading')
    assert not kanji.search(ruby.sub('', fields['example'])), (entry['id'], 'Missing example reading')
    fields['pattern'] = normalize_pattern(fields['pattern'])
    entry['pattern'] = normalize_pattern(entry['pattern'])
    entry['furigana'] = fields
    assert all(key in entry for key in required), entry['id']
    assert all(entry[key] for key in required[:10]), entry['id']
    assert all(key in ids for key in entry['related']), entry['id']
    assert all(source['url'].startswith('https://') for source in entry['sources']), entry['id']
payload = json.dumps(entries, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
template = (root / 'index.html.in').read_text()
assert template.count('__GRAMMAR_DATA__') == 1
script = (root / 'app.js').read_text().replace('</script', '<\\/script')
mobile_css = (root / 'mobile.css').read_text()
result = template.replace('__GRAMMAR_DATA__', payload).replace('__APP_SCRIPT__', script).replace('__MOBILE_CSS__', mobile_css)
(root / 'index.html').write_text(result)
print(f'Built {len(entries)} entries: {root / "index.html"}')
