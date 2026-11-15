"""Tareas de administración local del espacio compartido."""

import argparse
import os
import secrets
from getpass import getpass

from planetx.http.factory import _from_repo_root
from planetx.workspace.models import Login, normalize_email
from planetx.workspace.store import Workspace, password_hash


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    set_role = commands.add_parser("set-role", help="Cambia el rol de una cuenta registrada.")
    set_role.add_argument("email")
    set_role.add_argument("role", choices=("collaborator", "reviewer", "admin"))
    reset = commands.add_parser("reset-password", help="Restablece la contraseña y revoca las sesiones.")
    reset.add_argument("email")
    args = parser.parse_args()
    path = os.environ.get("PLANETX_WORKSPACE_DB")
    if not path:
        parser.error("Define PLANETX_WORKSPACE_DB con la ruta de la base de datos.")
    try:
        email = normalize_email(args.email)
    except ValueError as exc:
        parser.error(str(exc))
    workspace = Workspace(_from_repo_root(path))
    if args.command == "reset-password":
        password = getpass("Nueva contraseña (15–128 caracteres): ")
        if password != getpass("Confirma la contraseña: ") or not 15 <= len(password) <= 128:
            parser.error("Las contraseñas deben coincidir y tener de 15 a 128 caracteres.")
        fields = Login(email=email, password=password)
        salt = secrets.token_bytes(16)
        digest = password_hash(fields.password, salt)
    with workspace.connect(write=True) as db:
        account = db.execute("SELECT id FROM accounts WHERE email = ?", (email,)).fetchone()
        if account is None:
            parser.error("La cuenta todavía no está registrada.")
        if args.command == "set-role":
            db.execute("UPDATE accounts SET role = ? WHERE id = ?", (args.role, account["id"]))
        else:
            db.execute("UPDATE accounts SET salt = ?, password_hash = ? WHERE id = ?", (salt, digest, account["id"]))
            db.execute("DELETE FROM sessions WHERE account_id = ?", (account["id"],))
    print("Cuenta actualizada.")


if __name__ == "__main__":
    main()
