#!/data/data/com.termux/files/usr/bin/bash
# List every comment in src/, one per line, with file:line so comments can be
# triaged without opening each file.
#
# Usage:
#   tools/comments.sh            # all comments
#   tools/comments.sh <pattern>  # only comments matching a grep pattern (e.g. TODO)
#
# Sources scanned: src/**/*.js, src/**/*.jsx, src/**/*.css
# Recognized: // line comments, /* ... */ and {/* ... */} block comments,
#             CSS /* ... */ comments.

set -euo pipefail

PATTERN="${1:-}"

for f in $(find src -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.css' \) | sort); do
  # Line comments (// ...) — skip URLs (https://)
  grep -nE '(^|[^:])//' "$f" | sed "s|^|$f:|" || true
  # Block comments (/* ... */ and {/* ... */}) — one line per comment.
  # Closers ( */) must end the line or be followed by whitespace, so regex
  # literals like /\S*/ ) don't show up as false positives.
  grep -nE '/\*|\{/\*|\*/([[:space:]]|$)' "$f" | grep -v '^\s*$' | sed "s|^|$f:|" || true
done | if [ -n "$PATTERN" ]; then grep "$PATTERN"; else cat; fi
