
#!/data/data/com.termux/files/usr/bin/bash

# List every comment in src/, one per line, with file:line.
#
# Usage:
#   sh tools/comments.sh
#   sh tools/comments.sh TODO
#   sh tools/comments.sh "TODO|FIXME|HACK"
#
# Sources scanned:
#   src/**/*.js
#   src/**/*.jsx
#   src/**/*.css
#
# Recognized:
#   JavaScript // line comments
#   JavaScript /* block comments */
#   JSX {/* block comments */}
#   CSS /* block comments */

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
PATTERN="${1:-}"

if [ ! -d "$ROOT/src" ]; then
    echo "Error: src/ directory not found in $ROOT" >&2
    exit 1
fi

if ! node -e "require('@babel/parser'); require('postcss')" >/dev/null 2>&1; then
    echo "Error: Missing dependencies." >&2
    echo "Run: npm install --save-dev @babel/parser postcss" >&2
    exit 1
fi

cd "$ROOT"

node --input-type=commonjs - "$PATTERN" "$ROOT" <<'NODE'
const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const postcss = require('postcss');

const pattern = process.argv[2];
const ROOT = process.argv[3];

let filter;

if (pattern) {
    try {
        filter = new RegExp(pattern);
    } catch (error) {
        console.error(`Invalid grep pattern: ${error.message}`);
        process.exit(2);
    }
}

function matches(text) {
    if (!filter) return true;

    filter.lastIndex = 0;
    return filter.test(text);
}

function emit(file, line, comment) {
    const normalized = comment
        .replace(/\r\n/g, '\n')
        .replace(/\n/g, ' ')
        .trim();

    if (matches(normalized)) {
        console.log(`${file}:${line}: ${normalized}`);
    }
}

function collectFiles(dir) {
    const results = [];

    for (const entry of fs.readdirSync(dir, {
        withFileTypes: true
    })) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            results.push(...collectFiles(fullPath));
        } else if (/\.(js|jsx|css)$/.test(entry.name)) {
            results.push(fullPath);
        }
    }

    return results;
}

function scanJS(file, source) {
    const ast = parse(source, {
        sourceType: 'unambiguous',
        plugins: [
            'jsx',
            'typescript',
            'decorators-legacy'
        ],
        attachComment: true,
        errorRecovery: false
    });

    for (const comment of ast.comments || []) {
        const value = comment.type === 'CommentLine'
            ? `//${comment.value}`
            : `/*${comment.value}*/`;

        emit(
            file,
            comment.loc.start.line,
            value
        );
    }
}

function scanCSS(file, source) {
    const root = postcss.parse(source, {
        from: file
    });

    root.walkComments(comment => {
        emit(
            file,
            comment.source.start.line,
            `/*${comment.text}*/`
        );
    });
}

function main() {
    const srcDir = path.join(ROOT, 'src');

    const files = collectFiles(srcDir).sort();

    let failed = false;

    for (const absolute of files) {
        const file = path.relative(ROOT, absolute);

        try {
            const source = fs.readFileSync(absolute, 'utf8');

            if (file.endsWith('.css')) {
                scanCSS(file, source);
            } else {
                scanJS(file, source);
            }
        } catch (error) {
            failed = true;

            console.error(
                `${file}: ${error.message}`
            );
        }
    }

    if (failed) {
        process.exitCode = 1;
    }
}

main();
NODE

