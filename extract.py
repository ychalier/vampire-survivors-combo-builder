import argparse
import json
import os
from PIL import Image
import tqdm


def extract(path, output):
    os.makedirs(output, exist_ok=True)
    with open(path, "r", encoding="utf8") as file:
        data = json.load(file)
    for texture in data["textures"]:
        image = Image.open(os.path.join(os.path.dirname(path), texture["image"]))
        for frame in tqdm.tqdm(texture["frames"]):
            box = frame["frame"]
            part = image.crop((box["x"], box["y"], box["x"] + box["w"], box["y"] + box["h"]))
            part.save(os.path.join(output, frame["filename"]))
    

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=str)
    parser.add_argument("output", type=str)
    args = parser.parse_args()
    extract(args.input, args.output)


if __name__ == "__main__":
    main()
