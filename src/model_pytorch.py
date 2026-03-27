"""
PyTorch version of deepfake detection model
Optimized for on-device deployment with ONNX export
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np

class MesoNetPyTorch(nn.Module):
    """
    PyTorch implementation of MesoNet-inspired architecture
    Optimized for on-device deployment
    """
    
    def __init__(self, input_size=(128, 128, 3), dropout_rate=0.5):
        super(MesoNetPyTorch, self).__init__()
        
        # First convolutional block
        self.conv1 = nn.Conv2d(3, 8, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(8)
        self.pool1 = nn.MaxPool2d(2, 2)
        
        # Second convolutional block
        self.conv2 = nn.Conv2d(8, 8, kernel_size=5, padding=2)
        self.bn2 = nn.BatchNorm2d(8)
        self.pool2 = nn.MaxPool2d(2, 2)
        
        # Third convolutional block
        self.conv3 = nn.Conv2d(8, 16, kernel_size=5, padding=2)
        self.bn3 = nn.BatchNorm2d(16)
        self.pool3 = nn.MaxPool2d(2, 2)
        
        # Fourth convolutional block
        self.conv4 = nn.Conv2d(16, 16, kernel_size=5, padding=2)
        self.bn4 = nn.BatchNorm2d(16)
        self.pool4 = nn.MaxPool2d(2, 2)
        
        # Calculate flattened size
        self._calculate_flattened_size(input_size)
        
        # Dense layers
        self.fc1 = nn.Linear(self.flattened_size, 16)
        self.bn_fc1 = nn.BatchNorm1d(16)
        self.dropout = nn.Dropout(dropout_rate)
        
        # Output layer
        self.fc2 = nn.Linear(16, 1)
    
    def _calculate_flattened_size(self, input_size):
        """Calculate the size after convolutions"""
        # Create dummy tensor with correct shape (batch, channels, height, width)
        x = torch.zeros(1, input_size[2], input_size[0], input_size[1])  # (1, 3, 128, 128)
        x = self.pool1(F.relu(self.bn1(self.conv1(x))))
        x = self.pool2(F.relu(self.bn2(self.conv2(x))))
        x = self.pool3(F.relu(self.bn3(self.conv3(x))))
        x = self.pool4(F.relu(self.bn4(self.conv4(x))))
        self.flattened_size = x.numel()
    
    def forward(self, x):
        # Convolutional blocks
        x = self.pool1(F.relu(self.bn1(self.conv1(x))))
        x = self.pool2(F.relu(self.bn2(self.conv2(x))))
        x = self.pool3(F.relu(self.bn3(self.conv3(x))))
        x = self.pool4(F.relu(self.bn4(self.conv4(x))))
        
        # Flatten
        x = x.view(x.size(0), -1)
        
        # Dense layers
        x = self.dropout(F.relu(self.bn_fc1(self.fc1(x))))
        x = torch.sigmoid(self.fc2(x))
        
        return x

class LightweightNetPyTorch(nn.Module):
    """
    Even more lightweight model for faster inference
    """
    
    def __init__(self, input_size=(128, 128, 3)):
        super(LightweightNetPyTorch, self).__init__()
        
        # Feature extraction
        self.features = nn.Sequential(
            nn.Conv2d(3, 4, kernel_size=3, padding=1),
            nn.BatchNorm2d(4),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),
            
            nn.Conv2d(4, 8, kernel_size=3, padding=1),
            nn.BatchNorm2d(8),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),
            
            nn.Conv2d(8, 8, kernel_size=3, padding=1),
            nn.BatchNorm2d(8),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),
            
            nn.Conv2d(8, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((1, 1))
        )
        
        # Classification
        self.classifier = nn.Sequential(
            nn.Linear(16, 8),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(8, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        x = self.features(x)
        x = x.view(x.size(0), -1)
        x = self.classifier(x)
        return x

def create_model(model_type='mesonet'):
    """Create specified model type"""
    
    if model_type == 'mesonet':
        return MesoNetPyTorch()
    elif model_type == 'lightweight':
        return LightweightNetPyTorch()
    else:
        raise ValueError(f"Unknown model type: {model_type}")

def count_parameters(model):
    """Count model parameters"""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)

def get_model_info(model):
    """Get model information"""
    total_params = count_parameters(model)
    
    # Estimate model size (assuming 4 bytes per parameter for float32)
    size_bytes = total_params * 4
    size_mb = size_bytes / (1024 * 1024)
    
    return {
        'total_parameters': total_params,
        'size_mb': size_mb,
        'trainable_parameters': total_params
    }

def test_models():
    """Test model architectures"""
    
    print("🧠 Testing PyTorch Models")
    print("=" * 50)
    
    # Test MesoNet
    print("📊 MesoNet Model:")
    mesonet = MesoNetPyTorch()
    dummy_input = torch.randn(2, 3, 128, 128)  # Use batch size 2 for BatchNorm
    
    with torch.no_grad():
        output = mesonet(dummy_input)
    
    mesonet_info = get_model_info(mesonet)
    print(f"   Parameters: {mesonet_info['total_parameters']:,}")
    print(f"   Size: {mesonet_info['size_mb']:.2f} MB")
    print(f"   Output shape: {output.shape}")
    print()
    
    # Test Lightweight
    print("📊 Lightweight Model:")
    lightweight = LightweightNetPyTorch()
    
    with torch.no_grad():
        output = lightweight(dummy_input)
    
    lightweight_info = get_model_info(lightweight)
    print(f"   Parameters: {lightweight_info['total_parameters']:,}")
    print(f"   Size: {lightweight_info['size_mb']:.2f} MB")
    print(f"   Output shape: {output.shape}")
    print()
    
    return mesonet, lightweight

def export_to_onnx(model, filename, input_size=(1, 3, 128, 128)):
    """Export model to ONNX format for browser deployment"""
    
    model.eval()
    dummy_input = torch.randn(input_size)
    
    # Export to ONNX
    torch.onnx.export(
        model,
        dummy_input,
        filename,
        export_params=True,
        opset_version=11,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
    )
    
    print(f"✅ Model exported to {filename}")

if __name__ == "__main__":
    # Test models
    mesonet_model, lightweight_model = test_models()
    
    # Export to ONNX for browser deployment
    export_to_onnx(mesonet_model, 'mesonet')
    export_to_onnx(lightweight_model, 'lightweight')
