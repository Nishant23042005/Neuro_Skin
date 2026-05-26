import pandas as pd
import os
import shutil
from sklearn.model_selection import train_test_split

# Paths
metadata_path = 'dataset/HAM10000_metadata.csv'
images_dir = 'dataset'  # images are in subfolders part1 and part2
output_dir = 'organized_data'

# Disease mapping (lesion_id to disease name)
disease_map = {
    'akiec': 'Actinic Keratoses',
    'bcc': 'Basal Cell Carcinoma',
    'bkl': 'Benign Keratosis',
    'df': 'Dermatofibroma',
    'mel': 'Melanoma',
    'nv': 'Melanocytic Nevus',
    'vasc': 'Vascular Lesion'
}

# Create output directories
for disease in disease_map.values():
    os.makedirs(f'{output_dir}/train/{disease}', exist_ok=True)
    os.makedirs(f'{output_dir}/test/{disease}', exist_ok=True)

# Read metadata
df = pd.read_csv(metadata_path)

# Get all image filenames and their dx (disease)
image_paths = []
for _, row in df.iterrows():
    img_id = row['image_id'] + '.jpg'
    # Find which subfolder contains the image
    if os.path.exists(os.path.join(images_dir, 'HAM10000_images_part_1', img_id)):
        img_path = os.path.join(images_dir, 'HAM10000_images_part_1', img_id)
    elif os.path.exists(os.path.join(images_dir, 'HAM10000_images_part_2', img_id)):
        img_path = os.path.join(images_dir, 'HAM10000_images_part_2', img_id)
    else:
        continue
    disease = disease_map[row['dx']]
    image_paths.append((img_path, disease))

# Split into train and test (80/20)
train_paths, test_paths = train_test_split(image_paths, test_size=0.2, random_state=42, stratify=[d for _, d in image_paths])

# Copy files
for src, disease in train_paths:
    dst = f'{output_dir}/train/{disease}/{os.path.basename(src)}'
    shutil.copy2(src, dst)

for src, disease in test_paths:
    dst = f'{output_dir}/test/{disease}/{os.path.basename(src)}'
    shutil.copy2(src, dst)

print(f"Done! Organized {len(train_paths)} training images and {len(test_paths)} test images.")