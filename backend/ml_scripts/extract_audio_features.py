#!/usr/bin/env python3
"""
Extract audio features for accent recognition and analysis
"""

import sys
import os
import json
import numpy as np
import librosa
import librosa.display
import soundfile as sf
from scipy.signal import lfilter

def extract_features(audio_path):
    """Extract audio features for accent recognition and analysis"""
    try:
        # Load audio file
        y, sr = librosa.load(audio_path, sr=16000)
        
        # Basic features
        duration = librosa.get_duration(y=y, sr=sr)
        
        # Extract mel spectrogram
        mel_spec = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=80)
        mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)
        
        # Extract MFCC features
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_delta = librosa.feature.delta(mfcc)
        mfcc_delta2 = librosa.feature.delta(mfcc, order=2)
        
        # Extract pitch (F0) features
        f0, voiced_flag, voiced_probs = librosa.pyin(y, 
                                                    fmin=librosa.note_to_hz('C2'), 
                                                    fmax=librosa.note_to_hz('C7'),
                                                    sr=sr)
        f0 = np.nan_to_num(f0)
        f0_mean = np.mean(f0[f0 > 0]) if np.any(f0 > 0) else 0
        f0_std = np.std(f0[f0 > 0]) if np.any(f0 > 0) else 0
        
        # Extract formants (simplified)
        # In a real implementation, use a proper formant extraction library
        formants = [0, 0, 0]  # Placeholder for F1, F2, F3
        
        # Speech rate estimation (simplified)
        # Count syllables using energy peaks
        energy = np.sum(mel_spec, axis=0)
        peaks = librosa.util.peak_pick(energy, pre_max=3, post_max=3, pre_avg=3, post_avg=5, delta=0.5, wait=10)
        speech_rate = len(peaks) / duration if duration > 0 else 0
        
        # Vowel space (simplified)
        # In a real implementation, use proper vowel formant analysis
        vowel_space = 0  # Placeholder
        
        # Prepare features for model input
        # Resize mel spectrogram for model input
        target_length = 100  # Target time frames
        if mel_spec_db.shape[1] > target_length:
            mel_spec_db = mel_spec_db[:, :target_length]
        else:
            # Pad with zeros
            pad_width = target_length - mel_spec_db.shape[1]
            mel_spec_db = np.pad(mel_spec_db, ((0, 0), (0, pad_width)), mode='constant')
        
        # Normalize features
        mel_spec_db = (mel_spec_db - np.mean(mel_spec_db)) / (np.std(mel_spec_db) + 1e-8)
        
        # Return features as JSON-serializable dict
        return {
            "duration": float(duration),
            "f0_mean": float(f0_mean),
            "f0_std": float(f0_std),
            "formants": [float(f) for f in formants],
            "speech_rate": float(speech_rate),
            "vowel_space": float(vowel_space),
            "mfcc_mean": np.mean(mfcc, axis=1).tolist(),
            "mfcc_std": np.std(mfcc, axis=1).tolist(),
            "mel_spectrogram": mel_spec_db.tolist(),
            "energy_mean": float(np.mean(energy)),
            "energy_std": float(np.std(energy)),
        }
        
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Audio file path is required"}))
        sys.exit(1)
    
    audio_path = sys.argv[1]
    
    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"Audio file not found: {audio_path}"}))
        sys.exit(1)
    
    features = extract_features(audio_path)
    print(json.dumps(features))
