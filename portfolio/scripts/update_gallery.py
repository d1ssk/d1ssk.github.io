#!/usr/bin/env python3
"""Import pool images with EXIF metadata, or rebuild the static gallery from JSON."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import html
import json
from pathlib import Path
import re
import shutil
import subprocess
import unicodedata


ROOT = Path(__file__).resolve().parents[1]
POOL = ROOT / "assets" / "pool"
WORKS = ROOT / "assets" / "works"
COLLECTION = ROOT / "collection.json"
SUPPORTED = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def work_id(source):
    name = unicodedata.normalize("NFC", source.stem).lower()
    slug = re.sub(r"[^a-z0-9]+", "-", name).strip("-")
    return slug or "work-" + hashlib.sha256(name.encode("utf-8")).hexdigest()[:10]


def text(value):
    if value is None:
        return ""
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="replace")
    return str(value).strip("\0 ")


def number(value):
    if isinstance(value, (tuple, list)):
        value = value[0] if value else None
    try:
        return float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def decimal(value):
    return f"{value:.2f}".rstrip("0").rstrip(".")


def capture_details(image):
    exif = image.getexif()
    capture = exif.get_ifd(0x8769) if exif.get(0x8769) else {}
    details = []

    def add(label, value):
        if value is not None and text(value):
            details.append({"label": label, "value": text(value)})

    make = text(exif.get(271))
    model = text(exif.get(272))
    brand = make.split()[0] if make else ""
    camera = model if model.lower().startswith(brand.lower()) else " ".join(filter(None, (make, model)))
    add("Camera", camera)
    add("Lens", capture.get(42036))

    aperture = number(capture.get(33437))
    if aperture and aperture > 0:
        add("Aperture", f"f/{decimal(aperture)}")

    exposure = number(capture.get(33434))
    if exposure and exposure > 0:
        reciprocal = 1 / exposure
        rounded = round(reciprocal)
        if exposure < 1 and rounded > 0 and abs(reciprocal - rounded) / reciprocal < 0.01:
            add("Shutter speed", f"1/{rounded} s")
        else:
            add("Shutter speed", f"{exposure:g} s")

    iso = number(capture.get(34855))
    if iso and iso > 0:
        add("ISO", f"{iso:g}")

    focal_length = number(capture.get(37386))
    if focal_length and focal_length > 0:
        add("Focal length", f"{decimal(focal_length)} mm")

    equivalent = number(capture.get(41989))
    if equivalent and equivalent > 0:
        add("35mm equivalent", f"{decimal(equivalent)} mm")

    compensation = number(capture.get(37380))
    if compensation is not None:
        prefix = "+" if compensation > 0 else ""
        add("Exposure compensation", f"{prefix}{decimal(compensation)} EV")

    captured = text(capture.get(36867))
    if captured:
        captured = re.sub(r"^(\d{4}):(\d{2}):(\d{2})", r"\1-\2-\3", captured)
        offset = text(capture.get(36881))
        add("Captured", captured + (f" {offset}" if offset else ""))

    return details


def import_work(source, identifier):
    from PIL import Image

    directory = WORKS / identifier
    directory.mkdir(parents=True, exist_ok=True)
    info_path = directory / "info.json"

    for filename, size, quality in (("thumbnail.webp", 1200, 86), ("full.webp", 2400, 90)):
        output = directory / filename
        if not output.exists() or source.stat().st_mtime > output.stat().st_mtime:
            subprocess.run([
                "magick", str(source) + "[0]", "-auto-orient", "-colorspace", "sRGB",
                "-resize", f"{size}x{size}>", "-strip", "-quality", str(quality),
                "-define", "webp:method=6", str(output),
            ], check=True, capture_output=True, text=True)

    if info_path.exists():
        info = read_json(info_path)
    else:
        with Image.open(source) as image:
            details = capture_details(image)
        info = {
            "title": "",
            "location": "",
            "description": "",
            "alt": "Image by Daichi Sasaki.",
            "details": details,
            "source": source.relative_to(ROOT).as_posix(),
        }

    with Image.open(directory / "thumbnail.webp") as thumbnail:
        width, height = thumbnail.size
    with Image.open(directory / "full.webp") as full:
        full_width, full_height = full.size
    info["image"] = {"width": width, "height": height, "fullWidth": full_width, "fullHeight": full_height}
    write_json(info_path, info)
    return info


def import_pool(collection):
    if not shutil.which("magick"):
        raise RuntimeError("Importing new images requires ImageMagick (magick).")
    try:
        import PIL  # noqa: F401
    except ImportError as error:
        raise RuntimeError("Importing new images requires Pillow (python3 -m pip install Pillow).") from error

    sources = sorted(path for path in POOL.rglob("*") if path.is_file() and not path.name.startswith(".") and path.suffix.lower() in SUPPORTED)
    if not sources:
        raise RuntimeError("No supported images found in assets/pool/.")
    existing = {path.name for path in WORKS.iterdir() if path.is_dir()} if WORKS.exists() else set()
    identifiers = {}
    for source in sources:
        identifier = work_id(source)
        if identifier in identifiers:
            raise RuntimeError(f"Two source files have the same work ID: {identifiers[identifier].name}, {source.name}")
        identifiers[identifier] = source

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(import_work, source, identifier): identifier for identifier, source in identifiers.items()}
        for future in as_completed(futures):
            identifier = futures[future]
            info = future.result()
            print(f"Imported {identifier}: {len(info.get('details', []))} metadata fields", flush=True)

    collection.extend(identifier for identifier in identifiers if identifier not in collection and identifier not in existing)
    write_json(COLLECTION, collection)
    return collection


def gallery_html(collection, information=None):
    if len(collection) != len(set(collection)):
        raise ValueError("collection.json contains duplicate work IDs.")

    figures = []
    for index, identifier in enumerate(collection):
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", identifier):
            raise ValueError(f"Invalid work ID: {identifier}")
        info = information[identifier] if information is not None else read_json(WORKS / identifier / "info.json")
        image = info["image"]
        width, height = image["width"], image["height"]
        asset = f"assets/works/{identifier}"
        sources = [f"{asset}/thumbnail.webp {width}w"]
        if image["fullWidth"] > width:
            sources.append(f"{asset}/full.webp {image['fullWidth']}w")
        loading = 'fetchpriority="high"' if index == 0 else 'loading="lazy"'
        alt = html.escape(info.get("alt") or info.get("title") or "Image by Daichi Sasaki.", quote=True)
        figures.append(f'''        <figure class="work">
          <a class="work-link" href="{asset}/full.webp" data-info="{asset}/info.json" aria-haspopup="dialog">
            <img
              src="{asset}/thumbnail.webp"
              srcset="{', '.join(sources)}"
              sizes="(max-width: 46rem) calc(100vw - 2rem), (max-width: 68rem) 46vw, 24rem"
              width="{width}"
              height="{height}"
              alt="{alt}"
              {loading}
              decoding="async"
            >
          </a>
        </figure>''')

    template = (ROOT / "index.template.html").read_text(encoding="utf-8")
    if template.count("<!-- GALLERY -->") != 1:
        raise ValueError("index.template.html must contain one <!-- GALLERY --> placeholder.")
    return template.replace("<!-- GALLERY -->", "\n\n".join(figures))


def render_gallery(collection):
    (ROOT / "index.html").write_text(gallery_html(collection), encoding="utf-8")
    print(f"Gallery updated: {len(collection)} works", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--import-pool", action="store_true", help="Import all pool images and append new works without overwriting edited information.")
    args = parser.parse_args()

    if COLLECTION.exists():
        collection = read_json(COLLECTION)
    else:
        current = (ROOT / "index.html").read_text(encoding="utf-8") if (ROOT / "index.html").exists() else ""
        collection = list(dict.fromkeys(re.findall(r'href="assets/works/([^/]+)/full\.webp"', current)))
    if args.import_pool:
        collection = import_pool(collection)
    render_gallery(collection)


if __name__ == "__main__":
    main()
