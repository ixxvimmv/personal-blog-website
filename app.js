let STATE_CATEGORIES = [];
let STATE_POSTS = [];
const API_URL = window.location.origin;

function getAuthHeaders() {
  const token = localStorage.getItem('inrt_token');
  return { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' };
}
function checkAdminAuth() { return !!localStorage.getItem('inrt_token'); }

async function syncApplicationState() {
  try {
    const resCat = await fetch(`${API_URL}/api/public/categories`);
    STATE_CATEGORIES = await resCat.json();
    const resPosts = await fetch(`${API_URL}/api/public/posts`);
    STATE_POSTS = await resPosts.json();
  } catch (err) {
    console.error('State Sync Failure:', err);
  }
}

function cat(slug) { 
  return STATE_CATEGORIES.find(c => c.slug === slug) || { name: 'Thoughts & Notes', class: 'cov-notes', swatch: '#8f7a5c' }; 
}
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''; }
function readingTime(post) {
  const text = Array.isArray(post.body) ? post.body.join(" ") : String(post.body);
  return Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 190)) + " min read";
}
function coverBlock(post) {
  const c = cat(post.category);
  return post.coverImage ? `<div class="card-cover" style="background-image: url('${post.coverImage}'); background-size: cover; background-position: center;"><span class="cat-tag">${c.name}</span></div>` : `<div class="card-cover ${c.class}"><span class="cat-tag">${c.name}</span></div>`;
}
function cardHTML(post) {
  return `<a class="card" href="#/post/${post.slug}"><div class="card-body"><div class="card-meta"><span>${fmtDate(post.date)}</span><span>·</span><span>${readingTime(post)}</span></div><h3>${escapeHtml(post.title)}</h3><p class="excerpt">${escapeHtml(post.excerpt)}</p><span class="read-more">Read piece →</span></div></a>`;
}
function escapeHtml(str) { return str ? str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : ''; }

/* VIEW BLOCKS */
function viewHome() {
  const featured = STATE_POSTS.filter(p => p.featured);
  return `<section class="hero"><div class="wrap"><h1>Words, kept slowly, for whoever needs to read them.</h1></div></section><section class="section"><div class="wrap"><h2>Featured writings</h2><div class="grid-cards">${featured.map(cardHTML).join('')}</div></div></section>`;
}
function viewWritings() {
  return `<section class="section"><div class="wrap"><h2>All writings</h2><div id="writings-list">${STATE_POSTS.map(p => `<a href="#/post/${p.slug}"><h3>${escapeHtml(p.title)}</h3></a>`).join('')}</div></div></section>`;
}
function viewPost(params) {
  const post = STATE_POSTS.find(p => p.slug === params.slug);
  if (!post) return `<h2>Manuscript missing.</h2>`;
  return `<article class="wrap"><h1>${escapeHtml(post.title)}</h1><div class="article-body">${post.body.map(b => `<p>${b}</p>`).join('')}</div></article>`;
}
function viewAdminLogin() {
  return `<section class="section" style="max-width:400px; margin:auto;"><form id="admin-login-form"><h2>Admin Portal</h2><div class="form-field"><label>Username</label><input type="text" id="adm-user" required></div><div class="form-field"><label>Password</label><input type="password" id="adm-pass" required></div><button type="submit" class="btn">Login</button></form></section>`;
}
async function viewAdminDashboard() {
  if (!checkAdminAuth()) return viewAdminLogin();
  const res = await fetch(`${API_URL}/api/admin/posts`, { headers: getAuthHeaders() });
  const posts = await res.json();
  return `<section class="wrap"><h2>Workspace Dashboard</h2><button onclick="location.hash='#/admin/write'">New Piece</button><div>${posts.map(p => `<p>${escapeHtml(p.title)} - <button onclick="location.hash='#/admin/edit/${p._id}'">Edit</button></p>`).join('')}</div></section>`;
}

/* ROUTING PARSER MECHANICS */
const routes = { '/': viewHome, '/writings': viewWritings, '/admin/dashboard': viewAdminDashboard };
function matchRoute(hash) {
  if (hash.startsWith('/admin/edit/')) return { handler: () => viewAdminEditor(hash.replace('/admin/edit/', '')) };
  if (hash.startsWith('/post/')) return { handler: () => viewPost({ slug: hash.replace('/post/', '') }) };
  return routes[hash] ? { handler: routes[hash] } : null;
}
async function render() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const main = document.getElementById('main');
  const match = matchRoute(hash);
  if (match) main.innerHTML = await match.handler();
  wireEvents();
}
function wireEvents() {
  const login = document.getElementById('admin-login-form');
  if (login) {
    login.addEventListener('submit', async (e) => {
      e.preventDefault();
      const res = await fetch(`${API_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: document.getElementById('adm-user').value, password: document.getElementById('adm-pass').value }) });
      if (res.ok) { localStorage.setItem('inrt_token', (await res.json()).token); location.hash = '#/admin/dashboard'; }
    });
  }
}
window.addEventListener('hashchange', render);
window.addEventListener('load', async () => { await syncApplicationState(); render(); });
