"""Pruebas de tools/check_role_paths.py y de .github/CODEOWNERS. Sin red; repos git temporales."""

import importlib.util
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
TOOL = REPO_ROOT / "tools" / "check_role_paths.py"

spec = importlib.util.spec_from_file_location("check_role_paths", TOOL)
tool = importlib.util.module_from_spec(spec)
sys.modules["check_role_paths"] = tool
spec.loader.exec_module(tool)


# ------------------------------------------------------------------ clasificación
@pytest.mark.parametrize(
    ("owner", "path", "verdict"),
    [
        ("isaac", "api/planetx/irsa/adapter.py", "ok"),
        ("isaac", "api/tests/http/test_x.py", "ok"),
        ("isaac", ".github/CODEOWNERS", "ok"),
        ("isaac", "tools/check_role_paths.py", "ok"),
        ("isaac", "api/planetx/catalog/reader.py", "ajena"),
        ("isaac", "web/src/App.tsx", "ajena"),
        ("santiago", "web/src/App.tsx", "ok"),
        ("santiago", "web/src/assets/hero.png", "ok"),  # fuera de §6, asignado a Santiago
        ("santiago", "web/tsconfig.app.json", "ok"),  # patrón con «*»
        ("santiago", "web/eslint.config.js", "ok"),
        ("alexis", "docs/contexto/roles/02_Isaac.md", "ok"),
        ("cesar", "fixtures/data_qa/qa_01.json", "ok"),
        ("quintero", "web/e2e/smoke.spec.ts", "ok"),
        # lo que NO debe coincidir
        ("santiago", "web/App.tsx.bak", "desconocida"),  # un archivo exacto no es prefijo
        ("santiago", "web/src/App.tsx.bak", "desconocida"),
        ("santiago", "web/tsconfig/x.json", "desconocida"),  # «*» no cruza «/»
        ("isaac", "api/tests/httpx/y.py", "desconocida"),  # un directorio exige «/»
        ("isaac", "api/planetx/http_extra/z.py", "desconocida"),
        ("isaac", "tools/otro.py", "desconocida"),  # en tools/ solo el script de control
        ("isaac", "random.txt", "desconocida"),
        ("isaac", "api/appx.py", "desconocida"),
    ],
)
def test_classification(owner, path, verdict):
    violations = tool.check_paths(owner, [path], tool.OWNERS)
    assert ("ok" if not violations else violations[0].kind) == verdict


@pytest.mark.parametrize(
    "path",
    ["", "/etc/passwd", "../x", "a/../b", "a//b", "a/./b", "a\\b", "api/tests/http/x\ny.py", "api/app.py\0", "api/\x07x"],
)
def test_invalid_paths_never_pass_even_for_their_owner(path):
    violations = tool.check_paths("isaac", [path], tool.OWNERS)
    assert [v.kind for v in violations] == ["invalida"]


def test_one_foreign_path_blocks_among_many_allowed():
    paths = ["api/app.py", "README.md", "api/planetx/irsa/x.py", "api/planetx/catalog/reader.py"]
    assert [v.path for v in tool.check_paths("isaac", paths, tool.OWNERS)] == ["api/planetx/catalog/reader.py"]


def test_real_map_is_coherent_and_disjoint():
    assert tool.validate_map(tool.OWNERS) == []
    assert set(tool.REVIEWERS) == set(tool.OWNERS)
    assert tool.owners_of("web/src/assets/x.svg", tool.OWNERS) == ["santiago"]  # un solo dueño


@pytest.mark.parametrize(
    "bad",
    [
        {"a": ["x/"], "b": ["x/y.py"]},  # directorio contra archivo
        {"a": ["x/"], "b": ["x/y/"]},  # directorio contra directorio
        {"a": ["web/tsconfig*.json"], "b": ["web/tsconfig.app.json"]},  # patrón contra archivo
        {"a": ["web/*.json"], "b": ["web/"]},  # patrón contra directorio
        {"a": ["a.py"], "b": ["a.py"]},  # duplicado
        {"a": ["x/**"]},
        {"a": ["../x"]},
        {"a": ["/abs"]},
        {"a": ["web/*/x.py"]},  # «*» fuera del último segmento
        {"a": ["web/{a,b}.py"]},  # las llaves se expanden en el mapa, no se interpretan
    ],
)
def test_validate_map_detects_problems(bad):
    assert tool.validate_map(bad)


# ----------------------------------------------------------------- repo temporal
ENV = {**os.environ, "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_SYSTEM": os.devnull}


def git(repo, *args, **kw):
    cmd = ["git", "-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", *args]
    return subprocess.run(cmd, cwd=repo, env=ENV, check=True, capture_output=True, **kw)


def write(repo, rel, text="x\n"):
    path = Path(repo) / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


@pytest.fixture
def repo(tmp_path):
    root = tmp_path / "repo"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    for rel in ("README.md", "api/app.py", "api/planetx/catalog/reader.py", "web/src/App.tsx", "old name.txt"):
        write(root, rel)
    write(root, "tools/check_role_paths.py", TOOL.read_text())
    git(root, "add", "-A")
    git(root, "commit", "-q", "-m", "base")
    git(root, "switch", "-q", "-c", "feature")
    return root


def run(repo, *argv):
    out = subprocess.run([sys.executable, str(TOOL), "--repo", str(repo), *argv], capture_output=True, text=True, env=ENV)
    return out.returncode, out.stdout + out.stderr


def commit_all(repo, msg="c"):
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", msg)


def test_only_own_paths_exit_zero(repo):
    write(repo, "api/planetx/irsa/new.py")
    write(repo, "README.md", "cambio\n")
    commit_all(repo)
    code, out = run(repo, "--owner", "isaac", "--base", "main")
    assert code == 0 and "OK" in out


def test_one_foreign_committed_path_blocks(repo):
    write(repo, "api/planetx/irsa/new.py")
    write(repo, "api/planetx/catalog/reader.py", "cambio ajeno\n")
    commit_all(repo)
    code, out = run(repo, "--owner", "isaac", "--base", "main")
    assert code == 1 and "AJENA" in out and "api/planetx/catalog/reader.py" in out and "devalle" in out
    assert "irsa/new.py" not in out


def test_every_source_of_change_is_detected(repo):
    write(repo, "api/planetx/catalog/committed.py")  # confirmado
    commit_all(repo)
    write(repo, "web/src/App.tsx", "sin stage\n")  # modificado sin stage
    write(repo, "docs/qa/datos/staged.md")  # con stage
    git(repo, "add", "docs/qa/datos/staged.md")
    write(repo, "random untracked.txt")  # sin seguimiento
    code, out = run(repo, "--owner", "isaac", "--base", "main")
    assert code == 1
    for expected in ("api/planetx/catalog/committed.py", "web/src/App.tsx", "docs/qa/datos/staged.md", "random untracked.txt"):
        assert expected in out
    # --ci solo mira lo confirmado
    code, out = run(repo, "--owner", "isaac", "--base", "main", "--ci")
    assert code == 1 and "committed.py" in out and "App.tsx" not in out and "untracked" not in out


def test_rename_exposes_both_origin_and_destination(repo):
    (repo / "api/planetx/http").mkdir(parents=True)
    git(repo, "mv", "api/planetx/catalog/reader.py", "api/planetx/http/reader.py")  # origen ajeno, destino propio
    commit_all(repo)
    code, out = run(repo, "--owner", "isaac", "--base", "main")
    assert code == 1 and "api/planetx/catalog/reader.py" in out  # el borrado del origen cuenta


def test_odd_filenames_are_handled(repo):
    write(repo, "api/planetx/irsa/con espacio.py")
    write(repo, "api/planetx/irsa/ñandú.py")
    commit_all(repo)
    assert run(repo, "--owner", "isaac", "--base", "main")[0] == 0
    write(repo, "api/planetx/irsa/nueva\nlinea.py")  # nombre con salto de línea: inválido
    code, out = run(repo, "--owner", "isaac", "--base", "main")
    assert code == 1 and "INVALIDA" in out


def test_invalid_owner_exits_one_and_bad_base_exits_two(repo):
    assert run(repo, "--owner", "bob", "--base", "main")[0] == 1
    assert run(repo, "--owner", "césar", "--base", "main")[0] == 1  # sin acento: «cesar»
    assert run(repo, "--base", "main")[0] == 1
    code, out = run(repo, "--owner", "isaac", "--base", "no-existe")
    assert code == 2 and "error" in out


def test_owner_is_case_insensitive_and_cesar_unaccented(repo):
    write(repo, "docs/qa/datos/x.md")
    commit_all(repo)
    assert run(repo, "--owner", "CESAR", "--base", "main")[0] == 0


def test_branch_cannot_grant_itself_permissions_with_map_ref(repo):
    # La rama edita su propia copia del script para darse la ruta ajena.
    tool_copy = repo / "tools" / "check_role_paths.py"
    tool_copy.write_text(tool_copy.read_text().replace('"api/app.py",', '"api/app.py",\n        "web/src/App.tsx",', 1))
    write(repo, "web/src/App.tsx", "ajeno\n")
    commit_all(repo)
    run_copy = lambda *a: subprocess.run(  # noqa: E731  (se ejecuta la copia modificada de la rama)
        [sys.executable, str(tool_copy), "--repo", str(repo), *a], capture_output=True, text=True, env=ENV
    )
    # Sin --map-ref confía en el mapa que trae la propia rama: se auto-autoriza (el riesgo).
    assert run_copy("--owner", "isaac", "--base", "main", "--ci", "--map-ref", "HEAD").returncode == 0
    # Con el mapa de la base revisada no puede.
    blocked = run_copy("--owner", "isaac", "--base", "main", "--ci", "--map-ref", "main")
    assert blocked.returncode == 1 and "web/src/App.tsx" in blocked.stdout and "mapa de main" in blocked.stdout


def test_map_ref_missing_or_not_literal_exits_two(repo):
    assert run(repo, "--owner", "isaac", "--base", "main", "--map-ref", "no-existe")[0] == 2
    tool_copy = repo / "tools" / "check_role_paths.py"
    tool_copy.write_text("OWNERS = {k: [] for k in 'ab'}\n")  # no es un literal puro: no se ejecuta
    commit_all(repo)
    assert run(repo, "--owner", "isaac", "--base", "main", "--map-ref", "HEAD")[0] == 2


def test_selfcheck_cli():
    assert subprocess.run([sys.executable, str(TOOL), "--selfcheck"], capture_output=True).returncode == 0


# ------------------------------------------------------------------- CODEOWNERS
def effective_owners(rules, path):
    """Simula GitHub: gana la última regla que coincide."""
    result = None
    for pattern, who in rules:
        if pattern == "*":
            hit = True
        elif pattern.endswith("/"):
            hit = path.startswith(pattern[1:])
        elif "*" in pattern:
            hit = re.fullmatch(re.escape(pattern[1:]).replace(r"\*", "[^/]*"), path) is not None
        else:
            hit = path == pattern[1:]
        if hit:
            result = who
    return result


def test_committed_codeowners_matches_the_map():
    text = (REPO_ROOT / ".github" / "CODEOWNERS").read_text()
    assert tool.verify_codeowners(text) == []
    code = subprocess.run([sys.executable, str(TOOL), "--check-codeowners", str(REPO_ROOT / ".github" / "CODEOWNERS")]).returncode
    assert code == 0


def test_codeowners_file_is_syntactically_safe():
    text = (REPO_ROOT / ".github" / "CODEOWNERS").read_text()
    for line in text.splitlines():
        assert line == line.rstrip() and "{" not in line and "}" not in line  # CODEOWNERS no admite llaves
        if line and not line.startswith("#"):
            pattern, *who = line.split()
            assert pattern == "*" or pattern.startswith("/")
            assert who and all(w.startswith("@") for w in who)


def test_codeowners_precedence_owner_reviewers_catch_all_and_control_paths():
    rules = tool.parse_codeowners(tool.codeowners_text())
    assert rules[0] == ("*", ["@GITHUB_ISAAC"])  # el comodín va primero: menor precedencia
    assert effective_owners(rules, "random.txt") == ["@GITHUB_ISAAC"]  # sin dueño: pide a Isaac
    assert effective_owners(rules, "api/planetx/catalog/reader.py") == [
        "@GITHUB_DEVALLE", "@GITHUB_ISAAC", "@GITHUB_CESAR", "@GITHUB_SANTIAGO"  # dueño + revisores de la tabla
    ]
    assert effective_owners(rules, "web/src/assets/hero.png")[0] == "@GITHUB_SANTIAGO"
    assert effective_owners(rules, "web/tsconfig.app.json")[0] == "@GITHUB_SANTIAGO"
    # Control: Isaac y un segundo dueño (Alexis), no el resto de revisores de Isaac.
    for control in ("tools/check_role_paths.py", ".github/CODEOWNERS", ".github/workflows/ci.yml"):
        assert effective_owners(rules, control) == ["@GITHUB_ISAAC", "@GITHUB_ALEXIS"]
    # Todo archivo del mapa resuelve a su dueño como primer propietario.
    for owner, entries in tool.OWNERS.items():
        for entry in entries:
            sample = entry + "x.txt" if entry.endswith("/") else entry.replace("*", "x")
            if sample in tool.CONTROL_PATHS or sample.startswith(".github/"):
                continue
            assert effective_owners(rules, sample)[0] == f"@GITHUB_{owner.upper()}", sample


def test_verify_codeowners_accepts_real_logins_but_catches_drift():
    users = {name: f"@user-{name}" for name in tool.OWNERS}
    assert tool.verify_codeowners(tool.codeowners_text(users)) == []  # sustituir marcadores es válido
    text = tool.codeowners_text()
    assert tool.pending_placeholders(text) > 0 and tool.pending_placeholders(tool.codeowners_text(users)) == 0

    lines = text.splitlines()
    first_rule = next(i for i, l in enumerate(lines) if l.startswith("/docs/contexto/"))
    assert tool.verify_codeowners("\n".join(lines[:first_rule] + lines[first_rule + 1 :])) != []  # falta una ruta
    assert tool.verify_codeowners(text.replace("/docs/contexto/", "/docs/contexto/extra/")) != []  # patrón distinto
    assert tool.verify_codeowners(text.replace("@GITHUB_CESAR", "")) != []  # faltan propietarios
    swapped = tool.codeowners_text({**users, "cesar": "@user-isaac"})  # dos roles con el mismo usuario
    assert tool.verify_codeowners(swapped) != []
    mixed = text.replace("@GITHUB_ALEXIS", "@user-a", 1)  # un rol con dos nombres distintos
    assert tool.verify_codeowners(mixed) != []
    assert tool.verify_codeowners(text.replace("@GITHUB_ISAAC", "ISAAC", 1)) != []  # sin «@»


def test_print_codeowners_user_flag_and_validation():
    out = subprocess.run([sys.executable, str(TOOL), "--print-codeowners", "--user", "isaac=@isaac-gh"], capture_output=True, text=True)
    assert out.returncode == 0 and "@isaac-gh" in out.stdout and "@GITHUB_ISAAC" not in out.stdout
    bad = subprocess.run([sys.executable, str(TOOL), "--print-codeowners", "--user", "bob=@x"], capture_output=True, text=True)
    assert bad.returncode == 2
