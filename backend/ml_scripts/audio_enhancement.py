#!/usr/bin/env python3
"""
Audio enhancement and processing for listening practice
"""

import sys
import os
import json
import numpy as np
import librosa
import soundfile as sf
from scipy import signal

def enhance_audio(input_path, output_path, options):
    """Enhance audio with various processing techniques"""
    try:
        # Load audio file
        y, sr = librosa.load(input_path, sr=None)
        original_duration = librosa.get_duration(y=y, sr=sr)
        
        # Apply noise reduction if requested
        if options.get('noise_reduction', True):
            y = noise_reduction(y, sr)
        
        # Apply speed adjustment if requested
        speed_factor = float(options.get('speed_adjustment', 1.0))
        if speed_factor != 1.0:
            y = adjust_speed(y, sr, speed_factor)
        
        # Apply clarity enhancement if requested
        if options.get('clarity_enhancement', True):
            y = enhance_clarity(y, sr)
        
        # Apply volume normalization if requested
        if options.get('volume_normalization', True):
            y = normalize_volume(y)
        
        # Save processed audio
        sf.write(output_path, y, sr)
        
        # Calculate new duration
        enhanced_duration = librosa.get_duration(y=y, sr=sr)
        
        return {
            "original_duration": original_duration,
            "enhanced_duration": enhanced_duration,
            "speed_factor": speed_factor,
            "noise_reduction_applied": options.get('noise_reduction', True),
            "clarity_enhancement_applied": options.get('clarity_enhancement', True),
            "volume_normalization_applied": options.get('volume_normalization', True),
            "sample_rate": sr
        }
        
    except Exception as e:
        return {"error": str(e)}

def noise_reduction(y, sr):
    """Apply noise reduction to audio signal"""
    # Simple noise reduction using spectral gating
    # In a real implementation, use a more sophisticated algorithm
    
    # Estimate noise from the first 0.5 seconds (assuming it's background noise)
    noise_sample = y[:int(sr * 0.5)] if len(y) > int(sr * 0.5) else y
    
    # Compute noise profile
    noise_stft = librosa.stft(noise_sample)
    noise_power = np.mean(np.abs(noise_stft)**2, axis=1)
    
    # Compute signal stft
    signal_stft = librosa.stft(y)
    signal_power = np.abs(signal_stft)**2
    
    # Apply spectral gating
    gain = 1 - np.minimum(1, noise_power[:, np.newaxis] / (signal_power + 1e-10))
    enhanced_stft = signal_stft * gain
    
    # Inverse STFT
    y_enhanced = librosa.istft(enhanced_stft, length=len(y))
    
    return y_enhanced

def adjust_speed(y, sr, speed_factor):
    """Adjust playback speed without changing pitch"""
    if speed_factor == 1.0:
        return y
    
    # Time-stretch using librosa
    y_stretched = librosa.effects.time_stretch(y, rate=speed_factor)
    
    return y_stretched

def enhance_clarity(y, sr):
    """Enhance speech clarity"""
    # Apply a simple high-pass filter to remove low-frequency noise
    b, a = signal.butter(4, 100/(sr/2), 'highpass')
    y_filtered = signal.filtfilt(b, a, y)
    
    # Apply a simple low-pass filter to remove high-frequency noise
    b, a = signal.butter(4, 7000/(sr/2), 'lowpass')
    y_filtered = signal.filtfilt(b, a, y_filtered)
    
    # Apply a simple EQ to boost speech frequencies (around 2-4 kHz)
    b, a = signal.butter(2, [2000/(sr/2), 4000/(sr/2)], 'bandpass')
    y_boosted = signal.filtfilt(b, a, y_filtered) * 1.5
    
    # Mix the boosted signal with the original filtered signal
    y_enhanced = y_filtered + y_boosted * 0.3
    
    return y_enhanced

def normalize_volume(y):
    """Normalize audio volume"""
    # Simple peak normalization
    max_val = np.max(np.abs(y))
    if max_val > 0:
        y_normalized = y / max_val * 0.9  # Leave some headroom
    else:
        y_normalized = y
    
    return y_normalized

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Input and output paths are required"}))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    options = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
    
    if not os.path.exists(input_path):
        print(json.dumps({"error": f"Input file not found: {input_path}"}))
        sys.exit(1)
    
    result = enhance_audio(input_path, output_path, options)
    print(json.dumps(result))
