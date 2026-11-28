#!/usr/bin/env python3
"""Rekam animasi viewer di browser lalu buat lembar frame agar agen BENAR-BENAR melihat hasilnya.

Contoh:
  python3 capture_flow.py --url "http://localhost:8765/.agents/skills/animasi-aliran-mesin/scripts/demo.html?auto=2" \
      --out /tmp/flow-qa --viewport mobile --link jacket --xray

Hasil di --out:
  frame-XX.png     frame berurutan
  sheet.png        lembar kontak (buka dan lihat dengan alat baca gambar)
  report.json      skor gerak antar-frame, error konsol, dan sampel runtime FLOW-ROUTING
                   (running ×2, paused ×2, resumed ×2) bila halaman menyediakan window.__flow.probe()

Skor gerak ~0 berarti animasi tidak bergerak. Lembar frame tetap harus dilihat dan dinilai;
skrip ini tidak menilai keindahan atau kebenaran teknis.
Butuh: pip install playwright pillow && python3 -m playwright install chromium
"""
import argparse, json, os, sys, time

VIEWPORTS = {"desktop": (1280, 800, 1), "mobile": (390, 844, 2)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--viewport", choices=VIEWPORTS, default="desktop")
    ap.add_argument("--frames", type=int, default=8)
    ap.add_argument("--interval", type=int, default=250, help="ms antar frame")
    ap.add_argument("--wait", type=int, default=3000, help="ms tunggu sebelum merekam (pengisian Start)")
    ap.add_argument("--click", action="append", default=[], help="selector yang diklik sebelum merekam, berurutan")
    ap.add_argument("--xray", action="store_true", help="panggil __flow.setXray(true) sebelum merekam")
    ap.add_argument("--link", help="ID link untuk sampel runtime")
    a = ap.parse_args()

    from playwright.sync_api import sync_playwright
    from PIL import Image, ImageChops, ImageStat

    os.makedirs(a.out, exist_ok=True)
    w, h, scale = VIEWPORTS[a.viewport]
    errors, frames, report = [], [], {"url": a.url, "viewport": a.viewport}
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        page = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=scale)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and errors.append(m.text))
        page.goto(a.url, wait_until="networkidle")
        page.wait_for_timeout(500)
        for sel in a.click:
            page.click(sel)
            page.wait_for_timeout(300)
        if a.xray:
            page.evaluate("window.__flow && window.__flow.setXray(true)")
        page.wait_for_timeout(a.wait)
        for i in range(a.frames):
            path = os.path.join(a.out, f"frame-{i:02d}.png")
            page.screenshot(path=path)
            frames.append(path)
            page.wait_for_timeout(a.interval)

        has_flow = page.evaluate("!!(window.__flow && window.__flow.probe)")
        if has_flow:
            link = a.link or page.evaluate("window.__flow.links()[0] && window.__flow.links()[0].id")
            samples, t0 = [], time.time()
            def take(state):
                s = page.evaluate("id => window.__flow.probe(id)", link)
                if s:
                    s.update(state=state, time_s=round(time.time() - t0, 3))
                    samples.append(s)
            take("running"); page.wait_for_timeout(400); take("running")
            page.evaluate("window.__flow.pause()"); page.wait_for_timeout(150)
            take("paused"); page.wait_for_timeout(400); take("paused")
            page.evaluate("window.__flow.resume()"); take("resumed"); page.wait_for_timeout(400); take("resumed")
            report["runtime"] = {"link": link, "samples": samples,
                                 "pause_stable": len(samples) == 6 and samples[2]["fraction"] == samples[3]["fraction"],
                                 "moves_when_running": len(samples) == 6 and samples[0]["fraction"] != samples[1]["fraction"],
                                 "resume_continues": len(samples) == 6 and abs(samples[4]["fraction"] - samples[3]["fraction"]) < 0.05
                                                      and samples[5]["fraction"] != samples[4]["fraction"]}
            report["links"] = page.evaluate("window.__flow.links()")
            report["warnings"] = page.evaluate("window.__flow.warnings")
        browser.close()

    imgs = [Image.open(f).convert("RGB") for f in frames]
    diffs = [round(sum(ImageStat.Stat(ImageChops.difference(x, y)).mean) / 3, 3) for x, y in zip(imgs, imgs[1:])]
    report.update(frames=frames, motion=diffs, motion_ok=bool(diffs) and min(diffs) > 0.05, errors=errors)
    cols = 4 if a.viewport == "desktop" else 4
    tw = 480 if a.viewport == "desktop" else 240
    th = int(tw * imgs[0].height / imgs[0].width)
    rows = (len(imgs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * th), (18, 23, 28))
    for i, im in enumerate(imgs):
        sheet.paste(im.resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
    sheet.save(os.path.join(a.out, "sheet.png"))
    with open(os.path.join(a.out, "report.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps({k: report.get(k) for k in ("motion_ok", "motion", "errors", "warnings")}, indent=1))
    if "runtime" in report:
        print(json.dumps({k: v for k, v in report["runtime"].items() if k != "samples"}))
    return 0 if report["motion_ok"] and not errors else 2


if __name__ == "__main__":
    sys.exit(main())
