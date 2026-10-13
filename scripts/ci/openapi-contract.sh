#!/usr/bin/env bash
# openapi-contract (delivery-strategy §3, ci-and-data-guards §1.2 stage 5):
# 1) openapi.yaml is a valid OpenAPI document; 2) it matches gen_openapi.py output (not stale);
# 3) handler contract tests run once handlers exist.
set -euo pipefail
API=docs/architecture/api
tmp=$(mktemp -d)
python3 -c "from openapi_spec_validator import validate; from openapi_spec_validator.readers import read_from_filename; validate(read_from_filename('$API/openapi.yaml')[0])"
echo "openapi.yaml is valid."
cp "$API/gen_openapi.py" "$tmp/" && (cd "$tmp" && python3 gen_openapi.py)
if ! diff -q "$API/openapi.yaml" "$tmp/openapi.yaml" >/dev/null; then
  diff -u "$API/openapi.yaml" "$tmp/openapi.yaml" | head -50
  echo "FAIL: openapi.yaml is stale; regenerate it with gen_openapi.py." >&2; exit 1
fi
echo "openapi.yaml matches gen_openapi.py output."
if compgen -G "src/handlers/*" >/dev/null; then
  npx vitest run tests/contract
else
  echo "No handlers under src/handlers/ yet; handler contract tests have nothing to check (pass)."
fi
