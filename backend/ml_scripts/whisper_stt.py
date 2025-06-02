#!/usr/bin/env python3
"""
Speech-to-Text processing using OpenAI's Whisper model
"""

import sys
import os
import json
import time
import torch
import numpy as np
import librosa
import whisper
from datetime import datetime

def process_audio(audio_path, language="en"):
    """Process audio file with Whisper model and return transcription with word timestamps"""
    start_time = time.time()
    
    try:
        # Load Whisper model - use "tiny" for quick processing, "base" for better accuracy
        # In production, use "small" or "medium" for better results
        model = whisper.load_model("tiny")
        
        # Load audio
        audio, sr = librosa.load(audio_path, sr=16000, mono=True)
        
        # Get transcription
        result = model.transcribe(
            audio, 
            language=language,
            word_timestamps=True,
            verbose=False
        )
        
        # Process word timestamps
        word_timestamps = []
        for segment in result["segments"]:
            for word in segment.get("words", []):
                word_timestamps.append({
                    "word": word["word"].strip(),
                    "start": word["start"],
                    "end": word["end"],
                    "confidence": word.get("confidence", 0.0)
                })
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Prepare result
        output = {
            "text": result["text"],
            "language": result["language"],
            "segments": result["segments"],
            "word_timestamps": word_timestamps,
            "confidence": np.mean([word.get("confidence", 0.0) for word in word_timestamps]) if word_timestamps else 0.0,
            "processing_time": processing_time
        }
        
        return output
        
    except Exception as e:
        return {
            "error": str(e),
            "text": "",
            "word_timestamps": [],
            "confidence": 0.0,
            "processing_time": time.time() - start_time
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Audio file path is required"}))
        sys.exit(1)
    
    audio_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "en"
    
    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"Audio file not found: {audio_path}"}))
        sys.exit(1)
    
    result = process_audio(audio_path, language)
    print(json.dumps(result))
