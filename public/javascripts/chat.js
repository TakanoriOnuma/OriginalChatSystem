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
      $('body').addClass('noneselect');
      console.log('label mousedown');
    })
    // マウスアップ時に移動対象を外す
    .on('mouseup', '.label, body', function(e) {
      $moveLabel = null;
      $('body').removeClass('noneselect');
    })
    // マウス移動時に移動対象があれば移動する
    .on('mousemove', '.label, body', function(e) {
      if($moveLabel !== null) {
        var newPos = { x : e.pageX - pos.x, y : e.pageY - pos.y };
        var boardPos = $chatboard.position();
        // チャットボードの左と上の枠を超えないように座標を調節する
        newPos.x = (newPos.x < boardPos.left) ? boardPos.left : newPos.x;
        newPos.y = (newPos.y < boardPos.top)  ? boardPos.top  : newPos.y;

        // チャットボードの右と下の枠は超えそうなら大きくして調節する（今は取りあえず超えないようにする）
        if(newPos.x + $moveLabel.outerWidth() > boardPos.left + $chatboard.outerWidth()) {
          newPos.x = boardPos.left + $chatboard.outerWidth() - $moveLabel.outerWidth();
        }
        if(newPos.y + $moveLabel.outerHeight() > boardPos.top + $chatboard.outerHeight()) {
          newPos.y = boardPos.top + $chatboard.outerHeight() - $moveLabel.outerHeight();
        }

        $moveLabel.css({
          left : newPos.x,
          top  : newPos.y
        });
        // 移動情報をサーバーに送る
        SOCKET.emit('moveLabel', {
          x : newPos.x - $chatboard.position().left,
          y : newPos.y - $chatboard.position().top,
          chatId : $moveLabel.attr('key')
        });
        e.stopPropagation();
      }
    });

  // ドラッグの範囲を表示する
  var $dragfield = null;
  $('#chatboard')
    // マウスダウン時に範囲の開始位置を指定する
    .mousedown(function(e) {
      // ドラッグ範囲を表示するタグを取得する
      $dragfield = $('.dragfield');
      $dragfield
        .css({
          left: e.pageX,
          top:  e.pageY
        })
        .height(0)
        .width(0);

      // ドラッグ中は文字の選択を無効にする
      $('body').addClass('noneselect');
      console.log('chatboard mousedown');
    })
    // マウスアップ時はドラッグ表示タグをnullにしておく
    .mouseup(function(e) {
      $dragfield = null;
      $('body').removeClass('noneselect');
    })
    // マウスが移動時にドラッグの範囲を変更する
    .mousemove(function(e) {
      // ドラッグ範囲を表示するタグがあり、かつラベルを移動するので無ければ処理する
      if($dragfield !== null && $moveLabel === null) {
        var pos = $dragfield.position();
        $dragfield
          .width(e.pageX - pos.left)
          .height(e.pageY - pos.top);
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