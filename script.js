/* TEN NIGHTS IN A HOTEL — mobile/PC build with persistent save */
const SAVE_KEY = 'ten_nights_hotel_save_v6';
const LEGACY_SAVE_KEY = 'ten_nights_hotel_save_v5';
let nightTransitioning = false;
let memorySave = null;
function readSave(){ try { return localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY); } catch(e){ return memorySave; } }
function writeSave(v){ try { localStorage.setItem(SAVE_KEY,v); } catch(e){ memorySave=v; } }
function removeSave(){ try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(LEGACY_SAVE_KEY); } catch(e){} memorySave=null; }
let gameRunning = false, game_over = false;
let hora_actual = 0, static_segundos = 0;
let direction = 0, is_flashlight_on = false, is_tablet_open = false, is_curtains_closed = false;
let current_camera = 1, noche_actual = 1;
let tiempo_povar = 0, rabat_stage = 0, rabat_room = 0, mimic_stage = 0, killer_stage = 0, maid_stage = 0;
let maniac_alert = false, maniac_angry = false, maniac_angry_since = 0, maniac_alert_since = 0;
let maid_timer_running = false, maid_deadline = 0, rabat_glitch = false;
let saveClock = 0, lastTick = Date.now();

const timeDisplay = document.getElementById('time-display');
const office = document.getElementById('office');
const tabletScreen = document.getElementById('tablet-screen');
const cameraMonitor = document.getElementById('camera-monitor');
const monitorTextBox = document.getElementById('monitor-text-box');
const actionMonitorBtn = document.getElementById('action-monitor-btn');
const curtainBtn = document.getElementById('curtain-btn');
const flashlightBtn = document.getElementById('flashlight-btn');
const mainMenu = document.getElementById('main-menu');

const GAME_IMAGES = [
 'office_front_empty.jpg','office_front_rabat.jpg','office_back.jpg','office_curtains.jpg',
 'cam1_hall.jpg','cam2_empty.jpg','cam2_mimic_grate.jpg','cam3_stairs.jpg','cam3_killer.jpg','cam4_room5005.jpg','cam4_cook.jpg','cam4_cook_gone.jpg',
 'cam5_elevator.jpg','cam5_rabat.jpg','cam6_lobby.jpg','cam6_rabat.jpg','cam7_laundry.jpg','cam7_maid.jpg','cam7_maid_window.jpg','cam8_kitchen.jpg','cam8_maniac.jpg','cam8_maniac_alert.jpg',
 'jumpscare_cook.jpg','jumpscare_rabat.jpg','jumpscare_mimic.jpg','jumpscare_killer.jpg','jumpscare_maid.jpg','jumpscare_maniac.jpg','menu_bg.png'
];
GAME_IMAGES.forEach(src => { const img = new Image(); img.src = src; });

function secondsPerHour(){ return 20 + ((noche_actual - 1) * 10); }
// Каждая новая ночь в 2 раза агрессивнее предыдущей.
// Для вероятностей используем накопительный множитель, а для таймеров — деление на него.
function getDifficultyMultiplier(){ return Math.pow(2, Math.max(0, noche_actual - 1)); }
function getDifficulty(){ return getDifficultyMultiplier(); }
function getBaseChance(){ return Math.min(0.45, 0.012 * getDifficultyMultiplier()); }
function scaledTimer(base, minimum){ return Math.max(minimum, Math.round(base / getDifficultyMultiplier())); }
function resetNightState(){
  hora_actual=0; static_segundos=0; direction=0; is_flashlight_on=false; is_tablet_open=false; is_curtains_closed=false; current_camera=1;
  tiempo_povar=0; rabat_stage=0; rabat_room=0; mimic_stage=0; killer_stage=0; maid_stage=0;
  maniac_alert=false; maniac_angry=false; maniac_angry_since=0; maniac_alert_since=0; maid_timer_running=false; maid_deadline=0; rabat_glitch=false;
  saveClock=0; nightTransitioning=false;
}

function updateMenu(){
  const raw = readSave();
  const btn = document.getElementById('continue-btn');
  const info = document.getElementById('save-info');
  if(raw){
    try{
      const s = JSON.parse(raw);
      btn.disabled = false;
      info.textContent = `Сохранение: Ночь ${s.noche_actual}, ${s.hora_actual}:00 AM — продолжение доступно`;
    }catch(e){ btn.disabled=true; info.textContent='Сохранение повреждено'; }
  } else {
    btn.disabled = true;
    info.textContent = 'Сохранения нет — начните новую игру';
  }
}

function resetState(){
  game_over=false; gameRunning=false; hora_actual=0; static_segundos=0; direction=0; is_flashlight_on=false; is_tablet_open=false; is_curtains_closed=false; current_camera=1;
  noche_actual=1; tiempo_povar=0; rabat_stage=0; rabat_room=0; mimic_stage=0; killer_stage=0; maid_stage=0;
  maniac_alert=false; maniac_angry=false; maniac_angry_since=0; maniac_alert_since=0; maid_timer_running=false; maid_deadline=0; rabat_glitch=false;
}

function newGame(){
  removeSave();
  resetState();
  startGame(false);
}

function continueGame(){
  const raw = readSave();
  if(!raw) return;
  try{ loadSave(JSON.parse(raw)); startGame(true); }catch(e){ newGame(); }
}

function startGame(fromSave){
  nightTransitioning=false; gameRunning=true; game_over=false; mainMenuHide();
  if(!fromSave) saveGame(true);
  updateAllVisuals();
  if(is_tablet_open) { is_tablet_open=false; tabletScreen.style.display='none'; }
  updateMenu();
  lastTick=Date.now();
}
function mainMenuHide(){ mainMenu.style.display='none'; }
function returnToMenu(){ saveGame(true); gameRunning=false; if(tabletScreen) tabletScreen.style.display='none'; is_tablet_open=false; mainMenu.style.display='flex'; updateMenu(); }

function snapshot(){
  const now=Date.now();
  return {
    version:4, noche_actual, hora_actual, static_segundos, direction, is_flashlight_on, is_tablet_open:false, is_curtains_closed, current_camera,
    tiempo_povar, rabat_stage, rabat_room, mimic_stage, killer_stage, maid_stage, maniac_alert, maniac_angry,
    maniac_angry_remaining: maniac_angry && maniac_angry_since ? Math.max(0, scaledTimer(5000,1200)-(now-maniac_angry_since)) : 0,
    maniac_alert_remaining: maniac_alert && maniac_alert_since ? Math.max(0, scaledTimer(8000,1000)-(now-maniac_alert_since)) : 0,
    maid_remaining: maid_deadline ? Math.max(0, maid_deadline-now) : 0,
    savedAt: now
  };
}
function saveGame(force=false){
  if(!gameRunning && !force) return;
  try{ writeSave(JSON.stringify(snapshot())); }catch(e){}
}
function loadSave(s){
  noche_actual=Math.min(10,Math.max(1,Number(s.noche_actual)||1)); hora_actual=Math.min(5,Math.max(0,Number(s.hora_actual)||0)); static_segundos=Math.max(0,Number(s.static_segundos)||0);
  direction=Number(s.direction)||0; is_flashlight_on=!!s.is_flashlight_on; is_tablet_open=false; is_curtains_closed=!!s.is_curtains_closed; current_camera=Math.min(8,Math.max(1,Number(s.current_camera)||1));
  tiempo_povar=Math.max(0,Number(s.tiempo_povar)||0); rabat_stage=Math.max(0,Number(s.rabat_stage)||0); rabat_room=Math.max(0,Number(s.rabat_room)||0); mimic_stage=Math.max(0,Number(s.mimic_stage)||0); killer_stage=Math.max(0,Number(s.killer_stage)||0); maid_stage=Math.max(0,Number(s.maid_stage)||0);
  maniac_alert=!!s.maniac_alert; maniac_angry=!!s.maniac_angry; rabat_glitch=false; maid_timer_running=false;
  const now=Date.now();
  maniac_angry_since=maniac_angry && s.maniac_angry_remaining ? now-(scaledTimer(5000,1200)-Number(s.maniac_angry_remaining)) : 0;
  maniac_alert_since=maniac_alert && s.maniac_alert_remaining ? now-(scaledTimer(8000,1000)-Number(s.maniac_alert_remaining)) : 0;
  maid_deadline=Number(s.maid_remaining)>0 ? now+Number(s.maid_remaining) : 0;
  if(maid_deadline) maid_timer_running=true;
}

function updateClock(){ if(timeDisplay) timeDisplay.textContent=`${hora_actual}:00 AM | Ночь ${noche_actual}`; }
function updateOfficeVisuals(){
  if(!office) return;
  let img='office_front_empty.jpg';
  if(direction===1) img='office_back.jpg';
  else if(is_curtains_closed) img='office_curtains.jpg';
  else if(rabat_stage>=3) img='office_front_rabat.jpg';
  office.style.backgroundImage=`url('${img}')`;
  office.style.filter=is_flashlight_on?'brightness(1)':'brightness(.2)';
  if(flashlightBtn){ flashlightBtn.classList.toggle('on',is_flashlight_on); flashlightBtn.textContent=is_flashlight_on?'ФОНАРИК: ВКЛ':'ФОНАРИК'; }
  if(curtainBtn){ curtainBtn.classList.toggle('closed',is_curtains_closed); curtainBtn.textContent=is_curtains_closed?'ШТОРЫ: ЗАКРЫТЫ':'ШТОРЫ: ОТКР'; }
  const tabletBtn=document.getElementById('tablet-btn'); if(tabletBtn) tabletBtn.style.visibility=direction===1?'hidden':'visible';
  updateClock();
}
function updateAllVisuals(){ updateOfficeVisuals(); if(is_tablet_open) switchCamera(current_camera); }

function gameTick(){
  if(!gameRunning || game_over || nightTransitioning) return;
  static_segundos++;
  if(static_segundos>=secondsPerHour()){
    static_segundos=0; onHoraCambiada(); if(game_over) return;
  }
  const totalNightSeconds=hora_actual*secondsPerHour()+static_segundos;
  if(totalNightSeconds<=12){ if(is_tablet_open) switchCamera(current_camera); autosave(); return; }
  const chance=getBaseChance();
  const difficulty=getDifficultyMultiplier();

  // COOK
  const povarLimit=scaledTimer(130-(noche_actual*3), 12);
  if(direction===1 && is_flashlight_on) tiempo_povar=0;
  else { tiempo_povar++; if(tiempo_povar>=povarLimit){ triggerScreamer('cook','ПОВАР напал со спины!'); return; } }

  // RABAT: 0 safe -> CAM5 elevator -> CAM6 lobby -> office.
  if(!is_tablet_open && Math.random()<chance){
    if(rabat_stage<3){ rabat_stage++; rabat_room=rabat_stage===1?5:(rabat_stage>=2?6:0); rabat_glitch=true; setTimeout(()=>{rabat_glitch=false;if(is_tablet_open)switchCamera(current_camera)},1200); }
  }
  if(rabat_stage===3 && !is_tablet_open && !is_flashlight_on && Math.random()<Math.min(0.75,0.18*Math.sqrt(difficulty))){ rabat_stage=0;rabat_room=0; }
  if(rabat_stage===3 && is_flashlight_on && direction===0 && Math.random()<Math.min(0.65,0.12*Math.sqrt(difficulty))){ rabat_stage=0;rabat_room=0; }

  // MIMIC
  if(Math.random()<Math.min(0.9, chance*.72)){
    if(mimic_stage<2) mimic_stage++;
    else { triggerScreamer('mimic','МИМИК вырвался из вентиляции!'); return; }
  }

  // KILLER
  if(is_tablet_open && current_camera===3){ if(killer_stage>0 && Math.random()<.35) killer_stage--; }
  else if(Math.random()<Math.min(0.9, chance*.62)){ killer_stage++; if(killer_stage>=4){triggerScreamer('killer','УБИЙЦА добрался до кабинета!');return;} }

  // MAID
  if(Math.random()<Math.min(0.9, chance*.72) && maid_stage<2) maid_stage++;
  if(maid_stage===2){
    if(!is_curtains_closed && !maid_timer_running){ maid_timer_running=true; maid_deadline=Date.now()+scaledTimer(4200,1200); }
    else if(is_curtains_closed){ maid_stage=0; maid_timer_running=false; maid_deadline=0; }
  }
  if(maid_timer_running && maid_deadline && Date.now()>=maid_deadline && !is_curtains_closed && maid_stage===2){ triggerScreamer('maid','ГОРНИЧНАЯ выбила окно!'); return; }

  // MANIAC
  if(is_curtains_closed){
    if(!maniac_angry){maniac_angry=true;maniac_angry_since=Date.now();maniac_alert=true;maniac_alert_since=Date.now();}
    else if(Date.now()-maniac_angry_since>=scaledTimer(5000,1200)){triggerScreamer('maniac','МАНЬЯК разозлился из-за закрытых штор и пришёл!');return;}
  } else if(maniac_angry){maniac_angry=false;maniac_angry_since=0;maniac_alert=false;maniac_alert_since=0;}
  if(is_flashlight_on && direction===0 && current_camera!==8 && !maniac_angry){
    if(!maniac_alert && Math.random()<Math.min(0.6,0.018*difficulty)){maniac_alert=true;maniac_alert_since=Date.now();}
  }
  if(maniac_alert && !maniac_angry){
    const age=Date.now()-maniac_alert_since;
    if(is_flashlight_on && age>=scaledTimer(8000,1000) && Math.random()<Math.min(0.7,0.018*difficulty)){triggerScreamer('maniac','МАНЬЯК прибежал на свет!');return;}
    if(!is_flashlight_on && age>=3000 && Math.random()<.30){maniac_alert=false;maniac_alert_since=0;}
  }
  if(is_tablet_open) switchCamera(current_camera);
  autosave();
}

function autosave(){ if(++saveClock>=2){saveClock=0;saveGame();} }
function onHoraCambiada(){
  if(nightTransitioning || game_over || !gameRunning) return;
  hora_actual++;
  if(hora_actual<6){ updateClock(); saveGame(true); return; }

  // Один и только один переход после 6 AM. Это предотвращает повторение/пропуск ночей.
  nightTransitioning=true;
  game_over=true;
  gameRunning=false;

  if(noche_actual>=10){
    writeSave(JSON.stringify({version:6,noche_actual:10,hora_actual:5,static_segundos:secondsPerHour()-1,completed:true,savedAt:Date.now()}));
    showNightOverlay('ИГРА ПРОЙДЕНА','Ты пережил все 10 ночей.');
    return;
  }

  const completedNight=noche_actual;
  noche_actual++;
  resetNightState();
  // Сохраняем уже НОВУЮ ночь. Поэтому «Продолжить» никогда не откатит игрока
  // обратно на только что пройденную ночь.
  game_over=true;
  gameRunning=false;
  saveGame(true);
  showNightOverlay(`НОЧЬ ${noche_actual}`,`Ночь ${completedNight} пройдена. Сложность увеличена в 2 раза.`);
}

function showNightOverlay(title,text){
  const old=document.getElementById('night-overlay'); if(old)old.remove();
  const d=document.createElement('div'); d.id='night-overlay';
  const box=document.createElement('div'); box.className='box';
  const h=document.createElement('h2'); h.textContent=title;
  const p=document.createElement('div'); p.textContent=text;
  const b=document.createElement('button'); b.className='night-btn'; b.type='button'; b.textContent='ПРОДОЛЖИТЬ';
  b.addEventListener('click',()=>{ d.remove(); gameRunning=true; game_over=false; nightTransitioning=false; updateAllVisuals(); saveGame(true); });
  box.append(h,p,b); d.appendChild(box); document.body.appendChild(d);
}

function toggleDirection(){ if(!gameRunning||game_over)return; if(is_tablet_open)toggleTablet(); direction=direction===0?1:0; is_flashlight_on=false; updateOfficeVisuals(); saveGame(); }
function toggleFlashlight(){ if(!gameRunning||game_over)return; is_flashlight_on=!is_flashlight_on; updateOfficeVisuals(); saveGame(); }
function toggleCurtains(){
  if(!gameRunning||game_over)return; is_curtains_closed=!is_curtains_closed;
  if(is_curtains_closed){maid_stage=0;maid_timer_running=false;maid_deadline=0;maniac_angry=true;maniac_angry_since=Date.now();maniac_alert=true;maniac_alert_since=Date.now();}
  else{maniac_angry=false;maniac_angry_since=0;maniac_alert=false;maniac_alert_since=0;}
  updateOfficeVisuals();saveGame();
}
function toggleTablet(){ if(!gameRunning||game_over||direction===1)return; is_tablet_open=!is_tablet_open; tabletScreen.style.display=is_tablet_open?'block':'none'; if(is_tablet_open)switchCamera(current_camera); window.dispatchEvent(new CustomEvent('hotel-camera-change',{detail:{camera:current_camera,tabletOpen:is_tablet_open}})); saveGame(); }
function setCameraImage(image,status){cameraMonitor.style.backgroundImage=`url('${image}')`;monitorTextBox.textContent=status;}
function switchCamera(camNumber){
  current_camera=camNumber;
  window.dispatchEvent(new CustomEvent('hotel-camera-change',{detail:{camera:current_camera,tabletOpen:is_tablet_open}}));
  for(let i=1;i<=8;i++){const b=document.getElementById('cam'+i+'-btn');if(b)b.classList.remove('active')}
  const active=document.getElementById('cam'+camNumber+'-btn');if(active)active.classList.add('active');
  actionMonitorBtn.style.display='none';
  if(rabat_glitch&&camNumber===rabat_room){monitorTextBox.textContent=`[CAM ${camNumber}]\n⚠ СИГНАЛ ПОТЕРЯН...`;cameraMonitor.style.backgroundImage='none';return;}
  if(camNumber===1){
    // No dedicated CAM1-Rabat upload was provided; use the corridor image until a CAM1-specific Rabat photo is supplied.
    setCameraImage('cam1_hall.jpg',`[CAM 1: ГЛАВНЫЙ КОРИДОР]\n${rabat_stage>=3?'Рабат уже у кабинета.':'Коридор пуст. Рабата здесь нет.'}`);
  } else if(camNumber===2){
    actionMonitorBtn.style.display=mimic_stage===2?'block':'none';
    const image=mimic_stage===2?'cam2_mimic_grate.jpg':'cam2_empty.jpg';
    const status=mimic_stage===2?'МИМИК ПРЯМО У РЕШЁТКИ! ЗАКРОЙ РЕШЁТКУ.':(mimic_stage===1?'Слышен скрежет внутри вентиляции...':'В воздуховоде тихо.');
    setCameraImage(image,`[CAM 2: ВЕНТИЛЯЦИЯ]\n${status}`);
  } else if(camNumber===3){const image=killer_stage>=1?'cam3_killer.jpg':'cam3_stairs.jpg';setCameraImage(image,`[CAM 3: ЛЕСТНИЦА]\n${killer_stage>=3?'УБИЙЦА БЕЖИТ НА ВАШ ЭТАЖ!':killer_stage?'Силуэт приближается...':'Лестница пуста.'}`);}
  else if(camNumber===4){const limit=Math.max(70,Math.round(130-(noche_actual*6)));let image='cam4_room5005.jpg',status='Комната 5005 пуста.';if(tiempo_povar>0&&tiempo_povar<limit*.45){image='cam4_cook.jpg';status='Повар сидит в комнате.'}else if(tiempo_povar<limit*.75){image='cam4_cook_gone.jpg';status='Повар исчез...'}else{image='cam4_cook_gone.jpg';status='ПОВАР ПРИБЛИЖАЕТСЯ!'}setCameraImage(image,`[CAM 4: КОМНАТА 5005]\n${status}`);}
  else if(camNumber===5){setCameraImage(rabat_room===5?'cam5_rabat.jpg':'cam5_elevator.jpg',`[CAM 5: ЛИФТ]\n${rabat_room===5?'РАБАТ В ЛИФТЕ.':'Лифт пуст.'}`);}
  else if(camNumber===6){setCameraImage(rabat_room===6?'cam6_rabat.jpg':'cam6_lobby.jpg',`[CAM 6: ЛОББИ]\n${rabat_room===6?'РАБАТ В ЛОББИ.':'Лобби пусто.'}`);}
  else if(camNumber===7){let image='cam7_laundry.jpg',status='Прачечная пуста.';if(maid_stage===1){image='cam7_maid.jpg';status='Горничная в прачечной...'}if(maid_stage===2){image='cam7_maid_window.jpg';status='ГОРНИЧНАЯ У ОКНА!'}setCameraImage(image,`[CAM 7: ПРАЧЕЧНАЯ]\n${status}`);}
  else if(camNumber===8){setCameraImage(maniac_alert?'cam8_maniac_alert.jpg':'cam8_maniac.jpg',`[CAM 8: КУХНЯ]\n${maniac_alert?'МАНЬЯК ЗЛИТСЯ.':'Маньяк на кухне.'}`);}
}
function handleCamAction(){
  if(!gameRunning||game_over)return;
  if(current_camera===2&&mimic_stage===2){mimic_stage=0;actionMonitorBtn.style.display='none';switchCamera(2);saveGame();}
}

// Keyboard + mobile touch controls.
document.addEventListener('keydown',event=>{
  if(!gameRunning||game_over)return;
  const key=event.key.toLowerCase(),code=event.code;
  if(['tab',' ','escape','f','c','e','a','d','arrowleft','arrowright','1','2','3','4','5','6','7','8'].includes(key)||['Tab','Space'].includes(code))event.preventDefault();
  if(event.repeat)return;
  if(/^[1-8]$/.test(key)){if(!is_tablet_open)toggleTablet();if(is_tablet_open)switchCamera(Number(key));return;}
  if(code==='Tab'||code==='Space'){toggleTablet();return;} if(key==='escape'){if(is_tablet_open)toggleTablet();return;}
  if(key==='f'){toggleFlashlight();return;} if(key==='c'){toggleCurtains();return;}
  if(key==='a'||key==='arrowleft'){if(!is_tablet_open&&direction!==1)toggleDirection();return;} if(key==='d'||key==='arrowright'){if(!is_tablet_open&&direction!==0)toggleDirection();return;}
  if(key==='e'&&is_tablet_open&&current_camera===2&&mimic_stage===2)handleCamAction();
});
window.addEventListener('pagehide',()=>saveGame(true));
window.addEventListener('beforeunload',()=>saveGame(true));
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveGame(true)});

function triggerScreamer(type,reason){
  if(game_over)return; game_over=true;gameRunning=false;is_tablet_open=false;tabletScreen.style.display='none';
  // Keep the previous autosave; Continue should not restore the exact death moment.
  const images={cook:'jumpscare_cook.jpg',rabat:'jumpscare_rabat.jpg',mimic:'jumpscare_mimic.jpg',killer:'jumpscare_killer.jpg',maid:'jumpscare_maid.jpg',maniac:'jumpscare_maniac.jpg'};
  const overlay=document.createElement('div');overlay.id='jumpscare-overlay';overlay.style.backgroundImage=`url('${images[type]||images.cook}')`;
  const caption=document.createElement('div');caption.className='caption';caption.textContent=reason||'ТЫ ПРОИГРАЛ!';overlay.appendChild(caption);document.body.appendChild(overlay);
  setTimeout(()=>{overlay.remove();mainMenu.style.display='flex';updateMenu();game_over=false;},2500);
}

// Bind controls explicitly. This is more reliable in Android WebView than inline onclick handlers.
function bindControls(){
  const byId=id=>document.getElementById(id);
  byId('continue-btn')?.addEventListener('click', continueGame);
  byId('new-game-btn')?.addEventListener('click', newGame);
  byId('tablet-btn')?.addEventListener('click', toggleTablet);
  byId('flashlight-btn')?.addEventListener('click', toggleFlashlight);
  byId('curtain-btn')?.addEventListener('click', toggleCurtains);
  byId('turn-btn')?.addEventListener('click', toggleDirection);
  byId('action-monitor-btn')?.addEventListener('click', handleCamAction);
  for(let i=1;i<=8;i++) byId('cam'+i+'-btn')?.addEventListener('click',()=>switchCamera(i));
  byId('close-tablet')?.addEventListener('click', toggleTablet);
}

// Initial menu.
bindControls();
updateMenu();updateClock();updateOfficeVisuals();
setInterval(gameTick,1000);

window.newGame=newGame; window.continueGame=continueGame; window.toggleTablet=toggleTablet; window.toggleFlashlight=toggleFlashlight; window.toggleCurtains=toggleCurtains; window.toggleDirection=toggleDirection; window.switchCamera=switchCamera; window.handleCamAction=handleCamAction;
