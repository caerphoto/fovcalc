#!/bin/bash
HASH=$(date +%Y%m%d%H%M%S)
BASE_FILENAME=fovcalc.$HASH
JS_FILENAME=$BASE_FILENAME.js
CSS_FILENAME=$BASE_FILENAME.css
INPUT_JS=(
  fovcalc.js
)
echo Minifying these files: "${INPUT_JS[@]}"

rm build/*

#uglifyjs -b --warn "${INPUT_JS[@]}" > build/$JS_FILENAME &&
  #echo $JS_FILENAME generated
cp fovcalc.js build/$JS_FILENAME &&
  echo $JS_FILENAME created

cp fovcalc.css build/$CSS_FILENAME &&
  echo $CSS_FILENAME created

FAVICON_B64=$(cat favicon.png | openssl base64 | tr -d '\n') && echo "Base64-encoded favicon"

sed -e "s/fovcalc.css/$CSS_FILENAME/;s/fovcalc.js/$JS_FILENAME/;s|favicon.png|data:image/png;base64,$FAVICON_B64|" fovcalc.html > build/fovcalc.html &&
  echo Filenames replaced in build/fovcalc.html

