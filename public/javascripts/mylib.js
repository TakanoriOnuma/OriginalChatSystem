// URLの?以降に書かれているパラメータを取得する
function getParams() {
  var url    = location.href;
  parameters = url.split("?");
  params     = parameters[1].split("&");
  var paramsArray = [];
  for ( i = 0; i < params.length; i++ ) {
    neet = params[i].split("=");
    paramsArray.push(neet[0]);
    paramsArray[neet[0]] = neet[1];
  }
  return paramsArray;
}

// Arrayにfind関数が無い場合に定義しておく
if (!Array.prototype.find) {
  Array.prototype.find = function(predicate) {
    if (this === null) {
      throw new TypeError('Array.prototype.find called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    var list = Object(this);
    var length = list.length >>> 0;
    var thisArg = arguments[1];
    var value;

    for (var i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return value;
      }
    }
    return undefined;
  };
}


// 日付を文字列にして返す
function dateToStr(date) {
  // 文字列で書かれた日付なら、Dateオブジェクトに変換する
  if(typeof date === 'string') {
    date = new Date(date);
  }
  var str = date.getFullYear() + '/';
  str += date.getMonth() + '/';
  str += date.getDate() + ' ';
  str += ('00' + date.getHours()).substr(-2) + ':';
  str += ('00' + date.getMinutes()).substr(-2);

  return str;
}

// box内にelemがあるかチェック
function isBoxing($elem, $box) {
  return ($elem.position().left > $box.position().left
    && $elem.position().left + $elem.outerWidth() < $box.position().left + $box.outerWidth()
    && $elem.position().top > $box.position().top
    && $elem.position().top + $elem.outerHeight() < $box.position().top + $box.outerHeight());
}