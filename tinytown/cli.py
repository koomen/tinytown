"""`town`: one CLI, one verb per pipeline stage. See docs/ARCHITECTURE.md.

Each module exposes register(subparsers) and is imported only when one of its
verbs runs, so the deploy path stays standard-library only.
"""
import argparse
import importlib
import sys

# verb -> module. Keep in the order of the pipeline stages.
VERBS = {
    'fetch': 'sources',
    'scope': 'site',
    'build': 'site',
    'refs': 'references',
    'brief': 'references',
    'plan': 'references',
    'render': 'render',
    'lint': 'review',
    'review': 'review',
    'author': 'author',
    'accept': 'author',
    'status': 'state',
    'bake': 'bake',
    'stage': 'deploy',
    'serve': 'deploy',
    'verify': 'deploy',
    'browser': 'browser',
    'migrate': 'migrate',
    'changes': 'changes',
    'preview': 'changes',
}


def build_parser(verbs=None):
    parser = argparse.ArgumentParser(prog='town', description=__doc__.split('\n')[0])
    subparsers = parser.add_subparsers(dest='verb', metavar='verb')
    loaded = set()
    for verb, module_name in VERBS.items():
        if verbs is not None and verb not in verbs:
            continue
        if module_name in loaded:
            continue
        loaded.add(module_name)
        try:
            module = importlib.import_module(f'tinytown.{module_name}')
        except ModuleNotFoundError as error:
            if error.name != f'tinytown.{module_name}':
                raise
            continue  # module not present in this checkout
        module.register(subparsers)
    return parser


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    verb = next((a for a in argv if not a.startswith('-')), None)
    if verb in VERBS:
        parser = build_parser({verb})
    else:
        parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, 'run', None):
        parser.print_help()
        return 2
    result = args.run(args)
    if result is None or result is True:
        return 0
    if result is False:
        return 1
    return int(result)


if __name__ == '__main__':
    sys.exit(main())
