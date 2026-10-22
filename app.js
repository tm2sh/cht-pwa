(() => {
  const root = document.getElementById('family-telegram-ui');
  const app = root.querySelector('.tg-app');
  const history = root.querySelector('.tg-history');
  const input = root.querySelector('.tg-composer-input');
  const mainButton = root.querySelector('[data-action="main"]');
  const attachButton = root.querySelector('[data-action="attach"]');
  const inlineSend = root.querySelector('[data-action="inline-send"]');
  const voiceButton = root.querySelector('[data-action="voice-toggle"]');
  const composePanel = root.querySelector('.tg-compose-panel');
  const searchPanel = root.querySelector('.tg-search');
  const searchInput = root.querySelector('.tg-search-input');
  const count = root.querySelector('.tg-search-count');
  const menu = root.querySelector('.tg-menu');
  const dialog = root.querySelector('.tg-dialog');
  const chatPicker = root.querySelector('.tg-chat-picker');
  const backButton = root.querySelector('[data-action="chats-back"]');
  const state = {radius:16,avatarSize:40,blur:42};
  const viewport = window.visualViewport;
  const documentRoot = document.documentElement;
  documentRoot.dataset.inputModality = 'pointer';
  document.addEventListener('pointerdown', () => {
    documentRoot.dataset.inputModality = 'pointer';
  }, {capture:true, passive:true});
  document.addEventListener('keydown', event => {
    if(event.key === 'Tab' || event.key === 'Escape') documentRoot.dataset.inputModality = 'keyboard';
  }, {capture:true});
  let viewportFrame = 0;
  let stableViewportHeight = window.innerHeight;
  let stableViewportWidth = window.innerWidth;
  let followBottom = false;
  history.addEventListener('scroll', () => {
    followBottom = history.scrollHeight - history.scrollTop - history.clientHeight < 24;
  }, {passive:true});
  function updateViewport() {
    viewportFrame = 0;
    // Keep native pinch zoom; changing the layout while zoomed would fight it.
    if(viewport && Math.abs(viewport.scale - 1) > .01) return;
    // Only the message history should scroll. A normal-flow root avoids iOS
    // clipping, but text focus can still pan the document during keyboard entry.
    if(documentRoot.dataset.displayMode === 'standalone' && (window.scrollX || window.scrollY)) window.scrollTo(0, 0);
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    if(Math.abs(width - stableViewportWidth) > 40) {
      stableViewportWidth = width;
      stableViewportHeight = window.innerHeight;
    }
    const editing = document.activeElement?.matches('input, textarea, [contenteditable="true"]');
    if(!editing) stableViewportHeight = Math.max(stableViewportHeight, window.innerHeight);
    const keyboardOpen = editing && Math.max(stableViewportHeight, window.innerHeight) - height > 120;
    documentRoot.dataset.keyboard = keyboardOpen ? 'open' : 'closed';
    // Standalone CSS uses the large viewport, browser CSS the dynamic viewport.
    // VisualViewport is only used to shrink the chat during text entry.
    if(keyboardOpen) {
      documentRoot.style.setProperty('--keyboard-height', height + 'px');
      documentRoot.style.setProperty('--keyboard-top', Math.max(0, viewport?.offsetTop || 0) + 'px');
    } else {
      documentRoot.style.removeProperty('--keyboard-height');
      documentRoot.style.removeProperty('--keyboard-top');
    }
    if(followBottom) requestAnimationFrame(() => { history.scrollTop = history.scrollHeight; });
  }
  function scheduleViewport() {
    if(!viewportFrame) viewportFrame = requestAnimationFrame(updateViewport);
  }
  window.addEventListener('resize', scheduleViewport, {passive:true});
  window.addEventListener('scroll', scheduleViewport, {passive:true});
  window.addEventListener('pageshow', scheduleViewport);
  viewport?.addEventListener('resize', scheduleViewport, {passive:true});
  viewport?.addEventListener('scroll', scheduleViewport, {passive:true});
  document.addEventListener('focusin', scheduleViewport);
  document.addEventListener('focusout', () => {
    scheduleViewport();
    // iOS animates the keyboard independently from the focus change.
    setTimeout(scheduleViewport, 350);
  });
  const standalone = matchMedia('(display-mode: standalone)');
  function updateDisplayMode() { documentRoot.dataset.displayMode = standalone.matches || navigator.standalone ? 'standalone' : 'browser'; }
  standalone.addEventListener('change', updateDisplayMode);
  updateDisplayMode();
  updateViewport();
  let recording = false, recordSeconds = 0, recordTimer = null, voiceTimer = null, voiceElapsed = 0, toastTimer = null;
  let matches = [], activeMatch = 0, mediaTrigger = null;
  const waveHeights = [5,10,18,12,21,14,7,17,11,22,15,8,19,13,6,16,22,12,7,17,10,20,13,8];
  function icons() { if (globalThis.lucide) lucide.createIcons({attrs:{width:20,height:20}}); }
  function wave(parent) { parent.replaceChildren(...waveHeights.map(height => { const bar = document.createElement('span'); bar.style.height=height+'px'; return bar; })); }
  root.querySelectorAll('.tg-wave').forEach(wave);
  function toast(text) { const box=root.querySelector('.tg-toast'); box.textContent=text; box.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>box.hidden=true,2800); }
  function time(seconds) { return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'); }
  function buttonIcon(button,name,label) { button.innerHTML='<i data-lucide="'+name+'" aria-hidden="true"></i>'; button.setAttribute('aria-label',label); icons(); }
  function updateComposer() { mainButton.disabled=!recording; mainButton.setAttribute('aria-label','Отправить демо-голосовое'); inlineSend.hidden=recording||!input.value.trim(); input.disabled=recording; }
  function toggleMenu(open) { if(open)document.activeElement?.blur(); menu.hidden=!open; attachButton.setAttribute('aria-expanded',String(open)); }
  function closeComposer() { if(recording)stopRecording(); composePanel.hidden=true; voiceButton.setAttribute('aria-expanded','false'); }
  function setChatPicker(open,focus=true) {
    if(open) { document.activeElement?.blur(); toggleMenu(false); closeComposer(); if(voiceTimer)stopVoice(); clearTimeout(toastTimer); root.querySelector('.tg-toast').hidden=true; }
    chatPicker.hidden=!open;
    [...app.children].forEach(child=>child.inert=open&&child!==chatPicker);
    if(focus) (open?chatPicker.querySelector('[data-action="chat-open"]'):backButton).focus();
  }
  function renderSearch() {
    const query=searchInput.value.trim().toLocaleLowerCase('ru'); matches=[];
    root.querySelectorAll('[data-searchable]').forEach(element=> {
      const source=element.dataset.original||element.textContent;
      element.dataset.original=source; element.textContent=source;
      element.closest('.tg-message').classList.remove('tg-search-current');
      if(!query) return;
      const lower=source.toLocaleLowerCase('ru'); let start=0, index=lower.indexOf(query);
      if(index<0) return;
      element.replaceChildren();
      while(index>=0) { element.append(document.createTextNode(source.slice(start,index))); const mark=document.createElement('mark'); mark.textContent=source.slice(index,index+query.length); element.append(mark); start=index+query.length; index=lower.indexOf(query,start); }
      element.append(document.createTextNode(source.slice(start))); matches.push(element.closest('.tg-message'));
    });
    activeMatch=0; updateMatch();
    root.querySelectorAll('[data-action="search-prev"],[data-action="search-next"]').forEach(button=>button.disabled=matches.length===0);
    if(!query) count.textContent='Введите слово или фразу';
  }
  function updateMatch() { matches.forEach((message,index)=>message.classList.toggle('tg-search-current',index===activeMatch)); count.textContent=matches.length?String(activeMatch+1)+' из '+matches.length+' сообщений':'Ничего не найдено'; if(matches.length){const box=matches[activeMatch].getBoundingClientRect();const frame=history.getBoundingClientRect();const style=getComputedStyle(history);const top=parseFloat(style.paddingTop);const bottom=parseFloat(style.paddingBottom);history.scrollTop+=box.top-frame.top-top-(history.clientHeight-top-bottom-box.height)/2;} }
  function toggleSearch(open) { searchPanel.hidden=!open; root.querySelector('[data-action="search-open"]').setAttribute('aria-expanded',String(open)); if(open) searchInput.focus({preventScroll:true}); else { searchInput.blur(); searchInput.value=''; renderSearch(); root.querySelector('[data-action="search-open"]').focus({preventScroll:true}); } }
  function addMessage(kind,text='') {
    const host=root.querySelector('.tg-new-message'); host.hidden=false;
    const row=document.createElement('div'); row.className='tg-message-row tg-own';
    row.innerHTML='<article class="tg-message tg-own" aria-label="Ваше сообщение"><div class="tg-message-content"></div><div class="tg-time">Сейчас<i data-lucide="check" aria-label="Отправлено в макете"></i></div></article>';
    host.append(row); host.style.display='flex'; host.style.flexDirection='column';host.style.gap='4px';
    const content=row.querySelector('.tg-message-content');
    if(kind==='text') { const copy=document.createElement('div'); copy.className='tg-copy'; copy.dataset.searchable=''; copy.textContent=text; content.append(copy); }
    if(kind==='photo'||kind==='video') {
      const sample=root.querySelector(kind==='photo'?'[data-action="photo"]':'[data-action="video"]').cloneNode(true);
      sample.style.width='180px'; content.append(sample);
    }
    if(kind==='voice') {
      const voice=document.createElement('div'); voice.className='tg-copy'; voice.dataset.searchable=''; voice.textContent='🎙 Голосовое сообщение · '+time(Math.max(1,recordSeconds)); content.append(voice);
    }
    if(!searchPanel.hidden) renderSearch(); icons(); requestAnimationFrame(()=>{history.scrollTop=history.scrollHeight;});
  }
  function stopRecording() { clearInterval(recordTimer); recordTimer=null; recording=false; root.querySelector('.tg-recording').hidden=true; voiceButton.classList.remove('is-recording'); voiceButton.setAttribute('aria-expanded','false'); voiceButton.setAttribute('aria-label','Записать голосовое сообщение'); updateComposer(); }
  function startRecording() {
    document.activeElement?.blur();
    toggleMenu(false); recording=true; recordSeconds=0; composePanel.hidden=false;
    root.querySelector('.tg-recording').hidden=false; root.querySelector('.tg-record-time').textContent='0:00';
    voiceButton.setAttribute('aria-expanded','true'); voiceButton.setAttribute('aria-label','Отменить демо-запись'); voiceButton.classList.add('is-recording'); updateComposer();
    recordTimer=setInterval(()=>{ recordSeconds++; root.querySelector('.tg-record-time').textContent=time(recordSeconds); if(recordSeconds>=60){closeComposer();toast('Демо-запись остановлена');}},1000);
  }
  function send() { if(recording){addMessage('voice');closeComposer();toast('Демо: голосовое добавлено без записи звука');return;} const text=input.value.trim(); if(!text)return; addMessage('text',text);input.value='';closeComposer();updateComposer();toast('Демо-сообщение · видно только здесь'); }
  function stopVoice() { clearInterval(voiceTimer); voiceTimer=null; voiceElapsed=0; const button=root.querySelector('[data-action="voice-play"]'); button.setAttribute('aria-pressed','false'); buttonIcon(button,'play','Прослушать пример голосового сообщения'); root.querySelector('.tg-duration').textContent='0:12'; root.querySelectorAll('.tg-wave span').forEach(bar=>bar.dataset.active='false'); }
  function openMedia(kind,button) {
    document.activeElement?.blur();
    mediaTrigger=button; const scene=root.querySelector(kind==='photo'?'[data-action="photo"] .tg-scene':'[data-action="video"] .tg-scene').cloneNode(true);
    root.querySelector('.tg-dialog-media').replaceChildren(scene);
    root.querySelector('.tg-dialog-title').textContent=kind==='photo'?'Фотография':'Видео · 0:18';
    root.querySelector('.tg-dialog-note').textContent=kind==='photo'?'Иллюстрация для примера интерфейса':'Пример экрана просмотра · без видеозаписи';
    [...app.children].forEach(child=>{ if(child!==dialog) child.inert=true; }); dialog.hidden=false; dialog.querySelector('button').focus();
  }
  function closeMedia() { dialog.hidden=true; [...app.children].forEach(child=>child.inert=false); mediaTrigger?.focus(); }
  root.addEventListener('click',event=> {
    const button=event.target.closest('button[data-action]'); if(!button) return;
    const action=button.dataset.action;
    if(action==='chats-back'){setChatPicker(true);}
    if(action==='chat-open'){setChatPicker(false);}
    if(action==='search-open'){toggleSearch(searchPanel.hidden);}
    if(action==='search-close'){toggleSearch(false);}
    if(action==='search-next'||action==='search-prev'){if(matches.length){activeMatch=(activeMatch+(action==='search-next'?1:-1)+matches.length)%matches.length;updateMatch();}}
    if(action==='main'||action==='inline-send') send();
    if(action==='attach'){const open=menu.hidden; closeComposer(); toggleMenu(open);}
    if(action==='voice-toggle'){if(recording){closeComposer();voiceButton.focus();}else startRecording();}
    if(action==='composer-close'){closeComposer();voiceButton.focus();}
    if(action==='add-photo'||action==='add-video'){toggleMenu(false);addMessage(action==='add-photo'?'photo':'video');toast('Пример вложения · файлы не загружаются');}
    if(action==='photo'||action==='video') openMedia(action,button);
    if(action==='media-close') closeMedia();
    if(action==='voice-play') {
      if(voiceTimer){stopVoice();return;}
      button.setAttribute('aria-pressed','true');buttonIcon(button,'pause','Остановить пример голосового');toast('Демонстрация плеера · без звука');
      voiceTimer=setInterval(()=>{voiceElapsed++;root.querySelector('.tg-duration').textContent=time(voiceElapsed)+' / 0:12';root.querySelectorAll('.tg-wave span').forEach((bar,index)=>bar.dataset.active=String(index<waveHeights.length*voiceElapsed/12));if(voiceElapsed>=12)stopVoice();},1000);
    }
  });
  input.addEventListener('input',updateComposer);
  inlineSend.addEventListener('pointerdown', event => event.preventDefault());
  input.addEventListener('focus',()=>toggleMenu(false));
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();if(input.value.trim())send();}});
  searchInput.addEventListener('input',renderSearch);
  searchInput.addEventListener('keydown',event=>{if(event.key==='Enter'&&matches.length){event.preventDefault();activeMatch=(activeMatch+(event.shiftKey?-1:1)+matches.length)%matches.length;updateMatch();}});
  root.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!chatPicker.hidden){setChatPicker(false);}else if(!dialog.hidden)closeMedia();else if(!menu.hidden)toggleMenu(false);else if(!composePanel.hidden)closeComposer();else if(!searchPanel.hidden)toggleSearch(false);}if(!dialog.hidden&&event.key==='Tab'){event.preventDefault();dialog.querySelector('button').focus();}});
  function renderDesign() { app.style.setProperty('--tg-radius',state.radius+'px');app.style.setProperty('--tg-avatar',state.avatarSize+'px');app.style.setProperty('--tg-blur',state.blur+'px'); }
  renderDesign();
  window.addEventListener('pagehide',()=>{clearInterval(recordTimer);clearInterval(voiceTimer);clearTimeout(toastTimer);},{once:true});
  icons();
  requestAnimationFrame(()=>{const group=history.querySelector('.tg-message-group[data-author="mom"]');const top=parseFloat(getComputedStyle(history).paddingTop);history.scrollTop+=group.getBoundingClientRect().top-history.getBoundingClientRect().top-top-12;});
  if('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js', {scope:'./', updateViaCache:'none'})
      .then(() => navigator.serviceWorker.ready)
      .then(() => { documentRoot.dataset.offlineReady = 'true'; })
      .catch(error => { console.warn('PWA offline cache is unavailable:', error); });
  }
})();
