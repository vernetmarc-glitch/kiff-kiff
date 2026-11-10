import os, base64, random, shutil
from playwright.sync_api import sync_playwright
S = '/tmp/claude-0/-home-claude/d6940ff9-eadd-594d-a310-40c4f97a3a2f/scratchpad'  # dossier de travail (polices @fontsource dans S/fonts)
F = S + '/fonts'
OUT = S + '/semaine-2'
d64 = lambda f: 'data:font/woff2;base64,' + base64.b64encode(open(f, 'rb').read()).decode()
CSS = f'''
@font-face{{font-family:B;src:url({d64(F+'/fontsource-baskervville/files/baskervville-latin-600-normal.woff2')})}}
@font-face{{font-family:B;font-style:italic;src:url({d64(F+'/fontsource-baskervville/files/baskervville-latin-600-italic.woff2')})}}
@font-face{{font-family:J;font-weight:400;src:url({d64(F+'/fontsource-jost/files/jost-latin-400-normal.woff2')})}}
@font-face{{font-family:J;font-weight:600;src:url({d64(F+'/fontsource-jost/files/jost-latin-600-normal.woff2')})}}
*{{box-sizing:border-box;margin:0}}
body{{width:1080px;height:1350px;overflow:hidden;background:radial-gradient(120% 80% at 50% 0%,#7a1229 0%,#5b0b1c 45%,#33050f 100%);color:#f6e7d8;font-family:J,sans-serif;position:relative}}
body:before{{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 2px,transparent 2px 26px)}}
.cadre{{position:absolute;inset:34px;border:3px solid #c99a4b;border-radius:18px}}
.cadre:after{{content:"";position:absolute;inset:10px;border:1.5px solid rgba(232,197,122,.45);border-radius:12px}}
.in{{position:absolute;inset:120px 96px 170px;display:flex;flex-direction:column;justify-content:center;gap:44px}}
.kick{{font:600 30px J;letter-spacing:.2em;text-transform:uppercase;color:#e2b7a6}}
h2{{font:600 76px/1.1 B,serif;color:#f3dfae}}
.ligne{{font:400 46px/1.35 J;color:#f6e7d8}}
.carte{{background:#f6e9d6;color:#3a0612;border-radius:22px;padding:56px 58px;font:600 58px/1.3 B,serif;box-shadow:0 18px 40px rgba(0,0,0,.35);position:relative;z-index:2}}
.carte small{{display:block;font:600 26px J;letter-spacing:.16em;text-transform:uppercase;color:#8a1630;margin-bottom:20px}}
.barre{{display:inline-block;height:.72em;vertical-align:-.04em;border-radius:12px;background:linear-gradient(100deg,#b8862f,#f3dfae 45%,#b8862f)}}
.cases{{display:inline-flex;gap:5px;vertical-align:-.1em}}
.case{{display:inline-block;width:.62em;height:.8em;border:3px solid #8a1630;border-radius:4px;background:#fffaf2}}
.bulle{{max-width:80%;padding:30px 40px;border-radius:34px;font:400 46px/1.3 J;position:relative;z-index:2}}
.g{{align-self:flex-start;background:rgba(255,240,225,.16);border-bottom-left-radius:8px}}
.d{{align-self:flex-end;background:#e8c57a;color:#3a0612;border-bottom-right-radius:8px}}
.vu{{font:400 28px J;color:#e2b7a6;margin-top:-30px}}
.vu.g2{{align-self:flex-start}}
.vu.d2{{align-self:flex-end}}
.chat{{display:flex;flex-direction:column;gap:22px}}
.lock{{text-align:center;color:#fff}}
.heure{{font:400 210px/1 J;letter-spacing:-.02em;color:#fbeee0}}
.jour{{font:400 38px J;color:#e2b7a6;margin-top:6px}}
.notif{{margin:56px auto 0;width:100%;text-align:left;background:rgba(255,245,235,.16);border:1.5px solid rgba(255,240,225,.25);border-radius:34px;padding:30px 36px;display:flex;gap:26px;align-items:center}}
.notif .ico{{flex:0 0 86px;height:86px;border-radius:22px;background:#3a0612;display:grid;place-items:center}}
.notif .ico svg{{width:62px}}
.notif b{{display:block;font:600 30px J;letter-spacing:.06em;color:#f3dfae;margin-bottom:6px}}
.notif span{{font:400 40px J;color:#fbeee0}}
.notif i{{font-style:normal;float:right;font:400 28px J;color:#e2b7a6}}
.non{{font:600 230px/1 B,serif;color:#e8c57a;text-align:center;position:relative;z-index:2}}
.conf{{position:absolute;inset:0;z-index:1;pointer-events:none}}
.conf span{{position:absolute;display:block;border-radius:3px}}
.pied{{position:absolute;left:0;right:0;bottom:78px;display:flex;justify-content:center;align-items:center;gap:18px;font:600 32px J;letter-spacing:.06em;color:#e8c57a}}
.pied svg{{width:62px;height:46px}}
.num{{position:absolute;top:72px;right:86px;font:600 28px J;color:#e2b7a6;letter-spacing:.1em}}
'''
EMB = '<svg viewBox="0 0 168 124"><circle cx="62" cy="62" r="44" fill="none" stroke="#e8c57a" stroke-width="8"/><circle cx="106" cy="62" r="44" fill="none" stroke="#e8c57a" stroke-width="8"/></svg>'

def barre(n):  # une barre dorée à la longueur du mot caché
    return f'<span class="barre" style="width:{max(2, n) * 0.5:.2f}em"></span>'
def bar(*mots):  # plusieurs mots : une seule barre, de la longueur de l’expression
    return barre(len(' '.join(mots)))
def cases(n):
    return '<span class="cases">' + '<span class="case"></span>' * n + '</span>'
def carte(texte, niveau=''):
    return f'<div class="carte">{"<small>" + niveau + "</small>" if niveau else ""}{texte}</div>'
def lock(heure, jour):
    return (f'<div class="lock"><div class="heure">{heure}</div><div class="jour">{jour}</div>'
            f'<div class="notif"><div class="ico">{EMB}</div><div><b>KIFF KIFF <i>maintenant</i></b><span>Une envie t’attend.</span></div></div></div>')
def confettis(seed=7, n=160):
    random.seed(seed)
    cols = ['#e8c57a', '#f3dfae', '#f08aa3', '#ffffff', '#c99a4b', '#ff5d7a']
    s = ''
    for _ in range(n):
        x, y = random.uniform(2, 98), random.uniform(2, 98)
        if 22 < y < 70 and 8 < x < 92: continue  # le « Non. » reste lisible
        w, h = random.uniform(10, 22), random.uniform(18, 40)
        s += f'<span style="left:{x:.1f}%;top:{y:.1f}%;width:{w:.0f}px;height:{h:.0f}px;background:{random.choice(cols)};transform:rotate({random.uniform(0,180):.0f}deg);opacity:{random.uniform(.6,1):.2f}"></span>'
    return f'<div class="conf">{s}</div>'

J = 'J’ai envie'
P = {
 '01-point-budget': [
   lock('10:47', 'mardi 10 novembre') + carte(f'{J} de te {barre(8)} le pot de miel tel le marteau-piqueur (Bosch Pro).', 'Brûlant')],
 '02-je-pense-a-toi': [
   '<div class="chat"><div class="bulle d">Je pense à toi</div><div class="vu d2">Vu</div></div>',
   '<div class="chat"><div class="bulle d">J’ai envie de toi</div><div class="vu d2">Vu à 14:02</div></div>',
   carte(f'{J} de te faire de la spéléo dans {bar("la", "rondelle")}.', 'Brûlant') + '<div class="chat"><div class="bulle g">Oui, mais… avec une lampe frontale.</div></div>'],
 '03-trois-cuissons': [
   carte(f'{J} de te masser la nuque, très lentement.', 'Tendre'),
   carte(f'{J} de te déshabiller du regard pendant tout le dîner chez tes parents.', 'Pimenté'),
   carte(f'{J} que tu me {barre(5)} le sceptre d’amour jusqu’au nerf optique.', 'Brûlant')],
 '04-le-mobilier': [
   carte(f'{J} de te {barre(10)} la boîte à bonheur sur la table de la cuisine.', 'Brûlant') + '<div class="chat"><div class="bulle g">Oui, mais… sur celle du salon. Celle de la cuisine est déjà bancale.</div></div>'],
 '05-le-creneau': [
   '<h2>Le dirty talk, c’est comme le créneau.</h2><p class="ligne">Tout le monde fait semblant de savoir.</p>',
   '<p class="ligne">Ce que vous avez en tête : tout un programme.</p><p class="ligne">Ce qui sort :</p><h2>«&nbsp;Hmm… c’est… agréable.&nbsp;»</h2>',
   carte(f'{J} que tu me {barre(6)} la chaufferette comme une bonne petite {barre(6)}.', 'Brûlant')],
 '06-devinette': [
   carte(f'{J} de te {barre(5)} ce petit joystick dans les toilettes du bar.', 'Brûlant')],
 '07-douze-ans': [
   '<h2>Douze ans.</h2><h2>Un crédit sur vingt-cinq.</h2><h2>Un chat qui vous juge.</h2>',
   lock('9:03', 'jeudi 12 novembre'),
   carte(f'{J} de te passer un coup de Kärcher sur {bar("ce", "bon", "trou", "du", "cul")}, mode quickie efficace.', 'Brûlant')],
 '08-phrase-romantique': [
   '<p class="kick">Nous avons demandé aux roues une phrase romantique.</p>' + carte(f'{J} de te ravaler la façade de {bar("la", "teuch")}, et sans penser à Macron, stp.', 'Brûlant')],
 '09-les-confettis-du-non': [
   carte(f'{J} de te déboucher (au destop, par exemple) l’{barre(4)} dès que possible.', 'Brûlant'),
   confettis(7) + '<div class="non">Non.</div>',
   carte(f'{J} que tu me {bar("ramones", "bien")} la zézette, à quatre pattes.', 'Brûlant') + '<div class="chat"><div class="bulle g">J’ai envie aussi.</div></div>'],
 '10-ca-infuse': [
   lock('16:12', 'vendredi 13 novembre'),
   carte(f'{J} de te {barre(6)} longuement le périnée, la croupe en l’air.', 'Brûlant')],
 '11-textes-a-trous': [
   carte(f'{J} de te {cases(10)} la tirelire, en toute amitié.'),
   carte(f'{J} que tu me {cases(8)} sans ménagement dès que je passe le pas de la porte.'),
   carte(f'Je veux que tu me laisses un {cases(5)} dans la {cases(4)}, mais on prend un whisky d’abord.'),
   carte(f'{J} de te faire frissonner le {cases(9)} de la pointe d’une langue agile.')],
}

if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1080, 'height': 1350})
    for name, slides in P.items():
        for i, sl in enumerate(slides):
            num = f'<span class="num">{i+1}/{len(slides)}</span>' if len(slides) > 1 else ''
            html = f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="cadre"></div>{num}<div class="in">{sl}</div><div class="pied">{EMB}kiff-kiff.fr</div></body></html>'
            pg.set_content(html); pg.wait_for_timeout(150)
            suffix = f'-{i+1}' if len(slides) > 1 else ''
            pg.screenshot(path=f'{OUT}/{name}{suffix}.png')
    b.close()
print(sorted(os.listdir(OUT)))
