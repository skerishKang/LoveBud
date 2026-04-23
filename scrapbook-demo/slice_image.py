import os
from PIL import Image

def slice_mockup(image_path):
    if not os.path.exists(image_path):
        print(f"Error: {image_path} 파일이 없습니다. 이미지를 해당 이름으로 저장해주세요.")
        return

    img = Image.open(image_path)
    width, height = img.size
    
    # 이미지 사이즈에 맞게 좌표 비율 계산 (기준: 1920x1080)
    def get_coords(x1, y1, x2, y2):
        return (int(x1 * width / 1920), int(y1 * height / 1080), 
                int(x2 * width / 1920), int(y2 * height / 1080))

    # 자를 영역 정의 (좌상단x, 좌상단y, 우하단x, 우하단y)
    sections = {
        "hero-text": get_coords(180, 160, 750, 500),
        "card-heart": get_coords(780, 130, 1020, 410),
        "card-music": get_coords(1040, 140, 1450, 630),
        "card-note": get_coords(860, 420, 1050, 620),
        "card-stage": get_coords(1470, 140, 1720, 400),
        "card-sunset": get_coords(1540, 410, 1850, 630),
        "bottom-info": get_coords(150, 650, 1770, 780),
        "bottom-list": get_coords(150, 800, 1770, 1000)
    }

    if not os.path.exists('assets'):
        os.makedirs('assets')

    for name, box in sections.items():
        section_img = img.crop(box)
        section_img.save(f"assets/{name}.png")
        print(f"Saved: assets/{name}.png")

if __name__ == "__main__":
    slice_mockup("home.png")
