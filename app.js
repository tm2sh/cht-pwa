(() => {
  const root = document.getElementById('chat-ui');
  const app = root.querySelector('.chat-app');
  const history = root.querySelector('.chat-history');
  const input = root.querySelector('.chat-composer-input');
  const mainButton = root.querySelector('[data-action="main"]');
  const attachButton = root.querySelector('[data-action="attach"]');
  const composerAction = root.querySelector('[data-action="composer-action"]');
  const composePanel = root.querySelector('.chat-compose-panel');
  const searchPanel = root.querySelector('.chat-search');
  const searchInput = root.querySelector('.chat-search-input');
  const count = root.querySelector('.chat-search-count');
  const menu = root.querySelector('.chat-menu');
  const dialog = root.querySelector('.chat-dialog');
  const chatPicker = root.querySelector('.chat-chat-picker');
  const backButton = root.querySelector('[data-action="chats-back"]');
  const settings = root.querySelector('.chat-settings');
  const profileButton = root.querySelector('[data-action="settings-open"]');
  const profileForm = root.querySelector('.chat-settings-form');
  const profileName = root.querySelector('#chat-profile-name');
  const profileLogin = root.querySelector('#chat-profile-login');
  const profilePassword = root.querySelector('#chat-profile-password');
  const profilePasswordRepeat = root.querySelector('#chat-profile-password-repeat');
  const avatarFile = root.querySelector('#chat-avatar-file');
  const accountScreen = root.querySelector('.chat-account-screen');
  // Profile edits are local to this demo page; passwords are never retained.
  const profile = {name:'Тимур', login:'timur', avatar:''};
  let draftAvatar = '', avatarRequest = 0;
  const chats = {
    family: {name:'Семья', avatar:'С', members:'6 участников, 2 в сети', nodes:[...history.childNodes], draft:''},
    friends: {name:'Друзья', avatar:'Д', members:'4 участника, 2 в сети', nodes:[...document.getElementById('chat-friends-history').content.cloneNode(true).childNodes], draft:''},
  };
  let activeChat = 'family';
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
  let followBottom = true;
  function scrollToLatest() {
    followBottom = true;
    history.scrollTop = history.scrollHeight;
  }
  function keepLatestVisible() {
    if(followBottom) requestAnimationFrame(() => {
      if(followBottom) scrollToLatest();
    });
  }
  history.addEventListener('scroll', () => {
    followBottom = history.scrollHeight - history.scrollTop - history.clientHeight < 24;
  }, {passive:true});
  // Safe-area padding and viewport size may settle after the first paint.
  // Keep the last message above the composer unless the user scrolls up.
  new ResizeObserver(keepLatestVisible).observe(history);
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
    keepLatestVisible();
  }
  function scheduleViewport() {
    if(!viewportFrame) viewportFrame = requestAnimationFrame(updateViewport);
  }
  window.addEventListener('resize', scheduleViewport, {passive:true});
  window.addEventListener('scroll', scheduleViewport, {passive:true});
  window.addEventListener('pageshow', () => {
    scheduleViewport();
    setChatPicker(true, false);
    requestAnimationFrame(scrollToLatest);
  });
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
  function icons(scope=root) { if (globalThis.lucide) lucide.createIcons({root:scope,attrs:{width:20,height:20}}); }
  function wave(parent) { parent.replaceChildren(...waveHeights.map(height => { const bar = document.createElement('span'); bar.style.height=height+'px'; return bar; })); }
  root.querySelectorAll('.chat-wave').forEach(wave);
  function toast(text) { const box=root.querySelector('.chat-toast'); box.textContent=text; box.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>box.hidden=true,2800); }
  function time(seconds) { return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'); }
  function buttonIcon(button,name,label) { button.innerHTML='<i data-lucide="'+name+'" aria-hidden="true"></i>'; button.setAttribute('aria-label',label); icons(button); }
  function updateComposer() {
    const hasText = Boolean(input.value.trim());
    const sendMode = !recording && hasText;
    const mode = recording ? 'recording' : sendMode ? 'send' : 'voice';
    const label = recording ? 'Отменить демо-запись' : sendMode ? 'Отправить сообщение' : 'Записать голосовое сообщение';
    mainButton.disabled = !recording;
    mainButton.setAttribute('aria-label', 'Отправить демо-голосовое');
    input.disabled = recording;
    if(composerAction.dataset.mode !== mode) buttonIcon(composerAction, sendMode ? 'arrow-up' : 'mic', label);
    composerAction.dataset.mode = mode;
    composerAction.setAttribute('aria-label', label);
    composerAction.classList.toggle('is-send', sendMode);
    composerAction.classList.toggle('is-recording', recording);
    if(sendMode) {
      composerAction.removeAttribute('aria-disabled');
      composerAction.removeAttribute('aria-expanded');
      composerAction.removeAttribute('aria-controls');
    } else {
      composerAction.removeAttribute('aria-disabled');
      composerAction.setAttribute('aria-expanded', String(recording));
      composerAction.setAttribute('aria-controls', 'chat-compose-panel');
    }
  }
  function toggleMenu(open) { if(open)document.activeElement?.blur(); menu.hidden=!open; attachButton.setAttribute('aria-expanded',String(open)); }
  function closeComposer() { if(recording)stopRecording(); composePanel.hidden=true; updateComposer(); }
  function setChatPicker(open,focus=true) {
    if(open) {
      if(!settings.hidden) closeSettings(false);
      accountScreen.hidden=true;
    }
    if(open && !dialog.hidden) closeMedia();
    if(open && !searchPanel.hidden) toggleSearch(false);
    if(open) { document.activeElement?.blur(); toggleMenu(false); closeComposer(); if(voiceTimer)stopVoice(); clearTimeout(toastTimer); root.querySelector('.chat-toast').hidden=true; }
    chatPicker.hidden=!open;
    const title = open ? 'Чаты' : chats[activeChat].name;
    document.title = title+' — PWA-макет';
    app.setAttribute('aria-label', title+' · Liquid Glass');
    [...app.children].forEach(child=>child.inert=open&&child!==chatPicker);
    if(focus) (open?chatPicker.querySelector('[data-chat="'+activeChat+'"]'):backButton).focus({preventScroll:true});
  }
  function setScreen(screen, title) {
    [...app.children].forEach(child => {
      child.inert = child !== screen && !child.classList.contains('chat-toast');
    });
    document.title = title+' — PWA-макет';
    app.setAttribute('aria-label', title+' · Liquid Glass');
  }
  function renderAvatar(host, avatar, name) {
    host.replaceChildren();
    if(avatar) {
      const image = document.createElement('img');
      image.src = avatar;
      image.alt = '';
      host.append(image);
    } else {
      host.textContent = Array.from(name.trim())[0]?.toLocaleUpperCase('ru') || 'Я';
    }
  }
  function updateProfileDraft() {
    const name = profileName.value.trim() || profile.name;
    renderAvatar(root.querySelector('[data-settings-avatar]'), draftAvatar, name);
    root.querySelector('.chat-profile-name').textContent = name;
    root.querySelector('.chat-profile-login').textContent = '@'+(profileLogin.value.trim() || profile.login);
    root.querySelector('[data-action="avatar-remove"]').hidden = !draftAvatar;
    root.querySelector('.chat-settings-save').disabled = !(
      profileName.value.trim() !== profile.name || profileLogin.value.trim() !== profile.login ||
      draftAvatar !== profile.avatar || profilePassword.value || profilePasswordRepeat.value
    );
  }
  function clearPasswordFields() {
    [profilePassword, profilePasswordRepeat].forEach(field => {
      field.value = '';
      field.required = false;
      field.setCustomValidity('');
    });
  }
  function openSettings() {
    document.activeElement?.blur();
    profileName.value = profile.name;
    profileLogin.value = profile.login;
    profileName.setCustomValidity('');
    profileLogin.setCustomValidity('');
    clearPasswordFields();
    draftAvatar = profile.avatar;
    updateProfileDraft();
    settings.hidden = false;
    settings.scrollTop = 0;
    setScreen(settings, 'Настройки');
    root.querySelector('[data-action="settings-close"]').focus({preventScroll:true});
  }
  function closeSettings(focus=true) {
    document.activeElement?.blur();
    avatarRequest++;
    if(draftAvatar && draftAvatar !== profile.avatar) URL.revokeObjectURL(draftAvatar);
    draftAvatar = profile.avatar;
    avatarFile.value = '';
    clearPasswordFields();
    clearTimeout(toastTimer);
    root.querySelector('.chat-toast').hidden = true;
    settings.hidden = true;
    setScreen(chatPicker, 'Чаты');
    if(focus) profileButton.focus({preventScroll:true});
  }
  function removeAvatar() {
    avatarRequest++;
    if(draftAvatar && draftAvatar !== profile.avatar) URL.revokeObjectURL(draftAvatar);
    draftAvatar = '';
    updateProfileDraft();
  }
  avatarFile.addEventListener('change', () => {
    const file = avatarFile.files[0];
    avatarFile.value = '';
    if(!file) return;
    const request = ++avatarRequest;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if(request !== avatarRequest || settings.hidden) { URL.revokeObjectURL(url); return; }
      if(draftAvatar && draftAvatar !== profile.avatar) URL.revokeObjectURL(draftAvatar);
      draftAvatar = url;
      updateProfileDraft();
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      if(request === avatarRequest && !settings.hidden) toast('Не удалось открыть фото. Попробуйте другое изображение.');
    };
    image.src = url;
  });
  profileForm.addEventListener('input', () => {
    profileName.setCustomValidity('');
    profileLogin.setCustomValidity('');
    profilePassword.required = Boolean(profilePasswordRepeat.value);
    profilePasswordRepeat.required = Boolean(profilePassword.value);
    profilePasswordRepeat.setCustomValidity(profilePasswordRepeat.value && profilePassword.value !== profilePasswordRepeat.value ? 'Пароли не совпадают.' : '');
    updateProfileDraft();
  });
  profileForm.addEventListener('submit', event => {
    event.preventDefault();
    profileName.setCustomValidity(profileName.value.trim() ? '' : 'Укажите имя.');
    profileLogin.setCustomValidity(profileLogin.value.trim() ? '' : 'Укажите логин.');
    if(!profileForm.reportValidity()) return;
    const passwordChanged = Boolean(profilePassword.value);
    const oldAvatar = profile.avatar;
    profile.name = profileName.value.trim();
    profile.login = profileLogin.value.trim();
    profile.avatar = draftAvatar;
    if(oldAvatar && oldAvatar !== profile.avatar) URL.revokeObjectURL(oldAvatar);
    root.querySelectorAll('[data-user-avatar]').forEach(host => renderAvatar(host, profile.avatar, profile.name));
    clearPasswordFields();
    updateProfileDraft();
    toast(passwordChanged ? 'Профиль обновлён · смена пароля показана без сохранения' : 'Профиль обновлён в макете');
  });
  function openChat(chatId) {
    const next = chats[chatId];
    if(!next) return;
    document.activeElement?.blur();
    toggleMenu(false);
    closeComposer();
    if(voiceTimer) stopVoice();
    if(!searchPanel.hidden) toggleSearch(false);
    if(chatId !== activeChat) {
      chats[activeChat].nodes = [...history.childNodes];
      chats[activeChat].draft = input.value;
      activeChat = chatId;
      history.replaceChildren(...next.nodes);
      input.value = next.draft;
      root.querySelector('.chat-heading-name').textContent = next.name;
      const subtitle = root.querySelector('.chat-heading-sub');
      subtitle.textContent = next.members;
      subtitle.title = next.members;
      const avatar = root.querySelector('.chat-family-pill .chat-group-avatar');
      avatar.textContent = next.avatar;
      avatar.classList.toggle('chat-friends-avatar', chatId === 'friends');
      history.setAttribute('aria-label', 'Сообщения чата «'+next.name+'», прокручиваемая лента');
      input.setAttribute('aria-label', 'Сообщение в чат «'+next.name+'»');
      history.querySelectorAll('.chat-wave').forEach(wave);
      updateComposer();
      icons();
    }
    setChatPicker(false);
    requestAnimationFrame(scrollToLatest);
  }
  function renderSearch() {
    const query=searchInput.value.trim().toLocaleLowerCase('ru'); matches=[];
    root.querySelectorAll('[data-searchable]').forEach(element=> {
      const source=element.dataset.original||element.textContent;
      element.dataset.original=source; element.textContent=source;
      element.closest('.chat-message').classList.remove('chat-search-current');
      if(!query) return;
      const lower=source.toLocaleLowerCase('ru'); let start=0, index=lower.indexOf(query);
      if(index<0) return;
      element.replaceChildren();
      while(index>=0) { element.append(document.createTextNode(source.slice(start,index))); const mark=document.createElement('mark'); mark.textContent=source.slice(index,index+query.length); element.append(mark); start=index+query.length; index=lower.indexOf(query,start); }
      element.append(document.createTextNode(source.slice(start))); matches.push(element.closest('.chat-message'));
    });
    activeMatch=0; updateMatch();
    root.querySelectorAll('[data-action="search-prev"],[data-action="search-next"]').forEach(button=>button.disabled=matches.length===0);
    if(!query) count.textContent='Введите слово или фразу';
  }
  function updateMatch() { matches.forEach((message,index)=>message.classList.toggle('chat-search-current',index===activeMatch)); count.textContent=matches.length?String(activeMatch+1)+' из '+matches.length+' сообщений':'Ничего не найдено'; if(matches.length){const box=matches[activeMatch].getBoundingClientRect();const frame=history.getBoundingClientRect();const style=getComputedStyle(history);const top=parseFloat(style.paddingTop);const bottom=parseFloat(style.paddingBottom);history.scrollTop+=box.top-frame.top-top-(history.clientHeight-top-bottom-box.height)/2;} }
  function toggleSearch(open) { searchPanel.hidden=!open; root.querySelector('[data-action="search-open"]').setAttribute('aria-expanded',String(open)); if(open) searchInput.focus({preventScroll:true}); else { searchInput.blur(); searchInput.value=''; renderSearch(); root.querySelector('[data-action="search-open"]').focus({preventScroll:true}); } }
  function addMessage(kind,text='') {
    const host=root.querySelector('.chat-new-message'); host.hidden=false;
    const row=document.createElement('div'); row.className='chat-message-row chat-own';
    row.innerHTML='<article class="chat-message chat-own" aria-label="Ваше сообщение"><div class="chat-message-content"></div><div class="chat-time">Сейчас<i data-lucide="check" aria-label="Отправлено в макете"></i></div></article>';
    host.append(row); host.style.display='flex'; host.style.flexDirection='column';host.style.gap='4px';
    const content=row.querySelector('.chat-message-content');
    if(kind==='text') { const copy=document.createElement('div'); copy.className='chat-copy'; copy.dataset.searchable=''; copy.textContent=text; content.append(copy); }
    if(kind==='photo'||kind==='video') {
      const sample=root.querySelector(kind==='photo'?'[data-action="photo"]':'[data-action="video"]').cloneNode(true);
      sample.style.width='180px'; content.append(sample);
    }
    if(kind==='voice') {
      const voice=document.createElement('div'); voice.className='chat-copy'; voice.dataset.searchable=''; voice.textContent='🎙 Голосовое сообщение · '+time(Math.max(1,recordSeconds)); content.append(voice);
    }
    const choice = chatPicker.querySelector('[data-chat="'+activeChat+'"]');
    choice.querySelector('.chat-choice-preview').textContent = 'Вы: '+(kind==='text'?text:kind==='photo'?'Фотография':kind==='video'?'Видео':'Голосовое сообщение');
    choice.querySelector('.chat-choice-time').textContent = 'Сейчас';
    if(!searchPanel.hidden) renderSearch(); icons(); requestAnimationFrame(scrollToLatest);
  }
  function stopRecording() { clearInterval(recordTimer); recordTimer=null; recording=false; root.querySelector('.chat-recording').hidden=true; updateComposer(); }
  function startRecording() {
    document.activeElement?.blur();
    toggleMenu(false); recording=true; recordSeconds=0; composePanel.hidden=false;
    root.querySelector('.chat-recording').hidden=false; root.querySelector('.chat-record-time').textContent='0:00';
    updateComposer();
    recordTimer=setInterval(()=>{ recordSeconds++; root.querySelector('.chat-record-time').textContent=time(recordSeconds); if(recordSeconds>=60){closeComposer();toast('Демо-запись остановлена');}},1000);
  }
  function send() { if(recording){addMessage('voice');closeComposer();toast('Демо: голосовое добавлено без записи звука');return;} const text=input.value.trim(); if(!text)return; addMessage('text',text);input.value='';closeComposer();updateComposer();toast('Демо-сообщение · видно только здесь'); }
  function stopVoice() { clearInterval(voiceTimer); voiceTimer=null; voiceElapsed=0; const button=root.querySelector('[data-action="voice-play"]'); button.setAttribute('aria-pressed','false'); buttonIcon(button,'play','Прослушать пример голосового сообщения'); root.querySelector('.chat-duration').textContent='0:12'; root.querySelectorAll('.chat-wave span').forEach(bar=>bar.dataset.active='false'); }
  function openMedia(kind,button) {
    document.activeElement?.blur();
    mediaTrigger=button; const scene=root.querySelector(kind==='photo'?'[data-action="photo"] .chat-scene':'[data-action="video"] .chat-scene').cloneNode(true);
    root.querySelector('.chat-dialog-media').replaceChildren(scene);
    root.querySelector('.chat-dialog-title').textContent=kind==='photo'?'Фотография':'Видео · 0:18';
    root.querySelector('.chat-dialog-caption').textContent=activeChat==='friends'?'Прогулка с друзьями 🌿':'Наши выходные 🍂';
    root.querySelector('.chat-dialog-note').textContent=kind==='photo'?'Иллюстрация для примера интерфейса':'Пример экрана просмотра · без видеозаписи';
    [...app.children].forEach(child=>{ if(child!==dialog) child.inert=true; }); dialog.hidden=false; dialog.querySelector('button').focus();
  }
  function closeMedia() { dialog.hidden=true; [...app.children].forEach(child=>child.inert=false); mediaTrigger?.focus(); }
  root.addEventListener('click',event=> {
    const button=event.target.closest('button[data-action]'); if(!button) return;
    const action=button.dataset.action;
    if(action==='settings-open') openSettings();
    if(action==='settings-close') closeSettings();
    if(action==='avatar-change') avatarFile.click();
    if(action==='avatar-remove') removeAvatar();
    if(action==='account-logout') {
      closeSettings(false);
      accountScreen.hidden=false;
      setScreen(accountScreen, 'Вы вышли из аккаунта');
      root.querySelector('[data-action="account-return"]').focus({preventScroll:true});
    }
    if(action==='account-return') { setChatPicker(true, false); profileButton.focus({preventScroll:true}); }
    if(action==='chats-back'){setChatPicker(true);}
    if(action==='chat-open'){openChat(button.dataset.chat);}
    if(action==='search-open'){toggleSearch(searchPanel.hidden);}
    if(action==='search-close'){toggleSearch(false);}
    if(action==='search-next'||action==='search-prev'){if(matches.length){activeMatch=(activeMatch+(action==='search-next'?1:-1)+matches.length)%matches.length;updateMatch();}}
    if(action==='main') send();
    if(action==='attach'){const open=menu.hidden; closeComposer(); toggleMenu(open);}
    if(action==='composer-action'){if(composerAction.dataset.mode==='send')send();else if(recording){closeComposer();composerAction.focus();}else startRecording();}
    if(action==='composer-close'){closeComposer();composerAction.focus();}
    if(action==='add-photo'||action==='add-video'){toggleMenu(false);addMessage(action==='add-photo'?'photo':'video');toast('Пример вложения · файлы не загружаются');}
    if(action==='photo'||action==='video') openMedia(action,button);
    if(action==='media-close') closeMedia();
    if(action==='voice-play') {
      if(voiceTimer){stopVoice();return;}
      button.setAttribute('aria-pressed','true');buttonIcon(button,'pause','Остановить пример голосового');toast('Демонстрация плеера · без звука');
      voiceTimer=setInterval(()=>{voiceElapsed++;root.querySelector('.chat-duration').textContent=time(voiceElapsed)+' / 0:12';root.querySelectorAll('.chat-wave span').forEach((bar,index)=>bar.dataset.active=String(index<waveHeights.length*voiceElapsed/12));if(voiceElapsed>=12)stopVoice();},1000);
    }
  });
  input.addEventListener('input',updateComposer);
  composerAction.addEventListener('pointerdown', event => {
    // Keep focus and the keyboard while tapping Send.
    if(composerAction.dataset.mode === 'send') event.preventDefault();
  });
  input.addEventListener('focus',()=>toggleMenu(false));
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();if(input.value.trim())send();}});
  searchInput.addEventListener('input',renderSearch);
  searchInput.addEventListener('keydown',event=>{if(event.key==='Enter'&&matches.length){event.preventDefault();activeMatch=(activeMatch+(event.shiftKey?-1:1)+matches.length)%matches.length;updateMatch();}});
  root.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!settings.hidden)closeSettings();else if(!accountScreen.hidden){setChatPicker(true,false);profileButton.focus({preventScroll:true});}else if(!chatPicker.hidden){setChatPicker(false);}else if(!dialog.hidden)closeMedia();else if(!menu.hidden)toggleMenu(false);else if(!composePanel.hidden)closeComposer();else if(!searchPanel.hidden)toggleSearch(false);}if(!dialog.hidden&&event.key==='Tab'){event.preventDefault();dialog.querySelector('button').focus();}});
  function renderDesign() { app.style.setProperty('--chat-radius',state.radius+'px');app.style.setProperty('--chat-avatar',state.avatarSize+'px');app.style.setProperty('--chat-blur',state.blur+'px'); }
  renderDesign();
  window.addEventListener('pagehide',()=>{clearInterval(recordTimer);clearInterval(voiceTimer);clearTimeout(toastTimer);},{once:true});
  icons();
  setChatPicker(true, false);
  requestAnimationFrame(scrollToLatest);
  if('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js', {scope:'./', updateViaCache:'none'})
      .then(() => navigator.serviceWorker.ready)
      .then(() => { documentRoot.dataset.offlineReady = 'true'; })
      .catch(error => { console.warn('PWA offline cache is unavailable:', error); });
  }
})();
