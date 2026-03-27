"""
Preprocessing pipeline for deepfake detection datasets
Works with multiple dataset formats and prepares data for training
"""

import os
import cv2
import numpy as np
from pathlib import Path
import json
from typing import List, Tuple
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatasetPreprocessor:
    def __init__(self, target_size=(128, 128), max_frames_per_video=10):
        self.target_size = target_size
        self.max_frames_per_video = max_frames_per_video
        
    def extract_frames_from_video(self, video_path: str) -> List[np.ndarray]:
        """Extract frames from video file"""
        cap = cv2.VideoCapture(video_path)
        frames = []
        
        if not cap.isOpened():
            logger.error(f"Cannot open video: {video_path}")
            return frames
            
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        if total_frames == 0:
            logger.warning(f"No frames in video: {video_path}")
            cap.release()
            return frames
            
        # Sample frames evenly
        frame_indices = np.linspace(0, total_frames - 1, 
                                min(self.max_frames_per_video, total_frames), 
                                dtype=int)
        
        for frame_idx in frame_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            
            if ret:
                # Convert BGR to RGB
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frames.append(frame_rgb)
            else:
                logger.warning(f"Failed to read frame {frame_idx} from {video_path}")
        
        cap.release()
        return frames
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess single image"""
        # Resize
        resized = cv2.resize(image, self.target_size)
        
        # Normalize to [0, 1]
        normalized = resized.astype(np.float32) / 255.0
        
        return normalized
    
    def detect_face(self, image: np.ndarray) -> Tuple[bool, np.ndarray]:
        """Simple face detection using OpenCV Haar Cascade"""
        # Load face detector
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Convert to grayscale for detection
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        
        if len(faces) > 0:
            # Use the largest face
            x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
            
            # Extract face region with some padding
            padding = 20
            x_start = max(0, x - padding)
            y_start = max(0, y - padding)
            x_end = min(image.shape[1], x + w + padding)
            y_end = min(image.shape[0], y + h + padding)
            
            face_region = image[y_start:y_end, x_start:x_end]
            return True, face_region
        
        return False, image
    
    def process_video_file(self, video_path: str, output_dir: str, label: str) -> int:
        """Process a single video file and save frames"""
        frames = self.extract_frames_from_video(video_path)
        processed_count = 0
        
        for i, frame in enumerate(frames):
            # Detect and extract face
            has_face, face_region = self.detect_face(frame)
            
            if has_face:
                # Preprocess the face region
                processed_frame = self.preprocess_image(face_region)
                
                # Save processed frame
                filename = f"{Path(video_path).stem}_frame_{i:04d}.npy"
                output_path = os.path.join(output_dir, filename)
                
                # Save as numpy array
                np.save(output_path, processed_frame)
                processed_count += 1
            else:
                logger.warning(f"No face detected in frame {i} of {video_path}")
        
        return processed_count
    
    def process_image_file(self, image_path: str, output_dir: str, label: str) -> int:
        """Process a single image file"""
        try:
            # Read image
            image = cv2.imread(image_path)
            if image is None:
                logger.error(f"Cannot read image: {image_path}")
                return 0
            
            # Convert BGR to RGB
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Detect and extract face
            has_face, face_region = self.detect_face(image_rgb)
            
            if has_face:
                # Preprocess the face region
                processed_image = self.preprocess_image(face_region)
                
                # Save processed image
                filename = f"{Path(image_path).stem}.npy"
                output_path = os.path.join(output_dir, filename)
                
                # Save as numpy array
                np.save(output_path, processed_image)
                return 1
            else:
                logger.warning(f"No face detected in {image_path}")
                return 0
                
        except Exception as e:
            logger.error(f"Error processing {image_path}: {str(e)}")
            return 0
    
    def create_dataset_splits(self, data_dir: str, train_ratio=0.7, val_ratio=0.15, test_ratio=0.15):
        """Create train/val/test splits"""
        # Get all files
        all_files = []
        labels = []
        
        for label_dir in ['real', 'fake']:
            label_path = os.path.join(data_dir, label_dir)
            if os.path.exists(label_path):
                files = [f for f in os.listdir(label_path) if f.endswith('.npy')]
                all_files.extend([os.path.join(label_path, f) for f in files])
                labels.extend([label_dir] * len(files))
        
        # Shuffle
        combined = list(zip(all_files, labels))
        np.random.shuffle(combined)
        all_files, labels = zip(*combined)
        
        # Calculate split points
        total = len(all_files)
        train_end = int(total * train_ratio)
        val_end = train_end + int(total * val_ratio)
        
        # Create splits
        splits = {
            'train': (all_files[:train_end], labels[:train_end]),
            'val': (all_files[train_end:val_end], labels[train_end:val_end]),
            'test': (all_files[val_end:], labels[val_end:])
        }
        
        return splits

def create_sample_dataset(output_dir: str, num_samples: int = 100):
    """Create a synthetic dataset for testing"""
    logger.info(f"Creating sample dataset with {num_samples} images...")
    
    # Create directories
    real_dir = os.path.join(output_dir, 'real')
    fake_dir = os.path.join(output_dir, 'fake')
    os.makedirs(real_dir, exist_ok=True)
    os.makedirs(fake_dir, exist_ok=True)
    
    preprocessor = DatasetPreprocessor()
    
    # Generate synthetic data
    for i in range(num_samples // 2):
        # Generate random "real" image
        real_img = np.random.randint(0, 255, (128, 128, 3), dtype=np.uint8)
        np.save(os.path.join(real_dir, f'real_{i:04d}.npy'), real_img.astype(np.float32) / 255.0)
        
        # Generate random "fake" image (slightly different pattern)
        fake_img = np.random.randint(0, 255, (128, 128, 3), dtype=np.uint8)
        np.save(os.path.join(fake_dir, f'fake_{i:04d}.npy'), fake_img.astype(np.float32) / 255.0)
    
    logger.info(f"Sample dataset created in {output_dir}")

def main():
    """Main function for testing preprocessing"""
    # Create sample dataset for immediate testing
    data_dir = "data/processed/sample"
    create_sample_dataset(data_dir, num_samples=200)
    
    # Create dataset splits
    preprocessor = DatasetPreprocessor()
    splits = preprocessor.create_dataset_splits(data_dir)
    
    # Print split information
    for split_name, (files, labels) in splits.items():
        print(f"{split_name.upper()} SET:")
        print(f"  Total files: {len(files)}")
        print(f"  Real samples: {labels.count('real')}")
        print(f"  Fake samples: {labels.count('fake')}")
        print()

if __name__ == "__main__":
    main()
