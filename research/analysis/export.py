import csv,json
from pathlib import Path
root=Path(__file__).resolve().parent
def write(name,rows):
 with (root/'results'/name).open('w',newline='',encoding='utf-8') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
load=lambda n:json.loads((root/'results'/(n+'.json')).read_text())
write('label-review.csv',[{**r,'reviewer_same_different_unsure':'','rationale':''} for r in json.loads((root/'task-pairs.json').read_text())])
write('task-matcher.csv',load('match')['rows'])
write('rule-space.csv',load('space'))
write('draft-saved.csv',load('trials'))
write('strategies.csv',[{'scenario':x['id'],'strategy':k,**x[k]} for x in load('pairs') for k in ['authored','adaptive','transfer','random']])
