"""Copy individual reference illustrations, never screen captures, into the app."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import urlopen
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'docs/mobile/Design UI UX'
class Images(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'img' and attrs.get('src', '').startswith('https://'):
            self.images.append(attrs['src'])

groups = {'dashboard': 'dashboard_th_t_n_d_ng', 'profile': 'c_nh_n_c_i_t',
          'offers': 'u_i_v_ho_n_ti_n', 'credit': 'th_ng_k_h_n_m_c_s_d_th_t_n_d_ng',
          'account': 'th_ng_k_theo_t_ng_t_i_kho_n', 'source': 'xem_nh_ngu_n_ch_ng_t'}
out = ROOT / 'assets/reference'
out.mkdir(parents=True, exist_ok=True)
manifest = {}
for group, folder in groups.items():
    parser = Images()
    parser.feed((SOURCE / folder / 'code.html').read_text(encoding='utf-8'))
    for index, url in enumerate(parser.images):
        name = f'{group}-{index}.png'
        target = out / name
        if not target.exists():
            target.write_bytes(urlopen(url, timeout=30).read())
        manifest[name] = {'source': folder + '/code.html', 'url': url}
(out / 'sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{len(manifest)} reference illustrations available')
