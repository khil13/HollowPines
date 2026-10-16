import glob,sys,base64,os,json
shell=open('src/shell.html').read()
js='\n'.join(open(f).read() for f in sorted(glob.glob('src/[0-9]*.js')))
glb='<script>window.CHARACTER_GLB="'+base64.b64encode(open('assets/character.glb','rb').read()).decode()+'";</script>' if os.path.exists('assets/character.glb') else ''
anims={os.path.splitext(os.path.basename(f))[0]: json.load(open(f)) for f in sorted(glob.glob('assets/anim/*.json'))}  # retargeted clips (tools/retarget.py)
ext='<script>window.EXTRA_ANIMS='+json.dumps(anims,separators=(',',':'))+';</script>' if anims else ''
cdn='<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js"></script>'
open('game.html','w').write(shell+'\n'+cdn+'\n'+glb+ext+'\n<script>\n'+js+'\n</script>\n')
open('test.html','w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+shell+'\n<script src="three.min.js"></script><script src="GLTFLoader.js"></script><script src="SkeletonUtils.js"></script>\n'+glb+ext+'\n<script>\n'+js+'\n</script></body></html>')
print(len(js)//1024,'KB js', len(glb)//1024, 'KB model', len(ext)//1024, 'KB extra animations')
