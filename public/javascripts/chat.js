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
  setContextMenu();
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

    // グループボックスの表示
    $.get('/groupboxes', {roomId : ROOMID}, function(groupboxes) {
      $.each(groupboxes, function(index, groupbox) {
        setGroupBox($chatboard, groupbox, chats);
        // グループボックスで使用したチャットは配列から取り除く
        $.each(groupbox.childs, function(index, chatId) {
          for(var i = 0; i < chats.length; i++) {
            if(chats[i]._id === chatId) {
              chats.splice(i, 1);
              break;
            }
          }
        });
      });

      // チャット情報をチャットボードにも登録
      $.each(chats, function(index, chat) {
        setLabel($chatboard, chat);
      });
    });
  });
}

// グループボックスをチャットボードに表示する
function setGroupBox($chatboard, groupbox, chats) {
  var pos = $chatboard.position();
  var $groupbox = $('<div>').addClass('groupbox').attr('key', groupbox._id);
  $groupbox
    .append($('<div>').append(groupbox.title))
    .css({
      top:  groupbox.position.y + pos.top,
      left: groupbox.position.x + pos.left
    });
  var $ul = $('<ul>');
  $.each(groupbox.childs, function(index, child) {
    var chat = chats.find(function(elem, index, array) {
      return (elem._id === child);
    });
    $ul.append($('<li>').append(chat.text));
  });
  $groupbox.append($ul);
  $chatboard.append($groupbox);
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
    .on('mousedown', '.label, .groupbox', function(e) {
      $moveLabel = $(this);
      pos.x = e.pageX - $(this).position().left;
      pos.y = e.pageY - $(this).position().top;
      $('body').addClass('noneselect');
      // イベントがchatboardのほうが早いため、処理をしていたら取り消す
      if($dragfield !== null) {
        $dragfield.hide();
        $dragfield = null;
      }
    })
    // マウスアップ時に移動対象を外す
    .on('mouseup', '.label, .groupbox, body', function(e) {
      $moveLabel = null;
      $('body').removeClass('noneselect');
    })
    // マウス移動時に移動対象があれば移動する
    .on('mousemove', '.label, .groupbox, body', function(e) {
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
        var sendValue = {
          x : newPos.x - $chatboard.position().left,
          y : newPos.y - $chatboard.position().top,
          chatId : $moveLabel.attr('key')
        };
        if($moveLabel.hasClass('label')) {
          sendValue['className'] = 'label';
        }
        else {
          sendValue['className'] = 'groupbox';
        }
        SOCKET.emit('moveLabel', sendValue);
        e.stopPropagation();
      }
    });

  // ドラッグの範囲を表示する
  var $dragfield = null;
  var startPt = null;
  $('#chatboard')
    // マウスダウン時に範囲の開始位置を指定する
    .mousedown(function(e) {
      startPt = {x : e.pageX, y : e.pageY};
      // ドラッグ範囲を表示するタグを取得する
      $dragfield = $('.dragfield');
      $dragfield
        .css({
          left: startPt.x,
          top:  startPt.y
        })
        .height(0)
        .width(0)
        .show();

      // ドラッグ中は文字の選択を無効にする
      $('body').addClass('noneselect');
      // 右クリックの時以外ラベルの選択を消しておく
      if(e.which !== 3) {
        $('.label:visible').removeClass('groupselect');
      }
    })
    // マウスアップ時はドラッグ表示タグをnullにしておく
    .mouseup(function(e) {
      // ドラッグを表示するタグがあるなら処理する
      if($dragfield !== null) {
        if($dragfield.width() === 0 || $dragfield.height() === 0) {
          $dragfield.hide();
        }
        $dragfield = null;
        $('body').removeClass('noneselect');
      }
    })
    // マウスが移動時にドラッグの範囲を変更する
    .mousemove(function(e) {
      // ドラッグ範囲を表示するタグがあるなら処理する
      if($dragfield !== null) {
        var pos = $dragfield.position();
        var width  = e.pageX - startPt.x;
        var height = e.pageY - startPt.y;
        // 幅や高さがマイナスになったら左上の座標をその分動かす
        if(width < 0) {
          pos.left = startPt.x + width;
          width *= -1;
        }
        if(height < 0) {
          pos.top = startPt.y + height;
          height *= -1;
        }
        $dragfield
          .css({
            left : pos.left,
            top  : pos.top
          })
          .width(width)
          .height(height);

        $('.label:visible').each(function(index, label) {
          var $label = $(label);
          if(isBoxing($label, $dragfield)) {
            $label.addClass('groupselect');
          }
          else {
            $label.removeClass('groupselect');
          }
        });
      }
    });
}

// コンテキストメニューをセットする
function setContextMenu() {
  $('#chatboard').showMenu({
    opacity : 0.8,
    query : '#chatboardmenu'
  });
  $chatboardmenu = $('#chatboardmenu');
  $('li.grouping', $chatboardmenu).click(function() {
    var groupkeys = new Array();
    $('.groupselect').each(function(index, label) {
      groupkeys.push($(label).attr('key'));
    });
    alert(groupkeys);
    SOCKET.emit('grouping', {
      roomId : ROOMID,
      groupkeys : groupkeys
    });
  });
  $('li.ungrouping', $chatboardmenu).click(function() {
    alert('ungrouping');
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
  var $moveLabel = $('.' + label.className + '[key=' + label.chatId + ']');
  $moveLabel.css({
    left : label.x + pos.left,
    top  : label.y + pos.top
  });
});