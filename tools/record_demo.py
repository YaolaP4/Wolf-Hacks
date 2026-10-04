"""Record a silent walkthrough of the guided tour as a video (docs/demo.webm).

The tour text on screen works as captions. Usage: python tools/record_demo.py
"""
import functools
import http.server
import shutil
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 8796
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT / "app"))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
VID = ROOT / "docs" / "video_tmp"

with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", args=["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"])
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, record_video_dir=str(VID), record_video_size={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.goto(f"http://127.0.0.1:{PORT}/")
    page.wait_for_function("window.pinchpoint && window.pinchpoint.map")
    page.wait_for_timeout(7000)  # intro card
    page.click("#intro-tour")
    holds = [6000, 7000, 9000, 9000, 7000, 5000]
    for i, hold in enumerate(holds):
        page.wait_for_timeout(hold)
        if i < len(holds) - 1:
            page.click("#tour-next")
    page.click("#tour-close")
    # the deliverable: the action plan, scrolled through, then the statewide version
    page.evaluate("document.querySelector('#budget').value = 7; document.querySelector('#budget').dispatchEvent(new Event('input'))")
    page.wait_for_timeout(1500)
    page.click("#open-plan")
    page.wait_for_timeout(4000)
    for y in range(0, 2400, 120):
        page.evaluate(f"document.getElementById('action').scrollTo(0, {y})")
        page.wait_for_timeout(180)
    page.wait_for_timeout(1500)
    page.click("#ap-close")
    page.select_option("#shed", "NC")
    page.wait_for_timeout(5000)
    page.click("#open-plan")
    page.wait_for_timeout(4000)
    page.evaluate("document.getElementById('action').scrollTo(0, 360)")
    page.wait_for_timeout(5000)
    page.click("#ap-close")
    page.select_option("#shed", "06010105")
    page.wait_for_timeout(3000)
    # a quick live interaction: drag the budget up, then open Methods
    for bi in [9, 11, 13, 15, 17]:
        page.evaluate(f"document.querySelector('#budget').value = {bi}; document.querySelector('#budget').dispatchEvent(new Event('input'))")
        page.wait_for_timeout(900)
    page.wait_for_timeout(1500)
    # the flyover on Cherry Creek (Pigeon watershed, $1M), narration off for the recording
    page.evaluate("document.getElementById('cine-voice').checked = false")
    page.evaluate("document.querySelector('#shed').value = '06010106'; document.querySelector('#shed').dispatchEvent(new Event('change'))")
    page.evaluate("document.querySelector('#budget').value = 3; document.querySelector('#budget').dispatchEvent(new Event('input'))")
    page.wait_for_timeout(4000)
    page.evaluate("window.pinchpoint.flyover('sm2643')")
    page.wait_for_timeout(82000)
    page.keyboard.press("Escape")
    page.wait_for_timeout(2500)
    page.click("#open-methods-2")
    page.wait_for_timeout(5000)
    video = page.video.path()
    ctx.close()
    b.close()
server.shutdown()
out = ROOT / "docs" / "demo.webm"
shutil.move(video, out)
shutil.rmtree(VID, ignore_errors=True)
print("saved", out, f"{out.stat().st_size / 1e6:.1f} MB")
