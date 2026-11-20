"""Fail deployment unless the image contains a patched JVM and mitigation."""
import re
import subprocess
import sys


def validate_runtime(output):
    match = re.search(r'(?:openjdk|java) version "(\d+(?:\.\d+){1,3})"', output)
    if not match:
        raise ValueError('Cannot identify Java version')
    version = tuple(map(int, match[1].split('.')))
    minimum = {17: (17, 0, 21, 1), 21: (21, 0, 13, 1),
               25: (25, 0, 5, 1), 27: (27, 0, 1, 1)}
    if version[0] not in minimum or version < minimum[version[0]]:
        raise ValueError('Unpatched or unsupported Java version: ' + match[1])
    if not re.search(r'\bUseBASE64Intrinsics\s+=\s+false\b', output):
        raise ValueError('Base64 mitigation is not enabled in the image environment')
    return match[1]


if __name__ == '__main__':
    result = subprocess.run(['docker', 'run', '--rm', '--network', 'none',
                             '--entrypoint', 'java', sys.argv[1],
                             '-XX:+PrintFlagsFinal', '-version'],
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, timeout=120, check=True)
    print('Patched Java ' + validate_runtime(result.stdout) + '; mitigation enabled')
