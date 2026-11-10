import * as THREE from 'three';
import { ROOM_W, ROOM_H, SCR_W, SCR_Z, SCR_Y } from './config.js';

let initialized = false;
let audioListener = null;
let currentExternalAudio = null;
let currentSourceNode = null;
let videoSourceNode = null;
let videoGainNode = null;
let audioSplitter = null;
let audioCtx = null;
let mainVideo = null;
let currentExternalStartTime = 0;

// Generate a synthetic impulse response for the theatre reverb
function createImpulseResponse(duration, decay, ctx) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return impulse;
}

export function initAudio(camera, scene, video) {
  if (initialized) {
    resumeAudio();
    return;
  }

  try {
    // 1. Create listener (the user's ears) and attach to camera
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);

    const ctx = audioListener.context;

    // Insert a Master Compressor to prevent clipping when signals sum
    const masterCompressor = ctx.createDynamicsCompressor();
    masterCompressor.threshold.value = -6;
    masterCompressor.knee.value = 15;
    masterCompressor.ratio.value = 3;
    masterCompressor.attack.value = 0.005;
    masterCompressor.release.value = 0.1;

    audioListener.gain.disconnect();
    audioListener.gain.connect(masterCompressor);
    masterCompressor.connect(ctx.destination);

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    video.muted = false;
    mainVideo = video;
    audioCtx = ctx;

    videoSourceNode = ctx.createMediaElementSource(video);
    videoGainNode = ctx.createGain();
    videoGainNode.gain.value = 1.0;
    videoSourceNode.connect(videoGainNode);

    // Split source into 6 channels to support 5.1 Surround Sound
    audioSplitter = ctx.createChannelSplitter(6);
    videoGainNode.connect(audioSplitter);

    mainVideo.addEventListener('play', () => {
      if (currentExternalAudio) currentExternalAudio.play().catch(() => {});
    });
    mainVideo.addEventListener('pause', () => {
      if (currentExternalAudio) currentExternalAudio.pause();
    });
    mainVideo.addEventListener('seeking', () => {
      if (currentExternalAudio) currentExternalAudio.pause();
    });
    mainVideo.addEventListener('seeked', () => {
      if (currentExternalAudio && currentExternalAudio.dataset.rawUrl) {
        switchAudioTrack(currentExternalAudio.dataset.rawUrl);
      }
    });

    // 2. Global Theatre Reverb (Convolver)
    const convolver = ctx.createConvolver();
    convolver.buffer = createImpulseResponse(2.8, 4.0, ctx);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.08;
    convolver.connect(reverbGain);
    reverbGain.connect(audioListener.getInput());

    const reverbMix = ctx.createGain();
    audioSplitter.connect(reverbMix, 0);
    audioSplitter.connect(reverbMix, 1);
    reverbMix.connect(convolver);

    function createSpeaker(x, y, z, refDist = 12) {
      const speaker = new THREE.PositionalAudio(audioListener);
      speaker.setRefDistance(refDist);
      speaker.setRolloffFactor(1);
      speaker.setDistanceModel('exponential');
      speaker.position.set(x, y, z);
      scene.add(speaker);
      return speaker;
    }

    // 3. Front Left Speaker (Channel 0)
    const frontLeft = createSpeaker(-SCR_W / 2 - 2, SCR_Y, SCR_Z);
    const flGain = ctx.createGain();
    flGain.gain.value = 0.85;
    audioSplitter.connect(flGain, 0);
    frontLeft.setNodeSource(flGain);

    // 4. Front Right Speaker (Channel 1)
    const frontRight = createSpeaker(SCR_W / 2 + 2, SCR_Y, SCR_Z);
    const frGain = ctx.createGain();
    frGain.gain.value = 0.85;
    audioSplitter.connect(frGain, 1);
    frontRight.setNodeSource(frGain);

    // 5. Center Speaker (Channel 2 - DIALOGUE)
    const center = createSpeaker(0, SCR_Y, SCR_Z);
    const centerGain = ctx.createGain();
    centerGain.gain.value = 1.2;
    audioSplitter.connect(centerGain, 2);
    center.setNodeSource(centerGain);

    // 6. Subwoofer (Channel 3 LFE + Bass Management from L/R)
    const sub = createSpeaker(0, 0.5, SCR_Z + 2);
    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.value = 120;

    const subGain = ctx.createGain();
    subGain.gain.value = 1.0;
    audioSplitter.connect(subGain, 3);

    const bassMix = ctx.createGain();
    bassMix.gain.value = 0.5;
    audioSplitter.connect(bassMix, 0);
    audioSplitter.connect(bassMix, 1);
    bassMix.connect(subFilter);
    subFilter.connect(subGain);
    sub.setNodeSource(subGain);

    // 7. Surround Left
    const surrLeft = createSpeaker(-ROOM_W / 2 + 1, ROOM_H * 0.7, 5, 8);
    const slGain = ctx.createGain();
    slGain.gain.value = 0.7;
    audioSplitter.connect(slGain, 4);
    const slDelay = ctx.createDelay();
    slDelay.delayTime.value = 0.045;
    const slBleed = ctx.createGain();
    slBleed.gain.value = 0.15;
    audioSplitter.connect(slDelay, 0);
    slDelay.connect(slBleed);
    slBleed.connect(slGain);
    surrLeft.setNodeSource(slGain);

    // 8. Surround Right
    const surrRight = createSpeaker(ROOM_W / 2 - 1, ROOM_H * 0.7, 5, 8);
    const srGain = ctx.createGain();
    srGain.gain.value = 0.7;
    audioSplitter.connect(srGain, 5);
    const srDelay = ctx.createDelay();
    srDelay.delayTime.value = 0.045;
    const srBleed = ctx.createGain();
    srBleed.gain.value = 0.15;
    audioSplitter.connect(srDelay, 1);
    srDelay.connect(srBleed);
    srBleed.connect(srGain);
    surrRight.setNodeSource(srGain);

    initialized = true;
  } catch (err) {
    console.warn('Spatial WebAudio fallback to native audio:', err);
    initialized = true;
  }
}

export function resumeAudio() {
  if (audioListener && audioListener.context && audioListener.context.state === 'suspended') {
    audioListener.context.resume().catch(() => {});
  }
}

export function switchAudioTrack(url) {
  if (!videoGainNode) return;
  if (!url) {
    if (currentExternalAudio) {
      currentExternalAudio.pause();
      currentExternalAudio.removeAttribute('src');
      currentExternalAudio.load();
    }
    videoGainNode.gain.value = 1.0;
    return;
  }

  currentExternalStartTime = mainVideo ? mainVideo.currentTime : 0;

  if (!currentExternalAudio) {
    currentExternalAudio = new Audio();
    currentExternalAudio.crossOrigin = 'anonymous';
    currentSourceNode = audioCtx.createMediaElementSource(currentExternalAudio);
    currentSourceNode.connect(audioSplitter);
  } else {
    currentExternalAudio.pause();
    currentExternalAudio.removeAttribute('src');
    currentExternalAudio.load();
  }

  videoGainNode.gain.value = 0.0;
  currentExternalAudio.dataset.rawUrl = url;
  currentExternalAudio.src = `${url}?start=${currentExternalStartTime}`;
  currentExternalAudio.oncanplay = null;
  currentExternalAudio.onerror = (e) => {
    console.error('External audio failed to load!', e);
  };

  if (mainVideo && !mainVideo.paused) {
    currentExternalAudio.play().catch(err => console.error('Audio play failed:', err));
  }
}

export function resetAudioToNative() {
  switchAudioTrack(null);
}
