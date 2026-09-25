"""Commit a task's delta to local main without staging unrelated checkout edits."""
from contextlib import contextmanager
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

from . import change_merge


def git(root, *args, env=None, data=None):
    return subprocess.run(['git', '-c', 'core.hooksPath=/dev/null', '-C', str(root), *args],
                          env=env, input=data, capture_output=True, check=True).stdout


def entry(root, ref, name, env=None):
    raw = (git(root, 'ls-files', '--stage', '-z', '--', name, env=env) if ref == ':' else
           git(root, 'ls-tree', '-z', ref, '--', name))
    if not raw:
        return None, None
    rows = raw.rstrip(b'\0').split(b'\0')
    header = rows[0].split(b'\t', 1)[0].split()
    if len(rows) != 1 or (ref == ':' and header[2] != b'0'):
        raise ValueError(f'Resolve the staged conflict in {name} before approving')
    mode = int(header[0], 8)
    if mode not in {0o100644, 0o100755}:
        raise ValueError(f'Cannot commit a non-regular source file: {name}')
    blob = header[1] if ref == ':' else header[2]
    return git(root, 'cat-file', 'blob', blob.decode()), mode & 0o777


def put(root, env, name, content, mode):
    if content is None:
        git(root, 'update-index', '--force-remove', '--', name, env=env)
    else:
        blob = git(root, 'hash-object', '-w', '--stdin', data=content).decode().strip()
        git(root, 'update-index', '--add', '--cacheinfo',
            '100755' if mode & 0o111 else '100644', blob, name, env=env)


@contextmanager
def prepare(root, changes, message):
    """Yield a publish callback. Lock the real index and prepare both indexes first.

    changes contains (path, snapshot bytes, task bytes, snapshot mode, task mode).
    The commit excludes dirt already in the snapshot; the live index retains
    unrelated staged edits. No checkout, branch or real index changes until publish.
    """
    branch = git(root, 'symbolic-ref', '--quiet', '--short', 'HEAD').decode().strip()
    if branch != 'main':
        raise ValueError('Switch the queue checkout to local main before approving. No files were applied.')
    head = git(root, 'rev-parse', 'HEAD').decode().strip()
    index = Path(git(root, 'rev-parse', '--git-path', 'index').decode().strip())
    if not index.is_absolute():
        index = root / index
    lock = index.with_name(index.name + '.lock')
    try:
        stream = lock.open('xb')
    except FileExistsError:
        raise ValueError('Git is updating the index; approve again when it finishes') from None
    try:
        with stream, tempfile.TemporaryDirectory(prefix='town-commit-') as directory:
            commit_env = dict(os.environ, GIT_INDEX_FILE=str(Path(directory) / 'commit-index'))
            staged_env = dict(os.environ, GIT_INDEX_FILE=str(Path(directory) / 'staged-index'))
            git(root, 'read-tree', head, env=commit_env)
            shutil.copyfile(index, staged_env['GIT_INDEX_FILE'])
            for name, baseline, desired, baseline_mode, desired_mode in changes:
                committed, committed_mode = entry(root, head, name)
                staged, staged_mode = entry(root, ':', name, staged_env)
                try:
                    content = change_merge.content(name, baseline, committed, desired)
                    mode = change_merge.value(baseline_mode, committed_mode, desired_mode)
                    next_staged = change_merge.content(name, committed, staged, content)
                    next_mode = change_merge.value(committed_mode, staged_mode, mode)
                except change_merge.Conflict:
                    raise ValueError(f'{name} overlaps uncommitted or staged edits. Separate or commit those edits, then approve again; no files were applied.') from None
                put(root, commit_env, name, content, mode)
                put(root, staged_env, name, next_staged, next_mode)
            tree = git(root, 'write-tree', env=commit_env).decode().strip()
            old_tree = git(root, 'rev-parse', f'{head}^{{tree}}').decode().strip()
            commit = head if tree == old_tree else git(root, 'commit-tree', tree, '-p', head, '-m', message).decode().strip()
            stream.write(Path(staged_env['GIT_INDEX_FILE']).read_bytes())
            stream.flush()
            os.fsync(stream.fileno())

            def publish():
                # Also reject a checkout switch while the source merge was prepared.
                if git(root, 'symbolic-ref', '--quiet', '--short', 'HEAD').decode().strip() != 'main':
                    raise ValueError('Checkout branch changed during approval; approve again on main')
                git(root, 'update-ref', '-m', message.splitlines()[0], 'refs/heads/main', commit, head)
                try:
                    os.replace(lock, index)
                except Exception:
                    git(root, 'update-ref', 'refs/heads/main', head, commit)
                    raise
                return {'target_branch': 'main', 'applied_branch': 'main', 'commit': commit,
                        'previous_head': head, 'created_commit': commit != head}

            yield publish
    finally:
        lock.unlink(missing_ok=True)
