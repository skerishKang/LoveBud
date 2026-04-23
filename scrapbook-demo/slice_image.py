import os
from PIL import Image

def slice_mockup(image_path):
    if not os.path.exists(image_path):
        print(f"Error: {image_path} 파일이 없습니다.")
        return

    img = Image.open(image_path)
    width, height = img.size
    
    # 이미지 실제 사이즈 기준 (1672 x 941)
    base_w, base_h = 1672, 941

    def get_coords(x1, y1, x2, y2):
        return (int(x1 * width / base_w), int(y1 * height / base_h), 
                int(x2 * width / base_w), int(y2 * height / base_h))

    # 정밀 수정된 좌표 (1672x941 기준)
    sections = {
        "hero-text": get_coords(150, 150, 720, 520),
        "card-heart": get_coords(760, 120, 1010, 420),
        "card-music": get_coords(1030, 130, 1430, 650),
        "card-note": get_coords(840, 410, 1030, 630),
        "card-stage": get_coords(1450, 130, 1672, 410),
        "card-sunset": get_coords(1480, 410, 1672, 650),
        "bottom-info": get_coords(130, 650, 1672, 780),
        "bottom-list": get_coords(130, 790, 1672, 941)
    }

    if not os.path.exists('assets'):
        os.makedirs('assets')

    for name, box in sections.items():
        left = max(0, box[0])
        top = max(0, box[1])
        right = min(width, box[2])
        bottom = min(height, box[3])
        
        section_img = img.crop((left, top, right, bottom))
        section_img.save(f"assets/{name}.png")
        print(f"Saved: assets/{name}.png at {left, top, right, bottom}")

if __name__ == "__main__":
    slice_mockup("home.png")
