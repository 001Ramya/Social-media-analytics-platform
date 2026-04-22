
/* ══════════════════════════════════════
   LOGIN LOGIC
══════════════════════════════════════ */
let pwVisible = false;

function togglePw() {
  pwVisible = !pwVisible;
  const inp = document.getElementById('l-pw');
  inp.type = pwVisible ? 'text' : 'password';
  document.getElementById('eye-icon').innerHTML = pwVisible
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

function clearFieldErr(inputId, errId) {
  document.getElementById(inputId).classList.remove('err');
  document.getElementById(errId).style.display = 'none';
}

function showLoginMsg(msg, type) {
  const t = document.getElementById('login-toast');
  t.textContent = msg;
  t.className = 'login-toast ' + (type || 'info');
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3000);
}

function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pw = document.getElementById('l-pw').value;
  let valid = true;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('l-email').classList.add('err');
    document.getElementById('l-email-err').style.display = 'block';
    valid = false;
  }
  if (pw.length < 6) {
    document.getElementById('l-pw').classList.add('err');
    document.getElementById('l-pw-err').style.display = 'block';
    valid = false;
  }
  if (!valid) return;
  const btn = document.getElementById('login-btn');
  btn.textContent = 'Signing in…';
  btn.disabled = true;
  setTimeout(() => {
    document.getElementById('user-initials').textContent = email.slice(0, 2).toUpperCase();
    document.getElementById('page-login').style.display = 'none';
    document.getElementById('page-dash').style.display = 'block';
    document.getElementById('page-dash').classList.remove('dash-hidden');
    window.scrollTo(0, 0);
    updateDonut(); renderTrendChart();
    btn.textContent = 'Sign in'; btn.disabled = false;
    currentUserEmail = email;
    // Try load saved data
    loadFromStorage();
  }, 900);
}

function doLogout() {
  document.getElementById('page-dash').style.display = 'none';
  document.getElementById('page-login').style.display = 'flex';
  document.getElementById('l-email').value = '';
  document.getElementById('l-pw').value = '';
  document.getElementById('result-box').style.display = 'none';
  document.getElementById('comment-input').value = '';
  document.getElementById('url-input').value = '';
  document.getElementById('bulk-result').style.display = 'none';
  document.getElementById('progress-wrap').style.display = 'none';
  counts = { good: 0, average: 0, worst: 0 };
  history = []; currentFilter = 'all';
  updateStats(); updateHistory(); updateDonut();
  window.scrollTo(0, 0);
}

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let counts = { good: 0, average: 0, worst: 0 };
let history = [];           // all analyzed comments
let currentFilter = 'all'; // 'all' | 'good' | 'average' | 'worst'
let selectedPlatform = 'Instagram';
let selectedUrlPlatform = 'Instagram';
let trendChart;
let currentUserEmail = '';

/* ══════════════════════════════════════
   PERSISTENCE  (localStorage)
══════════════════════════════════════ */
function saveToStorage() {
  try {
    localStorage.setItem('siq_counts', JSON.stringify(counts));
    // Store last 200 only
    const toSave = history.slice(0, 200).map(c => ({
      ...c, time: c.time.toISOString()
    }));
    localStorage.setItem('siq_history', JSON.stringify(toSave));
  } catch(e) {}
}

function loadFromStorage() {
  try {
    const c = localStorage.getItem('siq_counts');
    const h = localStorage.getItem('siq_history');
    if (c) counts = JSON.parse(c);
    if (h) {
      history = JSON.parse(h).map(item => ({ ...item, time: new Date(item.time) }));
    }
    updateStats(); updateHistory(); updateDonut(); renderTrendChart();
  } catch(e) {}
}

/* ══════════════════════════════════════
   PLATFORM SELECTION
══════════════════════════════════════ */
function selectPlatform(el, name) {
  document.querySelectorAll('.platform-tabs .ptab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  selectedPlatform = name;
}

function selectUrlPlatform(el, name) {
  el.closest('.platform-tabs').querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  selectedUrlPlatform = name;
}

/* ══════════════════════════════════════
   SENTIMENT CLASSIFICATION ENGINE
══════════════════════════════════════ */
const goodWords = ['love','great','amazing','excellent','awesome','fantastic','perfect','wonderful','best','brilliant','outstanding','superb','beautiful','happy','enjoy','excited','thank','helpful','kind','nice','positive','good','like','appreciate','cool','impressive','magnificent','splendid','delightful','pleased','satisfied','recommend','incredible','adorable','inspiring','lovely','refreshing','interesting','valuable','useful','informative','clear','easy','clean','smooth'];
const badWords  = ['hate','terrible','awful','horrible','worst','disgusting','trash','garbage','useless','stupid','dumb','bad','pathetic','waste','annoying','disappoint','angry','furious','never','poor','rubbish','ugly','boring','scam','fraud','fake','lie','broken','failed','error','crash','rude','offensive','misleading','wrong','incorrect','confusing','slow','buggy','spam','horrible','worse','sucks'];
const negators  = ['not','no','never','hardly','barely','cannot','can\'t','won\'t','don\'t','didn\'t'];

function classifyComment(text) {
  const lower = text.toLowerCase();
  const tokens = lower.split(/\W+/);
  let goodScore = 0, badScore = 0;

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    const prevWord = i > 0 ? tokens[i - 1] : '';
    const isNegated = negators.includes(prevWord);
    if (goodWords.includes(word)) isNegated ? badScore++ : goodScore++;
    if (badWords.includes(word))  isNegated ? goodScore++ : badScore++;
  }

  const net = goodScore - badScore;
  if (net >= 1) return { type: 'good',    score: Math.min(100, 55 + goodScore * 9) };
  if (net <= -1) return { type: 'worst',  score: Math.max(5,  45 - badScore * 9) };
  return { type: 'average', score: 38 + Math.floor(Math.random() * 24) };
}

/* ══════════════════════════════════════
   SINGLE COMMENT ANALYZE
══════════════════════════════════════ */
const icons = { good: '✓ Good', average: '~ Average', worst: '✗ Worst' };
const messages = {
  good:    'This comment carries a positive sentiment. Great engagement!',
  average: 'This comment is neutral or mixed. Could go either way.',
  worst:   'This comment has negative sentiment. May need attention.',
};
const scoreColors = { good: '#639922', average: '#BA7517', worst: '#E24B4A' };

function analyzeComment() {
  const text = document.getElementById('comment-input').value.trim();
  if (!text) return;
  const btn = document.getElementById('analyze-btn');
  btn.disabled = true; btn.textContent = 'Analyzing…';
  setTimeout(() => {
    const { type, score } = classifyComment(text);
    counts[type]++;
    history.unshift({ text, type, score, platform: selectedPlatform, time: new Date(), source: 'manual' });
    updateStats(); showResult(type, score); updateHistory(); updateDonut(); renderTrendChart();
    saveToStorage();
    btn.disabled = false; btn.textContent = 'Analyze comment';
  }, 500);
}

function showResult(type, score) {
  const box = document.getElementById('result-box');
  box.className = 'result-box ' + type;
  box.style.display = 'block';
  document.getElementById('result-badge').className = 'result-badge ' + type;
  document.getElementById('result-badge').textContent = icons[type];
  document.getElementById('result-msg').textContent = messages[type];
  document.getElementById('score-fill').style.background = scoreColors[type];
  document.getElementById('score-fill').style.width = score + '%';
  document.getElementById('score-num').textContent = score + '/100';
}

/* ══════════════════════════════════════
   BULK URL ANALYSIS
   (Demo mode — simulates fetching comments)
   In production: replace simulateFetch() with
   real API calls to your backend/scraper.
══════════════════════════════════════ */

// Sample comment pools per platform for simulation
const sampleCommentPools = {
  Instagram: [
    "Love this post! Absolutely stunning 😍","Great content as always!","This is amazing work","Thank you for sharing this","Incredible shot, love it!",
    "Not sure about this one","Looks okay I guess","Could be better tbh","Average content nothing special","Seen better honestly",
    "This is terrible","Waste of time","Worst post I've seen","Hate this type of content","Disgusting quality",
    "Wow this is brilliant!","Perfect capture!","You're so talented","This made my day","Outstanding work!",
    "I don't like the colors","Boring content","Bad quality photo","Poor editing","Disappointing",
    "Beautiful aesthetic!","So inspiring!","Keep up the great work!","This is wonderful","Really impressed",
    "Confusing caption","Not clear what this is","Wrong vibe","Fake looking","Looks edited badly",
    "Best post this week!","Absolutely love this","Fantastic content creator","Highly recommend following","So helpful thank you",
  ],
  YouTube: [
    "Best tutorial I've ever watched","This video saved my project","Crystal clear explanation, thank you!","Subscribed instantly!","Amazing content keep it up",
    "Video was too long","Audio quality could be better","Okay content I guess","Not what I expected","Somewhat helpful",
    "Terrible video waste of my time","Wrong information don't watch this","Disliked and reported","Clickbait garbage","Worst channel ever",
    "Love the editing style!","Really helpful and clear","Excellent production quality","You explain things so well","Perfect video length",
    "The intro is too slow","Some parts are boring","Confusing at times","Not very informative","Seen better content",
    "This helped me so much thank you","Brilliant explanation!","Outstanding tutorial","Highly recommend this channel","Superb content as always",
    "Bad audio quality","Poor lighting in the video","Unhelpful overall","Frustrating to watch","Did not solve my problem",
    "Incredible work on this video","You're the best creator","So happy I found this channel","Wonderful content","Loved every minute",
  ],
  LinkedIn: [
    "Great insights! Really valuable perspective","Excellent post very thought-provoking","Thank you for sharing this wisdom","Brilliant analysis as always","Highly recommend reading this",
    "Interesting take but not sure I agree","Some good points here","Average post honestly","Could have been more detailed","Seen this content before",
    "This is completely wrong","Misleading information","Hate these kinds of posts","Waste of my LinkedIn time","Poor quality post",
    "Very inspirational post!","Love this perspective","So helpful for my career","Outstanding professional advice","This is exactly what I needed",
    "Not very relevant","Okay I guess","Nothing new here","Somewhat useful","Could be better",
    "Fantastic article very well written","You always share valuable content","Impressed by your expertise","Perfect timing on this post","Wonderful professional insight",
    "Incorrect data being shared","Wrong conclusion drawn","Bad advice don't follow this","Frustrating to read","Disagree completely",
    "This is so motivating!","Brilliant career advice","You're a great thought leader","Amazing perspective thank you","Incredible post keep going",
  ],
  Twitter: [
    "This tweet is 🔥 love it","Amazing take on this issue","Brilliant as always!","Love your content!","Perfect tweet 💯",
    "Eh not sure about this","Okay I guess","Normal tweet","Could be better","Average take",
    "Terrible take delete this","Wrong and harmful","Worst tweet of the day","Hate this account","Garbage opinion",
    "This is so true!","Thank you for sharing this","Great perspective!","Highly agree with this","Outstanding point",
    "Kind of confusing","Not sure what you mean","Mixed feelings about this","Somewhat agree","Hard to tell",
    "Love this thread!","You're so right about this","Incredible insight","Best account on here","So helpful thank you",
    "Bad take","Poor argument","Wrong facts","Misleading thread","This is stupid",
    "Amazing content every day!","So happy I follow you","This made me smile","Wonderful tweet","You always say it perfectly",
  ]
};

function getRandomComments(platform, count) {
  const pool = sampleCommentPools[platform] || sampleCommentPools.Instagram;
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return result;
}

function detectPlatformFromURL(url) {
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
  if (url.includes('linkedin.com')) return 'LinkedIn';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter';
  return selectedUrlPlatform;
}

async function fetchAndAnalyzeURL() {
  const urlInput = document.getElementById('url-input').value.trim();
  if (!urlInput) {
    alert('Please paste a post URL first.');
    return;
  }

  const btn = document.getElementById('fetch-btn');
  btn.disabled = true;
  btn.textContent = 'Fetching…';

  // Auto-detect platform from URL
  const platform = detectPlatformFromURL(urlInput);

  // Determine comment count (simulate: 50–300 based on platform)
  const commentCounts = { Instagram: 150, YouTube: 200, LinkedIn: 80, Twitter: 120 };
  const totalComments = commentCounts[platform] || 100;

  // Show progress
  const progressWrap = document.getElementById('progress-wrap');
  const progressFill = document.getElementById('progress-fill');
  const progressLabel = document.getElementById('progress-label');
  const progressCount = document.getElementById('progress-count');
  const bulkResult = document.getElementById('bulk-result');

  progressWrap.style.display = 'block';
  bulkResult.style.display = 'none';
  progressFill.style.width = '0%';

  // ── BACKEND INTEGRATION POINT ──
  // In production, replace the simulation below with:
  //
  // const res = await fetch('/api/fetch-comments', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  //   body: JSON.stringify({ url: urlInput, platform })
  // });
  // const { comments } = await res.json();
  //
  // Then loop through `comments` and call classifyComment() on each.

  const comments = getRandomComments(platform, totalComments);
  let processed = 0;
  const batchSize = 10;
  const batchCounts = { good: 0, average: 0, worst: 0 };

  progressLabel.textContent = `Analyzing ${totalComments} comments from ${platform}…`;

  await new Promise(resolve => {
    function processBatch() {
      const end = Math.min(processed + batchSize, totalComments);
      for (let i = processed; i < end; i++) {
        const text = comments[i];
        const { type, score } = classifyComment(text);
        batchCounts[type]++;
        counts[type]++;
        history.unshift({
          text, type, score,
          platform,
          time: new Date(),
          source: 'bulk',
          sourceUrl: urlInput
        });
      }
      processed = end;
      const pct = Math.round((processed / totalComments) * 100);
      progressFill.style.width = pct + '%';
      progressCount.textContent = `${processed} / ${totalComments} analyzed`;

      if (processed < totalComments) {
        setTimeout(processBatch, 60);
      } else {
        resolve();
      }
    }
    setTimeout(processBatch, 80);
  });

  // Done
  progressWrap.style.display = 'none';
  btn.disabled = false;
  btn.textContent = 'Analyze URL';

  // Show bulk result
  document.getElementById('br-good').textContent  = batchCounts.good;
  document.getElementById('br-avg').textContent   = batchCounts.average;
  document.getElementById('br-worst').textContent = batchCounts.worst;
  document.getElementById('bulk-info').textContent =
    `Analyzed ${totalComments} comments from ${platform} · ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
  bulkResult.style.display = 'block';

  updateStats(); updateHistory(); updateDonut(); renderTrendChart();
  saveToStorage();
}

/* ══════════════════════════════════════
   COMMENT FILTERING
══════════════════════════════════════ */
function filterComments(type) {
  currentFilter = type;

  // Update filter buttons
  ['all','good','average','worst'].forEach(t => {
    const btn = document.getElementById('fb-' + t);
    if (btn) btn.classList.remove('active');
  });
  const activeBtn = document.getElementById('fb-' + (type === 'average' ? 'avg' : type));
  if (activeBtn) activeBtn.classList.add('active');

  // Update stat card highlight
  ['sc-good','sc-avg','sc-worst'].forEach(id => {
    const card = document.getElementById(id);
    if (card) {
      card.classList.remove('active-filter','active-good','active-average','active-worst');
    }
  });
  if (type !== 'all') {
    const idMap = { good: 'sc-good', average: 'sc-avg', worst: 'sc-worst' };
    const card = document.getElementById(idMap[type]);
    if (card) card.classList.add('active-filter', 'active-' + type);
  }

  updateHistory();
  // Scroll to history
  document.getElementById('comment-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ══════════════════════════════════════
   HISTORY + STATS
══════════════════════════════════════ */
function updateStats() {
  const total = counts.good + counts.average + counts.worst;
  document.getElementById('total-count').textContent = total;
  document.getElementById('good-count').textContent  = counts.good;
  document.getElementById('avg-count').textContent   = counts.average;
  document.getElementById('worst-count').textContent = counts.worst;
  const gp = total ? Math.round(counts.good / total * 100) : 0;
  const ap = total ? Math.round(counts.average / total * 100) : 0;
  const wp = total ? Math.round(counts.worst / total * 100) : 0;
  document.getElementById('good-pct').textContent  = gp + '%';
  document.getElementById('avg-pct').textContent   = ap + '%';
  document.getElementById('worst-pct').textContent = wp + '%';
  const max = Math.max(counts.good, counts.average, counts.worst, 1);
  document.getElementById('bar-good').style.width  = Math.round(counts.good / max * 100) + '%';
  document.getElementById('bar-avg').style.width   = Math.round(counts.average / max * 100) + '%';
  document.getElementById('bar-worst').style.width = Math.round(counts.worst / max * 100) + '%';
  document.getElementById('bar-good-n').textContent  = counts.good;
  document.getElementById('bar-avg-n').textContent   = counts.average;
  document.getElementById('bar-worst-n').textContent = counts.worst;
}

function updateHistory() {
  const list = document.getElementById('comment-list');
  const infoEl = document.getElementById('filter-info');

  let filtered = currentFilter === 'all'
    ? history
    : history.filter(c => c.type === currentFilter);

  if (!history.length) {
    list.innerHTML = '<div class="empty-msg">No comments analyzed yet. Paste a URL above or type a comment.</div>';
    infoEl.textContent = '';
    return;
  }

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-msg">No ' + currentFilter + ' comments yet.</div>';
    infoEl.textContent = '';
    return;
  }

  const label = currentFilter === 'all' ? 'all' : currentFilter;
  infoEl.textContent = `Showing ${filtered.length} ${label} comment${filtered.length !== 1 ? 's' : ''}`;

  list.innerHTML = filtered.slice(0, 50).map(c => {
    const t = c.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const preview = c.text.length > 140 ? c.text.slice(0, 140) + '…' : c.text;
    const bulkTag = c.source === 'bulk' ? ' · <b>bulk</b>' : '';
    return `<div class="comment-row">
      <div><span class="c-badge ${c.type}">${c.type.charAt(0).toUpperCase() + c.type.slice(1)}</span></div>
      <div style="flex:1">
        <div class="c-text">${escapeHtml(preview)}</div>
        <div class="c-meta">${c.platform} · ${t}${bulkTag}</div>
      </div>
      <div class="c-score">${c.score}/100</div>
    </div>`;
  }).join('');
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function clearHistory() {
  if (!confirm('Clear all comment history?')) return;
  counts = { good: 0, average: 0, worst: 0 };
  history = []; currentFilter = 'all';
  updateStats(); updateHistory(); updateDonut(); renderTrendChart();
  saveToStorage();
}

/* ══════════════════════════════════════
   EXPORT
══════════════════════════════════════ */
function exportCSV() {
  const filtered = currentFilter === 'all' ? history : history.filter(c => c.type === currentFilter);
  if (!filtered.length) { alert('No comments to export.'); return; }

  const rows = [['Text','Sentiment','Score','Platform','Time','Source']];
  filtered.forEach(c => {
    rows.push([
      '"' + c.text.replace(/"/g, '""') + '"',
      c.type,
      c.score,
      c.platform,
      c.time.toISOString(),
      c.source || 'manual'
    ]);
  });

  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sentimentiq_${currentFilter}_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function copyGoodComments() {
  const good = history.filter(c => c.type === 'good').map(c => c.text);
  if (!good.length) { alert('No good comments yet.'); return; }
  navigator.clipboard.writeText(good.join('\n\n')).then(() => {
    alert(`Copied ${good.length} good comments to clipboard!`);
  });
}

/* ══════════════════════════════════════
   DONUT CHART
══════════════════════════════════════ */
function updateDonut() {
  const canvas = document.getElementById('donut');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const total = counts.good + counts.average + counts.worst;
  ctx.clearRect(0, 0, 130, 130);
  if (!total) {
    ctx.beginPath(); ctx.arc(65, 65, 48, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(136,135,128,0.2)'; ctx.lineWidth = 16; ctx.stroke();
    return;
  }
  const segs = [
    { val: counts.good,    color: '#639922' },
    { val: counts.average, color: '#BA7517' },
    { val: counts.worst,   color: '#E24B4A' },
  ];
  let start = -Math.PI / 2;
  segs.forEach(s => {
    if (!s.val) return;
    const sweep = (s.val / total) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(65, 65, 48, start, start + sweep);
    ctx.strokeStyle = s.color; ctx.lineWidth = 16; ctx.lineCap = 'butt'; ctx.stroke();
    start += sweep;
  });
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  ctx.fillStyle = isDark ? '#f0ede6' : '#1a1a18';
  ctx.font = '500 18px DM Sans, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(total, 65, 62);
  ctx.font = '11px DM Sans, sans-serif'; ctx.fillStyle = '#888780';
  ctx.fillText('total', 65, 80);
}

/* ══════════════════════════════════════
   TREND CHART
══════════════════════════════════════ */
function generateTrendData() {
  const grouped = {};
  history.forEach(item => {
    const date = item.time.toLocaleDateString();
    if (!grouped[date]) grouped[date] = { good: 0, average: 0, worst: 0 };
    grouped[date][item.type]++;
  });
  const labels = Object.keys(grouped).slice(-14); // last 14 days
  return {
    labels,
    good:  labels.map(d => grouped[d].good),
    avg:   labels.map(d => grouped[d].average),
    worst: labels.map(d => grouped[d].worst)
  };
}

function renderTrendChart() {
  const canvas = document.getElementById('topicChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = generateTrendData();
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels.length ? data.labels : ['No data yet'],
      datasets: [
        { label: 'Good',    data: data.good,  borderColor: '#639922', backgroundColor: 'rgba(99,153,34,0.08)',  tension: 0.3, fill: true, pointRadius: 3 },
        { label: 'Average', data: data.avg,   borderColor: '#BA7517', backgroundColor: 'rgba(186,117,23,0.08)', tension: 0.3, fill: true, pointRadius: 3 },
        { label: 'Worst',   data: data.worst, borderColor: '#E24B4A', backgroundColor: 'rgba(226,75,74,0.08)',  tension: 0.3, fill: true, pointRadius: 3 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 12 } } } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

/* ══════════════════════════════════════
   THEME
══════════════════════════════════════ */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.getElementById('themeToggle').textContent = next === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('siq_theme', next);
  updateDonut();
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Restore theme
  const savedTheme = localStorage.getItem('siq_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('themeToggle').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }

  // Ctrl+Enter shortcut for single comment
  const input = document.getElementById('comment-input');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.ctrlKey) analyzeComment();
    });
  }

  // Enter key in URL input
  const urlInp = document.getElementById('url-input');
  if (urlInp) {
    urlInp.addEventListener('keydown', e => {
      if (e.key === 'Enter') fetchAndAnalyzeURL();
    });
  }

  updateDonut();
  renderTrendChart();
});
script-1.js
Displaying script-1.js.
