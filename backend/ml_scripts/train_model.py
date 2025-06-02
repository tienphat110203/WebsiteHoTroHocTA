#!/usr/bin/env python3
"""
Training script for the pronunciation analysis model
"""
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv2D, MaxPooling2D, LSTM, Dense, Dropout, Reshape, BatchNormalization
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
import librosa
import json
import os

class PronunciationModelTrainer:
    def __init__(self):
        self.model = None
        self.input_shape = (None, 13, 1)  # Variable length, 13 MFCC features, 1 channel
        
    def create_model(self):
        """Create the CNN + LSTM model for pronunciation analysis"""
        model = Sequential([
            # Input layer
            tf.keras.layers.Input(shape=self.input_shape),
            
            # CNN layers for feature extraction
            Conv2D(64, (3, 3), activation='relu', padding='same'),
            BatchNormalization(),
            MaxPooling2D((2, 1), padding='same'),
            Dropout(0.3),
            
            Conv2D(128, (3, 3), activation='relu', padding='same'),
            BatchNormalization(),
            MaxPooling2D((2, 1), padding='same'),
            Dropout(0.3),
            
            Conv2D(256, (3, 3), activation='relu', padding='same'),
            BatchNormalization(),
            Dropout(0.3),
            
            # Reshape for LSTM
            Reshape((-1, 256)),
            
            # LSTM layers for temporal modeling
            LSTM(256, return_sequences=True, dropout=0.3, recurrent_dropout=0.3),
            BatchNormalization(),
            
            LSTM(128, return_sequences=True, dropout=0.3, recurrent_dropout=0.3),
            BatchNormalization(),
            
            LSTM(64, return_sequences=False, dropout=0.3),
            
            # Dense layers for final prediction
            Dense(128, activation='relu'),
            Dropout(0.5),
            Dense(64, activation='relu'),
            
            # Multi-task output
            Dense(50, activation='sigmoid', name='pronunciation_output')
        ])
        
        return model
    
    def compile_model(self, model):
        """Compile the model with appropriate loss and metrics"""
        model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss='mean_squared_error',
            metrics=['accuracy', 'mean_absolute_error']
        )
        return model
    
    def prepare_data(self, data_path):
        """Prepare training data from audio files and labels"""
        # This would load and preprocess real training data
        # For now, we'll create synthetic data for demonstration
        
        # Synthetic training data
        num_samples = 1000
        max_length = 100  # Maximum sequence length
        
        X = []
        y = []
        
        for i in range(num_samples):
            # Random sequence length
            seq_length = np.random.randint(50, max_length)
            
            # Random MFCC features
            mfcc_features = np.random.randn(seq_length, 13)
            X.append(mfcc_features)
            
            # Random target scores
            pronunciation_score = np.random.beta(2, 1)  # Skewed towards higher scores
            fluency_score = np.random.beta(2, 1)
            accuracy_score = np.random.beta(2, 1)
            
            # Random phoneme scores
            phoneme_scores = np.random.beta(2, 1, 39)  # 39 phonemes
            
            # Combine targets
            target = np.concatenate([[pronunciation_score, fluency_score, accuracy_score], phoneme_scores, np.random.rand(8)])
            y.append(target)
        
        return X, y
    
    def pad_sequences(self, sequences, maxlen=None):
        """Pad sequences to the same length"""
        if maxlen is None:
            maxlen = max(len(seq) for seq in sequences)
        
        padded = np.zeros((len(sequences), maxlen, sequences[0].shape[1]))
        
        for i, seq in enumerate(sequences):
            length = min(len(seq), maxlen)
            padded[i, :length] = seq[:length]
        
        return padded
    
    def train_model(self, X_train, y_train, X_val=None, y_val=None, epochs=100):
        """Train the pronunciation model"""
        # Pad sequences
        X_train_padded = self.pad_sequences(X_train)
        X_train_padded = X_train_padded.reshape(X_train_padded.shape[0], X_train_padded.shape[1], X_train_padded.shape[2], 1)
        
        if X_val is not None:
            X_val_padded = self.pad_sequences(X_val, X_train_padded.shape[1])
            X_val_padded = X_val_padded.reshape(X_val_padded.shape[0], X_val_padded.shape[1], X_val_padded.shape[2], 1)
            validation_data = (X_val_padded, np.array(y_val))
        else:
            validation_data = None
        
        # Create and compile model
        self.model = self.create_model()
        self.model = self.compile_model(self.model)
        
        # Callbacks
        callbacks = [
            EarlyStopping(patience=10, restore_best_weights=True),
            ModelCheckpoint('best_pronunciation_model.h5', save_best_only=True)
        ]
        
        # Train the model
        history = self.model.fit(
            X_train_padded,
            np.array(y_train),
            epochs=epochs,
            batch_size=32,
            validation_data=validation_data,
            callbacks=callbacks,
            verbose=1
        )
        
        return history
    
    def save_model(self, filepath):
        """Save the trained model"""
        if self.model:
            self.model.save(filepath)
            print(f"Model saved to {filepath}")
        else:
            print("No model to save. Train the model first.")
    
    def evaluate_model(self, X_test, y_test):
        """Evaluate the model on test data"""
        if self.model:
            X_test_padded = self.pad_sequences(X_test)
            X_test_padded = X_test_padded.reshape(X_test_padded.shape[0], X_test_padded.shape[1], X_test_padded.shape[2], 1)
            
            loss, accuracy, mae = self.model.evaluate(X_test_padded, np.array(y_test))
            print(f"Test Loss: {loss:.4f}")
            print(f"Test Accuracy: {accuracy:.4f}")
            print(f"Test MAE: {mae:.4f}")
            
            return loss, accuracy, mae
        else:
            print("No model to evaluate. Train the model first.")

def main():
    """Main training function"""
    trainer = PronunciationModelTrainer()
    
    # Prepare data (in real implementation, load from actual audio files)
    print("Preparing training data...")
    X, y = trainer.prepare_data("data/pronunciation_data")
    
    # Split data
    split_idx = int(0.8 * len(X))
    X_train, X_val = X[:split_idx], X[split_idx:]
    y_train, y_val = y[:split_idx], y[split_idx:]
    
    print(f"Training samples: {len(X_train)}")
    print(f"Validation samples: {len(X_val)}")
    
    # Train model
    print("Starting training...")
    history = trainer.train_model(X_train, y_train, X_val, y_val, epochs=50)
    
    # Save model
    trainer.save_model("pronunciation_model.h5")
    
    # Save training history
    with open("training_history.json", "w") as f:
        json.dump(history.history, f)
    
    print("Training completed!")

if __name__ == "__main__":
    main()
