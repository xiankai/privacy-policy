import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent

STYLE = """
    :root { color-scheme: light dark; --bg: #ffffff; --fg: #1f2328; --muted: #59636e; --rule: #d1d9e0; --link: #0969da; --panel: #f6f8fa; }
    @media (prefers-color-scheme: dark) { :root { --bg: #0d1117; --fg: #e6edf3; --muted: #9198a1; --rule: #3d444d; --link: #4493f8; --panel: #151b23; } }
    body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
    .page { max-width: 46rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
    a { color: var(--link); }
    header { border-bottom: 1px solid var(--rule); margin-bottom: 1.5rem; padding-bottom: 1rem; }
    header h1 { margin: 0 0 .25rem; font-size: 1.6rem; line-height: 1.3; }
    header p, footer { color: var(--muted); margin: 0; font-size: .9rem; }
    header nav { margin-top: .5rem; font-size: .9rem; }
    .supplement { margin-top: 2.5rem; padding: 1rem 1.25rem; background: var(--panel); border: 1px solid var(--rule); border-radius: 6px; }
    .supplement h2 { margin-top: 0; font-size: 1.15rem; }
    .supplement h3 { font-size: 1rem; margin-bottom: .25rem; }
    footer { margin-top: 3rem; border-top: 1px solid var(--rule); padding-top: 1rem; }
"""

GENERATED_AS_IS = "<!-- stack-reviewer-ignore: generator text is hosted unchanged by owner decision (#1); the developer supplement below states what is actually sent and says it wins where the two differ -->"


def generated_body(path):
    html = path.read_text()
    return re.search(r"<body>\s*(.*?)\s*</body>", html, re.S).group(1)


def page(title, subtitle, nav, body):
    nav_block = f"\n      <nav>{nav}</nav>" if nav else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <style>{STYLE}  </style>
</head>
<body>
  <div class="page">
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>{nav_block}
    </header>
    {body}
  </div>
</body>
</html>
"""


def nav(index_href, sibling_href, sibling_label):
    return f'<a href="{index_href}">All policies</a> · <a href="{sibling_href}">{sibling_label}</a>'


def build_app(app_dir):
    slug = app_dir.name
    config = json.loads((app_dir / "app.json").read_text())
    title = config["title"]
    dates = f'Effective {config["generator"]["effectiveDate"]} · last updated {config["updated"]}'
    generated = app_dir / "generated"
    supplement_file = app_dir / "supplement.html"

    privacy = generated_body(generated / "privacy.html")
    if supplement_file.exists():
        privacy += f"{GENERATED_AS_IS}\n    {supplement_file.read_text().rstrip()}"

    (root / slug / "terms").mkdir(parents=True, exist_ok=True)
    (root / slug / "index.html").write_text(page(
        f"{title} Privacy Policy", dates, nav("../", "terms/", "Terms &amp; Conditions"),
        f"<main>\n{privacy}\n    </main>",
    ))
    (root / slug / "terms" / "index.html").write_text(page(
        f"{title} Terms &amp; Conditions", dates, nav("../../", "../", "Privacy Policy"),
        f'<main>\n{generated_body(generated / "terms.html")}\n    </main>',
    ))
    return f'        <li>{config["listing"]}: <a href="{slug}/">Privacy Policy</a> · <a href="{slug}/terms/">Terms &amp; Conditions</a></li>'


listing = [build_app(d) for d in sorted((root / "apps").iterdir()) if (d / "app.json").exists()]

(root / "index.html").write_text(page(
    "Privacy policies", "Privacy policies for my apps and integrations.", "",
    "<main>\n      <ul>\n" + "\n".join(listing) + "\n      </ul>\n    </main>",
))
