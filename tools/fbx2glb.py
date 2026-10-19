"""Convert an animated .fbx (e.g. a Quaternius animal) to the .glb the game embeds from assets/animals/.
Usage: python3 tools/fbx2glb.py path/to/Horse.fbx assets/animals/horse.glb
Runs three.js's FBXLoader and GLTFExporter in headless Chromium (Playwright, as the tests use), regrouping the
mesh into one primitive per material on the way."""
import asyncio, http.server, functools, threading, sys, json, os, base64, shutil, tempfile
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
SRC, OUT = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
WORK = tempfile.mkdtemp()  # serve the libraries and the model from one scratch folder
for f in ['three.min.js']: shutil.copy(os.path.join(ROOT, f), WORK)
for f in ['fflate.min.js', 'NURBSUtils.js', 'NURBSCurve.js', 'FBXLoader.js']: shutil.copy(os.path.join(ROOT, 'tools', 'vendor', f), WORK)
shutil.copy(os.path.join(ROOT, 'tests', 'vendor', 'GLTFExporter.js'), WORK); shutil.copy(SRC, os.path.join(WORK, 'model.fbx'))
class _Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(_Q, directory=WORK)); threading.Thread(target=srv.serve_forever, daemon=True).start()
B = f'http://127.0.0.1:{srv.server_address[1]}'
JS = r"""url => new Promise(res => new THREE.FBXLoader().load(url, o => {
  /* FBX meshes come as many small material groups over unindexed triangles: regroup them into one index range per material so the exporter writes one primitive per material */
  const info = [];
  o.traverse(m => { if (!m.isMesh || !m.geometry.groups.length) return; const g = m.geometry, by = {};
    for (const gr of g.groups) { const a = by[gr.materialIndex] || (by[gr.materialIndex] = []); for (let i = gr.start; i < gr.start + gr.count; i++) a.push(g.index ? g.index.getX(i) : i); }
    const idx = []; g.clearGroups(); for (const k of Object.keys(by).sort((a, b) => a - b)) { g.addGroup(idx.length, by[k].length, +k); for (const v of by[k]) idx.push(v); } g.setIndex(idx); info.push([m.name, g.attributes.position.count, Object.keys(by).length, idx.length]); });
  const clips = o.animations.map(a => { a.name = a.name.split('|').pop(); return a; });
  new THREE.GLTFExporter().parse(o, buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); res({ b64: btoa(s), clips: clips.map(c => c.name), info }); }, { binary: true, animations: clips });
}, undefined, e => res({ err: String(e) })))"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('PW_CHROMIUM') or None, args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B + '/three.min.js'); await pg.set_content('<body></body>')
        for f in ['three.min.js', 'fflate.min.js', 'NURBSUtils.js', 'NURBSCurve.js', 'FBXLoader.js', 'GLTFExporter.js']: await pg.add_script_tag(url=f'{B}/{f}')
        r = await pg.evaluate(JS, f'{B}/model.fbx')
        if 'err' in r: print(r); sys.exit(1)
        open(OUT, 'wb').write(base64.b64decode(r['b64'])); print(OUT, os.path.getsize(OUT), r['clips'], r['info'], errs[:3]); await b.close()
asyncio.run(main())
