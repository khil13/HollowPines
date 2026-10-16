import asyncio, sys, json, os
from playwright.async_api import async_playwright
os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH','/opt/pw-browsers')
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL='file://'+os.path.join(ROOT,'test.html')
OUT=os.path.join(ROOT,'tests')+os.sep
async def boot(p, w=1280, h=760, mobile=False, quality='low'):
    b = await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx = await b.new_context(viewport={'width':w,'height':h}, has_touch=mobile, is_mobile=mobile)
    if quality: await ctx.add_init_script(f"try{{localStorage.setItem('hollowpines_settings', JSON.stringify({{quality:'{quality}'}}))}}catch(e){{}}")
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
