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
import argparse
import random

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

    def process_faceforensics_dataset(
        self,
        input_dir: str,
        output_dir: str,
        real_limit: int | None = None,
        fake_limit_per_source: int | None = None,
        seed: int = 42
    ):
        """Convert FaceForensics++ style raw videos into processed real/fake .npy samples."""
        input_path = Path(input_dir)
        output_path = Path(output_dir)
        real_dir = output_path / 'real'
        fake_dir = output_path / 'fake'
        real_dir.mkdir(parents=True, exist_ok=True)
        fake_dir.mkdir(parents=True, exist_ok=True)

        real_videos = sorted((input_path / 'original').glob('*.mp4'))
        fake_sources = [
            'Deepfakes',
            'Face2Face',
            'FaceSwap',
            'NeuralTextures',
            'FaceShifter',
            'DeepFakeDetection'
        ]

        rng = random.Random(seed)
        if real_limit is not None and len(real_videos) > real_limit:
            real_videos = sorted(rng.sample(real_videos, real_limit))

        logger.info('Processing FaceForensics originals: %s videos', len(real_videos))
        real_count = 0
        for video_path in real_videos:
            real_count += self.process_video_file(str(video_path), str(real_dir), 'real')

        fake_count = 0
        source_counts = {}
        for source_name in fake_sources:
            source_dir = input_path / source_name
            source_videos = sorted(source_dir.glob('*.mp4'))
            if fake_limit_per_source is not None and len(source_videos) > fake_limit_per_source:
                source_videos = sorted(rng.sample(source_videos, fake_limit_per_source))

            logger.info('Processing FaceForensics %s: %s videos', source_name, len(source_videos))
            processed = 0
            for video_path in source_videos:
                processed += self.process_video_file(str(video_path), str(fake_dir), 'fake')

            source_counts[source_name] = processed
            fake_count += processed

        summary = {
            'dataset': 'faceforensics',
            'input_dir': str(input_path),
            'output_dir': str(output_path),
            'target_size': list(self.target_size),
            'max_frames_per_video': self.max_frames_per_video,
            'real_limit': real_limit,
            'fake_limit_per_source': fake_limit_per_source,
            'real_samples': real_count,
            'fake_samples': fake_count,
            'fake_samples_by_source': source_counts
        }

        with open(output_path / 'faceforensics_summary.json', 'w', encoding='utf-8') as handle:
            json.dump(summary, handle, indent=2)

        return summary

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
    """CLI entry point for dataset preprocessing."""
    parser = argparse.ArgumentParser(description='Preprocess deepfake datasets into training-ready .npy samples.')
    parser.add_argument('--dataset', choices=['sample', 'faceforensics'], default='sample')
    parser.add_argument('--input-dir', default='data/raw/faceforensics')
    parser.add_argument('--output-dir', default='data/processed/faceforensics')
    parser.add_argument('--target-size', type=int, default=128)
    parser.add_argument('--max-frames-per-video', type=int, default=6)
    parser.add_argument('--real-limit', type=int, default=120)
    parser.add_argument('--fake-limit-per-source', type=int, default=20)
    parser.add_argument('--sample-count', type=int, default=200)
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()

    preprocessor = DatasetPreprocessor(
        target_size=(args.target_size, args.target_size),
        max_frames_per_video=args.max_frames_per_video
    )

    if args.dataset == 'sample':
        create_sample_dataset(args.output_dir, num_samples=args.sample_count)
        splits = preprocessor.create_dataset_splits(args.output_dir)
        for split_name, (files, labels) in splits.items():
            print(f"{split_name.upper()} SET:")
            print(f"  Total files: {len(files)}")
            print(f"  Real samples: {labels.count('real')}")
            print(f"  Fake samples: {labels.count('fake')}")
            print()
        return

    summary = preprocessor.process_faceforensics_dataset(
        args.input_dir,
        args.output_dir,
        real_limit=args.real_limit,
        fake_limit_per_source=args.fake_limit_per_source,
        seed=args.seed
    )
    print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    main()
