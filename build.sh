#!/bin/bash
HASH=$(date +%Y%m%d%H%M%S)
BASE_FILENAME=build/fovcalc.$HASH
JS_FILENAME=$BASE_FILENAME.min.js
CSS_FILENAME=$BASE_FILENAME.css
INPUT_JS=(
  fovcalc.js
)
echo Minifying these files: "${INPUT_JS[@]}"
rm $BASE_FILENAME.*
uglifyjs -m --warn "${INPUT_JS[@]}" > $JS_FILENAME && echo $JS_FILENAME generated
cp fovcalc.css $CSS_FILENAME
