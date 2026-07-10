#!/bin/sh
# notify.sh "<title>" "<message>" [priority] [tags] — push alert to Stuart's phone via ntfy.sh.
# Topic from $NTFY_TOPIC or the project .env. Fail-silent: alerting must never break a pipeline.
DIR=$(dirname "$0")
TOPIC="${NTFY_TOPIC:-$(grep -m1 '^NTFY_TOPIC=' "$DIR/../.env" 2>/dev/null | cut -d= -f2)}"
[ -z "$TOPIC" ] && exit 0
curl -sS --max-time 10 \
  -H "Title: ${1:-RuvNet Brain}" \
  -H "Priority: ${3:-default}" \
  -H "Tags: ${4:-brain}" \
  -d "${2:-（no message)}" \
  "https://ntfy.sh/$TOPIC" >/dev/null 2>&1 || true
