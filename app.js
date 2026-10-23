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
  const chatInfoButton = root.querySelector('[data-action="chat-info-open"]');
  const chatInfo = root.querySelector('.chat-info');
  const chatInfoForm = root.querySelector('#chat-info-form');
  const chatInfoName = root.querySelector('#chat-info-name');
  const chatAvatarFile = root.querySelector('#chat-info-avatar-file');
  const settings = root.querySelector('.chat-settings');
  const profileButton = root.querySelector('[data-action="settings-open"]');
  const profileForm = root.querySelector('#chat-profile-form');
  const profileName = root.querySelector('#chat-profile-name');
  const profileLogin = root.querySelector('#chat-profile-login');
  const profilePassword = root.querySelector('#chat-profile-password');
  const profilePasswordRepeat = root.querySelector('#chat-profile-password-repeat');
  const avatarFile = root.querySelector('#chat-avatar-file');
  const authScreen = root.querySelector('.chat-auth');
  const authForm = root.querySelector('#chat-auth-form');
  const authLogin = root.querySelector('#chat-auth-login');
  const authPassword = root.querySelector('#chat-auth-password');
  const authPasswordToggle = root.querySelector('[data-action="auth-password-toggle"]');
  const authError = root.querySelector('#chat-auth-error');
  // Demo-only sign-in; a real account service is not connected.
  const demoCredentials = {login:'admin', password:'admin'};
  let authenticated = false;
  // Profile edits are local to this demo page; passwords are never retained.
  const profile = {name:'Тимур', login:'admin', avatar:''};
  let draftAvatar = '', avatarRequest = 0;
  let draftChatAvatar = '', chatAvatarRequest = 0;
  const chats = {
    family: {
      name:'Семья', photo:'', members:'6 участников, 2 в сети', nodes:[...history.childNodes], draft:'',
      people:[
        {self:true, online:true},
        {name:'Мама', online:true, color:'linear-gradient(145deg, #b5a6e9, #8d7aca)'},
        {name:'Папа', online:false, color:'linear-gradient(145deg, #8ab9e5, #5e88b4)'},
        {name:'Бабушка', online:false, color:'linear-gradient(145deg, #d0ace8, #a17fc0)'},
        {name:'Дедушка', online:false, color:'linear-gradient(145deg, #9bc8b7, #659e8b)'},
        {name:'Саша', online:false, color:'linear-gradient(145deg, #e9b79c, #c28e77)'},
      ],
    },
    friends: {
      name:'Друзья', photo:'', members:'4 участника, 2 в сети', nodes:[...document.getElementById('chat-friends-history').content.cloneNode(true).childNodes], draft:'',
      people:[
        {self:true, online:true},
        {name:'Аня', online:true, color:'linear-gradient(145deg, #b5a6e9, #8d7aca)'},
        {name:'Макс', online:false, color:'linear-gradient(145deg, #8ab9e5, #5e88b4)'},
        {name:'Лена', online:false, color:'linear-gradient(145deg, #9bc8b7, #659e8b)'},
      ],
    },
  };
  let activeChat = 'family';
  const state = {radius:16,avatarSize:40,blur:42};
  const viewport = window.visualViewport;
  const documentRoot = document.documentElement;
  documentRoot.dataset.inputModality = 'pointer';
  document.addEventListener('pointerdown', () => {
    documentRoot.dataset.inputModality = 'pointer';
  }, {capture:true, passive:true});
  function preventPageZoom(event) {
    if(event.cancelable) event.preventDefault();
  }
  // WebKit may ignore the viewport zoom limits; cancel its native pinch events.
  document.addEventListener('gesturestart', preventPageZoom, {passive:false});
  document.addEventListener('gesturechange', preventPageZoom, {passive:false});
  // Trackpad pinches arrive as modified wheel events. Ordinary scrolling stays native.
  document.addEventListener('wheel', event => {
    if(event.ctrlKey || event.metaKey) preventPageZoom(event);
  }, {passive:false});
  document.addEventListener('keydown', event => {
    if((event.ctrlKey || event.metaKey) && ['+', '=', '-', '_', '0'].includes(event.key)) preventPageZoom(event);
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
    // A browser or system override may still zoom; do not mistake it for a keyboard.
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
    if(authenticated) setChatPicker(true, false);
    else showLogin();
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
    if(!authenticated) return;
    authScreen.hidden = true;
    if(open) {
      if(!chatInfo.hidden) closeChatInfo(false);
      if(!settings.hidden) closeSettings(false);
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
  function clearLoginError() {
    authError.hidden = true;
    authError.textContent = '';
    authLogin.removeAttribute('aria-invalid');
    authPassword.removeAttribute('aria-invalid');
  }
  function resetPasswordVisibility() {
    authPassword.type = 'password';
    authPasswordToggle.setAttribute('aria-pressed', 'false');
    buttonIcon(authPasswordToggle, 'eye', 'Показать пароль');
  }
  function showLogin() {
    document.activeElement?.blur();
    if(!chatInfo.hidden) closeChatInfo(false);
    if(!settings.hidden) closeSettings(false);
    if(!dialog.hidden) closeMedia();
    if(!searchPanel.hidden) toggleSearch(false);
    document.activeElement?.blur();
    toggleMenu(false);
    closeComposer();
    if(voiceTimer) stopVoice();
    clearTimeout(toastTimer);
    root.querySelector('.chat-toast').hidden = true;
    authenticated = false;
    chatPicker.hidden = true;
    authScreen.hidden = false;
    authForm.reset();
    resetPasswordVisibility();
    clearLoginError();
    authScreen.scrollTop = 0;
    setScreen(authScreen, 'Вход');
  }
  authForm.addEventListener('input', clearLoginError);
  authForm.addEventListener('submit', event => {
    event.preventDefault();
    const missingLogin = !authLogin.value.trim();
    const missingPassword = !authPassword.value;
    clearLoginError();
    if(missingLogin || missingPassword) {
      authError.textContent = missingLogin && missingPassword ? 'Введите логин и пароль.' : missingLogin ? 'Введите логин.' : 'Введите пароль.';
      authError.hidden = false;
      if(missingLogin) authLogin.setAttribute('aria-invalid', 'true');
      if(missingPassword) authPassword.setAttribute('aria-invalid', 'true');
      (missingLogin ? authLogin : authPassword).focus({preventScroll:true});
      return;
    }
    if(authLogin.value !== demoCredentials.login || authPassword.value !== demoCredentials.password) {
      authError.textContent = 'Неверный логин или пароль. Проверьте данные и попробуйте ещё раз.';
      authError.hidden = false;
      authLogin.setAttribute('aria-invalid', 'true');
      authPassword.setAttribute('aria-invalid', 'true');
      return;
    }
    authenticated = true;
    authPassword.value = '';
    resetPasswordVisibility();
    setChatPicker(true);
    chatPicker.scrollTop = 0;
  });
  authPasswordToggle.addEventListener('pointerdown', event => {
    if(document.activeElement === authPassword) event.preventDefault();
  });
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
    settings.querySelector('.chat-profile-name').textContent = name;
    settings.querySelector('.chat-profile-login').textContent = '@'+(profileLogin.value.trim() || profile.login);
    root.querySelector('[data-action="avatar-remove"]').hidden = !draftAvatar;
    profileForm.querySelector('.chat-settings-save').disabled = !(
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
  function updateChatAppearance(chatId) {
    const chat = chats[chatId];
    const choice = chatPicker.querySelector('[data-chat="'+chatId+'"]');
    choice.querySelector('.chat-choice-name').textContent = chat.name;
    choice.setAttribute('aria-label', 'Открыть чат '+chat.name);
    renderAvatar(choice.querySelector('.chat-group-avatar'), chat.photo, chat.name);
    if(chatId !== activeChat) return;
    root.querySelector('.chat-heading-name').textContent = chat.name;
    const subtitle = root.querySelector('.chat-heading-sub');
    subtitle.textContent = chat.members;
    subtitle.title = chat.members;
    const avatar = chatInfoButton.querySelector('.chat-group-avatar');
    renderAvatar(avatar, chat.photo, chat.name);
    avatar.classList.toggle('chat-friends-avatar', chatId === 'friends');
    chatInfoButton.setAttribute('aria-label', 'Настройки чата «'+chat.name+'»');
    history.setAttribute('aria-label', 'Сообщения чата «'+chat.name+'», прокручиваемая лента');
    input.setAttribute('aria-label', 'Сообщение в чат «'+chat.name+'»');
  }
  function renderChatMembers() {
    const list = chatInfo.querySelector('.chat-members-list');
    list.replaceChildren();
    const people = chats[activeChat].people;
    chatInfo.querySelector('.chat-members-count').textContent = people.length;
    people.forEach(person => {
      const name = person.self ? profile.name : person.name;
      const row = document.createElement('li');
      row.className = 'chat-member';
      const avatar = document.createElement('span');
      avatar.className = 'chat-member-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      if(person.color) avatar.style.setProperty('--member-avatar-bg', person.color);
      const face = document.createElement('span');
      face.className = 'chat-user-avatar';
      renderAvatar(face, person.self ? profile.avatar : '', name);
      avatar.append(face);
      if(person.online) {
        const dot = document.createElement('span');
        dot.className = 'chat-member-online';
        avatar.append(dot);
      }
      const copy = document.createElement('div');
      copy.className = 'chat-member-copy';
      const title = document.createElement('div');
      title.className = 'chat-member-name';
      const label = document.createElement('span');
      label.textContent = name;
      title.append(label);
      if(person.self) {
        const badge = document.createElement('span');
        badge.className = 'chat-member-self';
        badge.textContent = 'Вы';
        title.append(badge);
      }
      const status = document.createElement('span');
      status.className = 'chat-member-status'+(person.online ? ' is-online' : '');
      status.textContent = person.online ? 'в сети' : 'не в сети';
      copy.append(title, status);
      row.append(avatar, copy);
      list.append(row);
    });
  }
  function updateChatInfoDraft() {
    const chat = chats[activeChat];
    const name = chatInfoName.value.trim() || chat.name;
    const avatar = chatInfo.querySelector('[data-chat-info-avatar]');
    renderAvatar(avatar, draftChatAvatar, name);
    avatar.classList.toggle('chat-friends-avatar', activeChat === 'friends');
    chatInfo.querySelector('[data-chat-info-name]').textContent = name;
    chatInfo.querySelector('[data-chat-info-summary]').textContent = chat.members;
    chatInfo.querySelector('[data-action="chat-avatar-remove"]').hidden = !draftChatAvatar;
    chatInfoForm.querySelector('button[type="submit"]').disabled = chatInfoName.value.trim() === chat.name && draftChatAvatar === chat.photo;
  }
  function openChatInfo() {
    document.activeElement?.blur();
    toggleMenu(false);
    closeComposer();
    if(voiceTimer) stopVoice();
    if(!searchPanel.hidden) toggleSearch(false);
    clearTimeout(toastTimer);
    root.querySelector('.chat-toast').hidden = true;
    chatInfoName.value = chats[activeChat].name;
    chatInfoName.setCustomValidity('');
    draftChatAvatar = chats[activeChat].photo;
    updateChatInfoDraft();
    renderChatMembers();
    chatInfo.hidden = false;
    chatInfo.scrollTop = 0;
    setScreen(chatInfo, 'О чате «'+chats[activeChat].name+'»');
    chatInfo.querySelector('[data-action="chat-info-close"]').focus({preventScroll:true});
  }
  function closeChatInfo(focus=true) {
    document.activeElement?.blur();
    chatAvatarRequest++;
    if(draftChatAvatar && draftChatAvatar !== chats[activeChat].photo) URL.revokeObjectURL(draftChatAvatar);
    draftChatAvatar = '';
    chatAvatarFile.value = '';
    chatInfo.hidden = true;
    clearTimeout(toastTimer);
    root.querySelector('.chat-toast').hidden = true;
    setChatPicker(false, false);
    if(focus) chatInfoButton.focus({preventScroll:true});
  }
  function removeChatAvatar() {
    chatAvatarRequest++;
    if(draftChatAvatar && draftChatAvatar !== chats[activeChat].photo) URL.revokeObjectURL(draftChatAvatar);
    draftChatAvatar = '';
    updateChatInfoDraft();
  }
  chatAvatarFile.addEventListener('change', () => {
    const file = chatAvatarFile.files[0];
    chatAvatarFile.value = '';
    if(!file) return;
    const request = ++chatAvatarRequest;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if(request !== chatAvatarRequest || chatInfo.hidden) { URL.revokeObjectURL(url); return; }
      if(draftChatAvatar && draftChatAvatar !== chats[activeChat].photo) URL.revokeObjectURL(draftChatAvatar);
      draftChatAvatar = url;
      updateChatInfoDraft();
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      if(request === chatAvatarRequest && !chatInfo.hidden) toast('Не удалось открыть фото. Попробуйте другое изображение.');
    };
    image.src = url;
  });
  chatInfoName.addEventListener('input', () => {
    chatInfoName.setCustomValidity('');
    updateChatInfoDraft();
  });
  chatInfoForm.addEventListener('submit', event => {
    event.preventDefault();
    chatInfoName.setCustomValidity(chatInfoName.value.trim() ? '' : 'Укажите название чата.');
    if(!chatInfoForm.reportValidity()) return;
    const chat = chats[activeChat];
    const oldPhoto = chat.photo;
    chat.name = chatInfoName.value.trim();
    chat.photo = draftChatAvatar;
    if(oldPhoto && oldPhoto !== chat.photo) URL.revokeObjectURL(oldPhoto);
    updateChatAppearance(activeChat);
    updateChatInfoDraft();
    setScreen(chatInfo, 'О чате «'+chat.name+'»');
    toast('Настройки чата обновлены в макете');
  });
  function openChat(chatId) {
    if(!authenticated) return;
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
      history.querySelectorAll('.chat-wave').forEach(wave);
      updateComposer();
      icons();
    }
    updateChatAppearance(chatId);
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
    if(action==='auth-password-toggle') {
      const reveal = authPassword.type === 'password';
      authPassword.type = reveal ? 'text' : 'password';
      authPasswordToggle.setAttribute('aria-pressed', String(reveal));
      buttonIcon(authPasswordToggle, reveal ? 'eye-off' : 'eye', reveal ? 'Скрыть пароль' : 'Показать пароль');
      return;
    }
    if(!authenticated) return;
    if(action==='chat-info-open') openChatInfo();
    if(action==='chat-info-close') closeChatInfo();
    if(action==='chat-avatar-change') chatAvatarFile.click();
    if(action==='chat-avatar-remove') removeChatAvatar();
    if(action==='settings-open') openSettings();
    if(action==='settings-close') closeSettings();
    if(action==='avatar-change') avatarFile.click();
    if(action==='avatar-remove') removeAvatar();
    if(action==='account-logout') showLogin();
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
  document.addEventListener('keydown',event=>{if(!authenticated)return;if(event.key==='Escape'){if(!chatInfo.hidden)closeChatInfo();else if(!settings.hidden)closeSettings();else if(!chatPicker.hidden){setChatPicker(false);}else if(!dialog.hidden)closeMedia();else if(!menu.hidden)toggleMenu(false);else if(!composePanel.hidden)closeComposer();else if(!searchPanel.hidden)toggleSearch(false);}if(!dialog.hidden&&event.key==='Tab'){event.preventDefault();dialog.querySelector('button').focus();}});
  function renderDesign() { app.style.setProperty('--chat-radius',state.radius+'px');app.style.setProperty('--chat-avatar',state.avatarSize+'px');app.style.setProperty('--chat-blur',state.blur+'px'); }
  renderDesign();
  window.addEventListener('pagehide',()=>{clearInterval(recordTimer);clearInterval(voiceTimer);clearTimeout(toastTimer);},{once:true});
  icons();
  showLogin();
  requestAnimationFrame(scrollToLatest);
  if('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js', {scope:'./', updateViaCache:'none'})
      .then(() => navigator.serviceWorker.ready)
      .then(() => { documentRoot.dataset.offlineReady = 'true'; })
      .catch(error => { console.warn('PWA offline cache is unavailable:', error); });
  }
})();
