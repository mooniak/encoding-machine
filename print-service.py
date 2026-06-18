#!/usr/bin/env python3
import base64, io, mimetypes, os
from flask import Flask, request, send_from_directory
from PIL import Image
from escpos.printer import File

REPO_DIR = os.path.dirname(os.path.abspath(__file__))
PRINTER_DEV = "/dev/usb/lp0"
PRINT_WIDTH = 576  # 72 mm @ 203 dpi

mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("application/wasm", ".wasm")

app = Flask(__name__)

@app.route("/")
def index():
    return send_from_directory(REPO_DIR, "index.html")

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(REPO_DIR, filename)

@app.route("/print", methods=["POST", "OPTIONS"])
def do_print():
    if request.method == "OPTIONS":
        return "", 204
    try:
        raw_b64 = request.json["png"]
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(raw_b64))).convert("L")
        if img.width != PRINT_WIDTH:
            img = img.resize(
                (PRINT_WIDTH, int(img.height * PRINT_WIDTH / img.width)),
                Image.LANCZOS)
        p = File(PRINTER_DEV)
        p.image(img, impl="bitImageColumn")
        p.cut()
        p.close()
        return "ok"
    except Exception as e:
        app.logger.error("print error: %s", e)
        return str(e), 500

@app.route("/health")
def health():
    return "ok"

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=9099)
