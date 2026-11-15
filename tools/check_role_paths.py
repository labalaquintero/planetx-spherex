#!/usr/bin/env python3
"""Comprueba que los cambios de una rama solo tocan rutas de su dueño (§6) y genera CODEOWNERS.

Solo biblioteca estándar. El mapa ``OWNERS`` es la única fuente de verdad: de él salen tanto
este chequeo como ``.github/CODEOWNERS`` (``--print-codeowners``), y una prueba verifica que
no diverjan.

Uso:
  python3 tools/check_role_paths.py --owner isaac --base origin/main
  python3 tools/check_role_paths.py --owner isaac --base origin/main --ci --map-ref origin/main
  python3 tools/check_role_paths.py --print-codeowners > .github/CODEOWNERS
  python3 tools/check_role_paths.py --check-codeowners .github/CODEOWNERS
  python3 tools/check_role_paths.py --selfcheck

Salida: 0 todo permitido; 1 hay una ruta ajena, desconocida o inválida, o el dueño no existe
(o el mapa / CODEOWNERS no es coherente); 2 error operativo (p. ej. la base no existe).

Formas de una entrada del mapa:
  - ``ruta/exacta.ext``  archivo exacto (no es prefijo de nada)
  - ``dir/``             todo lo que cuelgue de ese directorio (en §6: ``dir/**``)
  - ``dir/patron*.ext``  patrón con ``*`` (no cruza «/»); solo donde §6 lo indica
Las llaves de §6 (``web/src/{App.tsx,...}``) se expanden a archivos exactos.
Una ruta que no coincide con ninguna entrada se reserva hasta que el equipo le ponga dueño.
"""

from __future__ import annotations

import argparse
import ast
import re
import subprocess
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

# --------------------------------------------------------------------------- mapa §6
# Debe ser un literal puro: con --map-ref se lee de la base revisada con ast.literal_eval.
OWNERS: dict[str, list[str]] = {
    "alexis": [
        "docs/contexto/",
        "docs/contratos/",
        "docs/decisiones/",
        "api/planetx/science/",
        "api/tests/science/",
        "web/src/contracts/fixtures/",
    ],
    "isaac": [
        "AGENTS.md",
        "README.md",
        ".gitignore",
        ".gitattributes",
        ".env.example",
        "compose.yaml",
        ".github/",
        "infra/",
        "tools/check_role_paths.py",
        "api/app.py",
        "api/Dockerfile",
        "api/requirements.txt",
        "api/pytest.ini",
        "api/planetx/__init__.py",
        "api/planetx/http/",
        "api/planetx/irsa/",
        "api/tests/http/",
        "experimental/explorar/",  # extra independiente «Explorar»; fuera de §6 a petición de Isaac
    ],
    "devalle": [
        "api/planetx/catalog/",
        "api/migrations/",
        "api/alembic.ini",
        "api/tests/catalog/",
        "docs/datos/modelo/",
        "web/src/features/observation-details/",
    ],
    "santiago": [
        "web/src/App.tsx",
        "web/src/App.css",
        "web/src/main.tsx",
        "web/src/index.css",
        "web/src/app/",
        "web/src/components/",
        "web/src/shared/",
        "web/src/features/viewer/",
        "web/src/test/",
        "web/src/assets/",  # fuera de §6; asignado a Santiago a petición del equipo (ver PR)
        "web/public/",
        "web/package.json",
        "web/pnpm-lock.yaml",
        "web/index.html",
        "web/vite.config.ts",
        "web/README.md",
        "web/.gitignore",
        "web/.oxlintrc.json",
        "web/tsconfig*.json",
        "web/eslint.config.*",
    ],
    "quintero": [
        "web/e2e/",
        "web/playwright.config.ts",
        "docs/qa/aceptacion/",
        "docs/entrega/",
    ],
    "cesar": [
        "docs/qa/datos/",
        "fixtures/data_qa/",
        "api/tests/data_qa/",
        "web/src/features/data-notice/",
    ],
}

# Columna «Revisores y relación» de §6: todas las personas nombradas para cada dueño.
REVIEWERS: dict[str, list[str]] = {
    "alexis": ["isaac", "cesar", "santiago"],
    "isaac": ["alexis", "devalle", "quintero"],
    "devalle": ["isaac", "cesar", "santiago"],
    "santiago": ["quintero", "isaac", "devalle", "cesar"],
    "quintero": ["cesar", "santiago", "isaac"],
    "cesar": ["alexis", "devalle", "santiago", "quintero"],
}

# El control de rutas y CODEOWNERS son de Isaac pero exigen la revisión de un segundo dueño.
CONTROL_PATHS: list[str] = ["tools/check_role_paths.py", ".github/"]
CONTROL_OWNER = "isaac"
CONTROL_SECOND_OWNER = "alexis"
# Regla comodín de menor precedencia: una ruta sin dueño igualmente pide una revisión.
CATCH_ALL_OWNER = "isaac"

SELF_PATH = "tools/check_role_paths.py"
PLACEHOLDER = "@GITHUB_"


class ToolError(Exception):
    """Error operativo (git, lectura de mapa): sale con 2."""


# --------------------------------------------------------------------- coincidencias
def _kind(entry: str) -> str:
    if entry.endswith("/"):
        return "dir"
    return "glob" if "*" in entry else "file"


def _glob_regex(entry: str) -> re.Pattern[str]:
    return re.compile(re.escape(entry).replace(r"\*", "[^/]*") + r"\Z")


def entry_matches(entry: str, path: str) -> bool:
    kind = _kind(entry)
    if kind == "dir":
        return path.startswith(entry)
    if kind == "glob":
        return _glob_regex(entry).match(path) is not None
    return path == entry


def owners_of(path: str, owners: Mapping[str, Sequence[str]]) -> list[str]:
    return [name for name, entries in owners.items() if any(entry_matches(e, path) for e in entries)]


def invalid_path_reason(path: str) -> str | None:
    """Rutas que nunca se aceptan, ni siquiera para su dueño."""
    if not path:
        return "vacía"
    if path.startswith("/"):
        return "absoluta"
    if "\\" in path:
        return "contiene «\\»"
    if any(ord(ch) < 0x20 or ord(ch) == 0x7F for ch in path):
        return "contiene caracteres de control"
    if any(seg in ("", ".", "..") for seg in path.split("/")):
        return "segmentos vacíos, «.» o «..»"
    return None


@dataclass(frozen=True)
class Violation:
    kind: str  # "invalida" | "desconocida" | "ajena"
    path: str
    detail: str = ""


def check_paths(owner: str, paths: Sequence[str], owners: Mapping[str, Sequence[str]]) -> list[Violation]:
    out: list[Violation] = []
    for path in sorted(set(paths)):
        reason = invalid_path_reason(path)
        if reason:
            out.append(Violation("invalida", path, reason))
            continue
        matched = owners_of(path, owners)
        if owner in matched:
            continue
        if matched:
            out.append(Violation("ajena", path, "dueño: " + ", ".join(matched)))
        else:
            out.append(Violation("desconocida", path, "sin dueño en el mapa de §6"))
    return out


# -------------------------------------------------------------- coherencia del mapa
def _overlap(a: str, b: str) -> bool:
    ka, kb = _kind(a), _kind(b)
    if ka == "file" and kb == "file":
        return a == b
    if ka == "dir" and kb == "dir":
        return a.startswith(b) or b.startswith(a)
    if {ka, kb} == {"dir", "file"}:
        d, f = (a, b) if ka == "dir" else (b, a)
        return f.startswith(d)
    if {ka, kb} == {"glob", "file"}:
        g, f = (a, b) if ka == "glob" else (b, a)
        return _glob_regex(g).match(f) is not None
    if {ka, kb} == {"glob", "dir"}:
        g, d = (a, b) if ka == "glob" else (b, a)
        return (g.rpartition("/")[0] + "/").startswith(d)
    return a == b  # glob frente a glob: solo se detecta la igualdad (documentado)


_ENTRY_OK = re.compile(r"[A-Za-z0-9._@+-]+(?:/[A-Za-z0-9._@+*-]+)*/?\Z")


def validate_map(owners: Mapping[str, Sequence[str]]) -> list[str]:
    """Problemas del mapa: entradas mal formadas o dos dueños para una misma ruta."""
    problems: list[str] = []
    flat: list[tuple[str, str]] = []
    for name, entries in owners.items():
        for entry in entries:
            if not _ENTRY_OK.match(entry) or ".." in entry.split("/") or "**" in entry:
                problems.append(f"entrada inválida de {name}: {entry!r}")
            elif "*" in entry and "*" in entry.rpartition("/")[0]:
                problems.append(f"«*» solo se admite en el último segmento: {entry!r}")
            else:
                flat.append((name, entry))
    for i, (owner_a, a) in enumerate(flat):
        for owner_b, b in flat[i + 1 :]:
            if _overlap(a, b):
                problems.append(f"solape entre {owner_a} ({a}) y {owner_b} ({b})")
    return problems


# ---------------------------------------------------------------------------- git
def _git(repo: Path, *args: str) -> bytes:
    try:
        proc = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, check=False)
    except OSError as exc:
        raise ToolError(f"no se pudo ejecutar git: {exc}") from None
    if proc.returncode != 0:
        detail = proc.stderr.decode("utf-8", "replace").strip().splitlines()
        raise ToolError(f"git {args[0]} falló: {detail[-1] if detail else 'sin detalle'}")
    return proc.stdout


def changed_paths(repo: Path, base: str, *, include_local: bool) -> set[str]:
    """Rutas cambiadas respecto a la base (merge-base). ``--no-renames`` muestra origen y destino."""
    chunks = [_git(repo, "diff", "--name-only", "-z", "--no-renames", f"{base}...HEAD")]
    if include_local:
        chunks.append(_git(repo, "diff", "--name-only", "-z", "--no-renames"))
        chunks.append(_git(repo, "diff", "--cached", "--name-only", "-z", "--no-renames"))
        chunks.append(_git(repo, "ls-files", "--others", "--exclude-standard", "-z"))
    paths: set[str] = set()
    for chunk in chunks:
        for raw in chunk.split(b"\0"):
            if raw:
                paths.add(raw.decode("utf-8", "surrogateescape"))
    return paths


def owners_from_ref(repo: Path, ref: str) -> dict[str, list[str]]:
    """Lee ``OWNERS`` de la copia de este script en ``ref`` sin ejecutarla (``ast.literal_eval``)."""
    source = _git(repo, "show", f"{ref}:{SELF_PATH}").decode("utf-8")
    for node in ast.parse(source).body:
        target = None
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            target, value = node.target.id, node.value
        elif isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            target, value = node.targets[0].id, node.value
        if target == "OWNERS" and value is not None:
            try:
                data = ast.literal_eval(value)
            except ValueError:
                raise ToolError(f"OWNERS en {ref} no es un literal") from None
            if isinstance(data, dict) and all(isinstance(v, list) for v in data.values()):
                return data
    raise ToolError(f"no se encontró OWNERS en {ref}:{SELF_PATH}")


# ------------------------------------------------------------------------ CODEOWNERS
def _tokens(*names: str, users: Mapping[str, str]) -> str:
    seen: list[str] = []
    for name in names:
        token = users.get(name) or f"{PLACEHOLDER}{name.upper()}"
        if token not in seen:
            seen.append(token)
    return " ".join(seen)


def codeowners_rules(users: Mapping[str, str] | None = None) -> list[tuple[str, list[str]]]:
    """[(patrón, [propietarios])] en orden de precedencia creciente (gana la última coincidencia)."""
    users = users or {}
    rules: list[tuple[str, list[str]]] = [("*", _tokens(CATCH_ALL_OWNER, users=users).split())]
    for owner, entries in OWNERS.items():
        who = _tokens(owner, *REVIEWERS[owner], users=users).split()
        rules += [(f"/{entry}", who) for entry in entries]
    control = _tokens(CONTROL_OWNER, CONTROL_SECOND_OWNER, users=users).split()
    rules += [(f"/{entry}", control) for entry in CONTROL_PATHS]
    return rules


def codeowners_text(users: Mapping[str, str] | None = None) -> str:
    users = users or {}
    lines = [
        "# GENERADO por tools/check_role_paths.py --print-codeowners. No editar a mano:",
        "# cambia el mapa OWNERS de esa herramienta y regenera. Una prueba comprueba la coincidencia.",
        "#",
        "# Cada ruta lista a su dueño (§6) y a los revisores de la columna «Revisores y relación».",
        "# Basta la aprobación de uno de ellos y la del autor no cuenta. Para bloquear la fusión hay",
        "# que exigir la revisión de los code owners con una regla de rama de GitHub.",
        "# Marcadores @GITHUB_<NOMBRE>: reemplazar por los usuarios de GitHub verificados.",
        "",
        "# Regla comodín de menor precedencia: una ruta sin dueño en el mapa pide la revisión de Isaac.",
    ]
    rules = codeowners_rules(users)
    lines.append(f"{rules[0][0]} {' '.join(rules[0][1])}")
    index = 1
    for owner, entries in OWNERS.items():
        lines += ["", f"# {owner}"]
        for _ in entries:
            pattern, who = rules[index]
            lines.append(f"{pattern} {' '.join(who)}")
            index += 1
    lines += ["", "# Control de rutas y CODEOWNERS: Isaac y además un segundo dueño (Alexis)."]
    lines += [f"{pattern} {' '.join(who)}" for pattern, who in rules[index:]]
    return "\n".join(lines) + "\n"


def parse_codeowners(text: str) -> list[tuple[str, list[str]]]:
    rules: list[tuple[str, list[str]]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            pattern, *who = stripped.split()
            rules.append((pattern, who))
    return rules


def verify_codeowners(text: str) -> list[str]:
    """Compara un CODEOWNERS con el generado: mismos patrones, orden y estructura de propietarios.

    Los marcadores @GITHUB_* pueden sustituirse por usuarios reales, siempre que cada rol
    corresponda a un único usuario y dos roles no compartan usuario.
    """
    expected = codeowners_rules()
    actual = parse_codeowners(text)
    problems: list[str] = []
    if [p for p, _ in actual] != [p for p, _ in expected]:
        missing = [p for p, _ in expected if p not in {q for q, _ in actual}]
        extra = [p for p, _ in actual if p not in {q for q, _ in expected}]
        problems.append(f"los patrones no coinciden con el mapa (faltan {missing[:3]}, sobran {extra[:3]})")
        return problems
    role_to_login: dict[str, str] = {}
    login_to_role: dict[str, str] = {}
    for (pattern, want), (_, have) in zip(expected, actual):
        if len(want) != len(have):
            problems.append(f"{pattern}: se esperaban {len(want)} propietarios y hay {len(have)}")
            continue
        for placeholder, login in zip(want, have):
            if not login.startswith("@") or login.startswith("@@") or len(login) < 2:
                problems.append(f"{pattern}: propietario inválido {login!r}")
                continue
            if role_to_login.setdefault(placeholder, login) != login:
                problems.append(f"{pattern}: {placeholder} aparece como {login} y como {role_to_login[placeholder]}")
            if login_to_role.setdefault(login, placeholder) != placeholder:
                problems.append(f"{pattern}: {login} se usa para {placeholder} y para {login_to_role[login]}")
    return problems


def pending_placeholders(text: str) -> int:
    return sum(1 for _, who in parse_codeowners(text) for token in who if token.startswith(PLACEHOLDER))


# --------------------------------------------------------------------------- CLI
def _safe(path: str) -> str:
    return path.encode("utf-8", "backslashreplace").decode("utf-8")


def _parse_users(values: Sequence[str]) -> dict[str, str]:
    users: dict[str, str] = {}
    for value in values:
        name, sep, login = value.partition("=")
        if not sep or name not in OWNERS or not re.fullmatch(r"@[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})", login):
            raise ToolError(f"--user inválido: {value!r} (se espera dueño=@usuario)")
        users[name] = login
    return users


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Comprueba rutas por dueño (§6) y genera CODEOWNERS.")
    p.add_argument("--owner", help="dueño: " + ", ".join(OWNERS))
    p.add_argument("--base", default="origin/main", help="base confirmada (por defecto origin/main)")
    p.add_argument("--repo", default=".", help="directorio del repositorio (por defecto .)")
    p.add_argument("--ci", action="store_true", help="solo lo confirmado (BASE...HEAD), sin cambios locales")
    p.add_argument("--map-ref", metavar="REF", help="leer el mapa de la copia de este script en REF")
    p.add_argument("--selfcheck", action="store_true", help="validar el mapa y salir")
    p.add_argument("--print-codeowners", action="store_true", help="imprimir CODEOWNERS generado")
    p.add_argument("--user", action="append", default=[], metavar="DUEÑO=@USUARIO")
    p.add_argument("--check-codeowners", metavar="ARCHIVO", help="verificar un CODEOWNERS contra el mapa")
    return p


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.selfcheck:
            problems = validate_map(OWNERS)
            problems += [f"REVIEWERS inválido para {k}" for k, v in REVIEWERS.items() if k not in OWNERS or any(x not in OWNERS for x in v)]
            for problem in problems:
                print(f"mapa: {problem}")
            print("mapa coherente" if not problems else f"{len(problems)} problema(s) en el mapa")
            return 1 if problems else 0

        if args.print_codeowners:
            sys.stdout.write(codeowners_text(_parse_users(args.user)))
            return 0

        if args.check_codeowners:
            text = Path(args.check_codeowners).read_text(encoding="utf-8")
            problems = verify_codeowners(text)
            for problem in problems:
                print(f"CODEOWNERS: {problem}")
            pending = pending_placeholders(text)
            if pending:
                print(f"aviso: {pending} marcador(es) {PLACEHOLDER}* pendientes de sustituir por usuarios")
            print("CODEOWNERS coherente con el mapa" if not problems else f"{len(problems)} problema(s)")
            return 1 if problems else 0

        repo = Path(args.repo)
        owners: Mapping[str, Sequence[str]] = owners_from_ref(repo, args.map_ref) if args.map_ref else OWNERS
        if not args.owner:
            print("falta --owner")
            return 1
        owner = args.owner.strip().lower()
        if owner not in owners:
            print(f"dueño inválido: {_safe(args.owner)!r} (válidos: {', '.join(owners)})")
            return 1

        paths = changed_paths(repo, args.base, include_local=not args.ci)
        violations = check_paths(owner, sorted(paths), owners)
        for v in violations:
            print(f"{v.kind.upper():11s} {_safe(v.path)}  [{v.detail}]")
        source = f"mapa de {args.map_ref}" if args.map_ref else "mapa local"
        if violations:
            print(f"BLOQUEADO: {len(violations)} ruta(s) fuera del alcance de {owner} ({len(paths)} cambiadas; {source})")
            return 1
        print(f"OK: {len(paths)} ruta(s) cambiadas, todas de {owner} ({source})")
        return 0
    except ToolError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
