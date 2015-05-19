$(function() {
  $('#fm').submit(function() {
    createRoom();
    return false;
  });
});

// 入力フォームの内容を元に部屋を作成する
function createRoom() {
  var title  = $('#title').val();
  var name   = $('#name').val();
  var detail = $('#detail').val();

  // 入力内容のチェック
  var check = function() {
    var errMsg = '';
    // タイトルについてのチェック
    if(title === '') {
      errMsg += 'タイトルがありません。\n';
    }
    // 名前についてのチェック
    if(name === '') {
      errMsg += '名前がありません。\n';
    }
    // 詳細についてのチェック（未入力はOK）
    return errMsg;
  };

  // お知らせ内容の削除
  var $info = $('.info');
  $info.children().remove();

  // 入力に問題があればエラーを表示して終わる
  var errMsg = check();
  if(errMsg !== '') {
    // 一番後ろの改行コードを削除
    errMsg = errMsg.substring(0, errMsg.length - 1);
    // エラー内容の追加
    $.each(errMsg.split('\n'), function(index, elem) {
      $info.append($('<li>').addClass('error').append(elem));
    });
    return;
  }

  // 入力がOKなら部屋の登録を行う
  var sendObj = {
    title    : title,
    creator  : name,
    detail   : detail,
    password : ''       // とりあえずパスワードは空文字
  };
  var roomId = '';
  $.post('/room', sendObj, function(res) {
    roomId = res;
    // ※ 非同期のせいでこの処理はほぼ無駄（混乱を招く可能性あり） ※ //
    if(roomId === null) {
      // 登録失敗のメッセージを送る
      $info.children().remove();
      $info.append($('<li>').addClass('error').append('DBの登録に失敗しました。'));
      return;
    }
    console.log('roomId1:' + roomId);
  });
  console.log('roomId2:' + roomId);

  // 入力を禁止にする
  $('#fm input, textarea').attr('disabled', true);
  $('#btn').val('部屋の作成完了');

  $info.append($('<li>').addClass('info').append('部屋の登録が完了しました。'));
}