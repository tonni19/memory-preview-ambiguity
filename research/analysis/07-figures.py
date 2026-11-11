from pathlib import Path
import json
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image
import reportlab
# Embedded fonts (the standard Helvetica is not embedded in the PDF).
fonts=Path(reportlab.__file__).parent/'fonts'
pdfmetrics.registerFont(TTFont('Vera',str(fonts/'Vera.ttf')));pdfmetrics.registerFont(TTFont('Vera-Bold',str(fonts/'VeraBd.ttf')))
base=Path(__file__).resolve().parents[1]
fig=base/'paper/figures'; res=base/'analysis/results'
def label(c,x,y,text,bold=False):
    c.setFillColor(HexColor('#172d34'));c.setFont('Vera-Bold' if bold else 'Vera',8.2);c.drawString(x,y,text)
# Figure 1: the consequence panel of each full-page capture, cropped so its text is legible. Labels are set in LaTeX.
panel=(1125,1195,1745,1700)
for kind in ('allow','block'):
    with Image.open(fig/(kind+'.png')) as im:im.convert('RGB').crop(panel).save(fig/(kind+'-panel.png'),optimize=True)
# The diagnostic's suggestion (headless Chrome capture of ui/index.html served by ui/server.mjs, scale factor 3).
with Image.open(fig/'diagnostic.png') as im:im.convert('RGB').crop((120,820,2160,1735)).save(fig/'diagnostic-panel.png',optimize=True)
# Figure 2: rules left by the authored pair, two adaptive tests and the transfer test, drawn in TikZ so fonts match the body.
# Every cell comes from results/identify.json.
ident={r['id']:r for r in json.loads((res/'identify.json').read_text())}
cols=[(r,s,p) for r in (False,True) for s in ('none','same-task','same-person') for p in (False,True)]
cw,ch,x0=.68,.30,6.6
out=[r'\begin{tikzpicture}[x=1cm,y=1cm,font=\footnotesize]']
y=0
for name,key in (('One-off choice','desk'),('Explicit preference','lighting')):
    out.append(rf'\node[anchor=west,font=\footnotesize\bfseries] at (0,{y-ch*.5:.3f}) {{{name}}};')
    choices=ident[key]['adaptiveSecondChoices']
    adaptive=[('two adaptive tests',choices[0]['grid'])] if len(choices)==1 else [('adaptive, tie broken to original task',choices[0]['grid']),('adaptive, tie broken to other task',choices[1]['grid'])]
    for label_,field in [('authored pair',ident[key]['authoredGrid'])]+adaptive+[('transfer test',ident[key]['transferGrid'])]:
        out.append(rf'\node[anchor=east] at ({x0-.1:.3f},{y-ch/2:.3f}) {{{label_}}};')
        lookup={(g['recall'],g['recommendation'],g['preference']):g for g in field}
        for j,col in enumerate(cols):
            g=lookup.get(col);xa,xb=x0+j*cw,x0+(j+1)*cw
            if g is None:out.append(rf'\path[pattern=north east lines,pattern color=black!35] ({xa:.3f},{y:.3f}) rectangle ({xb:.3f},{y-ch:.3f});')
            elif g['compatible']:out.append(rf'\fill[gridblue] ({xa:.3f},{y:.3f}) rectangle ({xb:.3f},{y-ch:.3f});')
            out.append(rf'\draw[black!30,line width=.3pt] ({xa:.3f},{y:.3f}) rectangle ({xb:.3f},{y-ch:.3f});')
        for j,col in enumerate(cols):
            g=lookup.get(col)
            if g and g['intended']:out.append(rf'\draw[gridink,line width=1.1pt] ({x0+j*cw+.03:.3f},{y-.03:.3f}) rectangle ({x0+(j+1)*cw-.03:.3f},{y-ch+.03:.3f});')
        y-=ch
    y-=.12
for k,(name,pick) in enumerate((('recall',lambda c:'on' if c[0] else 'off'),('recommendation',lambda c:{'none':'none','same-task':'task','same-person':'any'}[c[1]]),('preference',lambda c:'on' if c[2] else 'off'))):
    yy=y-.10-k*.28
    out.append(rf'\node[anchor=east] at ({x0-.1:.3f},{yy:.3f}) {{{name}}};')
    out+= [rf'\node at ({x0+(j+.5)*cw:.3f},{yy:.3f}) {{{pick(c)}}};' for j,c in enumerate(cols)]
out.append(r'\end{tikzpicture}')
(base/'paper/grid-figure.tex').write_text('\n'.join(out)+'\n',encoding='utf8')
rows=json.loads((res/'space.json').read_text()); c=Canvas(str(fig/'space.pdf'),pagesize=(355,145),initialFontName='Vera')
x=lambda v:38+v*3.75;y=lambda v:23+v*2.02
for k in [0,20,40,60,80]:
    label(c,x(k)-3,9,str(k))
for k in [0,20,40]:
    label(c,12,y(k)-3,str(k));c.setStrokeColor(HexColor('#d4dcdf'));c.line(x(0),y(k),x(80),y(k))
for id,color,symbol in [('desk','#116052','circle'),('lighting','#98390e','square')]:
    data=[r for r in rows if r['scenario']==id];points=[(x(r['space']),y(r['remaining'])) for r in data]
    for a,b in zip(points,points[1:]):c.setStrokeColor(HexColor(color));c.line(*a,*b)
    for px,py in points:
        c.setFillColor(HexColor(color))
        if symbol=='circle':c.circle(px,py,2.7,stroke=0,fill=1)
        else:c.rect(px-2.5,py-2.5,5,5,stroke=0,fill=1)
label(c,6,133,'Compatible rules');label(c,240,9,'') 
label(c,157,1,'Valid rules');label(c,138,51,'One-off');label(c,168,118,'Explicit preference')
c.showPage();c.save()
# Enumerate the published rule order and retain two distinct signatures.
def row(explicit):
    cells=[]
    for recall in [0,1]:
        for scope in ['none','task','person']:
            for pref in [0,1]:
                cells.append('invalid' if pref and not explicit else 'compatible' if (pref if explicit else scope!='none') else 'excluded')
    return cells
c=Canvas(str(fig/'two-patterns.pdf'),pagesize=(452,70),initialFontName='Vera')
for j,(r,s,p) in enumerate((r,s,p) for r in [0,1] for s in ['N','T','P'] for p in [0,1]):
    label(c,107+j*28,55,f'{r}{s}{p}')
for i,(name,exp) in enumerate([('One-off choice',False),('Explicit preference',True)]):
    label(c,4,35-18*i,name,True)
    for j,status in enumerate(row(exp)):
        label(c,112+j*28,35-18*i,{'invalid':'--','compatible':'Y','excluded':'N'}[status])
c.showPage();c.save()
