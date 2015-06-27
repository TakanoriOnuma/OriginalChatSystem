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
  var $titlebar = $('<div>');
  $titlebar
    .append($('<img>').attr('src', 'images/minus.png'))
    .append($('<span>').text(groupbox.title));
  $groupbox
    .append($titlebar)
    .css({
      top:  groupbox.position.y + pos.top,
      left: groupbox.position.x + pos.left
    });
  var $ul = $('<ul>');
  $.each(groupbox.childs, function(index, child) {
    var chat = chats.find(function(elem, index, array) {
      return (elem._id === child);
    });
    $ul.append($('<li>').text(chat.text));
  });
  $groupbox.append($ul);

  // もしアコーディオンパネルの状態が閉じるだったら閉じておく
  if(!groupbox.isExpand) {
    $('img', $titlebar).attr('src', 'images/plus.png');
    $ul.hide();
  }
  $chatboard.append($groupbox);
}

// チャット情報からチャットボードにラベルをセットする
function setLabel($chatboard, chat) {
  var pos = $chatboard.position();
  var $label = $('<div>').addClass('label').text(chat.text);
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
        $('.label:visible, .groupbox').removeClass('groupselect');
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

        $('.label:visible, .groupbox').each(function(index, label) {
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

  // グループボックスのアコーディオンパネルの実装
  $(document)
    .on('click', '.groupbox img', function() {
      var $img = $(this);
      toggleAccordionPanel($img);
      var $groupbox = $img.parent().parent();
      SOCKET.emit('toggleAccordionPanel', {
        groupBoxId : $groupbox.attr('key')
      });
    });

  // グループボックスのタイトルの変更
  $(document)
    .on('dblclick', '.groupbox div', function() {
      var $title = $('span', this);
      $title.replaceWith($('<input type="text">').val($title.html()));
    })
    .on('keypress', '.groupbox input', function(e) {
      // エンターキーが押されたら
      if(e.which === 13) {
        var $title = $(this);
        var title = $title.val();
        if(title.length <= 0) {
          alert('タイトルは1文字以上にしてください。');
          return;
        }
        var $groupbox = $title.parent().parent();
        $title.replaceWith($('<span>').text(title));

        SOCKET.emit('changeGroupTitle', {
          groupBoxId : $groupbox.attr('key'),
          title : title
        });
      }
    });
}

// コンテキストメニューをセットする
function setContextMenu() {
  var pos = $('#chatboard').position();

  $('#chatboard').showMenu({
    opacity : 1.0,
    query : '#chatboardmenu'
  });
  $chatboardmenu = $('#chatboardmenu');
  // グルーピングを選択したら
  $('li.grouping', $chatboardmenu).click(function(e) {
    var groupkeys = new Array();
    $('.groupselect').each(function(index, label) {
      if($(label).hasClass('label')) {
        groupkeys.push($(label).attr('key'));
      }
    });
    if(groupkeys.length <= 0) {
      alert('選択しているラベルがありません。');
      return;
    }
    SOCKET.emit('grouping', {
      roomId : ROOMID,
      groupkeys : groupkeys,
      x : e.pageX - pos.left,
      y : e.pageY - pos.top
    });
  });
  // アングルーピングを選択したら
  $('li.ungrouping', $chatboardmenu).click(function() {
    $('.groupselect.groupbox').each(function(index, groupBox) {
      SOCKET.emit('ungrouping', {
        groupBoxId : $(groupBox).attr('key')
      });
    });
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

// アコーディオンパネルの開閉を行う
function toggleAccordionPanel($img) {
  if($img.attr('src') === 'images/plus.png') {
    $img.attr('src', 'images/minus.png');
  }
  else {
    $img.attr('src', 'images/plus.png');
  }
  $('+ul', $img.parent()).slideToggle(500);
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

// groupingというイベントを受信したら選択されたチャットをグループボックスにまとめる
SOCKET.on('grouping', function(groupBox) {
  // ルームIDが違うなら何もしない
  if(groupBox.roomId !== ROOMID) {
    return;
  }

  // グルーピングされるラベルはチャットボードから削除する
  $.each(groupBox.childs, function(index, chatId) {
    $('.label[key="' + chatId + '"]').remove();
  });

  $.get('/chatmsgs', {roomId : ROOMID}, function(chats) {
    setGroupBox($('#chatboard'), groupBox, chats);
  });
});

// ungroupingというイベントを受信したら選択されたグループボックスを削除して、ラベルに戻す
SOCKET.on('ungrouping', function(ungroupBox) {
  // ルームIDが違うなら何もしない
  if(ungroupBox.roomId !== ROOMID) {
    return;
  }

  // 指定されたグループボックスは削除する
  $('.groupbox[key="' + ungroupBox.ungroupBoxId + '"]').remove();

  // グループボックスにあったチャット内容をラベルに作り直す
  $.each(ungroupBox.chats, function(index, chat) {
    setLabel($('#chatboard'), chat);
  });
});

// toggleAccordionPanelというイベントを受信したら選択された
// グループボックスの開閉状態をトグルする
SOCKET.on('toggleAccordionPanel', function(toggleBox) {
  // ルームIDが違うなら何もしない
  if(toggleBox.roomId !== ROOMID) {
    return;
  }

  var $toggleBox = $('.groupbox[key="' + toggleBox.groupBoxId + '"]');
  toggleAccordionPanel($('img', $toggleBox));
});

// changeGroupTitleというイベントを受信したら
// 選択されたグループボックスのタイトルを変更する
SOCKET.on('changeGroupTitle', function(changeBox) {
  // ルームIDが違うなら何もしない
  if(changeBox.roomId !== ROOMID) {
    return;
  }

  var $changeBox = $('.groupbox[key="' + changeBox.groupBoxId + '"]');
  $('span', $changeBox).html(changeBox.title);
});