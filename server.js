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

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/noonereads';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_ultra_secure_editorial_secret_key';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'ixxvimmv';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'karyzza';

// Create local temporary storage directory if missing
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

/* ===================================================================
   DATABASE SCHEMA ENGINE (Mongoose Models)
=================================================================== */
const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}));

const Category = mongoose.model('Category', new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  desc: { type: String },
  swatch: { type: String, default: '#8B6F47' },
  class: { type: String }
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
  isPoem: { type: Boolean, default: false },
  body: [{ type: String }],
  coverImage: { type: String, default: "" }
}, { timestamps: true }));

/* ===================================================================
   MIDDLEWARE PIPELINE
=================================================================== */
const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized session.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) { return res.status(401).json({ message: 'Invalid session profile.' }); }
};

const checkScheduledPosts = async (req, res, next) => {
  try {
    await Post.updateMany(
      { status: 'scheduled', date: { $lte: new Date() } },
      { $set: { status: 'published' } }
    );
  } catch (err) { console.error('Automated post scheduler exception:', err); }
  next();
};

const upload = multer({ storage: multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
})});

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
  if (!user) {
    return res.status(400).json({ message: 'Invalid admin credentials.' });
  }
  
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: 'Invalid admin credentials.' });
  }

  res.json({ token: jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' }) });
});

app.get('/api/public/categories', async (req, res) => res.json(await Category.find()));
app.get('/api/public/posts', async (req, res) => res.json(await Post.find({ status: 'published' }).sort({ date: -1 })));
app.get('/api/public/posts/:slug', async (req, res) => {
  const post = await Post.findOne({ slug: req.params.slug, status: 'published' });
  post ? res.json(post) : res.status(404).json({ message: 'Manuscript not found.' });
});

app.get('/api/admin/posts', protect, async (req, res) => res.json(await Post.find().sort({ updatedAt: -1 })));
app.post('/api/admin/posts', protect, async (req, res) => {
  try { const post = new Post(req.body); await post.save(); res.status(201).json(post); } 
  catch (err) { res.status(400).json({ message: err.message }); }
});
app.put('/api/admin/posts/:id', protect, async (req, res) => {
  res.json(await Post.findByIdAndUpdate(req.params.id, req.body, { new: true }));
});
app.delete('/api/admin/posts/:id', protect, async (req, res) => {
  await Post.findByIdAndDelete(req.params.id); res.json({ success: true });
});
app.post('/api/admin/media/upload', protect, upload.single('file'), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});

/* ===================================================================
   FLAT ASSET DISPATCH ROUTING (No public subfolders required)
=================================================================== */
app.get('/styles.css', (req, res) => res.sendFile(path.join(__dirname, 'styles.css')));
app.get('/app.js', (req, res) => res.sendFile(path.join(__dirname, 'app.js')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

/* ===================================================================
   SYSTEM INCEPTION & DATABASE SEEDING
=================================================================== */
const runDatabaseSeeding = async () => {
  // If your old password seed was unhashed, uncomment the line below ONCE to clear it:
  // await User.deleteMany({}); 

  if ((await User.countDocuments()) === 0) {
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await new User({ username: ADMIN_USERNAME, password: hashedPassword }).save();
    console.log(`🔑 Admin credentials initialized securely for: ${ADMIN_USERNAME}`);
  }

  if ((await Category.countDocuments()) === 0) {
    await Category.insertMany([
      { slug: "letters", name: "Letters", desc: "Words addressed to someone — sent or not.", class: "cov-letters", swatch: "#8B6F47" },
      { slug: "reflections", name: "Personal Reflections", desc: "Slow thinking about ordinary things.", class: "cov-reflections", swatch: "#5C6B5D" },
      { slug: "journal", name: "Journal Entries", desc: "Unfiltered, dated, and a little unfinished.", class: "cov-journal", swatch: "#6b7a8f" },
      { slug: "poems", name: "Poems", desc: "Short, compressed, and meant to be reread.", class: "cov-poems", swatch: "#8f5c6b" },
      { slug: "stories", name: "Stories", desc: "Fiction, mostly, but never entirely made up.", class: "cov-stories", swatch: "#7a5c8f" },
      { slug: "notes", name: "Thoughts & Notes", desc: "Fragments too small to be essays.", class: "cov-notes", swatch: "#8f7a5c" }
    ]);
  }
};

mongoose.connect(MONGODB_URI).then(() => {
  runDatabaseSeeding();
  app.listen(PORT, () => console.log(`Blogging platform listening at http://localhost:${PORT}`));
}).catch(err => console.error(err));
