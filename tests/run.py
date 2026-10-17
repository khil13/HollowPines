import asyncio, sys, json, os
from playwright.async_api import async_playwright
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH','/opt/pw-browsers')  # preinstalled browsers in the cloud dev container; elsewhere use Playwright's default
import functools, http.server, threading
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Serve the build over local HTTP rather than file://: Chromium doesn't reliably keep file:// localStorage across a
# reload in throwaway test profiles, which made the save-reload-continue checks flaky. HP_TEST_URL overrides.
class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path.startswith('/favicon.ico'): self.send_response(204); self.end_headers(); return  # browsers ask for it over http; a 404 would log a console error
        super().do_GET()
_srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(_Quiet, directory=ROOT))
threading.Thread(target=_srv.serve_forever, daemon=True).start()
URL=os.environ.get('HP_TEST_URL') or f'http://127.0.0.1:{_srv.server_address[1]}/test.html'
OUT=os.path.join(ROOT,'tests')+os.sep
async def boot(p, w=1280, h=760, mobile=False, quality='low', init=None):
    b = await p.chromium.launch(executable_path=os.environ.get('PW_CHROMIUM') or None, args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx = await b.new_context(viewport={'width':w,'height':h}, has_touch=mobile, is_mobile=mobile)
    if quality: await ctx.add_init_script(f"try{{localStorage.setItem('hollowpines_settings', JSON.stringify({{quality:'{quality}'}}))}}catch(e){{}}")
    if init: await ctx.add_init_script(init)
    pg = await ctx.new_page(); errs=[]; pg.set_default_timeout(120000)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    await pg.goto(URL); await pg.wait_for_function('document.getElementById("loading").textContent===""', timeout=120000)
    return b, pg, errs
async def main():
    async with async_playwright() as p:
        b,pg,errs = await boot(p)
        await pg.screenshot(path=OUT+'title.png')
        await pg.click('#bNew'); await pg.wait_for_timeout(3000)
        await pg.screenshot(path=OUT+'start.png')
        print('errors:', errs[:10])
        print(await pg.evaluate('JSON.stringify({p:HP.S.p, opts:HP.opts(), npcs:HP.NPC.all.map(n=>n.name+":"+n.state)})'))
        await b.close()
if __name__=='__main__': asyncio.run(main())
