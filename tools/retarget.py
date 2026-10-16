"""Retarget Quaternius Universal Animation Library clips onto the game's character.

    python3 tools/retarget.py SOURCE.glb --preview            # contact sheets for every clip in CLIPS (tools/out/)
    python3 tools/retarget.py SOURCE.glb --write              # write assets/anim/<pack>.json for build.py to embed

Runs the in-page retargeter (tools/retarget_page.js) in headless Chromium against test.html, so it uses the exact
three.js build and character the game uses. Needs `python3 build.py` first (for test.html) and Playwright."""
import argparse, asyncio, base64, functools, http.server, json, os, sys, threading
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if os.path.isdir('/opt/pw-browsers'): os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')

# relaxed standing frame of each pack, used as the reference pose for measuring rotation changes
REF = {'UAL1_Standard': ['Idle_Loop', 0], 'UAL2_Standard': ['Idle_No_Loop', 0]}
# source clip -> options. inPlace strips root motion (the game moves the character itself)
CLIPS = {
    'UAL1_Standard': {
        'Crouch_Idle_Loop': {}, 'Crouch_Fwd_Loop': {}, 'Swim_Fwd_Loop': {}, 'Swim_Idle_Loop': {}, 'Sitting_Idle_Loop': {},
        'Sitting_Talking_Loop': {}, 'Idle_Talking_Loop': {}, 'Fixing_Kneeling': {'range': [0.3, 0.5]}, 'Interact': {}, 'Punch_Jab': {}, 'Hit_Chest': {},
        # reviewed and left out: Walk/Jog/Sprint (a hunched knees-up scramble at chibi proportions; the rig's own Walk/Run
        # read better), Jump_* and Roll (no better than what's in use), Pistol_* (hands end at the chin), Punch_Cross,
        # PickUp_Table; the rest (dance, driving, spells, swords) don't fit the game
    },
    'UAL2_Standard': {
        'NinjaJump_Start': {}, 'NinjaJump_Land': {}, 'ClimbUp_1m_RM': {'inPlace': 'xyz'}, 'LayToIdle': {}, 'Consume': {},
        'Chest_Open': {}, 'Farm_Harvest': {},
        # reviewed and left out: Melee_Hook (the lunge reads as a lurch on chibi proportions), Idle_FoldArms_Loop (arms end up
        # under the chin); the pack's sword, shield, zombie, phone and slide clips don't fit the game
    },
}

class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('--preview', action='store_true'); ap.add_argument('--write', action='store_true'); ap.add_argument('--only', nargs='*')
    a = ap.parse_args(); pack = os.path.splitext(os.path.basename(a.src))[0]; clips = CLIPS.get(pack)
    if clips is None: sys.exit(f'no clip list for pack {pack}; add it to CLIPS')
    if a.only: clips = {k: v for k, v in clips.items() if k in a.only}
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(_Quiet, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('PW_CHROMIUM') or None, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.set_default_timeout(300000)
        await pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/test.html'); await pg.wait_for_function('typeof Assets !== "undefined" && Assets.ready')
        await pg.add_script_tag(path=os.path.join(ROOT, 'tools', 'retarget_page.js'))
        avail = dict(await pg.evaluate('b64 => RT.loadSource(b64)', base64.b64encode(open(a.src, 'rb').read()).decode()))
        await pg.evaluate('r => RT.setRef(r)', REF.get(pack))
        missing = [c for c in clips if c not in avail]
        if missing: sys.exit(f'clips not in {pack}: {missing}')
        out = {}; os.makedirs(os.path.join(ROOT, 'tools', 'out'), exist_ok=True)
        for name, opt in clips.items():
            d = await pg.evaluate('([n, o]) => RT.bake(n, o)', [name, opt]); out[name] = d
            if a.preview:
                png = await pg.evaluate('([n, d]) => RT.sheet(n, d)', [name, d])
                open(os.path.join(ROOT, 'tools', 'out', f'{name}.png'), 'wb').write(base64.b64decode(png.split(',')[1]))
            print(f'{name:24s} {d["duration"]:5.2f}s {d["frames"]:4d} frames')
        if errs: sys.exit(f'page errors: {errs[:3]}')
        if a.write:
            os.makedirs(os.path.join(ROOT, 'assets', 'anim'), exist_ok=True); path = os.path.join(ROOT, 'assets', 'anim', f'{pack}.json')
            json.dump({'source': f'{pack}.glb', 'license': 'CC0 1.0 (Quaternius, quaternius.com)', 'clips': out}, open(path, 'w'), separators=(',', ':'))
            print('wrote', os.path.relpath(path, ROOT), os.path.getsize(path) // 1024, 'KB')
        await b.close()

asyncio.run(main())
