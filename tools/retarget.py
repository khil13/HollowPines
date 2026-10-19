"""Retarget Quaternius Universal Animation Library clips onto the game's character.

    python3 tools/retarget.py SOURCE.glb --preview            # contact sheets for every clip in CLIPS (tools/out/)
    python3 tools/retarget.py SOURCE.glb --write              # write assets/anim/<pack>.json for build.py to embed
    python3 tools/retarget.py mixamo.zip --preview            # Mixamo downloads too: a .zip, a folder or .fbx files

Mixamo: download each animation as FBX Binary, Without Skin, 30 fps (tick In Place for walks and runs). Every clip in
the batch is retargeted, named after its file; include a relaxed idle (e.g. "Breathing Idle") so the clips are measured
from a standing pose and Wren keeps her own posture. Output goes to assets/anim/Mixamo.json (or --pack NAME).

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

def mixamo_files(paths):
    """[(clip name, bytes)] for every .fbx in the given files, folders or .zip archives (empty for a .glb source)"""
    import zipfile, re
    out = []
    def add(name, data): out.append((re.sub(r'\s+', '_', os.path.splitext(os.path.basename(name))[0]).strip('_'), data))
    for p in paths:
        if p.lower().endswith('.zip'):
            with zipfile.ZipFile(p) as z:
                for n in sorted(z.namelist()):
                    if n.lower().endswith('.fbx') and not os.path.basename(n).startswith('._'): add(n, z.read(n))
        elif os.path.isdir(p):
            for n in sorted(os.listdir(p)):
                if n.lower().endswith('.fbx'): add(n, open(os.path.join(p, n), 'rb').read())
        elif p.lower().endswith('.fbx'): add(p, open(p, 'rb').read())
    return out

class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('src', nargs='+'); ap.add_argument('--preview', action='store_true'); ap.add_argument('--write', action='store_true'); ap.add_argument('--only', nargs='*'); ap.add_argument('--pack')
    a = ap.parse_args(); fbx = mixamo_files(a.src)
    pack = a.pack or ('Mixamo' if fbx else os.path.splitext(os.path.basename(a.src[0]))[0]); clips = None if fbx else CLIPS.get(pack)
    if clips is None and not fbx: sys.exit(f'no clip list for pack {pack}; add it to CLIPS')
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(_Quiet, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('PW_CHROMIUM') or None, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.set_default_timeout(300000)
        await pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/test.html'); await pg.wait_for_function('typeof Assets !== "undefined" && Assets.ready')
        await pg.add_script_tag(path=os.path.join(ROOT, 'tools', 'retarget_page.js'))
        if fbx:
            for f in ['fflate.min.js', 'NURBSUtils.js', 'NURBSCurve.js', 'FBXLoader.js']: await pg.add_script_tag(path=os.path.join(ROOT, 'tools', 'vendor', f))
            avail = dict(await pg.evaluate('fs => RT.loadFBX(fs)', [[n, base64.b64encode(b).decode()] for n, b in fbx]))
            if not await pg.evaluate('RT.isMixamo()'): sys.exit('these FBX files do not have a Mixamo skeleton (mixamorig:* bones)')
            idle = next((n for n in avail if 'idle' in n.lower()), None); ref = [idle, 0] if idle else None
            if not idle: print('note: no idle clip in the batch; measuring from the T-pose and pointing limbs like the source (rougher on chibi proportions)')
            clips = {n: {'inPlace': True, **({} if idle else {'align': True})} for n in avail}  # the game moves the character itself
        else:
            avail = dict(await pg.evaluate('b64 => RT.loadSource(b64)', base64.b64encode(open(a.src[0], 'rb').read()).decode())); ref = REF.get(pack)
        if a.only: clips = {k: v for k, v in clips.items() if k in a.only}
        await pg.evaluate('r => RT.setRef(r)', ref)
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
            lic = 'Mixamo (Adobe), royalty-free for use in games' if fbx else 'CC0 1.0 (Quaternius, quaternius.com)'
            json.dump({'source': 'Mixamo FBX downloads' if fbx else f'{pack}.glb', 'license': lic, 'clips': out}, open(path, 'w'), separators=(',', ':'))
            print('wrote', os.path.relpath(path, ROOT), os.path.getsize(path) // 1024, 'KB')
        await b.close()

asyncio.run(main())
