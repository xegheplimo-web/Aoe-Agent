#!/usr/bin/env bash
# Review Gate (CI judge): merge only after a reviewer has reviewed the CURRENT
# head SHA and zero review threads remain unresolved.
#
#   usage: review-gate.sh <owner/repo> <pr-number> <head-sha>
#
# Polls until the gate clears, the head moves (stale run exits 0), unresolved
# findings appear (exit 1 — agent must fix and push), or the timeout hits
# (exit 1 — request a review, e.g. `@codex review`, then re-run).
set -euo pipefail

REPO="${1:?owner/repo required}"
PR="${2:?pr number required}"
HEAD="${3:?head sha required}"
OWNER="${REPO%%/*}"
NAME="${REPO##*/}"
DEADLINE=$((SECONDS + ${REVIEW_TIMEOUT_SECONDS:-720}))
INTERVAL="${REVIEW_INTERVAL_SECONDS:-30}"

QUERY='query($owner:String!,$name:String!,$pr:Int!){
  repository(owner:$owner,name:$name){
    pullRequest(number:$pr){
      headRefOid
      reviews(last:50){ nodes { author { login } commit { oid } state } }
      reviewThreads(last:50){ nodes { isResolved isOutdated } }
    }
  }
}'

echo "REVIEW-GATE ${REPO}#${PR} head=${HEAD:0:8} timeout=${REVIEW_TIMEOUT_SECONDS:-720}s"
while :; do
    out="$(gh api graphql -F owner="${OWNER}" -F name="${NAME}" -F pr="${PR}" -f query="${QUERY}")"

    current="$(echo "${out}" | jq -r '.data.repository.pullRequest.headRefOid')"
    if [ "${current}" != "${HEAD}" ]; then
        echo "REVIEW-GATE SKIP — head moved to ${current:0:8}; this run is stale"
        exit 0
    fi

    unresolved="$(echo "${out}" | jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false and .isOutdated == false)] | length')"
    reviewed="$(echo "${out}" | jq --arg head "${HEAD}" '[.data.repository.pullRequest.reviews.nodes[] | select(.commit.oid == $head)] | length')"

    if [ "${unresolved}" -gt 0 ]; then
        echo "REVIEW-GATE FAIL — ${unresolved} unresolved review thread(s) on ${HEAD:0:8}"
        exit 1
    fi
    if [ "${reviewed}" -gt 0 ]; then
        echo "REVIEW-GATE PASS — ${reviewed} review(s) on ${HEAD:0:8}, no unresolved threads"
        exit 0
    fi

    if [ "${SECONDS}" -ge "${DEADLINE}" ]; then
        echo "REVIEW-GATE FAIL — no review on ${HEAD:0:8} before timeout"
        echo "Request a review (e.g. comment '@codex review'), then re-run this job."
        exit 1
    fi
    echo "waiting for review on ${HEAD:0:8} ..."
    sleep "${INTERVAL}"
done
