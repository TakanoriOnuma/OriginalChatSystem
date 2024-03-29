var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var mongoose = require('mongoose');
var moment = require('moment');

mongoose.connect(process.env.MONGOLAB_URI || 'mongodb://localhost/chat');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 各ページの読み込み
var routes = require('./routes/index');
var roomCreation = require('./routes/roomCreation');
var chat = require('./routes/chat');

// ルートの指定
app.use('/', routes);
app.use('/room-creation', roomCreation);
app.use('/chat', chat);

var Schema = mongoose.Schema;
// roomスキーマの定義
var roomSchema = new Schema({
  title    : String,
  creator  : String,
  detail   : String,
  created  : { type: Date, default: Date.now },
  password : String
});
mongoose.model('Room', roomSchema);

// chatスキーマの定義
var chatSchema = new Schema({
  roomId    : String,
  name      : String,
  text      : String,
  created   : { type: Date, default: Date.now },
  isVisible : { type: Boolean, default: false },
  position  : { type: Object, default: {x: 0, y: 0} }
});
mongoose.model('Chat', chatSchema);

// groupBoxスキーマの定義
var groupBoxSchema = new Schema({
  roomId   : String,
  title    : String,
  isExpand : { type: Boolean, default: false },
  position : Object,
  childs   : Array
});
mongoose.model('groupBox', groupBoxSchema);

// /roomにGETアクセスした時、部屋一覧を取得する
app.get('/room', function(req, res) {
  var Room = mongoose.model('Room');
  var roomId = req.query.roomId;
  // ルームIDに指定があれば
  if(roomId) {
    // ルームIDの情報のみ送る
    Room.findOne({_id : roomId}, function(err, room) {
      res.send(room);
    });
  }
  // ルームIDに指定が無ければ
  else {
    // 全てのroomを取得して送る
    Room.find({}, function(err, rooms) {
      res.send(rooms);
    });
  }
});

// /roomにPOSTアクセスしたとき、部屋を新規登録する
app.post('/room', function(req, res) {
  var title    = req.body.title;
  var creator  = req.body.creator;
  // タイトルと作成者があればMongoDBに保存
  if(title !== '' && creator !== '') {
    var Room = mongoose.model('Room');
    var room = new Room();
    room.title    = title;
    room.creator  = creator;
    room.detail   = req.body.detail;
    room.password = req.body.password;
    room.save(function(err) {
      // エラーがあれば
      if(err) {
        res.send(null);
        return;
      }
    });

    res.send(room._id);
  }
  else {
    res.send(null);
  }
});

// /chatmsgsにGETアクセスしたとき、指定したルームIDにあるチャット情報を全て取得する
app.get('/chatmsgs', function(req, res) {
  var roomId = req.query.roomId;
  var Chat = mongoose.model('Chat');
  Chat.find({roomId : roomId}, function(err, chats) {
    res.send(chats);
  });
});

// /groupboxesにGETアクセスした時、指定したルームIDにあるグループボックスを全て取得する
app.get('/groupboxes', function(req, res) {
  var roomId = req.query.roomId;
  var GroupBox = mongoose.model('groupBox');
  GroupBox.find({roomId : roomId}, function(err, groupboxes) {
    res.send(groupboxes);
  });
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
