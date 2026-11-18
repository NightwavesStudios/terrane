#!/usr/bin/env bash
# Put `public/poi` into the cell bucket.
#
#   POI_BUCKET=https://<site>.freebuff.site POI_UPLOAD_TOKEN=<token> npm run poi:push
#
# The cells are not in git: 370 MB across 1,869 files, written by the world harvest
# and served straight from object storage (see poi-bucket/worker.js). Re-run this
# after a merge; it uploads every file and prints the ones that failed, so a partial
# upload is visible instead of silent.
set -u

: "${POI_BUCKET:?set POI_BUCKET to the cell store URL}"
: "${POI_UPLOAD_TOKEN:?set POI_UPLOAD_TOKEN to the store's upload token}"

cd "$(dirname "$0")/.." || exit 1

one() {
  local f=$1 rel=${1#public/} code
  code=$(curl -s -m 240 -o /dev/null -w "%{http_code}" \
    -X PUT -H "x-upload-token: $POI_UPLOAD_TOKEN" --data-binary "@$f" "$POI_BUCKET/upload/$rel")
  if [ "$code" = "200" ]; then
    echo "ok $rel"
  else
    echo "FAILED $code $rel"
  fi
}

export -f one
export POI_BUCKET POI_UPLOAD_TOKEN

find public/poi -name "*.json" -print0 \
  | xargs -0 -n 1 -P 6 bash -c 'one "$@"' _ \
  > /tmp/poi-push.log

uploaded=$(grep -c '^ok ' /tmp/poi-push.log || true)
failed=$(grep -c '^FAILED ' /tmp/poi-push.log || true)
echo "uploaded $uploaded, failed $failed"
if [ "$failed" != "0" ]; then
  grep '^FAILED ' /tmp/poi-push.log | head -20
  exit 1
fi
