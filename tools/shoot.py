"""Render the app headlessly and save screenshots (docs/ and a review folder).

Usage: python tools/shoot.py [outdir]
"""
import functools
import http.server
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs" / "shots"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8799

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT / "app"))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()

WAIT_IDLE = """() => new Promise((res) => {
  const m = window.pinchpoint && window.pinchpoint.map;
  if (!m) return res(false);
  const done = () => res(true);
  if (m.loaded() && m.areTilesLoaded()) setTimeout(done, 600); else m.once('idle', () => setTimeout(done, 600));
  setTimeout(() => res('timeout'), 25000);
})"""


def shot(page, name):
    page.evaluate(WAIT_IDLE)
    page.screenshot(path=str(OUT / f"{name}.png"))
    print("saved", OUT / f"{name}.png")


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    page = b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    page.on("console", lambda m: print("console:", m.type, m.text) if m.type in ("error", "warning") else None)
    page.goto(f"http://127.0.0.1:{PORT}/")
    page.wait_for_function("window.pinchpoint && window.pinchpoint.map")
    page.wait_for_timeout(1500)
    shot(page, "00_intro")
    page.click("#intro-skip")
    page.wait_for_timeout(4000)
    shot(page, "01_ufb_2M")
    page.click("#start-tour")
    for i in range(1, 5):
        page.wait_for_timeout(700)
        page.click("#tour-next")
        page.wait_for_timeout(3500)
        shot(page, f"0{i + 1}_tour_step{i + 1}")
    page.click("#tour-close")
    page.click("#open-methods-2")
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT / "06_methods.png"))
    print("saved methods")

    # clean hero shots for the README and DevPost gallery
    docs = ROOT / "docs"
    docs.mkdir(exist_ok=True)
    for name, hash_, culvert in [
        ("hero_ufb", "huc=06010105&b=5&p=0.7", None),
        ("hero_cherry_creek", "huc=06010106&b=1&p=0", "sm2643"),
        ("hero_whiteoak", "huc=06010202&b=5&p=0", "sm2847"),
    ]:
        page.goto(f"http://127.0.0.1:{PORT}/#{hash_}")
        page.reload()
        page.wait_for_function("window.pinchpoint && window.pinchpoint.map")
        page.wait_for_timeout(3500)
        if culvert:
            page.evaluate(f"window.pinchpoint.select('{culvert}')")
            page.wait_for_timeout(2500)
        page.evaluate(WAIT_IDLE)
        page.screenshot(path=str(docs / f"{name}.png"))
        print("saved", docs / f"{name}.png")
    b.close()
server.shutdown()
