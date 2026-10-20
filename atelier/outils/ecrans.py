"""Le tour des écrans (à lancer avec le jeu servi sur localhost:8765 et un relais MQTT local sur le port 8888, voir duoh.py) : une vraie partie sur un téléphone puis sur deux, une capture par écran,
et l’emplacement de chaque texte (clé de textes.js) dans ces captures. Résultat : atelier/ecrans/*.webp
et atelier/ecrans.js (KIFF_ECRANS). À relancer quand un écran change."""
import asyncio, json, os, sys, subprocess
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from duoh import BASE, REL, click, maybe, handoff, newpage
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = ROOT + '/ecrans'
TMP = '/tmp/kiffkiff-ecrans'
os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
CAT = json.loads(subprocess.check_output(['node', '-e', "global.window={};require('" + os.path.join(os.path.dirname(ROOT), 'textes.js') + "');console.log(JSON.stringify(window.KIFF_TEXTES.flatMap(g=>g.textes.map(t=>({k:t[0],g:g.id,d:t[1]})))))"]))
SEL = {'fete.cris': '#party-title', 'kiffs.compte': '#kiffs-count', 'kiffs.compte-1': '#kiffs-count', 'kiffs.compte-dont': '#kiffs-count', 'kiffs.compte-1-dont': '#kiffs-count', 'kiffs.titre-avec': '#kiffs-title', 'jeu.hasard': '#dice', 'jeu.annuler': '.is-changed .stamp', 'loupe.chercher-0': '#loupe-q', 'loupe.chercher-1': '#loupe-q', 'loupe.chercher-2': '#loupe-q', 'libre.titre-0': '#edit-label', 'libre.titre-1': '#edit-label', 'libre.titre-2': '#edit-label', 'libre.aide-0-me': '#edit-hint', 'libre.aide-0-te': '#edit-hint', 'libre.aide-1': '#edit-hint', 'libre.aide-2': '#edit-hint', 'jeu.vide-0': '.reel[data-reel="0"]', 'jeu.vide-1': '.reel[data-reel="1"]', 'jeu.vide-2': '.reel[data-reel="2"]', 'passage.texte': '#handoff-text', 'roues.ton-e-desc': '#roues-ex', 'roues.ton-m-desc': '#roues-ex', 'roues.ton-b-desc': '#roues-ex', 'roues.apres': '#hint', 'roues.refus': '#hint', 'jeu.une-seule': '#hint', 'jeu.une-seule-sens': '#hint', 'jeu.sens-libre': '#hint', 'jeu.ecris': '#hint', 'jeu.nom-0': '#hint', 'jeu.nom-1': '#hint', 'jeu.nom-2': '#hint', 'jeu.nom-sens': '#hint', 'roues.verrou-2': '#piment-list .is-locked .piment-tdesc', 'roues.verrou-3': '#piment-list .is-locked .piment-tdesc', 'fete.gardee': '#party-done', 'fete.gardee-par': '.party-text', 'fete.absence': '.party-text', 'fete.suite': '#party-next', 'fete.debloque': '#party-unlock', 'fete.image-ok': '#party-done', 'tukiffes.envoye': '#deal-done', 'tukiffes.copie': '#deal-done', 'duo.attente-la': '#duo-wait-text', 'duo.attente-averti': '#duo-wait-text', 'duo.copiee': '#duo-copy', 'duo.copie-impossible': '#duo-copy', 'attente.ajuste': '#wait-title', 'attente.ajuste-texte': '#wait-kicker', 'attente.relit': '#wait-kicker', 'attente.piment': '#wait-kicker', 'attente.absent': '#wait-presence', 'attente.absent-averti': '#wait-presence', 'attente.perdue': '#wait-presence', 'attente.copie': '#wait-presence', 'attente.copie-impossible': '#wait-presence', 'attente.averti': '#wait-notif .notif-word', 'attente.pas-connecte': '#duo-status', 'nouvelles.commence': '#note-title', 'nouvelles.fin': '#note-title', 'nouvelles.piment': '#note-title', 'nouvelles.commence-texte': '#note-text', 'nouvelles.fin-texte': '#note-text', 'nouvelles.piment-texte': '#note-text', 'nouvelles.passe-toi': '#note-text', 'nouvelles.passe-autre': '#note-text', 'offre.titre-ajuste': '#offer-title', 'offre.oui-ajuste': '#offer-yes', 'offre.passe-tel': '#offer-kicker', 'invite.regle-1': '#inv-rule-1', 'invite.regle-2': '#inv-rule-2', 'invite.regle-1-envie': '#inv-rule-1', 'invite.regle-2-envie': '#inv-rule-2', 'invite.piments': '#inv-piments', 'invite.piment-monte': '#inv-piments', 'cadeau.titre-anonyme': '#gift-title', 'accueil.en-cours': '#duo-home-text', 'accueil.en-cours-msg': '#duo-home-text', 'accueil.en-cours-kiffs': '#duo-home-text', 'accueil.nouvelle': '#welcome-go', 'accueil.arreter-confirmer': '#duo-quit', 'depart.titre-distance': '#pick-title', 'depart.texte-distance': '#pick-text', 'depart.go-distance': '#piment-go', 'parties.nombre': '#games-open-n', 'jeu.glisser': '#act-main', 'jeu.sans-envie': '#pass', 'principe.autre': '#rule-a', 'duo.invite-texte-envie': '#duo-text', 'duo.invite-texte': '#duo-text'}
SEL.update({'duo.titre': '#duo-title', 'duo.connexion-titre': '#duo-title', 'duo.suite': '#duo-title', 'duo.rejoindre-titre': '#duo-title', 'duo.creer-texte': '#duo-text', 'duo.suite-texte': '#duo-text', 'duo.rejoindre-texte': '#duo-text', 'duo.rejoindre-commencee': '#duo-text', 'duo.erreur-support': '#duo-text', 'duo.erreur-net': '#duo-text', 'duo.erreur-relais': '#duo-text', 'duo.erreur-introuvable': '#duo-text', 'duo.erreur-finie': '#duo-text', 'duo.erreur-version': '#duo-text', 'duo.creer': '#duo-go', 'duo.suite-ok': '#duo-go', 'duo.rejoindre': '#duo-go', 'duo.reessayer': '#duo-go', 'duo.accueil': '#duo-cancel', 'duo.ouvre': '#duo-wait-text', 'duo.connexion': '#duo-wait-text', 'duo.retrouve': '#duo-wait-text', 'parties.a-toi': '#games-sheet-list .game-turn', 'parties.kiff-neuf': '#games-sheet-list .game-turn', 'parties.kiff': '#games-sheet-list .game-turn', 'parties.personne': '#games-sheet-list .game-turn', 'parties.a-rejoindre': '#games-sheet-list .game-turn', 'parties.confirmer': '#games-sheet-list .game-turn', 'parties.tour': '#games-sheet-list .game-turn', 'parties.invitation': '#games-sheet-list .game-who', 'parties.a-deux': '#games-sheet-list .game-who', 'parties.avec': '#games-sheet-list .game-who', 'parties.kiffs': '#games-sheet-list .game-who', 'parties.l-autre': '#games-sheet-list .game-who', 'avertir.iphone': '#note-title', 'avertir.bloques': '#note-title', 'avertir.autoriser': '#note-title', 'avertir.indisponibles': '#note-title', 'installer.titre': '#note-title', 'avertir.iphone-texte': '#note-text', 'avertir.autoriser-texte': '#note-text', 'avertir.service': '#note-text', 'avertir.navigateur': '#note-text', 'avertir.bloques-android': '#note-text', 'avertir.bloques-iphone': '#note-text', 'avertir.bloques-autre': '#note-text', 'installer.iphone': '#note-text', 'avertir.coupes': '#wait-presence', 'avertir.ok': '#wait-presence', 'attente.copie': '#wait-presence', 'attente.copie-impossible': '#wait-presence', 'roues.verrou-2': '#piment-list .piment-tdesc', 'roues.verrou-3': '#piment-list .piment-tdesc', 'roues.erreur': '#piment-list', 'accueil.parties': '#games-open', 'attente.prevenir': '#wait-notif', 'fete.installer': '.party-foot', 'fete.image-ok': '#party-done'})
SHOTS = []          # [id, nom, groupes]
OU = {}             # clé -> [shot, x, y, w, h]

LOCATE = r"""
([groups, cat, ou, sel]) => {
  const norm = (s) => String(s).replace(/[  ]/g, ' ').replace(/'/g, '’').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return null;
    }
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + Math.min(r.width / 2, 40))), y = Math.min(innerHeight - 1, Math.max(0, r.top + Math.min(r.height / 2, 12)));
    const h = document.elementFromPoint(x, y);
    if (!h || !(el.contains(h) || h.contains(el) || (h.closest && h.closest('label') && h.closest('label').contains(el)))) return null;
    return r;
  };
  const all = [...document.body.querySelectorAll('*')].filter((e) => !['SCRIPT', 'STYLE', 'svg', 'use', 'path', 'circle', 'rect', 'symbol'].includes(e.tagName));
  const res = {};
  for (const { k, g, d } of cat) {
    if (!groups.includes(g) || ou[k]) continue;
    let r = null;
    for (const el of document.querySelectorAll('[data-t="' + k + '"], [data-t-ph="' + k + '"]')) { r = shown(el); if (r) break; }
    if (!r) {
      const frags = norm(d).split(/\{[^{}]+\}/).map((x) => x.trim()).filter((x) => x.length >= 3).sort((a, b) => b.length - a.length);
      const f = frags[0];
      if (f) {
        const hits = all.filter((e) => norm(e.textContent).includes(f) || norm(e.getAttribute('placeholder') || '').includes(f));
        const deep = hits.filter((e) => ![...e.children].some((c) => hits.includes(c)));
        for (const el of deep) { r = shown(el); if (r) break; }
      }
    }
    let alt = 0;
    if (!r && sel[k]) for (const el of document.querySelectorAll(sel[k])) {
      r = shown(el);
      if (r) { const f = norm(d).split(/\{[^{}]+\}/).map((x) => x.trim()).sort((a, b) => b.length - a.length)[0] || ''; alt = f && !norm(el.textContent).includes(f) ? 1 : 0; break; }
    }
    if (r) res[k] = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), alt];
  }
  return res;
}
"""

async def snap(pg, sid, nom, groups, wait=450):
    await pg.wait_for_timeout(wait)
    png = TMP + '/' + sid + '.png'
    await pg.screenshot(path=png)
    found = await pg.evaluate(LOCATE, [groups, CAT, OU, SEL])
    for k, r in found.items():
        OU[k] = [sid] + r
    Image.open(png).convert('RGB').save(OUT + '/' + sid + '.webp', 'WEBP', quality=58, method=6)
    SHOTS.append([sid, nom, groups, 390, 844])
    print(sid, len(found), pg.errs)

async def free_cell(pg, r):
    sel = '.reel[data-reel="%d"]' % r
    await pg.focus(sel)
    for _ in range(40):
        v = await pg.get_attribute(sel, 'aria-valuetext') or ''
        if v.startswith('écris'): return
        await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(260)

async def open_loupe(pg):
    sel = '.reel[data-reel="1"]'
    for _ in range(6):
        await pg.focus(sel); await pg.wait_for_timeout(300)
        v = await pg.get_attribute(sel, 'aria-valuetext') or ''
        if v.startswith('écris'): await pg.keyboard.press('ArrowDown'); await pg.wait_for_timeout(700)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(700)
        if await pg.is_visible('#loupe-q'): return
        if await pg.is_visible('#edit-cancel'): await pg.click('#edit-cancel'); await pg.wait_for_timeout(400)
    raise Exception('loupe fermée')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await newpage(b, 'redcorner', {})
        await pg.route('https://script.google.com/**', lambda route: route.abort())
        await pg.goto(BASE + '?design=redcorner'); await pg.wait_for_timeout(1200)
        await snap(pg, 'accueil', 'L’accueil, à la première visite', ['accueil'])
        await pg.click('#skin-open'); await snap(pg, 'ambiance', 'Choisis l’ambiance', ['ambiance'])
        await pg.click('#skins-done'); await pg.wait_for_timeout(300)
        await pg.click('#home-deal'); await snap(pg, 'tukiffes', 'Tu kiffes ?', ['tukiffes'], 900)
        await pg.click('#deal-story summary'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('#deal-story').scrollIntoView({block:'start'})")
        await snap(pg, 'tukiffes-histoire', 'Tu kiffes ? L’histoire du jeu', ['tukiffes'])
        await pg.click('#deal-close'); await pg.wait_for_timeout(300)
        # Un téléphone : départ, principe, piments
        await pg.click('#welcome-go'); await snap(pg, 'joueurs', 'Qui joue ?', ['joueurs'], 700)
        await pg.fill('#name0', 'Marc'); await pg.fill('#name1', 'Lou')
        await pg.click('#start-go'); await snap(pg, 'principe', 'Le principe', ['principe', 'joueurs'], 700)
        await pg.click('#rules-ok'); await snap(pg, 'depart', 'Quels piments ?', ['depart'], 700)
        await pg.click('#piment-go'); await snap(pg, 'passage', 'Passe le téléphone', ['passage'], 700)
        await pg.click('#handoff-go'); await snap(pg, 'jeu', 'L’écran de jeu', ['jeu', 'roues'], 1500)
        await pg.click('#piment-open'); await snap(pg, 'roues', 'Dans les roues', ['roues'], 600)
        await pg.click('#ton [data-ton="e"]'); await snap(pg, 'roues-ton', 'Dans les roues, un autre ton', ['roues'], 400)
        await pg.click('#ton [data-ton="m"]'); await pg.click('#piment-done'); await pg.wait_for_timeout(1500)
        await open_loupe(pg); await snap(pg, 'loupe', 'La loupe', ['loupe'], 900)
        await pg.fill('#loupe-q', 'zzz'); await snap(pg, 'loupe-vide', 'La loupe, sans résultat', ['loupe'], 500)
        await pg.click('#loupe-close'); await pg.wait_for_timeout(500)
        await free_cell(pg, 2); await pg.keyboard.press('Enter'); await snap(pg, 'libre', 'Écrire sa case', ['libre'], 700)
        await pg.fill('#edit-input', 'en chantonnant'); await pg.click('#edit-form button[type=submit]'); await pg.wait_for_timeout(600)
        await free_cell(pg, 0); await pg.wait_for_timeout(300); await pg.click('#act-main'); await snap(pg, 'jeu-vide', 'L’écran de jeu, case vide', ['jeu'], 300)
        await pg.focus('.reel[data-reel="0"]'); await pg.keyboard.press('ArrowDown'); await pg.wait_for_timeout(700)
        await pg.click('#pass'); await snap(pg, 'passe', 'On passe', ['passe'], 500)
        await pg.click('#pass-cancel'); await pg.wait_for_timeout(300)
        await pg.click('#act-main'); await snap(pg, 'offre', 'L’envie reçue', ['offre'], 700)
        await pg.click('#offer-but'); await snap(pg, 'mais', 'Oui, mais…', ['mais'], 500)
        await pg.click('#one-ok'); await snap(pg, 'jeu-mais', 'Pendant « Oui, mais… »', ['jeu'], 600)
        for _ in range(6):
            await pg.focus('.reel[data-reel="1"]'); await pg.keyboard.press('ArrowDown'); await pg.wait_for_timeout(900)
            if (await pg.inner_text('#act-main')).strip().startswith('Modification'): break
        await snap(pg, 'jeu-change', 'Après le changement', ['jeu'], 200)
        await pg.click('#act-main'); await pg.wait_for_selector('#offer-yes', state='visible'); await snap(pg, 'offre-ajustee', 'L’envie ajustée', ['offre'], 500)
        await pg.click('#offer-yes'); await snap(pg, 'fete', 'Kiff kiff !', ['fete'], 1400)
        await pg.click('#party-next'); await snap(pg, 'fete-vivre', 'Kiff kiff ! On la vit', ['fete'], 700)
        await pg.click('#party-next'); await pg.wait_for_timeout(700); await handoff(pg); await pg.wait_for_timeout(1200)
        await pg.click('#act-main'); await pg.wait_for_timeout(700); await pg.click('#offer-yes'); await pg.wait_for_timeout(1400)
        await snap(pg, 'fete-2', 'Kiff kiff ! Le deuxième', ['fete'], 200)
        async with pg.expect_download() as dl:
            await pg.click('#party-image')
        d = await dl.value
        await d.save_as(TMP + '/image.png')
        im = Image.open(TMP + '/image.png').convert('RGB'); im.save(OUT + '/image.webp', 'WEBP', quality=62, method=6)
        SHOTS.append(['image', 'L’image partagée', ['image'], im.width, im.height])
        OU['image.lead'] = ['image', 330, 555, 420, 90, 0]; OU['image.scanne'] = ['image', 352, 1080, 510, 58, 0]
        OU['image.accroche'] = ['image', 352, 1136, 590, 100, 0]; OU['image.pied'] = ['image', 352, 1248, 470, 36, 0]
        await snap(pg, 'fete-image', 'Kiff kiff ! Image enregistrée', ['fete'], 300)
        await pg.click('#party-later'); await snap(pg, 'fete-gardee', 'Kiff kiff ! Gardée pour plus tard', ['fete'], 250)
        await pg.wait_for_timeout(1400); await handoff(pg); await pg.wait_for_timeout(800)
        await pg.click('#kiffs-open'); await snap(pg, 'kiffs', 'Vos kiff kiff', ['kiffs'], 700)
        await pg.click('#kiffs-close'); await pg.wait_for_timeout(300)
        await pg.click('#home'); await snap(pg, 'accueil-partie', 'L’accueil, partie en cours', ['accueil'], 900)
        if await pg.is_visible('#home-cont'):
            await pg.click('#home-cont'); await snap(pg, 'duo-continuer', 'Continuer à distance', ['duo'], 700)
            await pg.click('#duo-cancel'); await pg.wait_for_timeout(300)
        await b.close()

        # Deux téléphones
        b = await p.chromium.launch()
        A = await newpage(b, 'redcorner', {'roue:rulesSeen': 'true'}); B = await newpage(b, 'redcorner', {})
        for x in (A, B): await x.route('https://script.google.com/**', lambda route: route.abort())
        await A.goto(BASE + REL + '&design=redcorner'); await A.wait_for_timeout(900)
        await A.click('#welcome-go'); await A.wait_for_timeout(500)
        await A.fill('#name0', 'Marc'); await A.click('.where-btn[data-where=duo]'); await A.wait_for_timeout(700)
        await maybe(A, 'Compris')
        await snap(A, 'depart-distance', 'Le piment à distance', ['depart'], 500)
        await click(A, 'Inviter l’autre téléphone'); await snap(A, 'duo-envie', 'Une envie dans l’invitation ?', ['duo', 'jeu'], 900)
        await click(A, 'Composer'); await A.wait_for_timeout(1500)
        await snap(A, 'jeu-invitation', 'Composer l’envie de l’invitation', ['jeu'], 200)
        await A.click('#act-main'); await snap(A, 'duo-invite', 'Invite l’autre téléphone', ['duo', 'attente'], 1200)
        link = A.url
        await B.goto(link.replace('#', '&design=redcorner#')); await snap(B, 'invite', 'L’invitation reçue', ['invite', 'accueil'], 1800)
        await click(B, 'Comment on joue'); await snap(B, 'invite-principe', 'L’invitation : le principe', ['invite', 'joueurs'], 600)
        await click(B, 'Compris'); await snap(B, 'invite-prenom', 'L’invitation : et toi ?', ['invite', 'joueurs'], 600)
        await B.fill('#inv-name', 'Lou'); await B.click('#inv-join'); await snap(B, 'cadeau', 'L’envie glissée', ['cadeau'], 2500)
        await B.click('#gift-open'); await A.wait_for_timeout(1500)
        await snap(B, 'offre-distance', 'L’envie reçue, à distance', ['offre'], 300)
        await snap(A, 'attente-lit', 'Envie envoyée, l’autre la lit', ['attente'], 200)
        await B.click('#offer-pass'); await B.wait_for_timeout(600)
        await B.click('#pass-same'); await B.wait_for_timeout(1500)
        await A.wait_for_timeout(1500)
        if await A.is_visible('#note-ok'):
            await snap(A, 'nouvelles', 'Une petite nouvelle', ['nouvelles', 'avertir', 'installer'], 200)
            await A.click('#note-ok'); await A.wait_for_timeout(1500)
        elif await B.is_visible('#note-ok'):
            await snap(B, 'nouvelles', 'Une petite nouvelle', ['nouvelles', 'avertir', 'installer'], 200)
            await B.click('#note-ok'); await B.wait_for_timeout(1500)
        else:
            await A.screenshot(path=TMP + '/debug-A.png'); await B.screenshot(path=TMP + '/debug-B.png'); print('pas de nouvelle')
        await snap(B, 'attente', 'Pendant que l’autre joue', ['attente', 'avertir'], 600)
        await A.click('#act-main'); await B.wait_for_timeout(1500)
        await snap(A, 'attente-envoyee', 'Envie envoyée', ['attente'], 300)
        await A.click('#wait-home'); await snap(A, 'accueil-distance', 'L’accueil, partie à distance', ['accueil', 'parties'], 900)
        if await A.is_visible('#games-open'):
            await A.click('#games-open'); await snap(A, 'parties', 'Parties à distance', ['parties'], 700)
        await b.close()
    data = {'shots': SHOTS, 'ou': OU}
    open(ROOT + '/ecrans.js', 'w').write('/* Kiff Kiff · l’atelier — les captures des écrans et l’emplacement de chaque texte (fait par un tour automatique du jeu). */\nwindow.KIFF_ECRANS = ' + json.dumps(data, ensure_ascii=False) + ';\n')
    missing = [c['k'] for c in CAT if c['k'] not in OU]
    print('situés', len(OU), '/', len(CAT)); print('sans place :', ' '.join(missing))

asyncio.run(main())
