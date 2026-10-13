#!/usr/bin/env python3
"""Regenerate the explicit HTTP API routes in templates/30-api.yaml from api/openapi.yaml.
One AWS::ApiGatewayV2::Route per (method, path). The integration comes from the path's x-sentinelqa-function.
Run it after editing the spec. CI fails if `git diff --exit-code` shows drift."""
import pathlib, re, yaml
here = pathlib.Path(__file__).resolve().parent
spec = yaml.safe_load((here / '../../api/openapi.yaml').read_text())
tpl_path = here / '../templates/30-api.yaml'
integ = {'records-api': 'RecordsIntegration', 'reports-api': 'ReportsIntegration'}
out = []
for path, item in spec['paths'].items():
    fn = integ[item['x-sentinelqa-function']]
    for m in ('get', 'post', 'patch', 'put', 'delete'):
        if m in item:
            name = 'Route' + re.sub(r'[^A-Za-z0-9]', '', (m + path.replace('/api/', '/')).title())
            out.append(f"  {name}:\n    Type: AWS::ApiGatewayV2::Route\n    Properties:\n      ApiId: !Ref HttpApi\n"
                       f"      RouteKey: {m.upper()} {path}\n      Target: !Sub integrations/${{{fn}}}\n")
begin, end = '  # BEGIN GENERATED ROUTES (iac/tools/gen-routes.py from api/openapi.yaml; do not edit)\n', '  # END GENERATED ROUTES\n'
t = tpl_path.read_text()
t = t[:t.index(begin) + len(begin)] + ''.join(out) + t[t.index(end):]
tpl_path.write_text(t)
print(f'{len(out)} routes written')
