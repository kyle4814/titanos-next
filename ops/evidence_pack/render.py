"""WeasyPrint render wrapper for the evidence pack template."""

import os
import sys


def render_pdf(data, out_path, mode="sample"):
    from .template import build_html
    html_str = build_html(data, mode=mode)

    try:
        from weasyprint import HTML as WH
    except ImportError:
        print("WeasyPrint not found — installing...")
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "weasyprint"], check=True)
        from weasyprint import HTML as WH

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    WH(string=html_str, base_url=None).write_pdf(out_path)
    size_kb = os.path.getsize(out_path) // 1024
    print(f"PDF written: {out_path} ({size_kb} KB)")
    return out_path
