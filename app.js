const express = require('express');
const app = express();
const bcrypt = require('bcrypt')
const methodOverride = require('method-override')
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')

mongoose.set('useNewUrlParser', true);
mongoose.set('useUnifiedTopology', true);

const mongoURI='mongodb://localhost:27017/inode'
mongoose.connect(mongoURI);
const conn=mongoose.connection;

let gfs;
conn.on('error', console.log.bind(console, "connection error"));
conn.once('open',()=>{
gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
console.log("connection succeeded");
})

app.use(bodyParser.json());
app.set('view-engine', 'ejs')
app.use(express.urlencoded({ extended: false }))
app.use(methodOverride('_method'))
app.use(flash())
app.use(session({
  secret: "mysecret",
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())

const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});
const upload = multer({ storage });

app.get('/', checkAuthenticated, (req, res) => {
  res.render('index.ejs', { name: req.body.name })
})

app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs')
})

app.post('/login', checkNotAuthenticated,async (req, res) => {
  try {
var query = { email: req.body.email};
conn.collection('details').find(query).toArray(function(err, result)
{
if (err) throw err;
var pass={ pass:req.body.password };
if(req.body.password==result[0]['password'])
{ 
res.redirect('/show');
//res.render('index.ejs', { name: result[0]['name'] })
}
else
{
 console.log("fail")
res.redirect('/login')
}
});
}
catch
{
res.redirect('/login')
}
})

app.get('/register', checkNotAuthenticated, (req, res) => {
  res.render('register.ejs')
})

app.post('/register', checkNotAuthenticated, async (req, res) => {
  try {
       var data = { name: req.body.name,email:req.body.email,password:req.body.password}
       conn.collection('details').insertOne(data,function(err, collection){
       if (err) throw err;
        console.log("Record inserted Successfully");
    });

    res.redirect('/login')
  } catch {
    res.redirect('/register')
  }
})

app.post('/upload', upload.single('file'), (req, res) => {
var data = {
file: req.file}
conn.collection('uploads').insertOne(data,function(err, collection){
if (err) throw err;
console.log("Record inserted Successfully");

});
  res.redirect('/');
});

app.get('/files', (req, res) => {
  gfs.files.find().toArray((err, files) => {
	//console.log(files.length)
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: 'No files exist'
      });
    }

    return res.json(files);
  });
});

app.get('/files/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }
    return res.json(file);
  });
});

app.get('/image/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }

    if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      res.status(404).json({
        err: 'Not an image'
      });
    }
  });
});

app.get('/show', (req, res) => {
  gfs.files.find().toArray((err, files) => {
    if (!files || files.length === 0) {
return res.status(404).json({
        err: 'No file exists'
    });
}
else {
      files.map(file => {
        if (
          file.contentType === 'image/jpeg' ||
          file.contentType === 'image/png'
        ) {
          file.isImage = true;
        } else {
          file.isImage = false;
        }
      });
   
      res.render('index.ejs', { files: files });
    }
  });
});

app.delete('/logout', (req, res) => {
  req.logOut()
  res.redirect('/login')
})

app.delete('/files/:filename', (req, res) => {
  gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
  var query={id: req.params.filename}
  conn.collection("uploads").remove(query, function(err, obj) {
    if (err) {
    return res.status(404).json({ err: err });
    }
     console.log(obj.result.n + " document(s) deleted");
    res.redirect('/');
  })
  });
});

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }

  res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/')
  }
  next()
}

app.listen(3000)
