import os
from PIL import Image

# Path to original OpenMoji PNGs (e.g., color/72x72/)
SOURCE_DIR = "emoji's/"
# Output directory for resized images
OUTPUT_DIR = "resized_emojis"

# Create output directory if it doesn't exist
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Loop through all PNGs in the source directory
for filename in os.listdir(SOURCE_DIR):
    if filename.endswith(".png"):
        src_path = os.path.join(SOURCE_DIR, filename)
        dst_path = os.path.join(OUTPUT_DIR, f"emoji_{filename[:-4]}_16x16.png")

        try:
            img = Image.open(src_path)
            img = img.resize((16, 16), Image.LANCZOS)
            img.save(dst_path)
            print(f"Resized: {filename}")
        except Exception as e:
            print(f"Error processing {filename}: {e}")
