"""
PyTorch training script for deepfake detection
Works with Python 3.14 and modern PyTorch
"""

import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import numpy as np
from pathlib import Path
import matplotlib.pyplot as plt
import json
from datetime import datetime

from model_pytorch import MesoNetPyTorch, LightweightNetPyTorch, get_model_info
from preprocessing import DatasetPreprocessor, create_sample_dataset

class DeepFakeDataset(Dataset):
    """Custom dataset for deepfake detection"""
    
    def __init__(self, file_paths, labels):
        self.file_paths = file_paths
        self.labels = labels
        
    def __len__(self):
        return len(self.file_paths)
    
    def __getitem__(self, idx):
        # Load preprocessed data
        data = np.load(self.file_paths[idx])
        
        # Ensure correct shape and convert to tensor
        if data.shape != (128, 128, 3):
            data = np.resize(data, (128, 128, 3))
        
        # Convert to tensor and change from HWC to CHW
        image_tensor = torch.FloatTensor(data).permute(2, 0, 1)
        
        # Convert label to tensor
        label = 1 if self.labels[idx] == 'fake' else 0
        label_tensor = torch.FloatTensor([label])
        
        return image_tensor, label_tensor

def prepare_dataset(data_dir, batch_size=32):
    """Prepare dataset for training"""
    
    preprocessor = DatasetPreprocessor()
    
    # Create dataset splits
    splits = preprocessor.create_dataset_splits(data_dir)
    
    # Create datasets
    train_dataset = DeepFakeDataset(splits['train'][0], splits['train'][1])
    val_dataset = DeepFakeDataset(splits['val'][0], splits['val'][1])
    test_dataset = DeepFakeDataset(splits['test'][0], splits['test'][1])
    
    # Create data loaders
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)
    
    return train_loader, val_loader, test_loader, splits

def train_epoch(model, train_loader, criterion, optimizer, device):
    """Train for one epoch"""
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0
    
    for batch_idx, (data, target) in enumerate(train_loader):
        data, target = data.to(device), target.to(device)
        
        optimizer.zero_grad()
        output = model(data)
        loss = criterion(output, target)
        
        loss.backward()
        optimizer.step()
        
        running_loss += loss.item()
        
        # Calculate accuracy
        predicted = (output > 0.5).float()
        total += target.size(0)
        correct += (predicted == target).sum().item()
        
        if batch_idx % 10 == 0:
            print(f'Batch {batch_idx}, Loss: {loss.item():.4f}')
    
    epoch_loss = running_loss / len(train_loader)
    epoch_acc = 100. * correct / total
    
    return epoch_loss, epoch_acc

def validate_epoch(model, val_loader, criterion, device):
    """Validate for one epoch"""
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0
    
    with torch.no_grad():
        for data, target in val_loader:
            data, target = data.to(device), target.to(device)
            
            output = model(data)
            loss = criterion(output, target)
            
            running_loss += loss.item()
            
            # Calculate accuracy
            predicted = (output > 0.5).float()
            total += target.size(0)
            correct += (predicted == target).sum().item()
    
    epoch_loss = running_loss / len(val_loader)
    epoch_acc = 100. * correct / total
    
    return epoch_loss, epoch_acc

def train_model(data_dir, model_type='mesonet', epochs=50, batch_size=32, learning_rate=0.001):
    """Train deepfake detection model with PyTorch"""
    
    print(f"🚀 Starting PyTorch training with {model_type} model")
    print(f"📁 Data directory: {data_dir}")
    print(f"📊 Batch size: {batch_size}")
    print(f"⏱️  Epochs: {epochs}")
    print(f"📈 Learning rate: {learning_rate}")
    print()
    
    # Check device
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"🖥️  Using device: {device}")
    
    # Prepare dataset
    print("📋 Preparing dataset...")
    train_loader, val_loader, test_loader, splits = prepare_dataset(data_dir, batch_size)
    
    print(f"✅ Dataset prepared:")
    print(f"   Training samples: {len(splits['train'][0])}")
    print(f"   Validation samples: {len(splits['val'][0])}")
    print(f"   Test samples: {len(splits['test'][0])}")
    print()
    
    # Create model
    print("🧠 Creating model...")
    if model_type == 'mesonet':
        model = MesoNetPyTorch()
    else:
        model = LightweightNetPyTorch()
    
    model = model.to(device)
    
    # Print model info
    model_info = get_model_info(model)
    print(f"✅ Model created:")
    print(f"   Parameters: {model_info['total_parameters']:,}")
    print(f"   Size: {model_info['size_mb']:.2f} MB")
    print()
    
    # Setup training
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=5, factor=0.5)
    
    # Training history
    history = {
        'train_loss': [], 'train_acc': [],
        'val_loss': [], 'val_acc': []
    }
    
    best_val_acc = 0.0
    
    # Training loop
    print("🏋️  Starting training...")
    for epoch in range(epochs):
        print(f'\nEpoch {epoch + 1}/{epochs}')
        print('-' * 50)
        
        # Train
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        
        # Validate
        val_loss, val_acc = validate_epoch(model, val_loader, criterion, device)
        
        # Update learning rate
        scheduler.step(val_loss)
        
        # Save history
        history['train_loss'].append(train_loss)
        history['train_acc'].append(train_acc)
        history['val_loss'].append(val_loss)
        history['val_acc'].append(val_acc)
        
        # Print epoch results
        print(f'Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.2f}%')
        print(f'Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.2f}%')
        
        # Save best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            os.makedirs('models', exist_ok=True)
            torch.save(model.state_dict(), f'models/{model_type}_best_model.pth')
            print(f'✅ New best model saved with accuracy: {val_acc:.2f}%')
    
    # Test best model
    print("\n📈 Testing best model...")
    model.load_state_dict(torch.load(f'models/{model_type}_best_model.pth'))
    test_loss, test_acc = validate_epoch(model, test_loader, criterion, device)
    
    print(f'🎯 Test Results:')
    print(f'   Test Loss: {test_loss:.4f}')
    print(f'   Test Accuracy: {test_acc:.2f}%')
    
    # Save training history
    save_training_history(history, model_type)
    
    # Plot training curves
    plot_training_history(history, model_type)
    
    # Export model to ONNX for browser deployment
    export_to_onnx(model, model_type)
    
    return model, history, {'test_loss': test_loss, 'test_acc': test_acc}

def save_training_history(history, model_type):
    """Save training history to JSON"""
    
    history_dict = {
        'model_type': model_type,
        'training_date': datetime.now().isoformat(),
        'history': history
    }
    
    with open(f'models/{model_type}_history.json', 'w') as f:
        json.dump(history_dict, f, indent=2)
    
    print(f"💾 Training history saved to models/{model_type}_history.json")

def plot_training_history(history, model_type):
    """Plot training curves"""
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
    
    # Loss
    ax1.plot(history['train_loss'], label='Training Loss')
    ax1.plot(history['val_loss'], label='Validation Loss')
    ax1.set_title('Model Loss')
    ax1.set_xlabel('Epoch')
    ax1.set_ylabel('Loss')
    ax1.legend()
    ax1.grid(True)
    
    # Accuracy
    ax2.plot(history['train_acc'], label='Training Accuracy')
    ax2.plot(history['val_acc'], label='Validation Accuracy')
    ax2.set_title('Model Accuracy')
    ax2.set_xlabel('Epoch')
    ax2.set_ylabel('Accuracy (%)')
    ax2.legend()
    ax2.grid(True)
    
    plt.tight_layout()
    plt.savefig(f'models/{model_type}_training_curves.png', dpi=150, bbox_inches='tight')
    plt.show()
    
    print(f"📊 Training curves saved to models/{model_type}_training_curves.png")

def export_to_onnx(model, model_type):
    """Export model to ONNX for browser deployment"""
    import torch
    
    model.eval()
    dummy_input = torch.randn(1, 3, 128, 128)
    
    try:
        torch.onnx.export(
            model,
            dummy_input,
            f'models/{model_type}_model.onnx',
            export_params=True,
            opset_version=11,
            do_constant_folding=True,
            input_names=['input'],
            output_names=['output']
        )
        print(f"🌐 Model exported to models/{model_type}_model.onnx")
    except Exception as e:
        print(f"❌ ONNX export failed: {e}")

def quick_test():
    """Quick test with synthetic data"""
    print("🧪 Running quick test with synthetic data...")
    
    # Create sample dataset
    data_dir = "data/processed/quick_test"
    create_sample_dataset(data_dir, num_samples=100)
    
    # Train lightweight model
    model, history, results = train_model(
        data_dir, 
        model_type='lightweight', 
        epochs=5, 
        batch_size=16
    )
    
    return model, history, results

def main():
    """Main training function"""
    
    # Check if dataset exists
    data_dir = "data/processed/sample"
    
    if not os.path.exists(data_dir):
        print("📁 Dataset not found. Creating sample dataset...")
        create_sample_dataset(data_dir, num_samples=200)
    
    # Train model
    model, history, results = train_model(
        data_dir,
        model_type='lightweight',  # or 'mesonet'
        epochs=20,
        batch_size=32,
        learning_rate=0.001
    )
    
    print("🎉 Training completed!")
    print("📂 Check 'models/' directory for saved model and results")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        quick_test()
    else:
        main()
