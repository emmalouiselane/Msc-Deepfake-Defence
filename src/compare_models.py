"""
Compare different model configurations and document performance
Tests various hyperparameters and architectures to find optimal setup
"""

import os
import sys
import time
import json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
import matplotlib.pyplot as plt
import numpy as np
from datetime import datetime

from model_pytorch import MesoNetPyTorch, LightweightNetPyTorch, create_model
from train_pytorch import DeepFakeDataset, prepare_dataset

def test_configuration(model_type, data_dir, epochs=10, batch_size=32, learning_rate=0.001):
    """Test a specific configuration and return results"""
    
    print(f"\nTesting {model_type} model...")
    print(f"Data: {data_dir}")
    print(f"Batch: {batch_size}, Epochs: {epochs}, LR: {learning_rate}")
    
    try:
        # Prepare dataset
        train_loader, val_loader, test_loader, splits = prepare_dataset(data_dir, batch_size)
        
        # Create model
        model = create_model(model_type)
        criterion = nn.BCELoss()
        optimizer = optim.Adam(model.parameters(), lr=learning_rate)
        
        # Training metrics
        train_losses, val_losses = [], []
        train_accs, val_accs = [], []
        
        start_time = time.time()
        
        print(f"Starting training...")
        
        # Training loop
        for epoch in range(epochs):
            model.train()
            train_loss = 0.0
            correct = 0
            total = 0
            
            for batch_idx, (data, target) in enumerate(train_loader):
                optimizer.zero_grad()
                output = model(data)
                loss = criterion(output.squeeze(), target.squeeze())
                loss.backward()
                optimizer.step()
                
                train_loss += loss.item()
                predicted = (output.squeeze() > 0.5).float()
                correct += (predicted == target).sum().item()
                total += target.size(0)
                
                if batch_idx % 5 == 0:
                    print(f"  Batch {batch_idx}, Loss: {loss.item():.4f}")
            
            train_loss = train_loss / len(train_loader)
            train_acc = 100. * correct / total
            train_losses.append(train_loss)
            train_accs.append(train_acc)
            
            # Validation
            model.eval()
            val_loss = 0.0
            correct = 0
            total = 0
            
            with torch.no_grad():
                for data, target in val_loader:
                    output = model(data)
                    loss = criterion(output.squeeze(), target.squeeze())
                    val_loss += loss.item()
                    
                    predicted = (output.squeeze() > 0.5).float()
                    correct += (predicted == target).sum().item()
                    total += target.size(0)
            
            val_loss = val_loss / len(val_loader)
            val_acc = 100. * correct / total
            val_losses.append(val_acc)
            val_accs.append(val_acc)
            
            print(f"  Epoch {epoch+1}/{epochs}: Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.2f}%, Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.2f}%")
        
        training_time = time.time() - start_time
        
        # Test evaluation
        model.eval()
        test_correct = 0
        test_total = 0
        
        with torch.no_grad():
            for data, target in test_loader:
                output = model(data)
                predicted = (output.squeeze() > 0.5).float()
                test_correct += (predicted == target).sum().item()
                test_total += target.size(0)
        
        test_acc = 100. * test_correct / test_total
        
        results = {
            'model_type': model_type,
            'epochs': epochs,
            'batch_size': batch_size,
            'learning_rate': learning_rate,
            'final_train_acc': max(train_accs),
            'final_val_acc': max(val_accs),
            'test_acc': test_acc,
            'training_time': training_time,
            'num_params': sum(p.numel() for p in model.parameters() if p.requires_grad)
        }
        
        print(f"Test Accuracy: {test_acc:.2f}%")
        print(f"Training Time: {training_time:.1f}s")
        print(f"Parameters: {results['num_params']:,}")
        
        return results
        
    except Exception as e:
        print(f"Error testing {model_type}: {e}")
        return None

def run_comprehensive_tests():
    """Run comprehensive comparison of model configurations"""
    
    print("Starting comprehensive model comparison...")
    print("=" * 60)
    
    # Test configurations
    configs = [
        # Lightweight model tests
        {'model_type': 'lightweight', 'epochs': 10, 'batch_size': 16, 'lr': 0.001},
        {'model_type': 'lightweight', 'epochs': 10, 'batch_size': 32, 'lr': 0.001},
        {'model_type': 'lightweight', 'epochs': 10, 'batch_size': 32, 'lr': 0.01},
        
        # MesoNet model tests
        {'model_type': 'mesonet', 'epochs': 10, 'batch_size': 16, 'lr': 0.001},
        {'model_type': 'mesonet', 'epochs': 10, 'batch_size': 32, 'lr': 0.001},
    ]
    
    results = []
    
    for i, config in enumerate(configs):
        print(f"\nTest {i+1}/{len(configs)}: {config['model_type']} (BS={config['batch_size']}, LR={config['lr']})")
        
        # Use appropriate dataset
        if i < 4:  # First 4 tests use lightweight
            data_dir = "data/processed/quick_test"
        else:  # Last 2 tests use mesonet
            data_dir = "data/processed/sample"
        
        result = test_configuration(
            model_type=config['model_type'],
            data_dir=data_dir,
            epochs=config['epochs'],
            batch_size=config['batch_size'],
            learning_rate=config['lr']
        )
        
        if result:
            results.append(result)
    
    # Analysis
    print("\n" + "=" * 60)
    print("RESULTS SUMMARY")
    print("=" * 60)
    
    # Find best configuration
    best_result = max(results, key=lambda x: x['test_acc'])
    
    print(f"\nBEST CONFIGURATION:")
    print(f"  Model: {best_result['model_type']}")
    print(f"  Batch Size: {best_result['batch_size']}")
    print(f"  Learning Rate: {best_result['learning_rate']}")
    print(f"  Test Accuracy: {best_result['test_acc']:.2f}%")
    print(f"  Parameters: {best_result['num_params']:,}")
    print(f"  Training Time: {best_result['training_time']:.1f}s")
    
    # Comparison table
    print(f"\nALL RESULTS:")
    print(f"{'Model':<15} {'Batch':<8} {'LR':<8} {'Train Acc':<12} {'Val Acc':<12} {'Test Acc':<12} {'Params':<10} {'Time(s)':<8}")
    print("-" * 80)
    
    for result in results:
        print(f"{result['model_type']:<15} {result['batch_size']:<8} {result['learning_rate']:<8} "
              f"{result['final_train_acc']:<11.2f}% {result['final_val_acc']:<11.2f}% "
              f"{result['test_acc']:<11.2f}% {result['num_params']:<10,} {result['training_time']:<8.1f}")
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"model_comparison_results_{timestamp}.json"
    
    with open(results_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'best_config': best_result,
            'all_results': results
        }, f, indent=2)
    
    print(f"\nResults saved to: {results_file}")
    
    return best_result, results

def create_performance_visualization(results):
    """Create visualization of model performance comparison"""
    
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 12))
    
    models = [r['model_type'] for r in results]
    test_accs = [r['test_acc'] for r in results]
    param_counts = [r['num_params'] for r in results]
    
    # Test Accuracy vs Parameters
    ax1.scatter(param_counts, test_accs, alpha=0.7)
    for i, model in enumerate(models):
        ax1.annotate(model, (param_counts[i], test_accs[i]), 
                   xytext=(5, 2), fontsize=9)
    ax1.set_xlabel('Number of Parameters')
    ax1.set_ylabel('Test Accuracy (%)')
    ax1.set_title('Model Size vs Performance')
    ax1.grid(True, alpha=0.3)
    
    # Test Accuracy by Model Type
    ax2.bar(models, test_accs, alpha=0.7)
    ax2.set_ylabel('Test Accuracy (%)')
    ax2.set_title('Accuracy by Model Type')
    ax2.set_ylim(0, max(test_accs) * 1.1)
    
    # Training Time Comparison
    training_times = [r['training_time'] for r in results]
    ax3.bar(models, training_times, alpha=0.7, color='orange')
    ax3.set_ylabel('Training Time (seconds)')
    ax3.set_title('Training Efficiency')
    
    # Parameter Count Comparison
    ax4.bar(models, param_counts, alpha=0.7, color='green')
    ax4.set_ylabel('Number of Parameters')
    ax4.set_title('Model Complexity')
    
    plt.tight_layout()
    plt.savefig('model_comparison_visualization.png', dpi=150, bbox_inches='tight')
    plt.show()
    
    print("Visualization saved to: model_comparison_visualization.png")

if __name__ == "__main__":
    best_result, all_results = run_comprehensive_tests()
    create_performance_visualization(all_results)
