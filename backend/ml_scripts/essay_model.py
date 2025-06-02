#!/usr/bin/env python3
"""
Advanced Essay Scoring Model using Transformer architecture with comprehensive analysis
"""
import os
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Dense, Dropout, Bidirectional, LSTM, 
    GlobalAveragePooling1D, GlobalMaxPooling1D, Concatenate,
    MultiHeadAttention, LayerNormalization, Add
)
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from transformers import TFBertModel, BertTokenizer, AutoTokenizer, AutoModel
import json
import logging
from typing import Dict, List, Any, Tuple, Optional
import re
from collections import Counter
import spacy

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler("essay_model.log"), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

class AdvancedEssayScoringModel:
    """
    Advanced ML model for automated essay scoring with comprehensive analysis
    """
    def __init__(self, model_path=None, bert_model_name="bert-base-uncased", max_length=512):
        """
        Initialize the advanced essay scoring model
        
        Args:
            model_path: Path to load a pre-trained model
            bert_model_name: Name of the BERT model to use
            max_length: Maximum sequence length for tokenizer
        """
        self.bert_model_name = bert_model_name
        self.max_length = max_length
        self.tokenizer = BertTokenizer.from_pretrained(bert_model_name)
        self.model = None
        self.history = None
        
        # Initialize NLP components
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy model not found, using basic analysis")
            self.nlp = None
        
        # Load model if path is provided
        if model_path and os.path.exists(model_path):
            logger.info(f"Loading model from {model_path}")
            self.load_model(model_path)
    
    def build_advanced_model(self):
        """
        Build advanced transformer-based model for essay scoring
        
        Returns:
            Compiled Keras model
        """
        # Input layers
        input_ids = Input(shape=(self.max_length,), dtype=tf.int32, name="input_ids")
        attention_mask = Input(shape=(self.max_length,), dtype=tf.int32, name="attention_mask")
        
        # BERT layer
        bert_model = TFBertModel.from_pretrained(self.bert_model_name)
        
        # Freeze BERT layers initially
        for layer in bert_model.layers:
            layer.trainable = False
            
        bert_outputs = bert_model({"input_ids": input_ids, "attention_mask": attention_mask})[0]
        
        # Custom transformer layers
        # Multi-head attention for essay-specific features
        attention_output = MultiHeadAttention(
            num_heads=8, 
            key_dim=64,
            name="essay_attention"
        )(bert_outputs, bert_outputs)
        
        attention_output = LayerNormalization()(attention_output)
        attention_output = Add()([bert_outputs, attention_output])
        
        # BiLSTM layers for sequential understanding
        lstm_output = Bidirectional(LSTM(128, return_sequences=True, dropout=0.2))(attention_output)
        lstm_output = Dropout(0.3)(lstm_output)
        lstm_output = Bidirectional(LSTM(64, return_sequences=True, dropout=0.2))(lstm_output)
        
        # Pooling strategies
        avg_pool = GlobalAveragePooling1D()(lstm_output)
        max_pool = GlobalMaxPooling1D()(lstm_output)
        
        # Combine pooling outputs
        combined = Concatenate()([avg_pool, max_pool])
        combined = Dropout(0.4)(combined)
        
        # Dense layers for feature extraction
        dense1 = Dense(256, activation="relu")(combined)
        dense1 = Dropout(0.3)(dense1)
        dense2 = Dense(128, activation="relu")(dense1)
        dense2 = Dropout(0.2)(dense2)
        
        # Multi-task outputs for different scoring aspects
        content_branch = Dense(64, activation="relu", name="content_branch")(dense2)
        content_output = Dense(1, activation="sigmoid", name="content_score")(content_branch)
        
        organization_branch = Dense(64, activation="relu", name="organization_branch")(dense2)
        organization_output = Dense(1, activation="sigmoid", name="organization_score")(organization_branch)
        
        language_branch = Dense(64, activation="relu", name="language_branch")(dense2)
        language_output = Dense(1, activation="sigmoid", name="language_score")(language_branch)
        
        conventions_branch = Dense(64, activation="relu", name="conventions_branch")(dense2)
        conventions_output = Dense(1, activation="sigmoid", name="conventions_score")(conventions_branch)
        
        # Overall score as weighted combination
        overall_features = Concatenate()([content_branch, organization_branch, language_branch, conventions_branch])
        overall_dense = Dense(32, activation="relu")(overall_features)
        overall_output = Dense(1, activation="sigmoid", name="overall_score")(overall_dense)
        
        # Create model
        model = Model(
            inputs=[input_ids, attention_mask],
            outputs=[
                overall_output,
                content_output,
                organization_output,
                language_output,
                conventions_output
            ]
        )
        
        # Compile model with advanced optimizer
        model.compile(
            optimizer=Adam(learning_rate=2e-5, beta_1=0.9, beta_2=0.999, epsilon=1e-8),
            loss={
                "overall_score": "mse",
                "content_score": "mse",
                "organization_score": "mse",
                "language_score": "mse",
                "conventions_score": "mse"
            },
            metrics={
                "overall_score": ["mae", "mse"],
                "content_score": ["mae"],
                "organization_score": ["mae"],
                "language_score": ["mae"],
                "conventions_score": ["mae"]
            },
            loss_weights={
                "overall_score": 1.0,
                "content_score": 0.8,
                "organization_score": 0.8,
                "language_score": 0.8,
                "conventions_score": 0.8
            }
        )
        
        self.model = model
        logger.info("Advanced model built successfully")
        return model
    
    def preprocess_essay(self, essay_text):
        """
        Preprocess essay text for model input
        
        Args:
            essay_text: Raw essay text
            
        Returns:
            Tokenized inputs for model
        """
        # Clean and normalize text
        cleaned_text = self.clean_text(essay_text)
        
        # Tokenize with BERT tokenizer
        encoding = self.tokenizer(
            cleaned_text,
            truncation=True,
            padding="max_length",
            max_length=self.max_length,
            return_tensors="tf"
        )
        
        return {
            "input_ids": encoding["input_ids"],
            "attention_mask": encoding["attention_mask"]
        }
    
    def clean_text(self, text):
        """
        Clean and normalize essay text
        
        Args:
            text: Raw text
            
        Returns:
            Cleaned text
        """
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Fix common encoding issues
        text = text.replace('"', '"').replace('"', '"')
        text = text.replace(''', "'").replace(''', "'")
        
        # Ensure proper sentence endings
        text = re.sub(r'([.!?])\s*([A-Z])', r'\1 \2', text)
        
        return text.strip()
    
    def predict_scores(self, essay_text):
        """
        Predict scores for an essay
        
        Args:
            essay_text: Essay text to score
            
        Returns:
            Dictionary of predicted scores
        """
        if self.model is None:
            # Build model with default architecture if not loaded
            self.build_advanced_model()
            logger.warning("Using untrained model - scores may not be accurate")
        
        # Preprocess essay
        inputs = self.preprocess_essay(essay_text)
        
        # Get predictions
        predictions = self.model.predict(inputs, verbose=0)
        
        # Scale predictions to 1-10 range
        scores = {
            "overall": float(predictions[0][0][0]) * 9 + 1,
            "content": float(predictions[1][0][0]) * 9 + 1,
            "organization": float(predictions[2][0][0]) * 9 + 1,
            "language": float(predictions[3][0][0]) * 9 + 1,
            "conventions": float(predictions[4][0][0]) * 9 + 1
        }
        
        return scores
    
    def analyze_essay_features(self, essay_text):
        """
        Extract comprehensive features from essay
        
        Args:
            essay_text: Essay text
            
        Returns:
            Dictionary of essay features
        """
        features = {}
        
        # Basic statistics
        words = essay_text.split()
        sentences = re.split(r'[.!?]+', essay_text)
        sentences = [s.strip() for s in sentences if s.strip()]
        paragraphs = essay_text.split('\n\n')
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        
        features['word_count'] = len(words)
        features['sentence_count'] = len(sentences)
        features['paragraph_count'] = len(paragraphs)
        features['avg_words_per_sentence'] = len(words) / max(len(sentences), 1)
        features['avg_sentences_per_paragraph'] = len(sentences) / max(len(paragraphs), 1)
        
        # Vocabulary analysis
        word_freq = Counter(word.lower() for word in words if word.isalpha())
        features['unique_words'] = len(word_freq)
        features['vocabulary_diversity'] = len(word_freq) / max(len(words), 1)
        
        # Sentence complexity
        complex_sentences = sum(1 for s in sentences if len(s.split()) > 15)
        features['complex_sentence_ratio'] = complex_sentences / max(len(sentences), 1)
        
        # Academic vocabulary
        academic_words = self.count_academic_vocabulary(words)
        features['academic_vocabulary_count'] = academic_words
        features['academic_vocabulary_ratio'] = academic_words / max(len(words), 1)
        
        # Transition words
        transitions = self.count_transitions(essay_text)
        features['transition_count'] = transitions
        
        # Essay structure
        structure = self.analyze_structure(essay_text, paragraphs)
        features.update(structure)
        
        return features
    
    def count_academic_vocabulary(self, words):
        """
        Count academic vocabulary words
        
        Args:
            words: List of words
            
        Returns:
            Count of academic words
        """
        academic_words = {
            'analyze', 'evaluate', 'demonstrate', 'illustrate', 'examine',
            'investigate', 'establish', 'determine', 'significant', 'substantial',
            'comprehensive', 'fundamental', 'essential', 'crucial', 'critical',
            'perspective', 'approach', 'methodology', 'framework', 'concept',
            'theory', 'hypothesis', 'evidence', 'research', 'study',
            'analysis', 'conclusion', 'argument', 'thesis', 'claim',
            'furthermore', 'moreover', 'however', 'nevertheless', 'consequently',
            'therefore', 'thus', 'hence', 'accordingly', 'subsequently'
        }
        
        return sum(1 for word in words if word.lower() in academic_words)
    
    def count_transitions(self, text):
        """
        Count transition words and phrases
        
        Args:
            text: Essay text
            
        Returns:
            Count of transitions
        """
        transitions = [
            'first', 'second', 'third', 'next', 'then', 'finally',
            'however', 'furthermore', 'moreover', 'additionally',
            'in addition', 'similarly', 'likewise', 'in contrast',
            'on the other hand', 'meanwhile', 'consequently',
            'therefore', 'thus', 'as a result', 'in conclusion'
        ]
        
        text_lower = text.lower()
        return sum(1 for transition in transitions if transition in text_lower)
    
    def analyze_structure(self, essay_text, paragraphs):
        """
        Analyze essay structure
        
        Args:
            essay_text: Essay text
            paragraphs: List of paragraphs
            
        Returns:
            Dictionary of structure features
        """
        structure = {}
        
        if not paragraphs:
            return {
                'has_introduction': False,
                'has_conclusion': False,
                'body_paragraph_count': 0,
                'has_thesis': False
            }
        
        # Check for introduction
        first_para = paragraphs[0].lower()
        intro_indicators = [
            'in this essay', 'this essay will', 'i will argue',
            'the author suggests', 'this paper', 'the purpose of'
        ]
        structure['has_introduction'] = any(indicator in first_para for indicator in intro_indicators)
        
        # Check for conclusion
        last_para = paragraphs[-1].lower()
        conclusion_indicators = [
            'in conclusion', 'to conclude', 'in summary',
            'therefore', 'thus', 'overall', 'finally'
        ]
        structure['has_conclusion'] = any(indicator in last_para for indicator in conclusion_indicators)
        
        # Body paragraphs
        structure['body_paragraph_count'] = max(0, len(paragraphs) - 2)
        
        # Thesis detection
        structure['has_thesis'] = self.detect_thesis(essay_text)
        
        return structure
    
    def detect_thesis(self, text):
        """
        Detect if essay has a clear thesis statement
        
        Args:
            text: Essay text
            
        Returns:
            Boolean indicating thesis presence
        """
        first_paragraph = text.split('\n')[0] if '\n' in text else text[:500]
        thesis_indicators = [
            'argue', 'claim', 'believe', 'suggest', 'propose',
            'maintain', 'assert', 'contend', 'demonstrate',
            'prove', 'show', 'will discuss', 'will examine'
        ]
        
        return any(indicator in first_paragraph.lower() for indicator in thesis_indicators)
    
    def save_model(self, path="advanced_essay_model"):
        """
        Save the model to disk
        
        Args:
            path: Path to save the model
        """
        if self.model is None:
            raise ValueError("Model must be built before saving")
        
        os.makedirs(path, exist_ok=True)
        
        # Save model weights
        self.model.save_weights(f"{path}/model_weights.h5")
        
        # Save model architecture
        with open(f"{path}/model_architecture.json", "w") as f:
            f.write(self.model.to_json())
        
        # Save tokenizer
        self.tokenizer.save_pretrained(f"{path}/tokenizer")
        
        # Save configuration
        config = {
            "bert_model_name": self.bert_model_name,
            "max_length": self.max_length,
            "model_type": "advanced_essay_scorer"
        }
        with open(f"{path}/config.json", "w") as f:
            json.dump(config, f)
        
        logger.info(f"Model saved to {path}")
    
    def load_model(self, path):
        """
        Load the model from disk
        
        Args:
            path: Path to load the model from
        """
        try:
            # Load configuration
            with open(f"{path}/config.json", "r") as f:
                config = json.load(f)
            
            self.bert_model_name = config["bert_model_name"]
            self.max_length = config["max_length"]
            
            # Load tokenizer
            self.tokenizer = BertTokenizer.from_pretrained(f"{path}/tokenizer")
            
            # Build model architecture
            self.build_advanced_model()
            
            # Load weights
            self.model.load_weights(f"{path}/model_weights.h5")
            
            logger.info(f"Model loaded from {path}")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            # Build default model
            self.build_advanced_model()

# Singleton instance
essay_model = None

def get_essay_model():
    """
    Get or create the essay model instance
    
    Returns:
        AdvancedEssayScoringModel instance
    """
    global essay_model
    if essay_model is None:
        essay_model = AdvancedEssayScoringModel()
    return essay_model

def predict_essay_scores(essay_text):
    """
    Predict scores for an essay
    
    Args:
        essay_text: Essay text to score
        
    Returns:
        Dictionary of predicted scores
    """
    model = get_essay_model()
    return model.predict_scores(essay_text)

def analyze_essay_features(essay_text):
    """
    Analyze essay features
    
    Args:
        essay_text: Essay text
        
    Returns:
        Dictionary of essay features
    """
    model = get_essay_model()
    return model.analyze_essay_features(essay_text)

if __name__ == "__main__":
    # Test the model
    test_essay = """
    The author of "The Challenge of Exploring Venus" presents a compelling argument for why studying Venus is worthwhile despite the challenges. The article effectively uses scientific evidence, historical context, and future possibilities to support this claim.
    
    First, the author provides strong scientific evidence about Venus's unique properties. The extreme temperatures and pressure are described in detail, showing why exploration is difficult. However, the author balances this by explaining how these same challenges make Venus scientifically valuable.
    
    In conclusion, the author effectively supports the idea that Venus exploration is worthwhile through a balanced presentation of challenges and benefits.
    """
    
    scores = predict_essay_scores(test_essay)
    features = analyze_essay_features(test_essay)
    
    print("Predicted Scores:", scores)
    print("Essay Features:", features)
