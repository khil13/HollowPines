"""Installable web app checks: manifest, icons, installability, offline cache, and the game running offline.
Serves site/ from a subfolder (like GitHub Pages serves /HollowPines/). Run python3 build.py first."""
import asyncio, os, shutil, tempfile
from run import ROOT
import functools, http.server, threading
from playwright.async_api import async_playwright
RESULTS = []
def check(name, ok, info=''):
    RESULTS.append((name, bool(ok), info)); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{info}]' if info else ''))
# the test owns this server so it can shut it down: with no server at all, the game can only come from the offline cache
OFFLINE = threading.Event()
class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):  # once "offline", refuse everything, even on connections Chrome opened ahead of time
        if OFFLINE.is_set(): self.send_error(503); return
        super().do_GET()
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(_Quiet, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/site/'
FONT = ('fonts.googleapis', 'fonts.gstatic', 'Failed to load resource')  # fonts can't load offline; the game falls back to system fonts

async def main():
    async with async_playwright() as p:
        # a persistent (non-incognito) profile: Chrome won't consider installing an app from an incognito window
        prof = tempfile.mkdtemp(prefix='hp-pwa-')
        ctx = await p.chromium.launch_persistent_context(prof, executable_path=os.environ.get('PW_CHROMIUM') or None, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True)
        await ctx.add_init_script("try{localStorage.setItem('hollowpines_settings', JSON.stringify({quality:'low'}))}catch(e){}")
        pg = await ctx.new_page(); pg.set_default_timeout(180000); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(BASE); await pg.wait_for_function('document.getElementById("loading").textContent===""')
        m = await pg.evaluate("fetch(document.querySelector('link[rel=manifest]').href).then(r=>r.json())")
        check('manifest: name, start_url/scope, fullscreen display, theme colours', m['name'] == 'Hollow Pines' and m['start_url'] == './' and m['scope'] == './' and m['display'] in ('fullscreen', 'standalone') and m['theme_color'], str({k: m[k] for k in ('name', 'start_url', 'display')}))
        sizes = await pg.evaluate("""Promise.all(%s.map(i => new Promise(res => { const im = new Image(); im.onload = () => res([i.src, i.sizes, im.naturalWidth + 'x' + im.naturalHeight, i.purpose]); im.onerror = () => res([i.src, i.sizes, 'missing', i.purpose]); im.src = i.src; })))""" % __import__('json').dumps(m['icons']))
        check('manifest: icons load at their declared sizes, including a maskable one', all(s[1] == s[2] for s in sizes) and any(s[3] == 'maskable' for s in sizes), str(sizes))
        tags = await pg.evaluate("({apple: !!document.querySelector('link[rel=apple-touch-icon]'), capable: !!document.querySelector('meta[name=apple-mobile-web-app-capable]'), title: document.querySelector('meta[name=apple-mobile-web-app-title]')?.content, vp: document.querySelector('meta[name=viewport]').content})")
        check('iOS: home-screen icon, full-screen and title tags are present', tags['apple'] and tags['capable'] and tags['title'] == 'Hollow Pines' and 'viewport-fit=cover' in tags['vp'], str(tags))
        await pg.evaluate("navigator.serviceWorker.ready"); await pg.reload(); await pg.wait_for_function('document.getElementById("loading").textContent===""')
        ctl = await pg.evaluate("!!navigator.serviceWorker.controller")
        cached = await pg.evaluate("caches.keys().then(ks => Promise.all(ks.map(k => caches.open(k).then(c => c.keys()).then(r => [k, r.length]))))")
        check('offline cache: the service worker controls the page and has cached the game', ctl and any(k.startswith('hollowpines-') and n >= 10 for k, n in cached), str(cached))
        cdp = await ctx.new_cdp_session(pg); inst = await cdp.send('Page.getInstallabilityErrors')
        check('installable: Chrome reports no installability errors', not inst.get('installabilityErrors'), str(inst))
        # go fully offline: refuse every request and stop the web server (Playwright's offline switch doesn't cover
        # service-worker requests, and Chrome may already hold open connections)
        OFFLINE.set(); srv.shutdown(); srv.server_close(); await ctx.set_offline(True); errs.clear()
        try:
            await pg.reload(timeout=60000); await pg.wait_for_function('document.getElementById("loading").textContent===""', timeout=60000)
        except Exception as e:
            check('offline: with the web server shut down the game loads, starts a new game and the player moves', False, f'game did not load from the offline cache: {str(e)[:120]}')
            await ctx.close(); shutil.rmtree(prof, ignore_errors=True); return finish()
        await pg.tap('#bNew'); await pg.wait_for_timeout(800)
        r = await pg.evaluate("(()=>{ HP.sim(1); const P=HP.Game.player, x=P.pos.x, z=P.pos.z; Input.move.x=0; Input.move.y=1; Input.move.mag=1; HP.sim(1,1/60); Input.move.mag=0; Input.move.y=0; return {model:Assets.ready, extras:Object.keys(window.EXTRA_ANIMS||{}).length, moved:+Math.hypot(P.pos.x-x, P.pos.z-z).toFixed(2), running:HP.Game.running}; })()")
        # prove the network really is off: a file the server has but the offline cache doesn't must fail to load (navigator.onLine
        # isn't reliable in every headless Chromium build)
        r['net_blocked'] = await pg.evaluate("fetch('../README.md?' + Date.now(), {cache: 'no-store'}).then(res => !res.ok, () => true)")  # served online, never cached
        bad = [e for e in errs if not any(f in e for f in FONT)]
        check('offline: with the web server shut down the game loads, starts a new game and the player moves', r['net_blocked'] and r['model'] and r['extras'] == 2 and r['running'] and r['moved'] > 1 and not bad, f"{r} errors={bad[:3]}")
        await ctx.set_offline(False); await ctx.close(); shutil.rmtree(prof, ignore_errors=True)
    finish()

def finish():
    n = sum(1 for _, ok, _ in RESULTS if ok); print(f"\n{n}/{len(RESULTS)} pwa checks passed")
    if n != len(RESULTS): raise SystemExit(1)

if __name__ == '__main__': asyncio.run(main())
