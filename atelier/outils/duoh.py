"""Outils pour jouer une vraie partie à deux téléphones, en local, avec le relais local."""
import asyncio
BASE='http://localhost:8765/'
REL='?relais=ws://localhost:8888'
async def vis(pg, txt):
    loc = pg.get_by_role('button', name=txt, exact=False)
    for i in range(await loc.count()):
        if await loc.nth(i).is_visible(): return loc.nth(i)
async def click(pg, txt, tries=40):
    for _ in range(tries):
        b = await vis(pg, txt)
        if b:
            await b.click(); await pg.wait_for_timeout(500); return
        await pg.wait_for_timeout(200)
    raise Exception('pas trouvé : ' + txt)
async def maybe(pg, txt, tries=6):
    for _ in range(tries):
        b = await vis(pg, txt)
        if b: await b.click(); await pg.wait_for_timeout(500); return True
        await pg.wait_for_timeout(150)
    return False
async def handoff(pg):
    for _ in range(10):
        if await pg.is_visible('#handoff-go'): await pg.click('#handoff-go'); await pg.wait_for_timeout(600)
        else: await pg.wait_for_timeout(120)
async def newpage(b, skin='redcorner', ls=None):
    ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, has_touch=True, reduced_motion='reduce')
    init = "localStorage.clear();" + ''.join(f"localStorage.setItem({k!r},{v!r});" for k,v in (ls or {}).items())
    await ctx.add_init_script("if(!sessionStorage.x){" + init + "sessionStorage.x=1}")
    pg = await ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.skin = skin
    return pg
async def create(pg, name='Marc'):
    await pg.goto(BASE + REL + '&design=' + pg.skin); await pg.wait_for_timeout(900)
    await pg.click('#welcome-go'); await pg.wait_for_timeout(500)
    await pg.fill('#name0', name)
    await pg.click('.where-btn[data-where=duo]'); await pg.wait_for_timeout(700)
    await maybe(pg, 'Compris')
    await click(pg, 'Inviter l’autre téléphone')
    await click(pg, 'Sans envie')
    await pg.wait_for_timeout(800)
    return pg.url
async def join(pg, link, name='Lou'):
    await pg.goto(link.replace(BASE, BASE + '').replace('#', '&design=' + pg.skin + '#') if '?' in link else link); await pg.wait_for_timeout(1500)
    await click(pg, 'Comment on joue')
    await click(pg, 'Compris')
    if name is not None: await pg.fill('#inv-name', name)
    await pg.click('#inv-join'); await pg.wait_for_timeout(1200)
