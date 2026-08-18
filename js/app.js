/**
 * μhunt - Mobile Interactive Engine
 * Strictly adhering to SecureCoder guidelines (Zero innerHTML, safe DOM creation)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const bgCanvas = document.getElementById('bgCanvas');
  const nameInput = document.getElementById('nameInput');
  const charCounter = document.getElementById('charCounter');
  const submitBtn = document.getElementById('submitBtn');
  const formCard = document.getElementById('formCard');
  const resultWrapper = document.getElementById('resultWrapper');
  const audioToggleBtn = document.getElementById('audioToggleBtn');
  
  // Result Badge Elements
  const badgeId = document.getElementById('badgeId');
  const badgeAvatar = document.getElementById('badgeAvatar');
  const badgeName = document.getElementById('badgeName');
  const badgeTitle = document.getElementById('badgeTitle');
  const statAgility = document.getElementById('statAgility');
  const statCipher = document.getElementById('statCipher');
  const statPower = document.getElementById('statPower');
  
  // Action Buttons
  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');
  const recentChips = document.getElementById('recentChips');
  const toastMsg = document.getElementById('toastMsg');

  // Audio Context (Synthesizer for UI sound FX)
  let audioCtx = null;
  let soundEnabled = true;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSound(type) {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'success') {
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        freqs.forEach((freq, idx) => {
          const subOsc = audioCtx.createOscillator();
          const subGain = audioCtx.createGain();
          subOsc.connect(subGain);
          subGain.connect(audioCtx.destination);
          
          subOsc.type = 'triangle';
          const startTime = now + idx * 0.06;
          subOsc.frequency.setValueAtTime(freq, startTime);
          subGain.gain.setValueAtTime(0.2, startTime);
          subGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
          
          subOsc.start(startTime);
          subOsc.stop(startTime + 0.2);
        });
      } else if (type === 'reset') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch (e) {
      // Ignore audio autoplay restrictions
    }
  }

  // Audio Toggle Button
  if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      audioToggleBtn.classList.toggle('active', soundEnabled);
      showToast(soundEnabled ? 'Audio FX Enabled 🔊' : 'Audio FX Muted 🔇');
      if (soundEnabled) playSound('click');
    });
  }

  // Input Character Counter
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (charCounter) {
        charCounter.textContent = `${val.length}/32`;
      }
      playSound('click');
    });

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleNameSubmit();
      }
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleNameSubmit();
    });
  }

  // Hash Function for Hunter Stats
  function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return Math.abs(hash);
  }

  const HUNTER_TITLES = [
    'QUANTUM VANGUARD',
    'CYBER PHANTOM',
    'NEXUS CIPHER',
    'STEALTH SPECTRE',
    'CHRONO SEEKER',
    'NEURAL ARCHITECT',
    'SOLAR ECLIPSE',
    'VOID HUNTER'
  ];

  let currentHunterData = null;

  async function handleNameSubmit() {
    const rawName = nameInput.value.trim();
    if (!rawName) {
      showToast('Please enter your name to start! ⚡');
      nameInput.focus();
      return;
    }

    playSound('success');

    const hash = hashString(rawName);
    const idNum = 1000 + (hash % 9000);
    const titleIndex = hash % HUNTER_TITLES.length;
    const title = HUNTER_TITLES[titleIndex];

    const agility = 75 + (hash % 25);
    const cipher = 80 + ((hash >> 2) % 20);
    const power = 70 + ((hash >> 4) % 30);

    const initial = rawName.charAt(0).toUpperCase();

    currentHunterData = {
      name: rawName,
      id: `µ-${idNum}`,
      title: title,
      initial: initial,
      agility: agility,
      cipher: cipher,
      power: power,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Render Badge Safely
    badgeId.textContent = currentHunterData.id;
    badgeAvatar.textContent = currentHunterData.initial;
    badgeName.textContent = currentHunterData.name;
    badgeTitle.textContent = `⚡ ${currentHunterData.title}`;
    statAgility.textContent = `${currentHunterData.agility}%`;
    statCipher.textContent = `${currentHunterData.cipher}%`;
    statPower.textContent = `${currentHunterData.power}%`;

    // Transition UI
    formCard.style.display = 'none';
    resultWrapper.classList.add('active');

    // Save to MongoDB via Server API
    try {
      const response = await fetch('/api/hunters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentHunterData.name,
          hunterId: currentHunterData.id,
          title: currentHunterData.title,
          stats: {
            agility: currentHunterData.agility,
            cipher: currentHunterData.cipher,
            power: currentHunterData.power
          }
        })
      });

      const resData = await response.json();
      if (resData.savedToMongo) {
        showToast(`Saved to MongoDB @ ${resData.data.formattedTime}! 🍃`);
      } else {
        showToast(`Welcome, Hunter ${currentHunterData.name}! 🎯`);
      }
    } catch (apiErr) {
      showToast(`Welcome, Hunter ${currentHunterData.name}! 🎯`);
    }

    saveRecentHunterLocal(currentHunterData.name);
    loadRecentHunters();
  }

  // Reset / Hunt Again
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      playSound('reset');
      resultWrapper.classList.remove('active');
      formCard.style.display = 'block';
      nameInput.value = '';
      if (charCounter) charCounter.textContent = '0/32';
      nameInput.focus();
    });
  }

  // Download Badge Image
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (!currentHunterData) return;
      playSound('click');
      generateBadgeImage(currentHunterData);
    });
  }

  function generateBadgeImage(data) {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    const bgGrad = ctx.createLinearGradient(0, 0, 600, 360);
    bgGrad.addColorStop(0, '#0c1024');
    bgGrad.addColorStop(1, '#070914');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 600, 360);

    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 580, 340);

    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('μhunt PROTOCOL', 35, 55);

    ctx.fillStyle = 'rgba(0, 242, 254, 0.15)';
    ctx.fillRect(440, 30, 120, 35);
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 1;
    ctx.strokeRect(440, 30, 120, 35);

    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(data.id, 460, 53);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(35, 80);
    ctx.lineTo(565, 80);
    ctx.stroke();

    const avGrad = ctx.createLinearGradient(35, 110, 135, 210);
    avGrad.addColorStop(0, '#7f00ff');
    avGrad.addColorStop(1, '#00f2fe');
    ctx.fillStyle = avGrad;
    ctx.fillRect(35, 110, 100, 100);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 50px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(data.initial, 85, 180);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(data.name, 155, 145);

    ctx.fillStyle = '#00f5a0';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`⚡ ${data.title}`, 155, 180);

    const statY = 250;
    const statBoxW = 165;
    const stats = [
      { lbl: 'AGILITY', val: data.agility },
      { lbl: 'CIPHER', val: data.cipher },
      { lbl: 'POWER', val: data.power }
    ];

    stats.forEach((st, i) => {
      const x = 35 + i * 185;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(x, statY, statBoxW, 70);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeRect(x, statY, statBoxW, 70);

      ctx.fillStyle = '#00f2fe';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(`${st.val}%`, x + 15, statY + 38);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(st.lbl, x + 15, statY + 58);
    });

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `μhunt-${data.name.replace(/\s+/g, '_')}-badge.png`;
    a.click();
    showToast('Badge Image Downloaded! 📸');
  }

  // Load Recent Hunters from Backend API (MongoDB)
  async function loadRecentHunters() {
    if (!recentChips) return;

    try {
      const response = await fetch('/api/hunters');
      const data = await response.json();
      if (data && Array.isArray(data.hunters) && data.hunters.length > 0) {
        renderChips(data.hunters.map(h => ({
          name: h.name,
          time: h.formattedTime || (h.timestamp ? new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')
        })));
        return;
      }
    } catch (e) {
      // Fallback to local
    }

    renderChipsFromLocal();
  }

  function saveRecentHunterLocal(name) {
    try {
      let hunters = JSON.parse(localStorage.getItem('muhunt_recent') || '[]');
      hunters = hunters.filter(h => h.toLowerCase() !== name.toLowerCase());
      hunters.unshift(name);
      if (hunters.length > 6) hunters = hunters.slice(0, 6);
      localStorage.setItem('muhunt_recent', JSON.stringify(hunters));
    } catch (e) {}
  }

  function renderChipsFromLocal() {
    try {
      const hunters = JSON.parse(localStorage.getItem('muhunt_recent') || '[]');
      renderChips(hunters.map(h => ({ name: h, time: '' })));
    } catch (e) {}
  }

  // Safe DOM Rendering for Chips (XSS-Safe)
  function renderChips(items) {
    recentChips.replaceChildren();

    if (!items || items.length === 0) {
      const emptySpan = document.createElement('span');
      emptySpan.textContent = 'No hunters yet. Be the first!';
      emptySpan.className = 'text-dim';
      emptySpan.style.fontSize = '0.75rem';
      recentChips.appendChild(emptySpan);
      return;
    }

    items.forEach(item => {
      const chip = document.createElement('div');
      chip.className = 'hunter-chip';

      const icon = document.createElement('span');
      icon.textContent = '⚡';

      const textNode = document.createTextNode(item.name);

      chip.appendChild(icon);
      chip.appendChild(textNode);

      if (item.time) {
        const timeSpan = document.createElement('span');
        timeSpan.textContent = ` (${item.time})`;
        timeSpan.style.fontSize = '0.65rem';
        timeSpan.style.color = '#64748b';
        chip.appendChild(timeSpan);
      }

      chip.addEventListener('click', () => {
        if (nameInput) {
          nameInput.value = item.name;
          if (charCounter) charCounter.textContent = `${item.name.length}/32`;
          playSound('click');
          handleNameSubmit();
        }
      });

      recentChips.appendChild(chip);
    });
  }

  loadRecentHunters();

  // Toast Helper
  function showToast(msg) {
    if (!toastMsg) return;
    toastMsg.textContent = msg;
    toastMsg.classList.add('show');
    setTimeout(() => {
      toastMsg.classList.remove('show');
    }, 2800);
  }

  // Background Canvas Particles
  if (bgCanvas) {
    const ctx = bgCanvas.getContext('2d');
    let width = bgCanvas.width = window.innerWidth;
    let height = bgCanvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = bgCanvas.width = window.innerWidth;
      height = bgCanvas.height = window.innerHeight;
    });

    const particles = [];
    const count = Math.min(Math.floor(window.innerWidth / 15), 45);

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.2
      });
    }

    let pointerX = -1000;
    let pointerY = -1000;

    window.addEventListener('pointermove', (e) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
    });

    function drawParticles() {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        const dx = pointerX - p.x;
        const dy = pointerY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          p.x += (dx / dist) * 0.5;
          p.y += (dy / dist) * 0.5;
        }

        ctx.fillStyle = `rgba(0, 242, 254, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const pdx = p.x - p2.x;
          const pdy = p.y - p2.y;
          const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

          if (pdist < 100) {
            ctx.strokeStyle = `rgba(127, 0, 255, ${0.2 * (1 - pdist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(drawParticles);
    }

    drawParticles();
  }
});
