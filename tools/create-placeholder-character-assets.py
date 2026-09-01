"""Create deterministic 512px placeholder character PNGs for Step 2 development."""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SIZE = 512


def create_face(path: Path, color: str) -> None:
    image = Image.new("RGBA", (SIZE, SIZE), color)
    image.save(path, "PNG")


def create_clothes(path: Path, color: str) -> None:
    image = Image.new("RGBA", (SIZE, SIZE), color)
    image.save(path, "PNG")


def main() -> None:
    face_dir = ROOT / "assets" / "faces"
    clothes_dir = ROOT / "assets" / "clothes" / "default"
    shop_dir = ROOT / "assets" / "clothes" / "shop"
    for directory in (face_dir, clothes_dir, shop_dir):
        directory.mkdir(parents=True, exist_ok=True)

    face_colors = ("#f4d4b4", "#d9ad82", "#bd825f", "#8d5b42", "#5f382c")
    clothes_colors = ("#477bbd", "#b95043", "#4f8b62", "#d6a638", "#4d515a")
    for index, color in enumerate(face_colors, start=1):
        create_face(face_dir / f"face_{index:02d}.png", color)
    for index, color in enumerate(clothes_colors, start=1):
        create_clothes(clothes_dir / f"default_{index:02d}.png", color)


if __name__ == "__main__":
    main()
