(function () {
"use strict";
const viewport = document.getElementById("viewport");
if (!viewport) return;

function loadThree(done) {
  if (window.THREE) return done();
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js";
  s.onload = done;
  s.onerror = () => { const l = document.getElementById("loading"); if (l) l.textContent = "THREE.JS LOAD ERROR"; };
  document.head.appendChild(s);
}
loadThree(init);

function init() {
  const T = window.THREE, R = 1.05, E = 0.15, DEPTH = 0.42, SPACING = 0, TAU = Math.PI * 2;
  const scene = new T.Scene();
  scene.background = new T.Color(0x050912);
  scene.fog = new T.Fog(0x050912, 10, 22);
  const camera = new T.PerspectiveCamera(38, viewport.clientWidth / Math.max(1, viewport.clientHeight), 0.1, 100);
  const renderer = new T.WebGLRenderer({antialias:true, alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = T.SRGBColorSpace;
  if (renderer.toneMapping !== undefined) { renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.28; }
  viewport.appendChild(renderer.domElement);
  viewport.style.position = "relative";
  const canvas = renderer.domElement;
  canvas.style.touchAction = "none";

  let rotX = 0.20, rotY = 0.72, zoom = 5.5, dragging = false, lastX = 0, lastY = 0, moved = false, downX = 0, downY = 0;
  canvas.addEventListener("pointerdown", e => { dragging=true; moved=false; downX=lastX=e.clientX; downY=lastY=e.clientY; try{canvas.setPointerCapture(e.pointerId);}catch(_){} });
  canvas.addEventListener("pointermove", e => {
    if (!dragging) return;
    if (Math.abs(e.clientX-downX)>6 || Math.abs(e.clientY-downY)>6) moved=true;
    rotY += (e.clientX-lastX)*0.008;
    rotX = T.MathUtils.clamp(rotX+(e.clientY-lastY)*0.008,-1.35,1.35);
    lastX=e.clientX; lastY=e.clientY;
  });
  canvas.addEventListener("pointerup",()=>dragging=false);
  canvas.addEventListener("pointercancel",()=>dragging=false);
  canvas.addEventListener("wheel",e=>{zoom=T.MathUtils.clamp(zoom+e.deltaY*0.008,4.2,11);},{passive:true});

  scene.add(new T.HemisphereLight(0xc9dcf2,0x17212c,2));
  const key=new T.DirectionalLight(0xe8f4ff,4.2); key.position.set(4,6,7); key.castShadow=true; scene.add(key);
  const rim=new T.DirectionalLight(0x168cff,4.0); rim.position.set(-5,2,-4); scene.add(rim);
  const top=new T.PointLight(0xffffff,24,14); top.position.set(0,4,3); scene.add(top);
  const blue=new T.PointLight(0x087bff,14,11); blue.position.set(-3,1,3); scene.add(blue);
  const warm=new T.PointLight(0xff642d,9,9); warm.position.set(3,-1,-3); scene.add(warm);

  const material=(c,m,r)=>new T.MeshStandardMaterial({color:c,metalness:m,roughness:r});
  const housingMat=new T.MeshStandardMaterial({color:0xaab8c7,metalness:.94,roughness:.2,side:T.DoubleSide});
  const coverMat=material(0x172636,.92,.2), rotorMat=material(0xd6e0e9,.96,.16);
  const edgeMat=material(0x718da5,.96,.16), steelMat=material(0xe7f1fa,.98,.13);
  const darkMat=material(0x0b1420,.9,.2), copperMat=material(0xd58a43,.96,.18);
  const blueMat=material(0x00aaff,.9,.16), sealMat=material(0x090d12,.75,.25);
  const portMat=material(0x20394b,.88,.23);
  const engine=new T.Group(); scene.add(engine);

  function cylinder(r,len,mat,seg=48){const o=new T.Mesh(new T.CylinderGeometry(r,r,len,seg),mat);o.rotation.x=Math.PI/2;o.castShadow=true;o.receiveShadow=true;return o;}
  function box(w,h,d,mat,parent,x,y,z){const o=new T.Mesh(new T.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function ring(r,t,mat,z,parent){const o=new T.Mesh(new T.TorusGeometry(r,t,12,96),mat);o.position.z=z;o.castShadow=true;parent.add(o);return o;}

  // Housing profile: third-harmonic trochoid approximation.
  function hp(t,s=1){return new T.Vector2((R*Math.cos(t)+E*Math.cos(3*t))*s,(R*Math.sin(t)-E*Math.sin(3*t))*s);}
  function makeShape(scale){const sh=new T.Shape(),n=720;for(let i=0;i<=n;i++){const p=hp(i/n*TAU,scale);if(!i)sh.moveTo(p.x,p.y);else sh.lineTo(p.x,p.y);}sh.closePath();return sh;}
  const outer=makeShape(1.18), hole=new T.Path();
  for(let i=720;i>=0;i--){const p=hp(i/720*TAU);if(i===720)hole.moveTo(p.x,p.y);else hole.lineTo(p.x,p.y);}
  hole.closePath();outer.holes.push(hole);
  const housingGeo=new T.ExtrudeGeometry(outer,{depth:DEPTH,bevelEnabled:true,bevelSegments:3,bevelSize:.018,bevelThickness:.018,curveSegments:120});
  housingGeo.translate(0,0,-DEPTH/2);

  // Rounded three-lobe rotor profile; improved visual scale, still an approximation rather than CAD geometry.
  const rs=new T.Shape();
  for(let i=0;i<=720;i++){const a=i/720*TAU,rad=.94+.11*Math.cos(3*a),x=rad*Math.cos(a),y=rad*Math.sin(a);if(!i)rs.moveTo(x,y);else rs.lineTo(x,y);}
  rs.closePath();
  const rotorGeo=new T.ExtrudeGeometry(rs,{depth:.30,bevelEnabled:true,bevelSegments:5,bevelSize:.025,bevelThickness:.025,curveSegments:120});
  rotorGeo.translate(0,0,-.15);

  const selectable=[], chambers=[], rotors=[];
  function register(o,name,desc){o.userData.partName=name;o.userData.partDescription=desc;selectable.push(o);}
  function cover(group){
    const plate=new T.Mesh(new T.ShapeGeometry(outer,120),coverMat);plate.position.z=-DEPTH/2-.07;plate.castShadow=true;group.add(plate);
    ring(1.12,.027,edgeMat,-DEPTH/2-.035,group);ring(.98,.012,copperMat,-DEPTH/2-.025,group);
    for(let i=0;i<12;i++){const a=i/12*TAU,p=hp(a,1.1),b=cylinder(.032,.045,steelMat,6);b.position.set(p.x,p.y,-DEPTH/2-.095);group.add(b);}
  }
  function rotorDetails(g){
    ring(.66,.009,edgeMat,.184,g);ring(.57,.008,steelMat,.19,g);ring(.34,.023,blueMat,.195,g);ring(.25,.012,copperMat,.20,g);
    const hub=cylinder(.20,.075,darkMat,64);hub.position.z=.20;g.add(hub);
    const cap=cylinder(.13,.085,copperMat,64);cap.position.z=.25;g.add(cap);
    const bolt=cylinder(.052,.09,steelMat,32);bolt.position.z=.30;g.add(bolt);
    for(let i=0;i<3;i++){const a=i*TAU/3,x=.48*Math.cos(a),y=.48*Math.sin(a),p=cylinder(.09,.018,darkMat,40);p.position.set(x,y,.19);g.add(p);
      const rr=new T.Mesh(new T.TorusGeometry(.064,.008,8,32),copperMat);rr.position.set(x,y,.205);g.add(rr);
      const b=cylinder(.022,.025,steelMat,6);b.position.set(x,y,.215);g.add(b);}
    for(let i=0;i<3;i++){const a=i*TAU/3+Math.PI/3,q=box(.31,.012,.009,edgeMat,g,.48*Math.cos(a),.48*Math.sin(a),.195);q.rotation.z=a;}
  }
  function particles(mat,n){const group=new T.Group(),list=[];for(let i=0;i<n;i++){const o=new T.Mesh(new T.SphereGeometry(.022,8,8),mat);group.add(o);list.push({mesh:o,speed:.3+Math.random()*.7,offset:Math.random()});}return{group,list};}
  function flame(){const g=new T.Group(),a=new T.Mesh(new T.SphereGeometry(.15,20,20),new T.MeshBasicMaterial({color:0xff641c,transparent:true,opacity:.88,depthWrite:false}));a.scale.set(1,1.55,.5);g.add(a);
    const b=new T.Mesh(new T.SphereGeometry(.07,16,16),new T.MeshBasicMaterial({color:0xffe78a,transparent:true,opacity:.95,depthWrite:false}));b.scale.set(1,1.5,.5);g.add(b);g.position.set(0,1.05,.23);g.visible=false;return g;}

  function createUnit(z,phase,index){
    const chamber=new T.Group();chamber.position.z=z;engine.add(chamber);
    const housingGroup=new T.Group();chamber.add(housingGroup);
    const housing=new T.Mesh(housingGeo,housingMat);housing.castShadow=true;housing.receiveShadow=true;housingGroup.add(housing);cover(housingGroup);
    for(let i=0;i<18;i++){const a=i/18*TAU,p=hp(a,1.105),b=new T.Mesh(new T.CylinderGeometry(.031,.031,.06,6),steelMat);b.rotation.x=Math.PI/2;b.position.set(p.x,p.y,.245);housingGroup.add(b);}
    register(housing,"بدنه محفظه","پوسته فلزی محفظه روتور.");
    const rg=new T.Group();chamber.add(rg);
    const rotor=new T.Mesh(rotorGeo,rotorMat);rotor.castShadow=true;rotor.receiveShadow=true;rg.add(rotor);rotorDetails(rg);
    register(rotor,"روتور سه‌گوش","روتور سه‌وجهی با پروفیل منحنی.");
    const rear=cylinder(.23,.22,darkMat,64);rear.position.z=-.19;rg.add(rear);
    const gear=cylinder(.28,.09,copperMat,64);gear.position.z=-.29;rg.add(gear);
    for(let i=0;i<30;i++){const a=i/30*TAU,q=box(.05,.032,.065,copperMat,rg,.29*Math.cos(a),.29*Math.sin(a),-.23);q.rotation.z=a;}
    register(rear,"توپی مرکزی","اتصال روتور به شفت.");register(gear,"چرخ‌دنده مرکزی","چرخ‌دنده مجموعه روتور.");
    // Three apex seals mounted at the rotor tips.
    for(let i=0;i<3;i++){const a=i*TAU/3,sg=new T.Group();box(.19,.027,.045,sealMat,sg,0,0,0);box(.13,.012,.018,steelMat,sg,0,-.018,-.006);
      sg.position.set(1.035*Math.cos(a),1.035*Math.sin(a),.17);sg.rotation.z=a;rg.add(sg);register(sg,"آب‌بند رأس روتور","آب‌بند نوک روتور برای جداسازی محفظه‌ها.");}
    const spark=new T.Group(),body=cylinder(.052,.23,steelMat,32);spark.add(body);
    const sb=cylinder(.075,.07,darkMat,32);sb.position.z=.13;spark.add(sb);
    const tip=new T.Mesh(new T.SphereGeometry(.035,12,12),new T.MeshBasicMaterial({color:0x45dfff}));tip.position.z=-.14;spark.add(tip);
    spark.position.set(0,1.12,.02);chamber.add(spark);
    const sparkLight=new T.PointLight(0x45dfff,0,1.8);sparkLight.position.set(0,1.12,.18);chamber.add(sparkLight);
    register(spark,"شمع موتور","جرقه‌زنی مخلوط سوخت و هوا.");
    const fire=flame();chamber.add(fire);const fireLight=new T.PointLight(0xff6a18,0,2.5);fireLight.position.set(0,1.05,.35);chamber.add(fireLight);
    const air=particles(new T.MeshBasicMaterial({color:0x35baff,transparent:true,opacity:.78}),14);chamber.add(air.group);
    const exhaust=particles(new T.MeshBasicMaterial({color:0x999999,transparent:true,opacity:.55}),14);chamber.add(exhaust.group);
    const intake=box(.34,.19,.12,portMat,chamber,-.76,-.36,.04);box(.39,.23,.035,copperMat,chamber,-.76,-.36,-.035);
    register(intake,"مسیر ورودی","مسیر ورود هوای تازه به محفظه.");
    const outlet=box(.34,.19,.12,portMat,chamber,.76,-.36,.04);box(.39,.23,.035,copperMat,chamber,.76,-.36,-.035);
    register(outlet,"مسیر خروجی","مسیر خروج گازهای احتراق.");
    chambers.push({chamber,housingGroup,z,index});
    rotors.push({rg,spark,sparkLight,fire,fireLight,air,exhaust,phase,cycle:0});
  }
  // Single-rotor Mazda-inspired cast housing. This is a visual interpretation,
  // not an exact production RX-9 component or manufacturing drawing.
  createUnit(0,0,0);

  // Central eccentric output shaft, sized for one rotor only.
  const shaftGroup=new T.Group();engine.add(shaftGroup);
  const shaft=cylinder(.115,1.35,copperMat,64);shaftGroup.add(shaft);
  const eccentric=cylinder(.19,.58,copperMat,64);eccentric.position.set(E,0,0);shaftGroup.add(eccentric);
  const frontHub=cylinder(.29,.16,darkMat,64);frontHub.position.z=.48;shaftGroup.add(frontHub);
  const frontCap=cylinder(.205,.11,steelMat,64);frontCap.position.z=.58;shaftGroup.add(frontCap);
  ring(.24,.018,edgeMat,.64,shaftGroup);
  register(shaft,"شفت خروجی مرکزی","شفت خارج از مرکز مخصوص مجموعه تک‌روتور.");
  register(eccentric,"ژورنال خارج از مرکز","سطح خارج از مرکز متصل به روتور.");

  // Thick cast-aluminium outer casing with a machined circular front flange.
  const blockGroup=new T.Group();engine.add(blockGroup);
  const castMat=material(0x788795,.94,.27),darkCast=material(0x26323d,.88,.3),machined=material(0xc5cdd4,.96,.19);
  const outerDisk=new T.Mesh(new T.CylinderGeometry(1.57,1.57,.48,128),castMat);
  outerDisk.rotation.x=Math.PI/2;outerDisk.position.z=-.34;outerDisk.castShadow=true;outerDisk.receiveShadow=true;blockGroup.add(outerDisk);
  // Front circular flange ring, visible around the trochoid chamber.
  const flange=new T.Mesh(new T.TorusGeometry(1.43,.115,18,144),machined);flange.position.z=.255;blockGroup.add(flange);
  const innerLip=new T.Mesh(new T.TorusGeometry(1.17,.035,12,128),edgeMat);innerLip.position.z=.265;blockGroup.add(innerLip);
  const darkLip=new T.Mesh(new T.TorusGeometry(1.105,.018,10,128),darkCast);darkLip.position.z=.27;blockGroup.add(darkLip);
  // Circular bolt seats and recessed rectangular cooling/oil galleries.
  for(let i=0;i<24;i++){    const a=i/24*TAU,x=1.43*Math.cos(a),y=1.43*Math.sin(a);
    const seat=cylinder(.075,.055,darkCast,24);seat.position.set(x,y,.30);blockGroup.add(seat);
    const bolt=cylinder(.043,.065,machined,12);bolt.position.set(x,y,.335);blockGroup.add(bolt);
    const slot=box(.31,.105,.035,darkCast,blockGroup,1.29*Math.cos(a),1.29*Math.sin(a),.285);slot.rotation.z=a;
  }
  // Cast side cheeks and cooling fins: integrated into the body, not a cage frame.
  for(const side of [-1,1]){
    const cheek=new T.Mesh(new T.BoxGeometry(.28,1.75,.56),castMat);
    cheek.position.set(side*1.37,0,-.30);blockGroup.add(cheek);
    for(let i=0;i<8;i++){
      const fin=new T.Mesh(new T.BoxGeometry(.32,1.62,.045),machined);
      fin.position.set(side*1.52,0,-.58+i*.075);blockGroup.add(fin);
    }
  }
  // Mounting ears and threaded bosses cast into the lower casing.
  for(const side of [-1,1]){
    const ear=new T.Mesh(new T.BoxGeometry(.48,.34,.52),castMat);ear.position.set(side*1.18,-1.34,-.28);blockGroup.add(ear);
    const boss=cylinder(.105,.16,darkCast,32);boss.position.set(side*1.18,-1.34,.02);blockGroup.add(boss);
    const bore=cylinder(.052,.18,steelMat,24);bore.position.set(side*1.18,-1.34,.04);blockGroup.add(bore);
  }
  // Small cast bosses around the upper perimeter.
  for(const a of [-2.45,-1.95,-1.45,-.95,-.45,.15,.65,1.15,1.65,2.15,2.65]){
    const boss=cylinder(.095,.16,castMat,32);boss.position.set(1.47*Math.cos(a),1.47*Math.sin(a),-.02);blockGroup.add(boss);
    const center=cylinder(.045,.18,darkCast,24);center.position.set(1.47*Math.cos(a),1.47*Math.sin(a),.015);blockGroup.add(center);
  }
  register(blockGroup,"پوسته یکپارچه موتور تک‌روتور","بدنه ریخته‌گری‌شده الهام‌گرفته از موتور روتاری مزدا، با فلنج دایره‌ای، پیچ‌های پیرامونی و پره‌های خنک‌کاری یکپارچه.");

  const base=new T.Mesh(new T.BoxGeometry(2.7,.13,.9),darkMat);base.position.set(0,-1.72,-.25);base.castShadow=true;engine.add(base);
  for(const x of [-1.05,1.05]){const foot=new T.Mesh(new T.BoxGeometry(.42,.22,.52),coverMat);foot.position.set(x,-1.58,-.25);engine.add(foot);}

  // Front-mounted metal identification plaque, physically attached to the engine casing.
  const plaqueGroup = new T.Group();
  plaqueGroup.position.set(0, -1.24, .39);
  blockGroup.add(plaqueGroup);

  const plaqueBacking = new T.Mesh(new T.BoxGeometry(1.58, .46, .10), darkCast);
  plaqueBacking.castShadow = true;
  plaqueBacking.receiveShadow = true;
  plaqueGroup.add(plaqueBacking);

  // Four bright machined-metal trim rails create a visible raised frame.
  const trimMat = material(0xd8e5ef, .98, .14);
  const trimTop = new T.Mesh(new T.BoxGeometry(1.62, .035, .12), trimMat);
  trimTop.position.set(0, .245, .015); plaqueGroup.add(trimTop);
  const trimBottom = trimTop.clone();
  trimBottom.position.y = -.245; plaqueGroup.add(trimBottom);
  const trimLeft = new T.Mesh(new T.BoxGeometry(.035, .46, .12), trimMat);
  trimLeft.position.set(-.795, 0, .015); plaqueGroup.add(trimLeft);
  const trimRight = trimLeft.clone();
  trimRight.position.x = .795; plaqueGroup.add(trimRight);

  const badgeCanvas = document.createElement("canvas");
  badgeCanvas.width = 1200; badgeCanvas.height = 360;
  const ctx = badgeCanvas.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, 1200, 360);
  bg.addColorStop(0, "#07121e");
  bg.addColorStop(.5, "#263e53");
  bg.addColorStop(1, "#07121e");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1200, 360);
  ctx.strokeStyle = "#9edfff"; ctx.lineWidth = 5; ctx.strokeRect(12, 12, 1176, 336);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = "#00aaff"; ctx.shadowBlur = 24;
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 104px Arial";
  ctx.fillText("MAZDA RX-9 ENGINE", 600, 135);
  ctx.shadowBlur = 16; ctx.fillStyle = "#79dcff";
  ctx.font = "bold 94px Arial"; ctx.fillText("Beny", 600, 265);
  const badgeTexture = new T.CanvasTexture(badgeCanvas);
  badgeTexture.colorSpace = T.SRGBColorSpace;
  const badgeMat = new T.MeshBasicMaterial({ map: badgeTexture });
  const badgeFace = new T.Mesh(new T.PlaneGeometry(1.53, .41), badgeMat);
  badgeFace.position.z = .057;
  badgeFace.renderOrder = 5;
  plaqueGroup.add(badgeFace);

  // Four visible fasteners make the plaque look bolted onto the housing.
  for (const x of [-.70, .70]) {
    for (const y of [-.17, .17]) {
      const screw = new T.Mesh(new T.CylinderGeometry(.025, .025, .025, 12), steelMat);
      screw.rotation.x = Math.PI / 2;
      screw.position.set(x, y, .067);
      plaqueGroup.add(screw);
    }
  }
  const grid=new T.GridHelper(10,40,0x17466b,0x101d2b);grid.position.y=-1.68;scene.add(grid);
  // Premium presentation stand and luminous accent rings.
  const stageMat=material(0x101c2a,.92,.22), stageTopMat=material(0x25384b,.9,.2);
  const stage=new T.Mesh(new T.CylinderGeometry(1.95,2.08,.18,128),stageMat);stage.position.set(0,-1.86,-.12);stage.castShadow=true;stage.receiveShadow=true;scene.add(stage);
  const stageTop=new T.Mesh(new T.CylinderGeometry(1.82,1.95,.055,128),stageTopMat);stageTop.position.set(0,-1.745,-.12);scene.add(stageTop);
  const glowRing=new T.Mesh(new T.TorusGeometry(1.91,.018,12,160),new T.MeshBasicMaterial({color:0x00aaff}));glowRing.rotation.x=Math.PI/2;glowRing.position.set(0,-1.75,-.12);scene.add(glowRing);
  const underRing=new T.Mesh(new T.TorusGeometry(2.01,.012,10,160),new T.MeshBasicMaterial({color:0xff8b3d}));underRing.rotation.x=Math.PI/2;underRing.position.set(0,-1.91,-.12);scene.add(underRing);
  const accentLight=new T.PointLight(0x008cff,5,5);accentLight.position.set(0,-1.2,1.6);scene.add(accentLight);

  // On-screen control panel
  const uiStyle=document.createElement("style");uiStyle.textContent=`#viewport{overflow:hidden;background:radial-gradient(ellipse at 50% 42%,#142b43 0%,#081321 52%,#03070d 100%);border:1px solid #23445f;border-radius:16px;box-shadow:0 16px 50px #0009}#viewport button{cursor:pointer;transition:transform .15s,filter .15s}#viewport button:active{transform:scale(.97)}#viewport input[type=range]{accent-color:#00b7ff}#viewport input:focus{outline:1px solid #00b7ff}`;document.head.appendChild(uiStyle);
  const wrapper=document.createElement("div");wrapper.style.cssText="position:absolute;top:12px;left:12px;z-index:20;direction:rtl;font-family:Arial,sans-serif;max-width:calc(100% - 24px)";viewport.appendChild(wrapper);
  const toggle=document.createElement("button");toggle.textContent="⚙ کنترل موتور";toggle.style.cssText="background:linear-gradient(135deg,#16334b,#071522);color:#eaf8ff;border:1px solid #16baff;border-radius:10px;padding:10px 15px;font-size:12px;font-weight:bold;box-shadow:0 0 18px #008cff55";wrapper.appendChild(toggle);
  const panel=document.createElement("div");panel.style.cssText="display:none;grid-template-columns:repeat(2,minmax(95px,1fr));gap:6px;margin-top:7px;width:min(240px,calc(100vw - 45px));background:linear-gradient(145deg,#101e2df5,#050b14f5);border:1px solid #168bc4;border-radius:12px;padding:9px;box-shadow:0 10px 30px #0009;backdrop-filter:blur(10px)";wrapper.appendChild(panel);
  toggle.onclick=()=>{const open=panel.style.display==="grid";panel.style.display=open?"none":"grid";toggle.textContent=open?"⚙ کنترل موتور":"✕ بستن کنترل‌ها";};
  function button(label,fn){const b=document.createElement("button");b.textContent=label;b.style.cssText="background:#172533;color:#e8f3ff;border:1px solid #36a9d6;border-radius:7px;padding:9px 5px;font-size:11px;font-weight:bold;min-height:38px";b.onclick=fn;panel.appendChild(b);return b;}
  let exploded=false,cutaway=false;
  button("باز کردن قطعات",function(){exploded=!exploded;this.textContent=exploded?"جمع کردن قطعات":"باز کردن قطعات";});
  const original=new Map();chambers.forEach(u=>u.housingGroup.traverse(o=>{if(o.isMesh&&o.material)original.set(o,o.material);}));
  button("حالت برش موتور",function(){cutaway=!cutaway;chambers.forEach(u=>u.housingGroup.traverse(o=>{if(!o.isMesh||!original.has(o))return;const m=original.get(o);if(cutaway){const c=m.clone();c.transparent=true;c.opacity=.16;c.depthWrite=false;o.material=c;}else{if(o.material!==m)o.material.dispose();o.material=m;}}));this.textContent=cutaway?"نمای عادی موتور":"حالت برش موتور";});
  const preset=(x,y,d)=>{rotX=x;rotY=y;zoom=d;};
  button("نمای سه‌بعدی",()=>preset(.20,.72,5.5));button("نمای جلو",()=>preset(0,0,5.4));button("نمای کنار",()=>preset(0,Math.PI/2,5.8));button("نمای بالا",()=>preset(1.45,0,5.8));
  // دکمه توضیحات موتور
button("📘 توضیح درمورد موتور", function () {
  const explanation = document.createElement("div");

  explanation.style.cssText = `
    position:absolute;
    top:50%;
    left:50%;
    transform:translate(-50%,-50%);
    z-index:100;
    width:min(500px,90%);
    max-height:80%;
    overflow-y:auto;
    direction:rtl;
    background:linear-gradient(145deg,#101e2d,#050b14);
    color:#e8f3ff;
    border:2px solid #16baff;
    border-radius:15px;
    padding:20px;
    box-sizing:border-box;
    font-family:Arial,sans-serif;
    line-height:2;
    box-shadow:0 0 35px #008cff66;
  `;

  explanation.innerHTML = `
    <h2 style="color:#36c8ff;text-align:center">
      معرفی موتور روتاری مزدا RX-9
    </h2>

    <p>
      این موتور یک مدل سه‌بعدی شبیه‌سازی‌شده از موتور روتاری
      با طراحی الهام‌گرفته از موتورهای مزدا است.
    </p>

    <h3 style="color:#ffc34a">ساختار موتور</h3>
    <p>
      موتور روتاری به‌جای پیستون‌های رفت‌وبرگشتی،
      از یک روتور سه‌وجهی استفاده می‌کند که داخل محفظه‌ای
      با شکل خاص حرکت دورانی انجام می‌دهد.
    </p>

    <h3 style="color:#42df91">مراحل عملکرد موتور</h3>
    <p>
      <b>۱. مکش:</b> هوای تازه و سوخت وارد محفظه می‌شوند.
      <br>
      <b>۲. تراکم:</b> مخلوط هوا و سوخت فشرده می‌شود.
      <br>
      <b>۳. احتراق:</b> شمع باعث اشتعال مخلوط شده و
      انرژی حاصل، روتور را به حرکت درمی‌آورد.
      <br>
      <b>۴. تخلیه:</b> گازهای حاصل از احتراق از مسیر خروجی خارج می‌شوند.
    </p>

    <h3 style="color:#36c8ff">قطعات اصلی</h3>
    <p>
      • روتور سه‌وجهی
      <br>
      • محفظه احتراق
      <br>
      • شفت خروجی خارج از مرکز
      <br>
      • چرخ‌دنده مرکزی
      <br>
      • شمع موتور
      <br>
      • آب‌بندهای رأس روتور
      <br>
      • مسیر ورودی و خروجی گاز
      <br>
      • پوسته و سیستم خنک‌کاری
    </p>

    <h3 style="color:#ff7956">ویژگی موتور روتاری</h3>
    <p>
      موتور روتاری دارای ابعاد جمع‌وجور، وزن نسبتاً کم،
      توان خروجی مناسب و عملکرد نرم است.
      از محدودیت‌های آن می‌توان به مصرف سوخت و روغن
      نسبتاً بالا و حساسیت آب‌بندها اشاره کرد.
    </p>

    <p style="color:#9db4c8;font-size:11px;text-align:center">
      توجه: این مدل سه‌بعدی یک شبیه‌سازی نمایشی است
      و نقشه مهندسی یا مشخصات دقیق موتور تولیدی نیست.
    </p>

    <button id="closeExplanation"
      style="width:100%;background:#087bff;color:white;
      border:0;border-radius:8px;padding:12px;
      font-size:14px;font-weight:bold;cursor:pointer">
      بستن توضیحات
    </button>
  `;

  viewport.appendChild(explanation);

  explanation.querySelector("#closeExplanation").onclick = function () {
    explanation.remove();
  };
});
  const speedLabel=document.createElement("div");speedLabel.textContent="دور موتور: 120 RPM";speedLabel.style.cssText="color:white;font-size:12px;grid-column:span 2;text-align:center;padding-top:7px;font-weight:bold";panel.appendChild(speedLabel);
  const speed=document.createElement("input");speed.type="range";speed.min="0";speed.max="900";speed.step="1";speed.value="120";speed.style.cssText="width:100%;grid-column:span 2";panel.appendChild(speed);
  const rpmNumber=document.createElement("input");rpmNumber.type="number";rpmNumber.min="0";rpmNumber.max="900";rpmNumber.step="1";rpmNumber.value="120";rpmNumber.inputMode="numeric";rpmNumber.style.cssText="width:100%;box-sizing:border-box;grid-column:span 2;background:#0b1420;color:#fff;border:1px solid #36a9d6;border-radius:6px;padding:7px;text-align:center;font-size:14px";panel.appendChild(rpmNumber);
  function setRPM(value){const n=Math.max(0,Math.min(900,Math.round(Number(value)||0)));targetRPM=n;speed.value=String(n);rpmNumber.value=String(n);speedLabel.textContent="دور موتور: "+n+" RPM";if(rpmSlider)rpmSlider.value=String(n);const v=document.getElementById("sliderValue");if(v)v.textContent=n+" RPM";}
  speed.oninput=()=>setRPM(speed.value);rpmNumber.onchange=()=>setRPM(rpmNumber.value);rpmNumber.oninput=()=>{if(rpmNumber.value!=="")setRPM(rpmNumber.value);};
  const speedHint=document.createElement("div");speedHint.textContent="تنظیم دقیق: از 0 تا 900 دور در دقیقه";speedHint.style.cssText="color:#9db4c8;font-size:10px;grid-column:span 2;text-align:center";panel.appendChild(speedHint);
  const info=document.createElement("div");info.style.cssText="display:none;background:#101c29ee;color:#e8f3ff;border:1px solid #36a9d6;border-radius:8px;padding:9px;font-size:12px;line-height:1.6;width:min(210px,calc(100vw - 45px));margin-top:7px";wrapper.appendChild(info);
  const ray=new T.Raycaster(),pointer=new T.Vector2();
  canvas.addEventListener("click",e=>{if(moved)return;const r=canvas.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;ray.setFromCamera(pointer,camera);
    const hits=ray.intersectObjects(selectable,true);if(!hits.length){info.style.display="none";return;}let o=hits[0].object;while(o&&!o.userData.partName)o=o.parent;
    if(o&&o.userData.partName){info.style.display="block";info.textContent=o.userData.partName+" — "+o.userData.partDescription;}});

  let running=true,targetRPM=120,currentRPM=120,shaftAngle=0,elapsed=0;
  const rpmSlider=document.getElementById("rpmSlider");
  if(rpmSlider){rpmSlider.min="0";rpmSlider.max="900";rpmSlider.step="1";rpmSlider.addEventListener("input",()=>setRPM(rpmSlider.value));}
  function status(text,color){const a=document.getElementById("engineStatus");if(a)a.textContent=text;const b=document.getElementById("stateText");if(b){b.textContent=text;b.style.color=color;}}
  let audio=null,osc=null,gain=null;
  function startSound(){try{if(!audio){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audio=new AC();osc=audio.createOscillator();gain=audio.createGain();osc.type="sawtooth";osc.frequency.value=35;gain.gain.value=0;osc.connect(gain);gain.connect(audio.destination);osc.start();}if(audio.state==="suspended")audio.resume();}catch(e){console.log("Audio unavailable",e);}}
  function updateSound(rpm){if(!audio||!osc||!gain)return;osc.frequency.setTargetAtTime(25+rpm*.035,audio.currentTime,.08);gain.gain.setTargetAtTime(running?Math.min(rpm/900*.035,.035):0,audio.currentTime,.1);}
  const start=document.getElementById("startBtn"),stop=document.getElementById("stopBtn");
  if(start)start.onclick=()=>{running=true;if(rpmSlider)setRPM(rpmSlider.value);startSound();status("ENGINE RUNNING","#42df91");};
  if(stop)stop.onclick=()=>{running=false;targetRPM=0;status("ENGINE STOPPED","#ff7956");};
  const names=["INTAKE","COMPRESSION","COMBUSTION","EXHAUST"],colors=["#35baff","#ffc34a","#ff5722","#aaaaaa"];
  function moveParticles(data,dt){data.list.forEach(p=>{p.mesh.position.x+=p.speed*dt;if(p.mesh.position.x>.65)p.mesh.position.x=-.65;p.mesh.position.y+=Math.sin(elapsed*4+p.offset*6)*.001;});}
  const clock=new T.Clock();
  function animate(){
    requestAnimationFrame(animate);const realDt=Math.min(clock.getDelta(),.05),dt=realDt;elapsed+=dt;
    currentRPM+=((running?targetRPM:0)-currentRPM)*Math.min(realDt*2,1);shaftAngle+=currentRPM*TAU/60*dt;shaftGroup.rotation.z=shaftAngle;
    chambers.forEach(u=>{const offset=exploded?-.48:0;u.chamber.position.z+=(u.z+offset-u.chamber.position.z)*Math.min(realDt*3,1);});
    rotors.forEach(u=>{
      const a=shaftAngle+u.phase;u.rg.position.set(E*Math.cos(a),E*Math.sin(a),0);
      // Rotation sign matches the negative third harmonic of this housing profile.
      u.rg.rotation.z=-a/3;
      const q=((a/3%TAU)+TAU)%TAU,cycle=Math.floor(q/(Math.PI/2)),progress=(q%(Math.PI/2))/(Math.PI/2);u.cycle=cycle;
      const firing=running&&cycle===2&&progress<.12;u.spark.visible=firing;u.sparkLight.intensity=firing?7:0;
      const burn=running&&cycle===2;u.fire.visible=burn;u.fireLight.intensity=burn?5:0;
      if(burn){const p=.78+Math.sin(elapsed*25)*.22;u.fire.scale.set(p,p*1.6,p);}
      u.air.group.visible=running&&cycle===0;if(u.air.group.visible)moveParticles(u.air,dt);
      u.exhaust.group.visible=running&&cycle===3;if(u.exhaust.group.visible)moveParticles(u.exhaust,dt);
    });
    updateSound(currentRPM);
    if(running&&rotors.length){const c=rotors[0].cycle,s=document.getElementById("stateText");if(s){s.textContent=names[c];s.style.color=colors[c];}const b=document.getElementById("combustionStatus");if(b)b.textContent=names[c];}
    const put=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    put("rpmValue",Math.round(currentRPM));put("crankSpeed",Math.round(currentRPM)+" RPM");put("camSpeed",Math.round(currentRPM/3)+" RPM");
    put("angle",String(Math.floor(shaftAngle*180/Math.PI%360)).padStart(3,"0"));
    put("simTime",String(Math.floor(elapsed/60)).padStart(2,"0")+":"+String(Math.floor(elapsed%60)).padStart(2,"0"));
    put("load",Math.round(currentRPM/900*100)+"%");put("ignitionStatus",running?"ACTIVE":"OFF");
    const bar=document.getElementById("rpmBar");if(bar)bar.style.width=Math.min(currentRPM/900*100,100)+"%";
    camera.position.set(zoom*Math.sin(rotY)*Math.cos(rotX),zoom*Math.sin(rotX),zoom*Math.cos(rotY)*Math.cos(rotX));camera.lookAt(0,0,0);
    renderer.render(scene,camera);
  }
  animate();
  window.addEventListener("resize",()=>{const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);});
  const loading=document.getElementById("loading");if(loading)loading.style.display="none";
}
})();