import glob,sys,base64,os,json
shell=open('src/shell.html').read()
js='\n'.join(open(f).read() for f in sorted(glob.glob('src/[0-9]*.js')))
glb='<script>window.CHARACTER_GLB="'+base64.b64encode(open('assets/character.glb','rb').read()).decode()+'";</script>' if os.path.exists('assets/character.glb') else ''
animals={os.path.splitext(os.path.basename(f))[0]: base64.b64encode(open(f,'rb').read()).decode() for f in sorted(glob.glob('assets/animals/*.glb'))}  # optional imported animals (03c_animals.js)
glb+=('<script>window.ANIMAL_GLB='+json.dumps(animals)+';</script>') if animals else ''
anims={os.path.splitext(os.path.basename(f))[0]: json.load(open(f)) for f in sorted(glob.glob('assets/anim/*.json'))}  # retargeted clips (tools/retarget.py)
ext='<script>window.EXTRA_ANIMS='+json.dumps(anims,separators=(',',':'))+';</script>' if anims else ''
cdn='<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js"></script>'
open('game.html','w').write(shell+'\n'+cdn+'\n'+glb+ext+'\n<script>\n'+js+'\n</script>\n')
open('test.html','w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+shell+'\n<script src="three.min.js"></script><script src="GLTFLoader.js"></script><script src="SkeletonUtils.js"></script>\n'+glb+ext+'\n<script>\n'+js+'\n</script></body></html>')
print(len(js)//1024,'KB js', len(glb)//1024, 'KB model', len(ext)//1024, 'KB extra animations')

# installable web app (GitHub Pages): site/ with a full page head, manifest, icons, offline service worker and local
# three.js copies so it runs with no network once installed. game.html above stays the CDN build used for the artifact.
import hashlib, shutil
SITE='site'; shutil.rmtree(SITE, ignore_errors=True); os.makedirs(SITE+'/icons')
LIBS=['three.min.js','GLTFLoader.js','SkeletonUtils.js']
for f in LIBS: shutil.copy(f, SITE)
for f in glob.glob('assets/icons/*.png'): shutil.copy(f, SITE+'/icons')
shutil.copy('pwa/manifest.webmanifest', SITE)
head=('<!doctype html><html lang="en"><head><meta charset="utf-8">'
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">'
  '<meta name="theme-color" content="#1d2a25"><meta name="description" content="A stylized frontier open-world adventure.">'
  '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icons/icon-192.png"><link rel="apple-touch-icon" href="icons/apple-touch-icon.png">'
  '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">'
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Hollow Pines">'
  '</head><body>')
sw_reg="<script>if('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('offline cache unavailable', e)));</script>"
page=head+shell+'\n'+''.join(f'<script src="{f}"></script>' for f in LIBS)+'\n'+glb+ext+'\n<script>\n'+js+'\n</script>\n'+sw_reg+'</body></html>'
open(SITE+'/index.html','w').write(page)
files=['./','index.html','manifest.webmanifest']+LIBS+['icons/'+os.path.basename(f) for f in sorted(glob.glob('assets/icons/*.png'))]
digest=hashlib.sha256(b''.join(open(os.path.join(SITE, f if f!='./' else 'index.html'),'rb').read() for f in files)).hexdigest()[:12]
open(SITE+'/sw.js','w').write(open('pwa/sw.js').read().replace('__BUILD__',digest).replace('__FILES__',json.dumps(files)))
open(SITE+'/.nojekyll','w').write('')
print('site/ built:', os.path.getsize(SITE+'/index.html')//1024, 'KB page, cache', digest)
