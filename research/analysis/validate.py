from pathlib import Path
import json,re,hashlib
from pypdf import PdfReader
from PIL import Image
root=Path(__file__).resolve().parents[1];paper=root/'paper'
load=lambda n:json.loads((root/'analysis/results'/(n+'.json')).read_text(encoding='utf8'))
tex=(paper/'manuscript.tex').read_text(encoding='utf8')
assert r'\documentclass[manuscript,review]{acmart}' in tex
assert 'figure*' not in tex and 'table*' not in tex and tex.count(r'\Description{')==tex.count(r'\begin{figure}')
pdf=PdfReader(paper/'manuscript.pdf');pages=[p.extract_text() for p in pdf.pages]
assert len(pages)==5 and 'References' in pages[4] and 'AI use.' in pages[3]
assert 'References' not in ''.join(pages[:4])
assert all(x['alwaysBlocked'] for x in load('pairs'))
assert len(load('trials'))==4 and {r['records'] for r in load('trials') if r['task']=='different'}=={0}
assert load('reference')['mismatches']==0 and load('reference')['contexts']==52 and load('reference')['sanityExecutions']==156
assert len(load('match')['rows'])==48 and len(load('leakage'))==6
assert abs(load('metrics')['gainBits']-.7233083338141041)<1e-10 and load('metrics')['aliasesBlocked']==12
assert load('metrics')['actualSpend']<.10
grid={r['id']:r['authoredGrid'] for r in load('identify')}
assert sum(g['compatible'] for g in grid['desk'])==4 and len(grid['desk'])==6 and sum(g['compatible'] for g in grid['lighting'])==6 and len(grid['lighting'])==12
assert all(any(g['intended'] and g['compatible'] for g in v) for v in grid.values())
# Claims added on 10 November: invariant requests, minimum identifying tests and what two tests leave open.
ident={r['id']:r for r in load('identify')}
assert len(ident)==12 and all(r['minimumIdentifying']==r['lowerBound']==r['adaptiveWorstCaseAnswers'] for r in ident.values())
assert (ident['desk']['invariantRequests'],ident['desk']['minimumIdentifying'])==(12,3) and (ident['lighting']['invariantRequests'],ident['lighting']['minimumIdentifying'])==(11,4)
assert {x.split('; ')[1] for x in ident['desk']['adaptiveLeaves']}=={'recommendation same-task','recommendation same-person'}
assert {x.split('; ')[0] for x in ident['desk']['transferLeaves']}=={'recall on','recall off'} and {x.split('; ')[1] for x in ident['desk']['transferLeaves']}=={'recommendation same-task'}
# Claims added in the second 10 November revision: every possible preview, and test counts when permissions depend on each other.
pv=load('previews');d,l=pv['desk'],pv['lighting']
assert (d['intended']['pairs'],d['intended']['blockedEliminatesNothing'],d['intended']['identifying'])==(39,36,0) and round(d['intended']['meanRulesLeft'],1)==3.2
assert (l['intended']['pairs'],l['intended']['blockedEliminatesNothing'],l['intended']['identifying'])==(48,44,0) and round(l['intended']['meanRulesLeft'],1)==6.3
assert [d['extended'][k] for k in ('rules','requests','lowerBound','fixedSet','adaptiveMax')]==[25,48,5,6,5]
assert [l['extended'][k] for k in ('rules','requests','lowerBound','fixedSet','adaptiveMax')]==[77,48,7,9,7]
match=load('match')['scores'];assert (match['exact']['tp'],match['embedding']['tp']+match['embedding']['fp'],match['judge']['tp'],match['judge']['fp'])==(3,23,11,0)
agrid={k:{f:sum(g['compatible'] for g in ident[k][f]) for f in ('authoredGrid','adaptiveGrid','transferGrid')} for k in ('desk','lighting')}
assert agrid=={'desk':{'authoredGrid':4,'adaptiveGrid':2,'transferGrid':2},'lighting':{'authoredGrid':6,'adaptiveGrid':3,'transferGrid':4}}
# Claims reworded after the 10 November review: what the even-split criterion leaves under every tie-break.
scopes=lambda k:sorted(sorted(p['scopesLeft']) for p in ident[k]['adaptivePaths'])
assert scopes('lighting')==[['none','same-person','same-task']]*2 and all(len(p['leaves'])==3 for p in ident['lighting']['adaptivePaths'])
assert scopes('desk')==[['none','same-task'],['same-person','same-task']] and all(len(p['leaves'])==2 for p in ident['desk']['adaptivePaths'])
assert len({round(p['disagreement'],12) for p in ident['desk']['adaptivePaths']})==1
assert not any('recommendation same-person' in x for x in ident['lighting']['transferLeaves']) and len(ident['lighting']['transferLeaves'])==4
assert 'diagnostic-panel.png' in tex and 'six purposes (recall, recommendation, preference, handoff, follow-up and trait)' in tex
# Survey pilot (11 November): aggregate counts written by 11-survey-pilot.py from the study export.
sv=load('survey-pilot')
assert sv['people']==20 and sv['missedAtLeastOne']==10 and sv['lamp'].get('incorrect')==5 and sv['bookcase']=={'correct':14,'incorrect':3,'unsure':3}
assert sv['wrongDirection']=={'expected_allow_rule_blocks':4,'expected_block_rule_allows':4} and 'yes' not in sv['fitAmongMissed'] and sv['fitAmongAllCorrect'].get('yes')==9
assert round(sv['medianSeconds'])==41 and 'unsure' not in sv['lamp']  # "the only unsure answers given" were on the bookcase
for phrase in ['Ten of 20','Five mispredicted the original task','six did not predict the transfer','against nine of the other ten','median completion time was 41 seconds','10 of 20 people']:
    assert phrase in tex, phrase
sources=(paper/'related.tex').read_text()+tex
cites=set(k for group in re.findall(r'\\cite\{([^}]+)\}',sources) for k in group.split(','))
bib=set(re.findall(r'@\w+\{(\w+),',(paper/'references.bib').read_text(encoding='utf8')))
assert cites==bib and len(cites)==21
assert all(Image.open(paper/'figures'/f).width>=1800 for f in ['allow.png','block.png'])
print('PASS: four body pages, one reference page, 21 cited records, descriptions for every manuscript figure, checked numerical inputs and budget.')
