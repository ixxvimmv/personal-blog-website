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
    STATE_CATEGORIES = await (await fetch(`${API_URL}/api/public/categories`)).json();
    STATE_POSTS = await (await fetch(`${API_URL}/api/public/posts`)).json();
  } catch (err) { console.error('Application data synchronization offline:', err); }
}

function cat(slug) { 
  return STATE_CATEGORIES.find(c => c.slug === slug) || { name: 'Notes', class: 'cov-notes', swatch: '#8f7a5c' }; 
}
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''; }
function readingTime(post) {
  const words = (Array.isArray(post.body) ? post.body.join(" ") : String(post.body)).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 190)) + " min read";
}
function escapeHtml(str) { return str ? str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : ''; }

/* ===================================================================
   FRONTEND TEMPLATE REVIEWS ENGINE
=================================================================== */
function viewHome() {
  const featured = STATE_POSTS.filter(p => p.featured);
  const recent = STATE_POSTS.slice(0, 10);
  return `
  <section class="hero"><div class="wrap"><h1>Words, kept slowly, for whoever needs to read them.</h1></div></section>
  <section class="section"><div class="wrap"><h2>Featured writings</h2>
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:30px;">
      ${featured.length === 0 ? '<p style="color:var(--text-muted); font-size:14px;">No featured manuscripts locked.</p>' : featured.map(p => `
        <div style="background:var(--bg-alt); padding:24px; border:1px solid var(--border);">
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">${fmtDate(p.date)} · ${cat(p.category).name}</div>
          <h3 style="font-family:'Fraunces'; font-size:22px; margin:0 0 10px;"><a href="#/post/${p.slug}" style="color:inherit; text-decoration:none;">${escapeHtml(p.title)}</a></h3>
          <p style="color:var(--text-muted); font-size:14px; margin:0 0 16px;">${escapeHtml(p.excerpt)}</p>
          <a href="#/post/${p.slug}" style="color:var(--accent); text-decoration:none; font-size:14px; font-weight:500;">Read piece →</a>
        </div>`).join('')}
    </div>
  </div></section>
  <section class="section" style="border-top:1px solid var(--border);"><div class="wrap"><h2>All logs</h2>
    <div>${recent.length === 0 ? '<p style="color:var(--text-muted); font-size:14px;">Writers desk collection is empty.</p>' : recent.map(p => `<div style="padding:16px 0; border-bottom:1px solid var(--border);"><span style="font-size:13px; color:var(--text-muted); margin-right:20px;">${fmtDate(p.date)}</span><a href="#/post/${p.slug}" style="color:inherit; font-family:'Fraunces'; font-size:18px; text-decoration:none; font-weight:500;">${escapeHtml(p.title)}</a></div>`).join('')}</div>
  </div></section>`;
}

function viewPost(params) {
  const post = STATE_POSTS.find(p => p.slug === params.slug);
  if (!post) return `<div class="wrap" style="padding:80px 20px; text-align:center;"><h2>Manuscript processing layout error. Missing log.</h2><a href="#/">Return home</a></div>`;
  return `
  <article class="wrap" style="padding:60px 20px;">
    <div style="text-align:center; margin-bottom:40px;">
      <span style="color:var(--accent); text-transform:uppercase; font-size:12px; letter-spacing:1px;">${cat(post.category).name}</span>
      <h1 style="font-family:'Fraunces', serif; font-size:42px; margin:10px 0;">${escapeHtml(post.title)}</h1>
      <div style="color:var(--text-muted); font-size:14px;">${fmtDate(post.date)} · ${readingTime(post)}</div>
    </div>
    <div style="font-family:'Lora', serif; font-size:18px; line-height:1.8; max-width:650px; margin:0 auto;" class="article-body">
      ${post.body.map(b => `<p style="margin-bottom:24px;">${escapeHtml(b)}</p>`).join('')}
    </div>
  </article>`;
}

function viewAdminLogin() {
  return `
  <section class="section" style="max-width:400px; margin:80px auto; padding:20px; border:1px solid var(--border); background:var(--bg-alt);">
    <form id="admin-login-form">
      <h2 style="font-family:'Fraunces'; margin-bottom:20px;">Desk Verification</h2>
      <div style="margin-bottom:15px;"><label style="display:block; font-size:12px; margin-bottom:4px;">Identifier</label><input type="text" id="adm-user" required style="width:100%; padding:8px; border:1px solid var(--border);"></div>
      <div style="margin-bottom:20px;"><label style="display:block; font-size:12px; margin-bottom:4px;">Key Token Phrase</label><input type="password" id="adm-pass" required style="width:100%; padding:8px; border:1px solid var(--border);"></div>
      <button type="submit" style="background:var(--text); color:white; border:none; padding:10px 16px; width:100%; cursor:pointer;">Authenticate Key</button>
    </form>
  </section>`;
}

async function viewAdminDashboard() {
  if (!checkAdminAuth()) return viewAdminLogin();
  const posts = await (await fetch(`${API_URL}/api/admin/posts`, { headers: getAuthHeaders() })).json();
  return `
  <section class="wrap" style="padding:40px 20px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px; border-bottom:1px solid var(--border); padding-bottom:15px;">
      <h2>Writers Deck Logs</h2>
      <div>
        <button onclick="location.hash='#/admin/write'" style="padding:8px 14px; background:var(--accent); color:white; border:none; cursor:pointer;">New Manuscript</button>
        <button id="admin-logout-btn" style="padding:8px 14px; background:transparent; border:1px solid var(--border); margin-left:10px; cursor:pointer;">Disconnect</button>
      </div>
    </div>
    <div style="display:flex; flex-direction:column; gap:15px;">
      ${posts.length === 0 ? '<p style="color:var(--text-muted);">No logs drafted yet.</p>' : posts.map(p => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border:1px solid var(--border); background:var(--bg-alt);">
          <div><strong>${escapeHtml(p.title)}</strong> <span style="font-size:11px; text-transform:uppercase; margin-left:10px; padding:2px 6px; background:#ddd;">${p.status}</span></div>
          <div>
            <button onclick="location.hash='#/admin/edit/${p._id}'" style="padding:4px 10px; cursor:pointer; background:white; border:1px solid var(--border);">Edit</button>
            <button onclick="deletePostTarget('${p._id}')" style="padding:4px 10px; cursor:pointer; background:#c94c4c; color:white; border:none; margin-left:5px;">Delete</button>
          </div>
        </div>`).join('')}
    </div>
  </section>`;
}

async function viewAdminEditor(postId = null) {
  if (!checkAdminAuth()) return viewAdminLogin();
  let target = { title: '', slug: '', category: 'letters', excerpt: '', body: [''], status: 'draft' };
  
  if (postId) {
    const all = await (await fetch(`${API_URL}/api/admin/posts`, { headers: getAuthHeaders() })).json();
    target = all.find(p => p._id === postId) || target;
  }

  return `
  <section class="wrap" style="padding:40px 20px; max-width:700px;">
    <h2>Composition Processing Workspace</h2>
    <form id="editor-submission-form">
      <div style="margin-bottom:15px;"><label>Title</label><input type="text" id="ed-title" value="${escapeHtml(target.title)}" required style="width:100%; padding:8px;"></div>
      <div style="margin-bottom:15px;"><label>Slug</label><input type="text" id="ed-slug" value="${escapeHtml(target.slug)}" required style="width:100%; padding:8px;"></div>
      <div style="margin-bottom:15px;"><label>Category</label><select id="ed-category" style="width:100%; padding:8px;">${STATE_CATEGORIES.map(c => `<option value="${c.slug}" ${target.category === c.slug ? 'selected':''}>${c.name}</option>`).join('')}</select></div>
      <div style="margin-bottom:15px;"><label>Excerpt</label><input type="text" id="ed-excerpt" value="${escapeHtml(target.excerpt)}" required style="width:100%; padding:8px;"></div>
      <div style="margin-bottom:15px;"><label>Body Material</label><textarea id="ed-body" required style="width:100%; height:300px; padding:10px; font-family:serif; font-size:16px;">${Array.isArray(target.body) ? target.body.join('\n\n') : target.body}</textarea></div>
      <div style="margin-bottom:20px;"><label>Status Workflow Mode</label><select id="ed-status" style="width:100%; padding:8px;"><option value="draft" ${target.status==='draft'?'selected':''}>Draft Mode</option><option value="published" ${target.status==='published'?'selected':''}>Publish</option></select></div>
      <button type="submit" style="padding:10px 20px; background:var(--text); color:white; border:none; cursor:pointer;">Commit Record</button>
    </form>
  </section>`;
}

/* ===================================================================
   SYSTEM CONTROLLER DELEGATES
=================================================================== */
async function deletePostTarget(id) {
  if (!confirm('Permanently purge this manuscript layout?')) return;
  await fetch(`${API_URL}/api/admin/posts/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
  await syncApplicationState(); render();
}

/* ===================================================================
   CLIENT CORE ROUTER
=================================================================== */
const routes = { '/': viewHome, '/admin/dashboard': viewAdminDashboard, '/admin/write': () => viewAdminEditor(null) };

function matchRoute(hash) {
  if (hash.startsWith('/admin/edit/')) return { handler: () => viewAdminEditor(hash.replace('/admin/edit/', '')) };
  if (hash.startsWith('/admin/dashboard')) return { handler: viewAdminDashboard };
  if (hash.startsWith('/admin/write')) return { handler: () => viewAdminEditor(null) };
  if (hash.startsWith('/post/')) return { handler: () => viewPost({ slug: hash.replace('/post/', '') }) };
  return routes[hash] ? { handler: routes[hash] } : { handler: viewHome };
}

async function render() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const main = document.getElementById('main');
  const match = matchRoute(hash);
  
  if (match) {
    main.innerHTML = match.handler.constructor.name === 'AsyncFunction' ? await match.handler() : match.handler();
  }
  wireDynamicEvents(hash);
}

function wireDynamicEvents(hash) {
  setTimeout(() => {
    const login = document.getElementById('admin-login-form');
    if (login) {
      login.onsubmit = null; 
      login.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('adm-user').value;
        const passwordInput = document.getElementById('adm-pass').value;

        try {
          const res = await fetch(`${API_URL}/api/auth/login`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ username: usernameInput, password: passwordInput }) 
          });
          
          if (res.ok) { 
            const data = await res.json();
            localStorage.setItem('inrt_token', data.token); 
            location.hash = '#/admin/dashboard'; 
          } else { 
            const errorData = await res.json();
            alert(errorData.message || 'Authentication credentials rejected.'); 
          }
        } catch (err) {
          console.error("Login endpoint failure:", err);
          alert("Could not connect to authentication services.");
        }
      });
    }

    const logout = document.getElementById('admin-logout-btn');
    if (logout) logout.onclick = () => { localStorage.removeItem('inrt_token'); location.hash = '#/'; };

    const editor = document.getElementById('editor-submission-form');
    if (editor) {
      editor.onsubmit = null;
      editor.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = document.getElementById('ed-body').value.split('\n\n').map(p => p.trim()).filter(Boolean);
        const payload = {
          title: document.getElementById('ed-title').value,
          slug: document.getElementById('ed-slug').value,
          category: document.getElementById('ed-category').value,
          excerpt: document.getElementById('ed-excerpt').value,
          body: body,
          status: document.getElementById('ed-status').value
        };
        const isEditing = hash.includes('/admin/edit/');
        const url = isEditing ? `${API_URL}/api/admin/posts/${hash.replace('/admin/edit/', '')}` : `${API_URL}/api/admin/posts`;
        
        const res = await fetch(url, { method: isEditing ? 'PUT' : 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
        if (res.ok) { await syncApplicationState(); location.hash = '#/admin/dashboard'; }
      });
    }
  }, 50);
}

window.addEventListener('hashchange', render);
window.addEventListener('load', async () => { await syncApplicationState(); render(); });
