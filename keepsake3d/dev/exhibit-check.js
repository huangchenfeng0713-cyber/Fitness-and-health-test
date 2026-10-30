// Development regression harness. Input is dispatched in the fixture, never the browser driver.
const query=new URLSearchParams(location.search),offline=query.has('offline'),desktop=query.has('desktop');
const frame=document.querySelector('iframe'),out=document.querySelector('pre');
frame.style.width=(desktop?1280:390)+'px';frame.style.height=(desktop?720:844)+'px';
const report={mode:offline?'offline':'source',viewport:desktop?'desktop':'mobile',checks:[],errors:[]};
const post=(name,body)=>fetch('http://127.0.0.1:8876/save?name='+name,{method:'POST',body});
function check(name,value,detail){report.checks.push({name,pass:!!value,...(detail===undefined?{}:{detail:JSON.parse(JSON.stringify(detail))})});if(!value)throw Error(name+': '+JSON.stringify(detail));}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn){for(let i=0;i<300;i++){if(fn())return;await delay(100);}throw Error('Timed out waiting for application');}
try{
 report.sourceHashes={};
 for(const file of ['index.html','src/app.js','src/exhibit_objects.js','src/magnet_scene.js',...(offline?['dist/keepsake.html']:[])]){const bytes=await fetch('../'+file).then(r=>r.arrayBuffer());report.sourceHashes[file]=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
 if(offline){let html=await fetch('../dist/keepsake.html').then(r=>r.text());html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src data: blob: \'unsafe-inline\' \'unsafe-eval\'; connect-src data: blob:;">');frame.srcdoc=html;}else frame.src='../index.html';
 await waitFor(()=>frame.contentWindow?.__app);
 const w=frame.contentWindow,d=w.document,a=w.__app,c=d.querySelector('#c');a.renderer.setAnimationLoop(null);
 w.addEventListener('error',e=>report.errors.push(e.message));w.addEventListener('unhandledrejection',e=>report.errors.push(String(e.reason)));
 const step=(n=1)=>a.step(n),state=()=>a.state();
 const event=(type,id,x,y)=>c.dispatchEvent(new w.PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:id===1,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y}));
 function hit(bodyOnly=false){for(let y=120;y<w.innerHeight-150;y+=12)for(let x=50;x<w.innerWidth-40;x+=12){const h=a.pick(x,y);if(h&&(!bodyOnly||h.object===a.items.plush.body))return{x,y,h};}throw Error('No visible hit target');}
 function tap(p=hit()){event('pointerdown',1,p.x,p.y);step(3);event('pointerup',1,p.x,p.y);step(60);}
 check('both original objects ready',Object.keys(a.items).length===2);
 check('only one object visible',state().visible.join()==='plush');
 check('no display furniture or lamp',!a.scene.getObjectByName('desk')&&!a.scene.getObjectByName('lamp')&&!a.items.plush.api.hook.stand.visible);
 check('preview images are real rendered models',[...d.querySelectorAll('.collection-card img')].every(i=>i.complete&&i.naturalWidth===400));
 check('canvas owns touch gestures',w.getComputedStyle(c).touchAction==='none');
 check('caption never blocks touch',w.getComputedStyle(d.querySelector('.caption')).pointerEvents==='none');
 check('no bottom buttons',[...d.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().height&&e.getBoundingClientRect().top>w.innerHeight*.75).length===0);
 const pre=state().distance;tap(hit(true));check('tap picks up and moves closer',state().held&&state().distance<pre);
 const q0=state().quaternion;event('pointerdown',1,170,340);event('pointermove',1,210,365);event('pointerup',1,210,365);step(90);check('single finger rotates without translation',JSON.stringify(q0)!==JSON.stringify(state().quaternion)&&a.pivot.position.length()===0);
 a.front(true);step(10);event('pointerdown',1,130,350);event('pointerdown',2,250,350);event('pointermove',2,300,360);check('pinch brings detail closer',state().zoom<1);
 event('pointerup',2,300,360);const qp=state().quaternion;event('pointermove',1,155,365);event('pointerup',1,155,365);check('remaining finger continues rotation',JSON.stringify(qp)!==JSON.stringify(state().quaternion)&&!state().pointers);
 event('pointerdown',1,150,350);event('pointercancel',1,150,350);check('cancel clears contact',state().pointers===0);
 a.front(true);step(30);const p=hit(true),positions=a.items.plush.body.geometry.attributes.position.array,rest=positions.slice();
 event('pointerdown',1,p.x,p.y);step(60);let max=0;for(let i=0;i<positions.length;i+=3)max=Math.max(max,Math.hypot(positions[i]-rest[i],positions[i+1]-rest[i+1],positions[i+2]-rest[i+2]));
 check('long press creates only a submillimetre fabric dent',state().pressure>.5&&max>0&&max<=.000451,{pressure:state().pressure,depth:max});
 event('pointerup',1,p.x,p.y);step(180);max=0;for(let i=0;i<positions.length;i++)max=Math.max(max,Math.abs(positions[i]-rest[i]));check('fabric returns without oscillation',max<1e-7&&state().pressure===0,max);
 const stable=positions.slice();step(300);check('idle geometry never jitters',positions.every((v,i)=>v===stable[i]));
 event('pointerdown',1,p.x,p.y);w.dispatchEvent(new w.Event('blur'));check('interrupted touch releases',state().pointers===0);
 d.querySelector('#openGallery').click();check('gallery opens with focus',!d.querySelector('#gallery').hidden&&d.activeElement.id==='closeGallery');
 check('gallery card targets are large',[...d.querySelectorAll('.collection-card')].every(b=>b.getBoundingClientRect().width>=120));
 d.querySelector('[data-item="magnet"]').click();step(90);check('selecting another object resets held state',state().current==='magnet'&&!state().held&&state().visible.join()==='magnet'&&d.querySelector('#gallery').hidden);
 tap();check('magnet picked up',state().held);
 for(const stage of ['flapOpen','cardOut','cardOpen','blisterFree','magnetFree']){tap();step(180);check('normal unpacking: '+stage,state().stage===stage&&!state().busy,state());check(stage+' stays visible and centered',!!hit()&&a.items.magnet.slot.position.clone().add(a.items.magnet.center).length()<.0001);}
 const bodies=a.items.magnet.api.debug.bodies;
 check('empty packaging leaves the display',!bodies.bag.root.visible&&!bodies.card.root.visible&&!bodies.blister.root.visible&&bodies.magnet.root.visible);
 const mh=hit();event('pointerdown',1,mh.x,mh.y);step(80);check('magnet bend is limited',Math.abs(bodies.magnet.bend.k)>0&&Math.abs(bodies.magnet.bend.k)<=bodies.magnet.bend.kMax,bodies.magnet.bend);event('pointerup',1,mh.x,mh.y);step(240);check('magnet bend returns',Math.abs(bodies.magnet.bend.k)<.0001,bodies.magnet.bend.k);
 d.querySelector('#openDetails').click();d.querySelector('#repack').click();step(100);check('packaging can be restored',state().stage==='sealed'&&!state().held);
 for(const [width,height]of [[320,568],[390,844],[844,390]]){frame.style.width=width+'px';frame.style.height=height+'px';await delay(150);step(10);const top=d.querySelector('.topbar').getBoundingClientRect();check('controls fit '+width+'×'+height,top.left>=0&&top.right<=width&&d.documentElement.scrollWidth<=width);check('touch targets at least 44px '+width,[...d.querySelectorAll('.topbar button')].filter(b=>!b.hidden).every(b=>b.getBoundingClientRect().height>=44&&b.getBoundingClientRect().width>=44));}
 frame.style.width=(desktop?1280:390)+'px';frame.style.height=(desktop?720:844)+'px';await delay(150);a.select('plush');a.front(true);step(20);
 check('all view transforms remain finite',[...state().quaternion,state().distance].every(Number.isFinite));
 if(offline)check('offline page has no remote resources',w.performance.getEntriesByType('resource').every(r=>!/^https?:/.test(r.name)));
 if(query.has('export')){await a.saveGLB('magnet','exhibit-magnet.glb');await a.saveGLB('plush','exhibit-plush.glb');check('model downloads exported',true);}
}catch(e){report.errors.push(e.stack||String(e));}
out.textContent=JSON.stringify(report,null,2);await post('exhibit-'+(offline?'offline-':'')+(desktop?'desktop':'mobile')+'.json',out.textContent);
