#!/usr/bin/env python3
"""Run the portfolio editor locally: python3 scripts/serve_editor.py."""
import argparse
import hashlib
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
from pathlib import Path
import secrets
from urllib.parse import urlsplit

import update_gallery as gallery

EDITOR = Path(__file__).resolve().parent / "editor"
TOKEN = secrets.token_urlsafe(32)


def revision():
    digest = hashlib.sha256(gallery.COLLECTION.read_bytes())
    for path in sorted(gallery.WORKS.glob("*/info.json")):
        digest.update(path.parent.name.encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def catalog():
    return {path.parent.name: gallery.read_json(path)
            for path in sorted(gallery.WORKS.glob("*/info.json"))}


def validate_metadata(changes, available):
    if not isinstance(changes, dict):
        raise ValueError("作品情報が不正です。")
    result = dict(available)
    for identifier, fields in changes.items():
        if identifier not in available or not isinstance(fields, dict):
            raise ValueError("作品情報のIDまたは形式が不正です。")
        if set(fields) - {"title", "location", "description", "alt", "details", "visibility"}:
            raise ValueError("画像寸法・元ファイルなどの管理情報は変更できません。")
        for key in ("title", "location", "description", "alt"):
            if key in fields and not isinstance(fields[key], str):
                raise ValueError(f"{key} は文字列で入力してください。")
        if "visibility" in fields:
            visibility = fields["visibility"]
            if (not isinstance(visibility, dict) or
                    set(visibility) - {"title", "location", "description"} or
                    any(not isinstance(value, bool) for value in visibility.values())):
                raise ValueError("表示設定が不正です。")
        if "details" in fields:
            details = fields["details"]
            if not isinstance(details, list) or any(
                not isinstance(entry, dict) or
                not isinstance(entry.get("label"), str) or
                not isinstance(entry.get("value"), str) or
                ("show" in entry and not isinstance(entry["show"], bool))
                for entry in details
            ):
                raise ValueError("詳細情報は項目名・値・表示設定を指定してください。")
        result[identifier] = {**available[identifier], **fields}
    return result


def save_collection(collection, expected_revision, changes=None):
    if expected_revision != revision():
        raise FileExistsError("別の変更が見つかりました。ページを再読み込みして確認してください。")
    available = catalog()
    if not isinstance(collection, list) or any(not isinstance(item, str) or item not in available for item in collection):
        raise ValueError("作品一覧が不正です。")
    information = validate_metadata({} if changes is None else changes, available)
    # Render and validate everything before writing. Keep original bytes for rollback.
    rendered = gallery.gallery_html(collection, information)
    outputs = {
        gallery.COLLECTION: (json.dumps(collection, ensure_ascii=False, indent=2) + "\n").encode(),
        gallery.ROOT / "index.html": rendered.encode(),
    }
    for identifier, info in information.items():
        if info != available[identifier]:
            outputs[gallery.WORKS / identifier / "info.json"] = (
                json.dumps(info, ensure_ascii=False, indent=2) + "\n").encode()
    originals = {path: path.read_bytes() for path in outputs}
    written = []
    try:
        for path, content in outputs.items():
            written.append(path)
            path.write_bytes(content)
    except OSError:
        for path in reversed(written):
            path.write_bytes(originals[path])
        raise
    return revision()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(gallery.ROOT), **kwargs)

    def allowed(self):
        port = self.server.server_port
        hosts = {f"localhost:{port}", f"127.0.0.1:{port}"}
        return (self.headers.get("Host") in hosts and
                self.headers.get("Origin") in (None, *[f"http://{host}" for host in hosts]))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def respond(self, value, status=200):
        data = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if not self.allowed():
            self.send_error(403)
            return
        path = urlsplit(self.path).path
        if path == "/api/collection":
            try:
                self.respond({"collection": gallery.read_json(gallery.COLLECTION),
                              "works": catalog(), "revision": revision(), "token": TOKEN})
            except (OSError, ValueError) as error:
                self.respond({"error": str(error)}, 500)
        elif path in ("/editor", "/editor/", "/editor/editor.js", "/editor/editor.css"):
            filename = path.rsplit("/", 1)[-1]
            if filename in ("editor", ""):
                filename = "index.html"
            content = (EDITOR / filename).read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css"}[Path(filename).suffix])
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            super().do_GET()

    def do_POST(self):
        if not self.allowed() or self.headers.get("X-Editor-Token") != TOKEN:
            self.send_error(403)
            return
        if self.path != "/api/collection":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 2000000:
                raise ValueError("リクエストのサイズが不正です。")
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError("リクエストが不正です。")
            new_revision = save_collection(payload.get("collection"), payload.get("revision"), payload.get("changes"))
            self.respond({"revision": new_revision})
        except FileExistsError as error:
            self.respond({"error": str(error)}, 409)
        except (ValueError, TypeError) as error:
            self.respond({"error": str(error)}, 400)
        except OSError as error:
            self.respond({"error": str(error)}, 500)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    server = HTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Portfolio editor: http://localhost:{server.server_port}/editor/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
