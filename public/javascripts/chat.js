var SOCKET = io();  // web socket
var ROOMID;         // 部屋のID
var CHATTEMP;       // チャットのテンプレート

$(function() {
  init();
});

// 初期化処理
function init() {
  loadParams();
  loadTemplates();
  loadTopic();
  loadChat();
  setHandlers();
}

// URLにあるパラメータの読み込み
// 読み込み内容は全てグローバル参照が出来る
function loadParams() {
  var params = getParams();
  ROOMID = params['room'];
}

// booleanから'ON'／'OFF'の文字列を返す
function getONOFF(isVisible) {
  return isVisible ? 'ON' : 'OFF';
}

// テンプレートの読み込み
function loadTemplates() {
  // テンプレートで用いるヘルパー関数の登録
  Handlebars.registerHelper('dateToStr', dateToStr);
  Handlebars.registerHelper('getONOFF', getONOFF);

  // チャットテンプレートの読み込み
  var source = $('#chat-template').html();
  CHATTEMP = Handlebars.compile(source);
}

// 部屋のタイトルと詳細情報を読み込んで表示
function loadTopic() {
  var $topic = $('#topic');

  $.get('/room', {roomId : ROOMID}, function(room) {
    $topic
      .append('<h2>' + room.title + '</h2>')
      .append(room.detail);
  });
}

// チャット情報を取得して表示
function loadChat() {
  // 出力先を指定
  var $chatlist = $('.chatlist');
  var $chatboard = $('#chatboard');

  $.get('/chatmsgs', {roomId : ROOMID}, function(chats) {
    var compiledHtml = CHATTEMP(chats);
    $chatlist.html(compiledHtml);

    // チャットボードにも登録
    $.each(chats, function(index, chat) {
      setLabel($chatboard, chat);
    });
  });
}

// チャット情報からチャットボードにラベルをセットする
function setLabel($chatboard, chat) {
  var pos = $chatboard.position();
  var $label = $('<div>').addClass('label').append(chat.text);
  $label
    .show()
    .attr('key', chat._id)
    .css({
      top:  chat.position.y + pos.top,
      left: chat.position.x + pos.left
    });
  if(!chat.isVisible) {
    $label.hide();
  }
  $chatboard.append($label);
}

// イベント群をセットする
function setHandlers() {
  // フォームからチャットの送信が来たら
  $('#fm').submit(function() {
    postChat();
    return false;
  });

  // チャットフィールドにあるチャットのボタンをクリックしたらチャットボードの表示のON／OFFを切り替えられる
  $(document).on('click', '.chatlist input', function() {
    var key = $(this).attr('key');
    SOCKET.emit('toggleChat', key);
  });

  // ラベルの移動処理
  var pos = {x: 0, y: 0};
  var $moveLabel = null;
  var $chatboard = $('#chatboard');
  $(document)
    // マウスダウン時に移動対象を取得する
    .on('mousedown', '.label', function(e) {
      $moveLabel = $(this);
      pos.x = e.pageX - $(this).position().left;
      pos.y = e.pageY - $(this).position().top;
    })
    // マウスアップ時に移動対象を外す
    .on('mouseup', '.label, body', function(e) {
      $moveLabel = null;
    })
    // マウス移動時に移動対象があれば移動する
    .on('mousemove', '.label, body', function(e) {
      if($moveLabel !== null) {
        // $moveLabel.css({
        //   left : e.pageX - pos.x,
        //   top  : e.pageY - pos.y
        // });
        // 移動情報をサーバーに送る
        SOCKET.emit('moveLabel', {
          x : e.pageX - pos.x - $chatboard.position().left,
          y : e.pageY - pos.y - $chatboard.position().top,
          chatId : $moveLabel.attr('key')
        });
      }
    });
}

// チャット内容を送信する
function postChat() {
  // フォームに入力された内容を取得
  var name = $('#name').val();
  var text = $('#text').val();

  // 入力内容のチェック
  var check = function() {
    var errMsg = '';
    // 名前についてのチェック
    if(name === '') {
      errMsg += '名前がありません。\n';
    }
    // テキストについてのチェック
    if(text === '') {
      errMsg += 'チャットがありません。\n';
    }
    return errMsg;
  };
  // お知らせ内容の削除
  var $info = $('.info');
  $info.children().remove();

  var errMsg = check();
  // 入力に問題があればエラーを表示して終了
  if(errMsg !== '') {
    // 一番後ろの改行コードを削除
    errMsg = errMsg.substring(0, errMsg.length - 1);
    // エラー内容の追加
    $.each(errMsg.split('\n'), function(index, elem) {
      $info.append($('<li>').addClass('error').append(elem));
    });
    return;
  }

  // テキストの入力項目を空にする
  $('#text').val('');

  // web socketでチャット内容を送信
  SOCKET.emit('chat', {
    roomId : ROOMID,
    name   : name,
    text   : text
  });
}

// chatというイベントを受信したらチャットを追加する
SOCKET.on('chat', function(chat) {
  // ルームIDが違うなら何もしない
  if(chat.roomId !== ROOMID) {
    return;
  }
  var $chatlist = $('.chatlist');
  var compiledHtml = CHATTEMP([chat]);
  $chatlist.append(compiledHtml);

  var $chatboard = $('#chatboard');
  setLabel($chatboard, chat);
});

// toggleChatというイベントを受信したら指定されたラベルの表示ON／OFFを切り替える
SOCKET.on('toggleChat', function(chat) {
  var $button = $('.chatlist input[key=' + chat._id + ']');
  $button.attr('value', getONOFF(chat.isVisible));

  var $label = $('.label[key=' + chat._id + ']');
  if(chat.isVisible) {
    $label.show(100);
  }
  else {
    $label.hide(100);
  }
});

// moveLabelというイベントを受信したら指定されたラベルの座標を移動する
SOCKET.on('moveLabel', function(label) {
  var pos = $('#chatboard').position();
  var $moveLabel = $('.label[key=' + label.chatId + ']');
  $moveLabel.css({
    left : label.x + pos.left,
    top  : label.y + pos.top
  });
});