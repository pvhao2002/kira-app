import copy
import unittest
from pathlib import Path

from check_java_image import validate_runtime
from prepare_bank_stack import prepare


class JavaSecurityTest(unittest.TestCase):
    def test_all_java_dockerfiles_pin_verified_jdk_and_keep_mitigation(self):
        root = Path(__file__).resolve().parents[1]
        dockerfiles = [root / path for path in [
            'kira-gateway/Dockerfile', 'kira-data-manager/Dockerfile',
            'kira-producer/Dockerfile', 'kira-queue/Dockerfile', 'kira-crawl-java/Dockerfile',
            'kira-bank/kira-bank-service/Dockerfile',
            'kira-affilate/kira-affilate-service/Dockerfile',
            'kira-memory/kira-memory-service/Dockerfile',
            'farm-market/farm-market-service/Dockerfile']]
        for path in dockerfiles:
            with self.subTest(path=path):
                text = path.read_text()
                self.assertRegex(text, r'corretto.aws/downloads/resources/(21\.0\.13\.1\.2|25\.0\.5\.1\.2)/')
                self.assertIn('sha256sum -c -', text)
                self.assertIn('amd64)', text)
                self.assertIn('arm64)', text)
                self.assertIn('ENV JAVA_HOME=/opt/java/patched', text)
                self.assertEqual(text.count('ENV JAVA_TOOL_OPTIONS="-XX:-UseBASE64Intrinsics"'), 2)
                self.assertNotIn('FROM eclipse-temurin:25-jre', text)

    def test_runtime_rejects_unpatched_missing_flag_and_unknown_versions(self):
        for version in ['21.0.13', '25.0.5', '25.0.4.1', '26.0.1']:
            with self.subTest(version=version), self.assertRaises(ValueError):
                validate_runtime(f'openjdk version "{version}"\n bool UseBASE64Intrinsics = false')
        with self.assertRaises(ValueError):
            validate_runtime('openjdk version "25.0.5.1"\n bool UseBASE64Intrinsics = true')

    def test_runtime_accepts_patched_and_newer_versions(self):
        for version in ['21.0.13.1', '25.0.5.1', '25.0.6']:
            validate_runtime(f'openjdk version "{version}"\n bool UseBASE64Intrinsics = false')

    def test_stack_preserves_configuration_and_secrets(self):
        import yaml
        stack = {'services': {'kira-bank-service': {'image': 'local:old', 'pull_policy': 'never',
                 'environment': {'DB_PASSWORD': '${DB_PASSWORD}', 'JAVA_TOOL_OPTIONS': '-Xmx1g'},
                 'ports': ['127.0.0.1:8080:8080']}, 'kira-bank-ui': {'image': 'ui:old'}},
                 'networks': {'database-network': {'external': True}}}
        env = [{'name': 'DB_PASSWORD', 'value': 'test-secret'}]
        original = copy.deepcopy(stack)
        image = 'kira2308/kira-bank-service@sha256:' + 'a' * 64
        ui = 'kira2308/kira-bank-ui@sha256:' + 'b' * 64
        result = prepare(yaml.safe_dump(stack), env, image, ui)
        updated = yaml.safe_load(result['stackFileContent'])
        self.assertEqual(result['env'], env)
        self.assertEqual(updated['networks'], original['networks'])
        service = updated['services']['kira-bank-service']
        self.assertEqual(service['image'], image)
        self.assertEqual(service['pull_policy'], 'always')
        self.assertEqual(service['ports'], original['services']['kira-bank-service']['ports'])
        self.assertEqual(service['environment']['DB_PASSWORD'], '${DB_PASSWORD}')
        self.assertEqual(service['environment']['JAVA_TOOL_OPTIONS'], '-Xmx1g -XX:-UseBASE64Intrinsics')
        with self.assertRaises(ValueError):
            prepare(yaml.safe_dump(stack), env, 'kira2308/kira-bank-service:latest', ui)


if __name__ == '__main__':
    unittest.main()
