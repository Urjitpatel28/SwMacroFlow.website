"""Generates the site's derived image assets from the two source PNGs.

Run this by hand when assets/logo.png or assets/SwMacroFlow.png changes:

    python tools/build-images.py

It is deliberately NOT part of the Pages workflow. The outputs are small binaries that are
committed to the repo, and a build step that rewrites binaries on every push produces a diff on
every push. Pillow is the only dependency and it is only needed by whoever regenerates them.

Produces:
    assets/SwMacroFlow.webp     the hero screenshot, ~3x smaller than the PNG it falls back to
    assets/og-image.png         1200x630, the aspect ratio Open Graph and Twitter cards actually
                                crop to (the screenshot alone is 1.49:1 and got cut badly)
    assets/apple-touch-icon.png 180x180, iOS home screen
    favicon.ico                 16/32/48, the file browsers request whether or not it is linked
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

BG = (13, 13, 15)
PANEL_BORDER = (48, 48, 56)
TEXT = (245, 242, 237)
TEXT_DIM = (198, 192, 184)
ACCENT = (226, 35, 26)

FONT_DIR = Path("C:/Windows/Fonts")


def font(name, size, fallback="arial.ttf"):
    """Segoe UI where it exists, Arial where it does not, Pillow's bitmap font as a last resort."""
    for candidate in (name, fallback):
        path = FONT_DIR / candidate
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def wrap(draw, text, typeface, max_width):
    lines, current = [], ""
    for word in text.split():
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=typeface) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def build_webp():
    # Lossless, which is both smaller and better here: the source is a UI screenshot of flat fills
    # and small text, the case lossy codecs handle worst. Measured on this image, lossless WebP is
    # 43 KB against 69 KB for quality 82 and 54 KB for AVIF, so there is nothing to trade off.
    source = Image.open(ASSETS / "SwMacroFlow.png")
    target = ASSETS / "SwMacroFlow.webp"
    source.save(target, "WEBP", lossless=True, method=6)
    print(f"  {target.relative_to(ROOT)}  {target.stat().st_size // 1024} KB "
          f"(was {(ASSETS / 'SwMacroFlow.png').stat().st_size // 1024} KB)")


def build_og_image():
    width, height = 1200, 630
    canvas = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(canvas)

    # The screenshot bleeds off the right edge rather than sitting boxed in the middle: at card
    # size the detail is unreadable anyway, so it reads as texture and the words carry the meaning.
    shot = Image.open(ASSETS / "SwMacroFlow.png").convert("RGB")
    shot_width = 620
    shot_height = round(shot.height * shot_width / shot.width)
    shot = shot.resize((shot_width, shot_height), Image.LANCZOS)
    shot_x, shot_y = width - 540, (height - shot_height) // 2
    canvas.paste(shot, (shot_x, shot_y))
    draw.rectangle(
        [shot_x - 1, shot_y - 1, shot_x + shot_width, shot_y + shot_height],
        outline=PANEL_BORDER,
        width=1,
    )

    # A band fading the screenshot out behind the text, so a long headline never lands on top of it.
    fade = Image.new("RGBA", (260, height), (0, 0, 0, 0))
    fade_draw = ImageDraw.Draw(fade)
    for x in range(260):
        fade_draw.line([(x, 0), (x, height)], fill=BG + (255 - round(255 * x / 260),))
    canvas.paste(fade, (shot_x - 260, 0), fade)

    margin = 72
    logo = Image.open(ASSETS / "logo.png").convert("RGBA").resize((64, 64), Image.LANCZOS)
    canvas.paste(logo, (margin, 96), logo)

    brand = font("segoeuib.ttf", 30, "arialbd.ttf")
    draw.text((margin + 82, 111), "SwMacroFlow", font=brand, fill=TEXT)

    headline = font("segoeuib.ttf", 50, "arialbd.ttf")
    lines = wrap(draw, "Batch-run your SOLIDWORKS macros across hundreds of files.", headline, 520)
    y = 208
    for line in lines:
        draw.text((margin, y), line, font=headline, fill=TEXT)
        y += 60

    body = font("segoeui.ttf", 25, "arial.ttf")
    draw.text((margin, y + 24), "Free standalone Windows app.", font=body, fill=TEXT_DIM)
    draw.text((margin, y + 60), "No account, no licence, nothing to buy.", font=body, fill=TEXT_DIM)

    draw.rectangle([margin, y + 112, margin + 56, y + 116], fill=ACCENT)

    target = ASSETS / "og-image.png"
    canvas.save(target, "PNG", optimize=True)
    print(f"  {target.relative_to(ROOT)}  {target.stat().st_size // 1024} KB  1200x630")


def build_icons():
    logo = Image.open(ASSETS / "logo.png").convert("RGBA")

    touch = logo.resize((180, 180), Image.LANCZOS)
    # iOS paints no background behind the icon, so the transparent corners would go black.
    flattened = Image.new("RGB", (180, 180), BG)
    flattened.paste(touch, (0, 0), touch)
    touch_target = ASSETS / "apple-touch-icon.png"
    flattened.save(touch_target, "PNG", optimize=True)
    print(f"  {touch_target.relative_to(ROOT)}  {touch_target.stat().st_size // 1024} KB  180x180")

    ico_target = ROOT / "favicon.ico"
    logo.save(ico_target, "ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"  {ico_target.relative_to(ROOT)}  {ico_target.stat().st_size // 1024} KB  16/32/48")


if __name__ == "__main__":
    print("Building image assets")
    build_webp()
    build_og_image()
    build_icons()
