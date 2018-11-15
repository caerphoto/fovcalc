#!/bin/bash
HASH=$(date +%Y%m%d%H%M%S)
BASE_FILENAME=fovcalc.$HASH
JS_FILENAME=$BASE_FILENAME.min.js
CSS_FILENAME=$BASE_FILENAME.css
INPUT_JS=(
  fovcalc.js
)
echo Minifying these files: "${INPUT_JS[@]}"

rm build/*

uglifyjs -m --warn "${INPUT_JS[@]}" > build/$JS_FILENAME &&
  echo $JS_FILENAME generated

cp fovcalc.css build/$CSS_FILENAME &&
  echo $CSS_FILENAME created

sed -e "s/CSS_FILENAME_PLACEHOLDER/$CSS_FILENAME/;s/JS_FILENAME_PLACEHOLDER/$JS_FILENAME/" fovcalc.html > build/fovcalc.html &&
  echo Filenames replaced in build/fovcalc.html
