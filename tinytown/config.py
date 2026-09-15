"""Site and deploy configuration: sites/<site>/site.json and sites/deploy.json.

Routes derive from site configs; nothing in the package hard-codes a site name.
Standard library only; imported on the deploy path.
"""
import importlib
import json
from pathlib import Path

from .paths import ROOT, SITE_NAME


def _read(path):
    return json.loads(Path(path).read_text())


def site_config(name, root=ROOT):
    path = Path(root) / 'sites' / name / 'site.json'
    if not path.is_file():
        raise KeyError(f'unknown site: {name}')
    config = _read(path)
    config.setdefault('deploy', [])
    if isinstance(config['deploy'], dict):
        config['deploy'] = [config['deploy']]
    return config


def all_sites(root=ROOT):
    sites = Path(root) / 'sites'
    return sorted(p.name for p in sites.iterdir()
                  if p.is_dir() and SITE_NAME.fullmatch(p.name) and (p / 'site.json').is_file())


def deploy_targets(root=ROOT):
    return _read(Path(root) / 'sites' / 'deploy.json')


def placements(target, root=ROOT):
    """[(site, placement)] for one deploy target, root route first."""
    rows = []
    for name in all_sites(root):
        for placement in site_config(name, root)['deploy']:
            if placement.get('target') == target:
                rows.append((name, placement))
    rows.sort(key=lambda row: (row[1]['route'] != '/', row[1]['route']))
    return rows


def routes(target, root=ROOT):
    """{route: site} for one deploy target, including aliases."""
    table = {}
    for name, placement in placements(target, root):
        table[placement['route']] = name
        for alias in placement.get('aliases', ()):
            table[alias] = name
    return table


def root_site(target, root=ROOT):
    table = routes(target, root)
    if '/' not in table:
        raise KeyError(f'deploy target {target} has no root site')
    return table['/']


def sites_for_target(target, root=ROOT):
    return sorted({name for name, _ in placements(target, root)})


def plugin(name, root=ROOT):
    """The site's plugin module, or None."""
    module = site_config(name, root).get('plugin')
    if not module:
        return None
    return importlib.import_module(f'tinytown.plugins.{module}')


def scope(name, root=ROOT):
    """The site's frozen scope (structure ids, exclusions), or None."""
    config = site_config(name, root)
    if not config.get('scope'):
        return None
    return _read(Path(root) / 'sites' / name / config['scope'])
