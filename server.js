require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

/* ===================================================================
   CONFIGURATIONS & ENVIRONMENT SYSTEM VARIABLES
=================================================================== */
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/noonereads';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_ultra_secure_editorial_secret_key';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sanctuary';

// Create a local uploads directory automatically if it doesn't exist
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

/* ===================================================================
   DATABASE LAYER (Mongoose Schemas)
=================================================================== */
const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}));

const Category = mongoose.model('Category', new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  desc: { type: String },
  swatch: { type: String, default: '#8B6F47' }
}));

const Post = mongoose.model('Post', new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: "" },
  category: { type: String, required: true },
  tags: [{ type: String }],
  date: { type: Date, default: Date.now },
  featured: { type: Boolean, default: false },
  status: { type: String, enum: ['published', 'draft', 'scheduled'], default: 'draft' },
  excerpt: { type: String, required: true },
  body: [{ type: String }],
  coverImage: { type: String, default: "" }
}, { timestamps: true }));

/* ===================================================================
   MIDDLEWARES & UPLOADS PIPELINE
=================================================================== */
const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

const checkScheduledPosts = async (req, res, next) => {
  try {
    await Post.updateMany(
      { status: 'scheduled', date: { $lte: new Date() } },
      { $set: { status: 'published' } }
    );
  } catch (err) {
    console.error('Scheduler error:', err);
  }
  next();
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use(checkScheduledPosts);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ===================================================================
   BACKEND REST API ENDPOINTS
=================================================================== */
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ message: 'Invalid credentials.' });
  }
  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

app.get('/api/public/categories', async (req, res) => res.json(await Category.find()));
app.get('/api/public/posts', async (req, res) => res.json(await Post.find({ status: 'published' }).sort({ date: -1 })));

app.get('/api/admin/posts', protect, async (req, res) => res.json(await Post.find().sort({ updatedAt: -1 })));
app.post('/api/admin/posts', protect, async (req, res) => {
  try {
    const post = new Post(req.body);
    await post.save();
    res.status(201).json(post);
  } catch (err) { res.status(400).json({ message: err.message }); }
});
app.put('/api/admin/posts/:id', protect, async (req, res) => {
  const post = await Post.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(post);
});
app.delete('/api/admin/posts/:id', protect, async (req, res) => {
  await Post.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});
app.post('/api/admin/media/upload', protect, upload.single('file'), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});

/* ===================================================================
   FRONTEND FLAT ROUTING MECHANISM (Inlined HTML/CSS/JS Engine)
=================================================================== */
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>If No One Reads This</title>
  <style>
    :root { --bg: #fbfbf9; --text: #292929; --text-muted: #757575; --border: #eaeaea; --accent: #8B6F47; }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; line-height: 1.6; }
    .wrap { max-width: 800px; margin: 0 auto; padding: 20px; }
    header { border-bottom: 1px solid var(--border); padding: 20px 0; display: flex; justify-content: space-between; align-items: center; }
    header h1 a { font-family: serif; color: var(--text); text-decoration: none; font-size: 22px; }
    nav a { margin-left: 15px; color: var(--text-muted); text-decoration: none; font-size: 14px; }
    nav a:hover { color: var(--text); }
    .hero { padding: 60px 0; border-bottom: 1px solid var(--border); }
    .hero h2 { font-family: Georgia, serif; font-size: 36px; font-weight: 400; margin: 0 0 10px; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 30px; padding: 40px 0; }
    .post-preview { text-decoration: none; color: inherit; border-bottom: 1px solid var(--border); padding-bottom: 25px; }
    .post-preview h3 { font-family: Georgia, serif; font-size: 24px; margin: 0 0 10px; }
    .meta { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
    .excerpt { color: var(--text-muted); font-size: 16px; margin: 0; }
    .article-title { font-family: Georgia, serif; font-size: 40px; margin-bottom: 10px; }
    .article-body { font-family: Georgia, serif; font-size: 18px; line-height: 1.8; color: #333; }
    .article-body p { margin-bottom: 24px; }
    .form-field { margin-bottom: 15px; }
    .form-field label { display: block; font-size: 12px; margin-bottom: 5px; text-transform: uppercase; color: var(--text-muted); }
    input[type="text"], input[type="password"], select, textarea { width: 100%; padding: 10px; border: 1px solid var(--border); background: #fff; box-sizing: border-box; font-size: 14px; }
    button { background: var(--text); color: #fff; border: none; padding: 10px 20px; cursor: pointer; font-size: 14px; }
    button:hover { background: var(--accent); }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; border-bottom: 1px solid var(--border); text-align: left; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1><a href="#/">If No One Reads This</a></h1>
      <nav>
        <a href="#/writings">Writings</a>
        <a href="#/admin/dashboard" style="border: 1px dashed var(--accent); padding: 4px 8px;">Dashboard</a>
      </nav>
    </header>
    <main id="main">Loading sanctuary...</main>
  </div>

  <script>
    let STATE_CATEGORIES = [];
    let STATE_POSTS = [];
    const API_URL = window.location.origin;

    function getHeaders() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('inrt_token') }; }
    function isAuth() { return !!localStorage.getItem('inrt_token'); }

    async function syncState() {
      STATE_CATEGORIES = await (await fetch(API_URL + '/api/public/categories')).json();
      STATE_POSTS = await (await fetch(API_URL + '/api/public/posts')).json();
    }

    const viewHome = () => \`
      <section class="hero"><h2>Words, kept slowly, for whoever needs to read them.</h2></section>
      <div class="grid">\${STATE_POSTS.map(p => \`
        <a class="post-preview" href="#/post/\${p.slug}">
          <div class="meta">\${new Date(p.date).toLocaleDateString('en-US', {month:'short', day:'numeric'})} · \${p.category}</div>
          <h3>\${p.title}</h3>
          <p class="excerpt">\${p.excerpt}</p>
        </a>
      \`).join('')}</div>\`;

    const viewPost = (slug) => {
      const p = STATE_POSTS.find(x => x.slug === slug);
      if(!p) return '<h2>Piece not found.</h2>';
      return \`<article style="padding: 40px 0;">
        <div class="meta">\${new Date(p.date).toLocaleDateString('en-US', {anonymous:'long', year:'numeric'})}</div>
        <h2 class="article-title">\${p.title}</h2>
        <div class="article-body">\${p.body.map(b => \`<p>\${b}</p>\`).join('')}</div>
      </article>\`;
    };

    const viewLogin = () => \`
      <div style="max-width:350px; margin: 60px auto;">
        <form id="login-form">
          <h2>Desk Login</h2>
          <div class="form-field"><label>Username</label><input type="text" id="user" required></div>
          <div class="form-field"><label>Password</label><input type="password" id="pass" required></div>
          <button type="submit">Verify</button>
        </form>
      </div>\`;

    async function viewDashboard() {
      if (!isAuth()) return viewLogin();
      const adminPosts = await (await fetch(API_URL + '/api/admin/posts', { headers: getHeaders() })).json();
      return \`
        <h2>Workspace Dashboard</h2>
        <button onclick="location.hash='#/admin/write'">Compose New Manuscript</button>
        <table>
          \${adminPosts.map(p => \`<tr><td>\${p.title} (<b>\${p.status}</b>)</td><td><button onclick="deletePost('\${p._id}')">Delete</button></td></tr>\`).join('')}
        </table>\`;
    }

    async function viewEditor() {
      return \`
        <h2>Write Piece</h2>
        <form id="edit-form">
          <div class="form-field"><label>Title</label><input type="text" id="t" required></div>
          <div class="form-field"><label>Slug</label><input type="text" id="s" required></div>
          <div class="form-field"><label>Category</label><select id="c">\${STATE_CATEGORIES.map(cat => \`<option value="\${cat.slug}">\${cat.name}</option>\`).join('')}</select></div>
          <div class="form-field"><label>Excerpt</label><input type="text" id="e" required></div>
          <div class="form-field"><label>Body Content (Separate paragraphs with double returns)</label><textarea id="b" rows="10" required></textarea></div>
          <div class="form-field"><label>Status</label><select id="st"><option value="draft">Draft</option><option value="published">Publish</option></select></div>
          <button type="submit">Save Log</button>
        </form>\`;
    }

    async function deletePost(id) {
      if(confirm('Delete permanently?')) {
        await fetch(API_URL + '/api/admin/posts/' + id, { method: 'DELETE', headers: getHeaders() });
        await syncState(); render();
      }
    }

    async function render() {
      const hash = location.hash.replace(/^#/, '') || '/';
      const main = document.getElementById('main');
      if (hash === '/') main.innerHTML = viewHome();
      else if (hash === '/writings') main.innerHTML = viewHome();
      else if (hash.startsWith('/post/')) main.innerHTML = viewPost(hash.replace('/post/', ''));
      else if (hash === '/admin/dashboard') main.innerHTML = await viewDashboard();
      else if (hash === '/admin/write') main.innerHTML = await viewEditor();
      
      bindEvents();
    }

    function bindEvents() {
      const lf = document.getElementById('login-form');
      if(lf) {
        lf.addEventListener('submit', async (e) => {
          e.preventDefault();
          const r = await fetch(API_URL + '/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: document.getElementById('user').value, password: document.getElementById('pass').value }) });
          if(r.ok) { localStorage.setItem('inrt_token', (await r.json()).token); location.hash = '#/admin/dashboard'; }
          else alert('Rejected Access Credentials.');
        });
      }
      const ef = document.getElementById('edit-form');
      if(ef) {
        ef.addEventListener('submit', async (e) => {
          e.preventDefault();
          const body = document.getElementById('b').value.split('\\n\\n').filter(x => x.trim());
          const payload = { title: document.getElementById('t').value, slug: document.getElementById('s').value, category: document.getElementById('c').value, excerpt: document.getElementById('e').value, body: body, status: document.getElementById('st').value };
          
          const r = await fetch(API_URL + '/api/admin/posts', { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) });
          if(r.ok) { await syncState(); location.hash = '#/admin/dashboard'; }
        });
      }
    }

    window.addEventListener('hashchange', render);
    window.addEventListener('load', async () => { await syncState(); render(); });
  </script>
</body>
</html>
  `);
});

/* ===================================================================
   SYSTEM COLD BOOT SEED DATA INTERFACE
=================================================================== */
const seedData = async () => {
  if ((await User.countDocuments()) === 0) {
    await new User({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }).save();
  }
  if ((await Category.countDocuments()) === 0) {
    await Category.insertMany([
      { slug: "letters", name: "Letters", desc: "Words addressed to someone." },
      { slug: "reflections", name: "Reflections", desc: "Slow thinking about life." },
      { slug: "poems", name: "Poems", desc: "Compressed fragments." }
    ]);
  }
};

/* ===================================================================
   SERVER SYSTEM START EXECUTION
=================================================================== */
mongoose.connect(MONGODB_URI)
  .then(() => {
    seedData();
    app.listen(PORT, () => console.log(`All-In-One Engine live at: http://localhost:${PORT}`));
  })
  .catch(err => console.error(err));
