import asyncio, sys
from run import boot, OUT
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b,pg,errs = await boot(p, 900, 700, quality='medium')
        await pg.click('#bNew'); await pg.wait_for_timeout(500)
        shots = [('m_idle',"HP.S.time.hour=11; HP.tp(-8,-18); const P=HP.Game.player; P.yaw=0.6; HP.Game.cam.yaw=Math.PI+0.6+1.2; HP.Game.cam.pitch=0.15; HP.Game.cam.zoom=3.6; HP.sim(1.2)", None),
                 ('m_walk',"Input.keys.add('w'); Input.keys.add('control'); HP.sim(1.0)", "Input.keys.clear()"),
                 ('m_run',"Input.keys.add('w'); Input.keys.add('shift'); HP.sim(1.5)", "Input.keys.clear()"),
                 ('m_crouch',"HP.Game.player.crouch=true; Input.keys.add('w'); HP.sim(1.0)", "Input.keys.clear(); HP.Game.player.crouch=false"),
                 ('m_punch',"HP.sim(0.5); HP.Game.player.anim.play('punch'); HP.sim(0.28)", None),
                 ('m_aim',"HP.sim(0.5); HP.Game.player.setWeapon('revolver'); Input.aimToggle=true; HP.sim(0.8)", "Input.aimToggle=false; HP.Game.player.setWeapon('fists')"),
                 ('m_npcs',"HP.S.time.hour=11; HP.tp(-46,20); HP.Game.player.yaw=0; HP.Game.cam.yaw=-Math.PI/2; HP.Game.cam.pitch=0.2; HP.Game.cam.zoom=5; HP.sim(1.5)", None),
                 ('m_ride',"HP.tp(-20,40); const H=HP.Game.horse; H.pos.set(-20,H.pos.y,42); H.yaw=1.2; HP.tp(H.pos.x-Math.cos(H.yaw)*1.4,H.pos.z+Math.sin(H.yaw)*1.4); HP.sim(0.2); HP.press('Mount'); HP.sim(1.5); HP.Game.cam.yaw=H.yaw+2.2; HP.Game.cam.idleT=-99; HP.sim(0.3)", None)]
        for nm, js, after in shots:
            await pg.evaluate(js); await pg.wait_for_timeout(4000); await pg.screenshot(path=OUT+nm+'.png', timeout=180000)
            if after: await pg.evaluate(after)
        print([e for e in errs if 'TUNNEL' not in e][:5]); await b.close()
asyncio.run(main())
