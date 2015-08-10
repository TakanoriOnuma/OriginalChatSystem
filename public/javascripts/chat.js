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

  // chatboard内にあるタグに対するイベント処理
  // documentからいくよりもイベントが早く取得できる
  $chatboard
    // マウスダウン時に移動対象を取得する
    .on('mousedown', '.label, .groupbox', function(e) {
      var keys = getKeys(e);
      $moveLabel = $(this);
      if(!keys['ctrl'] && !$moveLabel.hasClass('groupselect')) {
        $('.label, .groupbox').each(function(idx, elem) {
          if($(this).attr('key') !== $moveLabel.attr('key')) {
            $(this).removeClass('groupselect');
          }
        });
      }
      $moveLabel.addClass('groupselect');

      pos.x = e.pageX - $(this).position().left;
      pos.y = e.pageY - $(this).position().top;
      $('body').addClass('noneselect');

      // チャットボードのイベントは起こさないようにする
      e.stopPropagation();
    });

  $(document)
    // マウスアップ時に移動対象を外す
    .mouseup(function(e) {
      $moveLabel = null;
      $('body').removeClass('noneselect');
    })
    // マウス移動時に移動対象があれば移動する
    .mousemove(function(e) {
      if($moveLabel !== null) {
        var move = {
          x : e.pageX - ($moveLabel.position().left + pos.x),
          y : e.pageY - ($moveLabel.position().top  + pos.y)
        };
        // 移動するラベルの中で左上の座標と右下の座標を求める
        var topLeftPos = { x : $(document).outerWidth(), y : $(document).outerHeight() };
        var bottomRightPos = { x : 0, y : 0 };
        $('.groupselect').each(function(idx, elem) {
          if(topLeftPos.x > $(this).position().left) {
            topLeftPos.x = $(this).position().left;
          }
          if(topLeftPos.y > $(this).position().top) {
            topLeftPos.y = $(this).position().top;
          }
          if(bottomRightPos.x < $(this).position().left + $(this).outerWidth()) {
            bottomRightPos.x = $(this).position().left + $(this).outerWidth();
          }
          if(bottomRightPos.y < $(this).position().top + $(this).outerHeight()) {
            bottomRightPos.y = $(this).position().top + $(this).outerHeight();
          }
        });

        var boardPos = $chatboard.position();
        // チャットボードの左と上の枠を超えないように移動量を調節する
        move.x = (topLeftPos.x + move.x < boardPos.left) ? boardPos.left - topLeftPos.x : move.x;
        move.y = (topLeftPos.y + move.y < boardPos.top)  ? boardPos.top  - topLeftPos.y : move.y;

        // チャットボードの右と下の枠は超えないように移動量を調節する
        if(bottomRightPos.x + move.x > boardPos.left + $chatboard.outerWidth()) {
          move.x = boardPos.left + $chatboard.outerWidth() - bottomRightPos.x;
        }
        if(bottomRightPos.y + move.y > boardPos.top + $chatboard.outerHeight()) {
          move.y = boardPos.top + $chatboard.outerHeight() - bottomRightPos.y;
        }

        $('.groupselect').each(function(idx, elem) {
          var pos = $(this).position();
          $(this).css({
            left : pos.left + move.x,
            top  : pos.top  + move.y
          });
          // 移動情報をサーバーに送る
          var sendValue = {
            x : pos.left + move.x - $chatboard.position().left,
            y : pos.top  + move.y - $chatboard.position().top,
            chatId : $(this).attr('key')
          };
          if($(this).hasClass('label')) {
            sendValue['className'] = 'label';
          }
          else {
            sendValue['className'] = 'groupbox';
          }
          SOCKET.emit('moveLabel', sendValue);
        });

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
      var keys = getKeys(e);
      // Ctrlキーを押していない時はラベルの選択を解除する
      if(!keys['ctrl']) {
        $('.label:visible, .groupbox').removeClass('groupselect');
      }
    });
  $(document)
    // マウスアップ時はドラッグ表示タグをnullにしておく
    .mouseup(function(e) {
      // ドラッグを表示するタグがあるなら処理する
      if($dragfield !== null) {
        $dragfield.hide();
        $dragfield = null;
        $('body').removeClass('noneselect');
      }
    })
    // マウスが移動時にドラッグの範囲を変更する
    .mousemove(function(e) {
      // ドラッグ範囲を表示するタグがあるなら処理する
      if($dragfield !== null) {
        var box = $dragfield.position();
        box.width  = e.pageX - startPt.x;
        box.height = e.pageY - startPt.y;
        // 幅や高さがマイナスになったら左上の座標をその分動かす
        if(box.width < 0) {
          box.left = startPt.x + box.width;
          box.width *= -1;
        }
        if(box.height < 0) {
          box.top = startPt.y + box.height;
          box.height *= -1;
        }
        sizeFix(box, $('#chatboard'));

        $dragfield
          .css({
            left : box.left,
            top  : box.top
          })
          .width(box.width)
          .height(box.height);

        $('.label:visible, .groupbox').each(function(index, label) {
          var $label = $(label);
          if(isBoxing($label, $dragfield)) {
            $label.addClass('groupselect');
          }
          // Ctrlを押しているときは単純に選択を外さない方が良さそう
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
      $title.replaceWith($('<input type="text">').val($title.text()));
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
  $('span', $changeBox).text(changeBox.title);
});