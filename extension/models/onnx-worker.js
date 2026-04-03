// ONNX Worker for Deepfake Detection
// This worker handles ONNX model inference in a separate context

let ort = null;
let modelSession = null;
let modelLoaded = false;

// Load ONNX Runtime
async function loadONNXRuntime() {
    try {
        // Import ONNX Runtime Web
        importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js');
        ort = self.ort;
        console.log('ONNX Worker: ONNX Runtime loaded');
        return true;
    } catch (error) {
        console.error('ONNX Worker: Failed to load ONNX Runtime:', error);
        return false;
    }
}

// Load ONNX model
async function loadModel() {
    try {
        if (!ort) {
            await loadONNXRuntime();
        }

        // Get model URL from main thread
        const modelUrl = 'models/lightweight_model.onnx';
        
        // Create inference session
        modelSession = await ort.InferenceSession.create(modelUrl);
        modelLoaded = true;
        
        console.log('ONNX Worker: Model loaded successfully');
        return true;
    } catch (error) {
        console.error('ONNX Worker: Failed to load model:', error);
        return false;
    }
}

// Preprocess image for model input
async function preprocessImage(imageData) {
    try {
        // Create ImageBitmap from image data
        const imageBitmap = await createImageBitmap(imageData);
        
        // Create canvas for processing
        const canvas = new OffscreenCanvas(128, 128);
        const ctx = canvas.getContext('2d');
        
        // Draw and resize image
        ctx.drawImage(imageBitmap, 0, 0, 128, 128);
        
        // Get pixel data
        const pixels = ctx.getImageData(0, 0, 128, 128).data;
        
        // Convert to tensor format (CHW, normalized to [0,1])
        const input = new Float32Array(3 * 128 * 128);
        
        for (let c = 0; c < 3; c++) {
            for (let h = 0; h < 128; h++) {
                for (let w = 0; w < 128; w++) {
                    const pixelIndex = (h * 128 + w) * 4;
                    const tensorIndex = c * 128 * 128 + h * 128 + w;
                    
                    // Normalize pixel values to [0, 1]
                    input[tensorIndex] = pixels[pixelIndex + c] / 255.0;
                }
            }
        }
        
        // Create tensor with shape [1, 3, 128, 128]
        return new ort.Tensor('float32', input, [1, 3, 128, 128]);
    } catch (error) {
        console.error('ONNX Worker: Image preprocessing failed:', error);
        throw error;
    }
}

// Run inference
async function runInference(inputTensor) {
    try {
        if (!modelLoaded) {
            throw new Error('Model not loaded');
        }

        // Run inference
        const results = await modelSession.run({
            'input': inputTensor
        });
        
        // Get output (model outputs sigmoid activation)
        const output = results.output.data[0]; // Single value between 0 and 1
        
        console.log(`ONNX Worker: Model output: ${output}`);
        
        return {
            rawOutput: output,
            isFake: output > 0.5,
            confidence: Math.abs(output - 0.5) * 2 * 100
        };
    } catch (error) {
        console.error('ONNX Worker: Inference failed:', error);
        throw error;
    }
}

// Calculate sensitivity threshold
function calculateSensitivityThreshold(sensitivity) {
    return 1 - (sensitivity / 100);
}

// Apply sensitivity to model output
function applySensitivityToModelOutput(baseOutput, sensitivity) {
    const threshold = calculateSensitivityThreshold(sensitivity);
    
    let adjustedScore;
    if (baseOutput > threshold) {
        const excess = baseOutput - threshold;
        const maxExcess = 1 - threshold;
        adjustedScore = 50 + (excess / maxExcess) * 50 * (sensitivity / 100);
    } else {
        adjustedScore = (baseOutput / threshold) * 50 * (1 - sensitivity / 100);
    }
    
    return Math.max(0, Math.min(100, adjustedScore));
}

// Calculate confidence
function calculateConfidence(baseOutput, threshold) {
    const distance = Math.abs(baseOutput - threshold);
    const maxDistance = Math.max(threshold, 1 - threshold);
    const normalizedDistance = distance / maxDistance;
    const confidence = 70 + normalizedDistance * 25;
    
    return Math.max(70, Math.min(95, confidence));
}

// Handle messages from main thread
self.addEventListener('message', async (event) => {
    const { type, data, id } = event.data;
    
    try {
        let result;
        
        switch (type) {
            case 'load':
                result = await loadModel();
                break;
                
            case 'inference':
                // Preprocess image
                const inputTensor = await preprocessImage(data.imageData);
                
                // Run inference
                const inferenceResult = await runInference(inputTensor);
                
                // Apply sensitivity
                const threshold = calculateSensitivityThreshold(data.sensitivity);
                const riskScore = applySensitivityToModelOutput(
                    inferenceResult.rawOutput, 
                    data.sensitivity
                );
                const confidence = calculateConfidence(
                    inferenceResult.rawOutput, 
                    threshold
                );
                
                result = {
                    riskScore: riskScore,
                    confidence: confidence,
                    rawOutput: inferenceResult.rawOutput,
                    threshold: threshold,
                    isFake: inferenceResult.rawOutput > threshold,
                    technicalDetails: {
                        model: 'LightweightNet v2.11',
                        parameters: '2,377',
                        inferenceTime: 'Real-time',
                        sensitivity: data.sensitivity,
                        threshold: threshold.toFixed(3),
                        rawOutput: inferenceResult.rawOutput.toFixed(3)
                    }
                };
                break;
                
            default:
                throw new Error(`Unknown message type: ${type}`);
        }
        
        // Send result back to main thread
        self.postMessage({
            type: type,
            success: true,
            result: result,
            id: id
        });
        
    } catch (error) {
        console.error(`ONNX Worker: Error handling ${type}:`, error);
        
        // Send error back to main thread
        self.postMessage({
            type: type,
            success: false,
            error: error.message,
            id: id
        });
    }
});

// Initialize worker
console.log('ONNX Worker: Worker initialized');
