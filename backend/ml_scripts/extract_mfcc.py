#!/usr/bin/env python3
import sys
import json
import numpy as np
import librosa
import warnings
warnings.filterwarnings('ignore')

def extract_mfcc_features(audio_file, n_mfcc=13, n_fft=2048, hop_length=512):
    """
    Extract MFCC features from audio file
    """
    try:
        # Load audio file
        y, sr = librosa.load(audio_file, sr=16000)
        
        # Extract MFCC features
        mfcc = librosa.feature.mfcc(
            y=y, 
            sr=sr, 
            n_mfcc=n_mfcc,
            n_fft=n_fft,
            hop_length=hop_length
        )
        
        # Transpose to get time-series format (time_steps, features)
        mfcc = mfcc.T
        
        # Add delta and delta-delta features
        delta_mfcc = librosa.feature.delta(mfcc.T).T
        delta2_mfcc = librosa.feature.delta(mfcc.T, order=2).T
        
        # Combine features
        features = np.concatenate([mfcc, delta_mfcc, delta2_mfcc], axis=1)
        
        # Normalize features
        features = (features - np.mean(features, axis=0)) / (np.std(features, axis=0) + 1e-8)
        
        # Extract additional acoustic features
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
        zero_crossing_rate = librosa.feature.zero_crossing_rate(y)[0]
        
        # Pitch/F0 estimation
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitch_values = []
        for t in range(pitches.shape[1]):
            index = magnitudes[:, t].argmax()
            pitch = pitches[index, t]
            pitch_values.append(pitch if pitch > 0 else 0)
        
        # Create comprehensive feature set
        result = {
            'mfcc': features[:, :n_mfcc].tolist(),
            'delta_mfcc': features[:, n_mfcc:2*n_mfcc].tolist(),
            'delta2_mfcc': features[:, 2*n_mfcc:].tolist(),
            'spectral_centroid': spectral_centroid.tolist(),
            'spectral_rolloff': spectral_rolloff.tolist(),
            'zero_crossing_rate': zero_crossing_rate.tolist(),
            'pitch': pitch_values,
            'duration': len(y) / sr,
            'sample_rate': sr,
            'n_frames': features.shape[0]
        }
        
        return result
        
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

def extract_phoneme_features(audio_file):
    """
    Extract phoneme-level features for pronunciation analysis
    """
    try:
        y, sr = librosa.load(audio_file, sr=16000)
        
        # Extract mel-frequency cepstral coefficients
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        
        # Extract spectral features
        spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        tonnetz = librosa.feature.tonnetz(y=librosa.effects.harmonic(y), sr=sr)
        
        # Combine all features
        features = np.vstack([mfcc, spectral_contrast, chroma, tonnetz])
        
        # Statistical features (mean, std, max, min)
        feature_stats = []
        for feat in features:
            feature_stats.extend([
                np.mean(feat),
                np.std(feat),
                np.max(feat),
                np.min(feat)
            ])
        
        return {
            'phoneme_features': features.T.tolist(),
            'statistical_features': feature_stats,
            'feature_dimensions': {
                'mfcc': 13,
                'spectral_contrast': 7,
                'chroma': 12,
                'tonnetz': 6
            }
        }
        
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({'error': 'Usage: python extract_mfcc.py <audio_file>'}))
        sys.exit(1)
    
    audio_file = sys.argv[1]
    
    # Extract basic MFCC features
    mfcc_result = extract_mfcc_features(audio_file)
    
    # Extract phoneme-level features
    phoneme_result = extract_phoneme_features(audio_file)
    
    # Combine results
    combined_result = {
        **mfcc_result,
        **phoneme_result
    }
    
    print(json.dumps(combined_result))
