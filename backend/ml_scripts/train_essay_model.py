#!/usr/bin/env python3
"""
Training script for the essay scoring model
"""
import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
import tensorflow as tf
from essay_model import EssayScoringModel
import logging
import json
import requests
from io import StringIO

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler("essay_training.log"), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

def download_dataset(url):
    """
    Download dataset from URL
    
    Args:
        url: URL to download from
        
    Returns:
        Pandas DataFrame
    """
    logger.info(f"Downloading dataset from {url}")
    response = requests.get(url)
    response.raise_for_status()
    
    # Parse CSV
    data = pd.read_csv(StringIO(response.text))
    logger.info(f"Downloaded dataset with {len(data)} rows")
    
    return data

def preprocess_dataset(data):
    """
    Preprocess the dataset for training
    
    Args:
        data: Pandas DataFrame
        
    Returns:
        Tuple of (essays, scores)
    """
    logger.info("Preprocessing dataset")
    
    # Clean data
    data = data.dropna(subset=["full_text", "score"])
    
    # Extract essays
    essays = data["full_text"].tolist()
    
    # Generate synthetic scores for different aspects
    # In a real implementation, you would use actual scores for each aspect
    overall_scores = data["score"].values / 10.0  # Normalize to 0-1 range
    
    # Create synthetic scores for different aspects
    np.random.seed(42)
    content_scores = overall_scores * 0.9 + np.random.normal(0, 0.05, len(overall_scores))
    organization_scores = overall_scores * 0.85 + np.random.normal(0, 0.05, len(overall_scores))
    language_scores = overall_scores * 0.95 + np.random.normal(0, 0.05, len(overall_scores))
    conventions_scores = overall_scores * 0.8 + np.random.normal(0, 0.05, len(overall_scores))
    
    # Clip scores to 0-1 range
    content_scores = np.clip(content_scores, 0, 1)
    organization_scores = np.clip(organization_scores, 0, 1)
    language_scores = np.clip(language_scores, 0, 1)
    conventions_scores = np.clip(conventions_scores, 0, 1)
    
    # Scale scores to 0-10 range
    overall_scores = overall_scores * 10
    content_scores = content_scores * 10
    organization_scores = organization_scores * 10
    language_scores = language_scores * 10
    conventions_scores = conventions_scores * 10
    
    # Create scores dictionary
    scores = {
        "overall": overall_scores,
        "content": content_scores,
        "organization": organization_scores,
        "language": language_scores,
        "conventions": conventions_scores
    }
    
    logger.info(f"Preprocessed {len(essays)} essays")
    return essays, scores

def main():
    """
    Main training function
    """
    # Set random seeds for reproducibility
    np.random.seed(42)
    tf.random.set_seed(42)
    
    # Download dataset
    dataset_url = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ASAP2_train_sourcetexts-qzZ42jOFi2vUDvilbB8cEu5MOXQ1uh.csv"
    data = download_dataset(dataset_url)
    
    # Preprocess dataset
    essays, scores = preprocess_dataset(data)
    
    # Split data into train and test sets
    essays_train, essays_test, scores_train, scores_test = train_test_split(
        essays,
        {k: v for k, v in scores.items()},
        test_size=0.2,
        random_state=42
    )
    
    logger.info(f"Training set: {len(essays_train)} essays")
    logger.info(f"Test set: {len(essays_test)} essays")
    
    # Initialize model
    model = EssayScoringModel(bert_model_name="distilbert-base-uncased", max_length=512)
    
    # Build model
    model.build_model()
    
    # Train model
    logger.info("Starting model training")
    model.train(
        essays=essays_train,
        scores=scores_train,
        validation_split=0.2,
        epochs=5,
        batch_size=8
    )
    
    # Fine-tune model
    logger.info("Starting model fine-tuning")
    model.fine_tune(
        essays=essays_train,
        scores=scores_train,
        epochs=3,
        batch_size=4
    )
    
    # Evaluate model
    logger.info("Evaluating model")
    metrics = model.evaluate(essays_test, scores_test)
    
    # Print evaluation metrics
    logger.info("Evaluation metrics:")
    for aspect, aspect_metrics in metrics.items():
        logger.info(f"{aspect.capitalize()} scores:")
        logger.info(f"  MSE: {aspect_metrics['mse']:.4f}")
        logger.info(f"  MAE: {aspect_metrics['mae']:.4f}")
        logger.info(f"  R²: {aspect_metrics['r2']:.4f}")
    
    # Plot training history
    logger.info("Plotting training history")
    model.plot_training_history()
    
    # Save model
    logger.info("Saving model")
    model.save_model("essay_scoring_model")
    
    logger.info("Training completed successfully")

if __name__ == "__main__":
    main()
