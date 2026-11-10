import { BASE_PITCH } from './config.js';
import { fmtTime, showErr } from './utils.js';
import { video, state, loadVideoUrl, loadSubtitleTrack, loadSubtitleFile } from './videoManager.js';
import { initAudio, resumeAudio, switchAudioTrack, resetAudioToNative } from './audioManager.js';

export function initUI(deps) {
  const { camera, renderer, lights, scene } = deps;
  const canvas = renderer.domElement;
  
  // ── Look Controls (Mouse & Touch Dragging in 3D Space) ───────────
  const look = { yaw: 0, pitch: 0, dragging: false, lx: 0, ly: 0, sens: 0.0027, my: 1.2, mp: 0.5 };
  canvas.addEventListener('mousedown', e => { 
    if (e.button !== 0) return; 
    look.dragging = true; 
    look.lx = e.clientX; 
    look.ly = e.clientY; 
  });
  window.addEventListener('mouseup', () => { look.dragging = false; });
  canvas.addEventListener('mousemove', e => {
    if (!look.dragging) return;
    look.yaw   -= (e.clientX - look.lx) * look.sens;
    look.pitch -= (e.clientY - look.ly) * look.sens;
    look.yaw   = Math.max(-look.my, Math.min(look.my, look.yaw));
    look.pitch = Math.max(-look.mp, Math.min(look.mp, look.pitch));
    look.lx = e.clientX;
    look.ly = e.clientY;
  });

  canvas.addEventListener('touchstart', e => { 
    look.dragging = true; 
    look.lx = e.touches[0].clientX; 
    look.ly = e.touches[0].clientY; 
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (!look.dragging) return;
    look.yaw   -= (e.touches[0].clientX - look.lx) * look.sens;
    look.pitch -= (e.touches[0].clientY - look.ly) * look.sens;
    look.yaw   = Math.max(-look.my, Math.min(look.my, look.yaw));
    look.pitch = Math.max(-look.mp, Math.min(look.mp, look.pitch));
    look.lx = e.touches[0].clientX;
    look.ly = e.touches[0].clientY;
  }, { passive: true });
  canvas.addEventListener('touchend', () => { look.dragging = false; }, { passive: true });

  // Mouse wheel FOV zoom
  let currentFov = camera.fov;
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    currentFov = Math.max(20, Math.min(110, currentFov + e.deltaY * 0.05));
    camera.fov = currentFov;
    camera.updateProjectionMatrix();
  }, { passive: false });

  let seatPitchOffset = 0;
  let seatYawOffset = 0;
  deps.updateCamera = () => {
    camera.rotation.order = 'YXZ';
    camera.rotation.y = seatYawOffset + look.yaw;
    camera.rotation.x = BASE_PITCH + seatPitchOffset + look.pitch;
  };

  // ── Toast Notification Helper ──────────────────────────────────
  let toastTimer = null;
  function showToast(msg, duration = 3500) {
    const toast = document.getElementById('app-toast');
    const toastMsg = document.getElementById('app-toast-msg');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, duration);
  }

  // ── HUD Visibility Management ──────────────────────────────────
  const hudEl = document.getElementById('hud');
  let hudTimer = null;
  function showHUD() {
    hudEl.classList.remove('hud-hidden');
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => { 
      if (!video.paused) hudEl.classList.add('hud-hidden'); 
    }, 3200);
  }
  document.addEventListener('mousemove', () => { if (state.hasVideo) showHUD(); });
  document.addEventListener('touchstart', () => { if (state.hasVideo) showHUD(); }, { passive: true });

  function togglePlay() { 
    if (!state.hasVideo) return; 
    initAudio(camera, scene, video);
    resumeAudio();
    if (video.paused) {
      video.play();
    } else {
      video.pause(); 
    }
  }

  video.addEventListener('play', () => {
    document.getElementById('play-icon').style.display = 'none';
    document.getElementById('pause-icon').style.display = 'block';
    if (lights.screenGlow) lights.screenGlow.intensity = 1.8;
  });
  video.addEventListener('pause', () => {
    document.getElementById('play-icon').style.display = 'block';
    document.getElementById('pause-icon').style.display = 'none';
    showHUD();
    if (lights.screenGlow) lights.screenGlow.intensity = 0.55;
  });
  video.addEventListener('ended', () => { 
    document.getElementById('play-icon').style.display = 'block'; 
    document.getElementById('pause-icon').style.display = 'none'; 
    showHUD(); 
  });
  video.addEventListener('seeking', () => { document.getElementById('buffering-overlay').style.display = 'flex'; });
  video.addEventListener('seeked',  () => { document.getElementById('buffering-overlay').style.display = 'none'; });
  video.addEventListener('waiting', () => { document.getElementById('buffering-overlay').style.display = 'flex'; });
  video.addEventListener('canplay', () => { document.getElementById('buffering-overlay').style.display = 'none'; });

  // ── Seek Bar & Time Display ────────────────────────────────────
  const seekBar = document.getElementById('seek-bar');
  const seekProg = document.getElementById('seek-progress');
  const seekBuf = document.getElementById('seek-buffered');
  let isSeeking = false;

  seekBar.addEventListener('mousedown',  () => { isSeeking = true; });
  seekBar.addEventListener('touchstart', () => { isSeeking = true; }, { passive: true });
  seekBar.addEventListener('input', () => {
    const t = (seekBar.value / 10000) * (video.duration || 0);
    document.getElementById('current-time').textContent = fmtTime(t);
    seekProg.style.width = (seekBar.value / 100) + '%';
  });
  seekBar.addEventListener('change', () => { 
    video.currentTime = (seekBar.value / 10000) * (video.duration || 0); 
    isSeeking = false; 
  });

  video.addEventListener('timeupdate', () => {
    if (isSeeking || !video.duration) return;
    const pv = video.currentTime / video.duration;
    seekBar.value = (pv * 10000).toFixed(0);
    seekProg.style.width = (pv * 100).toFixed(3) + '%';
    document.getElementById('current-time').textContent = fmtTime(video.currentTime);
    if (video.buffered.length > 0) { 
      const be = video.buffered.end(video.buffered.length - 1); 
      seekBuf.style.width = (be / video.duration * 100).toFixed(2) + '%'; 
    }
    if (lights.screenGlow) { 
      lights.screenGlow.intensity = 1.8 + Math.sin(video.currentTime * 0.08) * 0.15; 
    }
  });

  // ── Volume & Mute Controls ─────────────────────────────────────
  const volBar = document.getElementById('volume-bar');
  volBar.addEventListener('input', () => { 
    video.volume = volBar.value / 100; 
    video.muted = (volBar.value == 0); 
    updMute(); 
  });
  function updMute() { 
    document.getElementById('vol-icon').style.display = video.muted ? 'none' : 'block'; 
    document.getElementById('muted-icon').style.display = video.muted ? 'block' : 'none'; 
  }
  function toggleMute() { 
    video.muted = !video.muted; 
    if (!video.muted && volBar.value == 0) {
      volBar.value = 50;
      video.volume = 0.5;
    } 
    updMute(); 
  }
  document.getElementById('speed-select').addEventListener('change', e => { 
    video.playbackRate = parseFloat(e.target.value); 
  });

  // ── Fullscreen & Lighting ──────────────────────────────────────
  function toggleFS() {
    if (!document.fullscreenElement) { 
      document.documentElement.requestFullscreen().catch(() => {}); 
      document.getElementById('fs-expand').style.display = 'none'; 
      document.getElementById('fs-collapse').style.display = 'block'; 
    } else { 
      document.exitFullscreen(); 
      document.getElementById('fs-expand').style.display = 'block'; 
      document.getElementById('fs-collapse').style.display = 'none'; 
    }
  }

  let lightsOn = false;
  function toggleLights() {
    lightsOn = !lightsOn;
    const targetSpot = lightsOn ? 4000.0 : 0;
    const targetAmb  = lightsOn ? 8.0 : 1.0;
    lights.ceilSpots.forEach(s => { s.intensity = targetSpot; });
    lights.ambientLight.intensity = targetAmb;
    document.getElementById('lights-btn').classList.toggle('active', lightsOn);
  }

  document.getElementById('play-btn').addEventListener('click', togglePlay);
  document.getElementById('seek-back-btn').addEventListener('click', () => { video.currentTime = Math.max(0, video.currentTime - 10); });
  document.getElementById('seek-fwd-btn').addEventListener('click',  () => { video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); });
  document.getElementById('mute-btn').addEventListener('click', toggleMute);
  document.getElementById('lights-btn').addEventListener('click', toggleLights);
  document.getElementById('fullscreen-btn').addEventListener('click', toggleFS);

  // ── Cinema Seat Selection ──────────────────────────────────────
  document.getElementById('seat-select').addEventListener('change', (e) => {
    const val = e.target.value;
    seatYawOffset = 0;
    seatPitchOffset = 0;
    look.yaw = 0;
    look.pitch = 0;
    if (val === 'center') {
      camera.position.set(0, 2.43, 4.66); // Row 7
    } else if (val === 'front') {
      camera.position.set(0, 0.99, -1.82); // Row 1
      seatPitchOffset = 0.31;
    } else if (val === 'back') {
      camera.position.set(0, 4.11, 12.22); // Row 14
      seatPitchOffset = 0.03;
    } else if (val === 'side') {
      camera.position.set(-11.5, 2.43, 4.66); // Left side
      seatYawOffset = -0.39;
      seatPitchOffset = 0.10;
    }
  });

  // ── Audio & Subtitle Tracks Menu ───────────────────────────────
  const subsBtn = document.getElementById('subs-btn');
  const tracksMenu = document.getElementById('tracks-menu');
  if (subsBtn && tracksMenu) {
    subsBtn.addEventListener('click', () => {
      tracksMenu.style.display = tracksMenu.style.display === 'flex' ? 'none' : 'flex';
    });
  }

  function fetchMetadata(filename) {
    fetch(`/api/metadata/${encodeURIComponent(filename)}`)
      .then(r => r.json())
      .then(data => {
        const aList = document.getElementById('audio-list');
        const sList = document.getElementById('sub-list');
        if (!aList || !sList) return;
        
        aList.innerHTML = ''; 
        sList.innerHTML = '';
        
        if (!data.audioTracks || data.audioTracks.length === 0) {
          aList.innerHTML = '<div class="track-option active">Áudio Integrado (5.1 Surround / Cinema 3D)</div>';
        } else {
          const defaultUrl = `/audio/${encodeURIComponent(filename)}/${data.audioTracks[0].index}`;
          switchAudioTrack(defaultUrl);
        }
        
        if (data.audioTracks) {
          data.audioTracks.forEach((t, i) => {
            const btn = document.createElement('button');
            btn.className = 'track-option' + (i === 0 ? ' active' : '');
            btn.textContent = `${t.title} (${t.language}) - ${t.codec} [Surround 3D]`;
            btn.onclick = () => { 
              Array.from(aList.children).forEach(c => c.classList.remove('active'));
              btn.classList.add('active');
              switchAudioTrack(`/audio/${encodeURIComponent(filename)}/${t.index}`);
            };
            aList.appendChild(btn);
          });
        }

        const offBtn = document.createElement('button');
        offBtn.className = 'track-option active';
        offBtn.textContent = 'Sem Legenda';
        offBtn.onclick = () => { 
          Array.from(sList.children).forEach(c => c.classList.remove('active'));
          offBtn.classList.add('active');
          loadSubtitleTrack(null); 
        };
        sList.appendChild(offBtn);

        if (data.subtitleTracks) {
          data.subtitleTracks.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'track-option';
            btn.textContent = `${t.title} (${t.language})`;
            btn.onclick = () => { 
              Array.from(sList.children).forEach(c => c.classList.remove('active'));
              btn.classList.add('active');
              loadSubtitleTrack(`/subtitles/${encodeURIComponent(filename)}/${t.index}`); 
            };
            sList.appendChild(btn);
          });
        }
      })
      .catch(() => {
        // Fallback for files without server metadata
        setupNativeAudioTrackMenu();
      });
  }

  function setupNativeAudioTrackMenu() {
    const aList = document.getElementById('audio-list');
    const sList = document.getElementById('sub-list');
    if (aList) {
      aList.innerHTML = '<div class="track-option active">Áudio Integrado Direto (Canais 5.1 & Acústica IMAX)</div>';
    }
    if (sList && sList.children.length === 0) {
      sList.innerHTML = '<div class="track-option active">Legenda: Carregue na Central de Mídia</div>';
    }
  }

  // ── Media Hub Modal (Open / Close & Tabs) ──────────────────────
  const welcomeScreen = document.getElementById('welcome-screen');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const openBtn = document.getElementById('open-btn');
  const addMediaTopBtn = document.getElementById('add-media-top-btn');

  function openMediaModal(tabId = null) {
    welcomeScreen.style.display = 'flex';
    if (tabId) switchTab(tabId);
  }
  function closeMediaModal() {
    welcomeScreen.style.display = 'none';
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeMediaModal);
  if (openBtn) openBtn.addEventListener('click', () => {
    welcomeScreen.style.display = welcomeScreen.style.display === 'none' ? 'flex' : 'none';
  });
  if (addMediaTopBtn) addMediaTopBtn.addEventListener('click', () => openMediaModal());

  welcomeScreen.addEventListener('click', (e) => {
    if (e.target === welcomeScreen) closeMediaModal();
  });

  // Tab switching logic
  const tabButtons = document.querySelectorAll('.media-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  function switchTab(targetTabId) {
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === targetTabId);
    });
    tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === targetTabId);
    });
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // ── Tab 1: Movie Library Fetching & Searching ───────────────────
  const movieGrid = document.getElementById('movie-grid');
  const librarySearch = document.getElementById('library-search');
  const refreshLibraryBtn = document.getElementById('refresh-library-btn');
  let loadedMovies = [];

  function renderMovieGrid(filterText = '') {
    if (!movieGrid) return;
    const filter = filterText.toLowerCase().trim();
    const filtered = loadedMovies.filter(m => m.toLowerCase().includes(filter));

    movieGrid.innerHTML = '';
    if (filtered.length === 0) {
      if (loadedMovies.length === 0) {
        movieGrid.innerHTML = `
          <div class="loading-spinner">
            Nenhum filme encontrado na pasta "movies".<br>
            Use a aba <strong>Do Computador</strong> ou <strong>Link da Web</strong> para adicionar filmes!
          </div>`;
      } else {
        movieGrid.innerHTML = `<div class="loading-spinner">Nenhum filme corresponde à busca "${filterText}".</div>`;
      }
      return;
    }

    filtered.forEach(m => {
      const card = document.createElement('div');
      card.className = 'movie-card';
      const cleanTitle = m.replace(/\.(mkv|mp4|webm|mov|m4v|ogv)$/i, '');
      card.innerHTML = `
        <div class="movie-card-thumb-container">
          <img class="movie-card-thumb" src="/thumbnail/${encodeURIComponent(m)}" alt="${m}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxYTAwMDUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iI2M4YTk2ZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5DSU5FTUEgM0Q8L3RleHQ+PC9zdmc+'" />
          <div class="movie-card-play-overlay">
            <div class="movie-card-play-icon">
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        </div>
        <div class="movie-card-title" title="${m}">${cleanTitle}</div>
      `;
      card.addEventListener('click', () => {
        initAudio(camera, scene, video);
        resumeAudio();
        loadVideoUrl(`/stream/${encodeURIComponent(m)}`, m, showHUD);
        fetchMetadata(m);
        closeMediaModal();
        showToast(`🎬 Reproduzindo: ${cleanTitle}`);
      });
      movieGrid.appendChild(card);
    });
  }

  function loadMovieLibrary() {
    if (!movieGrid) return;
    movieGrid.innerHTML = '<div class="loading-spinner">Carregando filmes...</div>';
    fetch('/api/movies')
      .then(r => r.json())
      .then(movies => {
        loadedMovies = movies;
        renderMovieGrid(librarySearch ? librarySearch.value : '');
      })
      .catch(() => {
        movieGrid.innerHTML = `<div class="loading-spinner" style="color:#e74c3c">Erro ao conectar com o Servidor Local.<br>O servidor 'server.js' está ativo?</div>`;
      });
  }

  if (librarySearch) {
    librarySearch.addEventListener('input', (e) => {
      renderMovieGrid(e.target.value);
    });
  }
  if (refreshLibraryBtn) {
    refreshLibraryBtn.addEventListener('click', () => {
      loadMovieLibrary();
      showToast('🔄 Lista da biblioteca atualizada!');
    });
  }
  loadMovieLibrary();

  // ── Tab 2: Do Computador (Upload e Reprodução Direta) ───────────
  const localFileInput = document.getElementById('local-file-input');
  const browseLocalBtn = document.getElementById('browse-local-btn');
  const localDropZone = document.getElementById('local-drop-zone');
  const selectedFileCard = document.getElementById('selected-file-card');
  const selectedFileName = document.getElementById('selected-file-name');
  const selectedFileSize = document.getElementById('selected-file-size');
  const btnPlayInstant = document.getElementById('btn-play-instant');
  const btnUploadServer = document.getElementById('btn-upload-server');
  const uploadProgressWrap = document.getElementById('upload-progress-wrap');
  const uploadProgressBar = document.getElementById('upload-progress-bar');
  const uploadStatusText = document.getElementById('upload-status-text');
  const uploadPercentText = document.getElementById('upload-percent-text');

  // Subtitles
  const browseSubBtn = document.getElementById('browse-sub-btn');
  const subFileInput = document.getElementById('sub-file-input');
  const subFileName = document.getElementById('sub-file-name');

  let currentSelectedLocalFile = null;

  function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function handleFileSelected(file) {
    if (!file) return;
    currentSelectedLocalFile = file;
    selectedFileName.textContent = file.name;
    selectedFileSize.textContent = formatBytes(file.size);
    selectedFileCard.style.display = 'block';
    uploadProgressWrap.style.display = 'none';
  }

  if (browseLocalBtn && localFileInput) {
    browseLocalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      localFileInput.click();
    });
  }
  if (localDropZone && localFileInput) {
    localDropZone.addEventListener('click', () => localFileInput.click());
    localDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      localDropZone.classList.add('drag-over');
    });
    localDropZone.addEventListener('dragleave', () => {
      localDropZone.classList.remove('drag-over');
    });
    localDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      localDropZone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });
    localFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelected(e.target.files[0]);
      }
    });
  }

  // Play Instantaneously via Blob (Zero waiting, lossless original video & 3D Spatial Audio)
  if (btnPlayInstant) {
    btnPlayInstant.addEventListener('click', () => {
      if (!currentSelectedLocalFile) return;
      initAudio(camera, scene, video);
      resumeAudio();
      resetAudioToNative();

      const blobUrl = URL.createObjectURL(currentSelectedLocalFile);
      loadVideoUrl(blobUrl, currentSelectedLocalFile.name, showHUD);
      setupNativeAudioTrackMenu();
      closeMediaModal();
      showToast(`🎬 Reproduzindo ${currentSelectedLocalFile.name} no telão IMAX com som 3D!`, 4000);
    });
  }

  // Upload to Local Server Library (Permanent storage in movies/ + thumbnail)
  if (btnUploadServer) {
    btnUploadServer.addEventListener('click', () => {
      if (!currentSelectedLocalFile) return;
      uploadProgressWrap.style.display = 'block';
      uploadProgressBar.style.width = '0%';
      uploadPercentText.textContent = '0%';
      uploadStatusText.textContent = 'Enviando para a biblioteca do cinema...';
      btnUploadServer.disabled = true;

      const formData = new FormData();
      formData.append('video', currentSelectedLocalFile);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          uploadProgressBar.style.width = percent + '%';
          uploadPercentText.textContent = percent + '%';
          if (percent >= 100) {
            uploadStatusText.textContent = 'Processando vídeo e gerando miniatura no servidor...';
          }
        }
      };

      xhr.onload = () => {
        btnUploadServer.disabled = false;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            uploadStatusText.textContent = '✅ Salvo na biblioteca permanente com sucesso!';
            showToast('✅ Filme adicionado à biblioteca permanente!', 4000);
            loadMovieLibrary();
            // Start playback from server stream
            initAudio(camera, scene, video);
            resumeAudio();
            loadVideoUrl(res.streamUrl, res.filename, showHUD);
            fetchMetadata(res.filename);
            closeMediaModal();
          } catch(err) {
            uploadStatusText.textContent = 'Erro ao processar resposta do servidor.';
          }
        } else {
          uploadStatusText.textContent = 'Erro ao enviar arquivo para o servidor.';
          showErr('Falha no upload do arquivo.');
        }
      };

      xhr.onerror = () => {
        btnUploadServer.disabled = false;
        uploadStatusText.textContent = 'Erro de conexão com o servidor.';
      };

      xhr.send(formData);
    });
  }

  // External Subtitle Picker
  if (browseSubBtn && subFileInput) {
    browseSubBtn.addEventListener('click', () => subFileInput.click());
    subFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const subFile = e.target.files[0];
        subFileName.textContent = subFile.name;
        loadSubtitleFile(subFile);
        showToast(`💬 Legenda ${subFile.name} aplicada no telão 3D!`);
      }
    });
  }

  // ── Tab 3: Link da Web / URL Online ─────────────────────────────
  const webUrlInput = document.getElementById('web-url-input');
  const btnPlayUrl = document.getElementById('btn-play-url');
  const btnDownloadUrl = document.getElementById('btn-download-url');
  const urlStatus = document.getElementById('url-status');

  function playWebUrl(url, customName = null) {
    if (!url) return;
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    // Friendly detection for non-direct video page links (e.g. YouTube, Vimeo)
    const isYoutube = /(?:youtube\.com|youtu\.be)/i.test(cleanUrl);
    const isVimeo = /vimeo\.com/i.test(cleanUrl);
    if (isYoutube || isVimeo) {
      if (urlStatus) {
        urlStatus.className = 'url-status-message error';
        urlStatus.innerHTML = `⚠️ <strong>Links de páginas do YouTube / Vimeo não transmitem arquivos de vídeo brutos (.mp4).</strong><br>
        O telão IMAX 3D precisa do link direto do arquivo de vídeo (.mp4, .webm, .mkv, stream .m3u8, Dropbox, Google Drive) para projetar com texturas WebGL e som 5.1.<br>
        💡 <em>Dica: Baixe o vídeo em seu computador e arraste o arquivo para o cinema ou use a aba "Do Computador"!</em>`;
      }
      showToast('⚠️ YouTube e Vimeo bloqueiam reprodução direta no telão 3D. Use link direto ou arquivo do PC!', 6000);
      return;
    }

    initAudio(camera, scene, video);
    resumeAudio();
    resetAudioToNative();

    // Use CORS proxy to bypass cross-origin restrictions on WebGL texture & Web Audio spatialization
    const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(cleanUrl)}`;
    let displayName = customName;
    if (!displayName) {
      try {
        const u = new URL(cleanUrl);
        displayName = u.pathname.split('/').pop() || u.hostname;
      } catch(e) {
        displayName = 'Stream Online';
      }
    }

    loadVideoUrl(proxyUrl, displayName, showHUD);
    setupNativeAudioTrackMenu();
    closeMediaModal();
    showToast(`🌐 Reproduzindo stream online no telão com áudio 3D!`, 4000);
  }

  if (webUrlInput) {
    webUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (btnPlayUrl) btnPlayUrl.click();
      }
    });

    webUrlInput.addEventListener('input', () => {
      if (urlStatus) {
        urlStatus.className = 'url-status-message';
        urlStatus.textContent = '';
      }
    });
  }

  if (btnPlayUrl) {
    btnPlayUrl.addEventListener('click', () => {
      const url = webUrlInput.value.trim();
      if (!url) {
        urlStatus.className = 'url-status-message error';
        urlStatus.textContent = 'Por favor, insira uma URL válida.';
        return;
      }
      playWebUrl(url);
    });
  }

  if (btnDownloadUrl) {
    btnDownloadUrl.addEventListener('click', () => {
      const url = webUrlInput.value.trim();
      if (!url) {
        urlStatus.className = 'url-status-message error';
        urlStatus.textContent = 'Por favor, insira uma URL válida para baixar.';
        return;
      }

      urlStatus.className = 'url-status-message loading';
      urlStatus.textContent = '⏳ Baixando vídeo para o servidor local... Por favor aguarde.';
      btnDownloadUrl.disabled = true;

      fetch('/api/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      .then(r => r.json())
      .then(data => {
        btnDownloadUrl.disabled = false;
        if (data.success) {
          urlStatus.className = 'url-status-message success';
          urlStatus.textContent = `✅ ${data.filename} baixado e salvo na biblioteca!`;
          showToast(`✅ Vídeo baixado com sucesso na biblioteca!`);
          loadMovieLibrary();
          initAudio(camera, scene, video);
          resumeAudio();
          loadVideoUrl(data.streamUrl, data.filename, showHUD);
          fetchMetadata(data.filename);
          closeMediaModal();
        } else {
          urlStatus.className = 'url-status-message error';
          urlStatus.textContent = data.error || 'Erro ao baixar o vídeo.';
        }
      })
      .catch(err => {
        btnDownloadUrl.disabled = false;
        urlStatus.className = 'url-status-message error';
        urlStatus.textContent = 'Erro ao conectar ao servidor para download.';
      });
    });
  }

  // 1-Click Demo Chips
  document.querySelectorAll('.demo-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const url = chip.dataset.url;
      const name = chip.dataset.name;
      if (webUrlInput) webUrlInput.value = url;
      playWebUrl(url, name);
    });
  });

  // ── Global Drag & Drop on the Entire Cinema Window ─────────────
  const globalDragOverlay = document.getElementById('global-drag-overlay');
  let dragCounter = 0;

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (globalDragOverlay) globalDragOverlay.style.display = 'flex';
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      if (globalDragOverlay) globalDragOverlay.style.display = 'none';
    }
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (globalDragOverlay) globalDragOverlay.style.display = 'none';

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split('.').pop().toLowerCase();
      
      // If subtitle dropped
      if (['srt', 'vtt'].includes(ext)) {
        loadSubtitleFile(file);
        showToast(`💬 Legenda externa ${file.name} aplicada!`);
        return;
      }

      // If video dropped
      if (['mp4', 'mkv', 'webm', 'mov', 'm4v', 'ogv'].includes(ext)) {
        initAudio(camera, scene, video);
        resumeAudio();
        resetAudioToNative();

        const blobUrl = URL.createObjectURL(file);
        loadVideoUrl(blobUrl, file.name, showHUD);
        setupNativeAudioTrackMenu();
        closeMediaModal();
        showToast(`🎬 Reproduzindo ${file.name} no telão IMAX com som 3D!`, 4000);
      }
    }
  });

  // ── Keyboard Shortcuts ─────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    switch (e.key) {
      case ' ':          e.preventDefault(); togglePlay(); break;
      case 'ArrowLeft':  e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); break;
      case 'ArrowRight': e.preventDefault(); video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); break;
      case 'ArrowUp':    e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); volBar.value = video.volume * 100; updMute(); break;
      case 'ArrowDown':  e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); volBar.value = video.volume * 100; updMute(); break;
      case 'f': case 'F': toggleFS(); break;
      case 'l': case 'L': toggleLights(); break;
      case 'm': case 'M': toggleMute(); break;
      case 'Escape':
        closeMediaModal();
        break;
      case 'o': case 'O': 
        welcomeScreen.style.display = welcomeScreen.style.display === 'none' ? 'flex' : 'none';
        break;
    }
  });

  // ── Intro Curtains Loading Sequence ────────────────────────────
  const bar = document.getElementById('loading-bar');
  const ls = document.getElementById('loading-screen');
  let pct = 0;
  const ti = setInterval(() => {
    pct += Math.random() * 16 + 7;
    bar.style.width = Math.min(pct, 95) + '%';
    if (pct >= 95) {
      clearInterval(ti);
      bar.style.width = '100%';
      setTimeout(() => {
        ls.classList.add('curtains-open');
        setTimeout(() => { 
          ls.style.display = 'none'; 
          welcomeScreen.style.display = 'flex'; 
        }, 1800);
      }, 400);
    }
  }, 130);
}
