"""Prepare the existing Portainer stack in memory; never log its secrets."""
import json
import os
import re
import sys
import yaml


def prepare(content, environment, bank_image, ui_image):
    stack = yaml.safe_load(content)
    for service, image in [('kira-bank-service', bank_image), ('kira-bank-ui', ui_image)]:
        if not re.fullmatch(r'kira2308/' + service + r'@sha256:[0-9a-f]{64}', image):
            raise ValueError('Deployment requires the verified build digest for ' + service)
        config = stack['services'][service]
        config['image'] = image
        config['pull_policy'] = 'always'
        config.pop('build', None)
    config = stack['services']['kira-bank-service']
    env = config.setdefault('environment', {})
    if isinstance(env, list):
        env = dict(item.split('=', 1) if '=' in item else (item, None) for item in env)
        config['environment'] = env
    options = env.get('JAVA_TOOL_OPTIONS')
    if options is None:
        options = next((item['value'] for item in environment if item['name'] == 'JAVA_TOOL_OPTIONS'), '')
    # Append last so a previously supplied +UseBASE64Intrinsics cannot override it.
    env['JAVA_TOOL_OPTIONS'] = (options + ' -XX:-UseBASE64Intrinsics').strip()
    return {'stackFileContent': yaml.safe_dump(stack, sort_keys=False),
            'env': environment, 'prune': False, 'pullImage': True}


if __name__ == '__main__':
    try:
        data = json.load(sys.stdin)
        payload = prepare(data['content'], data['env'], os.environ['BANK_IMAGE'], os.environ['UI_IMAGE'])
    except (ValueError, KeyError, TypeError, yaml.YAMLError):
        sys.exit('Invalid stack or image digest; deployment refused (stack contents suppressed)')
    json.dump(payload, sys.stdout)
