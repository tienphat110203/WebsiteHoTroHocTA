#!/usr/bin/env python3
"""
Comprehensive Essay Analysis and Inference System
"""
import os
import sys
import json
import numpy as np
import re
from typing import Dict, Any, List
import logging
from datetime import datetime

# Import our custom modules
from essay_model import get_essay_model, predict_essay_scores, analyze_essay_features
from error_detection import get_error_detector, detect_errors

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler("essay_inference.log"), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

class ComprehensiveEssayAnalyzer:
    """
    Comprehensive essay analysis system combining ML scoring and error detection
    """
    def __init__(self):
        """
        Initialize the comprehensive analyzer
        """
        logger.info("Initializing Comprehensive Essay Analyzer")
        self.essay_model = get_essay_model()
        self.error_detector = get_error_detector()
        self.initialized = True
        
    def analyze_essay_comprehensive(self, essay_text: str, prompt_text: str, level: str = "intermediate") -> Dict[str, Any]:
        """
        Perform comprehensive essay analysis
        
        Args:
            essay_text: Essay text to analyze
            prompt_text: Writing prompt
            level: Difficulty level (beginner, intermediate, advanced)
            
        Returns:
            Comprehensive analysis results
        """
        logger.info(f"Starting comprehensive analysis for {level} level essay")
        
        try:
            # 1. Basic text analysis
            basic_stats = self.extract_basic_statistics(essay_text)
            
            # 2. ML-based scoring
            ml_scores = self.get_ml_scores(essay_text)
            
            # 3. Rule-based scoring for validation
            rule_scores = self.get_rule_based_scores(essay_text, prompt_text, level)
            
            # 4. Combine scores intelligently
            final_scores = self.combine_scores(ml_scores, rule_scores, level)
            
            # 5. Error detection
            detected_errors = detect_errors(essay_text)
            
            # 6. Adjust scores based on errors
            adjusted_scores = self.adjust_scores_for_errors(final_scores, detected_errors)
            
            # 7. Generate comprehensive feedback
            feedback = self.generate_comprehensive_feedback(adjusted_scores, basic_stats, level, detected_errors)
            
            # 8. Generate improvement suggestions
            improvements = self.generate_improvement_suggestions(adjusted_scores, detected_errors, level)
            
            # 9. Analyze essay structure
            structure_analysis = self.analyze_essay_structure(essay_text)
            
            # 10. Group errors by type
            grouped_errors = self.group_errors_by_type(detected_errors)
            
            # Compile final analysis
            analysis = {
                "overall_score": round(adjusted_scores["overall"], 1),
                "detailed_scores": {
                    "content": round(adjusted_scores["content"], 1),
                    "organization": round(adjusted_scores["organization"], 1),
                    "language": round(adjusted_scores["language"], 1),
                    "conventions": round(adjusted_scores["conventions"], 1)
                },
                "feedback": feedback,
                "improvements": improvements,
                "structure_analysis": structure_analysis,
                "statistics": basic_stats,
                "errors": detected_errors,
                "grouped_errors": grouped_errors,
                "error_count": len(detected_errors),
                "level": level,
                "analysis_method": "comprehensive_ml_rule_hybrid",
                "timestamp": datetime.now().isoformat()
            }
            
            logger.info(f"Analysis completed. Overall score: {analysis['overall_score']}")
            return analysis
            
        except Exception as e:
            logger.error(f"Error in comprehensive analysis: {e}")
            # Fallback to basic analysis
            return self.fallback_analysis(essay_text, prompt_text, level)
    
    def extract_basic_statistics(self, essay_text: str) -> Dict[str, Any]:
        """
        Extract basic text statistics
        
        Args:
            essay_text: Essay text
            
        Returns:
            Dictionary of basic statistics
        """
        # Clean text for analysis
        cleaned_text = re.sub(r'\s+', ' ', essay_text.strip())
        
        # Word analysis
        words = re.findall(r'\b\w+\b', cleaned_text)
        word_count = len(words)
        
        # Sentence analysis
        sentences = re.split(r'[.!?]+', cleaned_text)
        sentences = [s.strip() for s in sentences if s.strip()]
        sentence_count = len(sentences)
        
        # Paragraph analysis
        paragraphs = essay_text.split('\n\n')
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        paragraph_count = len(paragraphs)
        
        # Calculate averages
        avg_words_per_sentence = word_count / max(sentence_count, 1)
        avg_sentences_per_paragraph = sentence_count / max(paragraph_count, 1)
        
        # Character analysis
        char_count = len(cleaned_text)
        char_count_no_spaces = len(cleaned_text.replace(' ', ''))
        
        # Vocabulary diversity
        unique_words = len(set(word.lower() for word in words))
        vocabulary_diversity = unique_words / max(word_count, 1)
        
        return {
            "word_count": word_count,
            "sentence_count": sentence_count,
            "paragraph_count": paragraph_count,
            "character_count": char_count,
            "character_count_no_spaces": char_count_no_spaces,
            "avg_words_per_sentence": round(avg_words_per_sentence, 1),
            "avg_sentences_per_paragraph": round(avg_sentences_per_paragraph, 1),
            "unique_words": unique_words,
            "vocabulary_diversity": round(vocabulary_diversity, 3),
            "reading_time_minutes": round(word_count / 200, 1)
        }
    
    def get_ml_scores(self, essay_text: str) -> Dict[str, float]:
        """
        Get ML-based scores
        
        Args:
            essay_text: Essay text
            
        Returns:
            ML scores
        """
        try:
            return predict_essay_scores(essay_text)
        except Exception as e:
            logger.warning(f"ML scoring failed: {e}")
            # Return neutral scores if ML fails
            return {
                "overall": 6.0,
                "content": 6.0,
                "organization": 6.0,
                "language": 6.0,
                "conventions": 6.0
            }
    
    def get_rule_based_scores(self, essay_text: str, prompt_text: str, level: str) -> Dict[str, float]:
        """
        Get rule-based scores for validation
        
        Args:
            essay_text: Essay text
            prompt_text: Writing prompt
            level: Difficulty level
            
        Returns:
            Rule-based scores
        """
        # Extract features for rule-based scoring
        features = analyze_essay_features(essay_text)
        
        # Score different aspects
        content_score = self.score_content_rule_based(essay_text, prompt_text, features)
        organization_score = self.score_organization_rule_based(essay_text, features)
        language_score = self.score_language_rule_based(essay_text, features)
        conventions_score = self.score_conventions_rule_based(essay_text)
        
        # Apply level adjustments
        level_factor = {"beginner": 1.1, "intermediate": 1.0, "advanced": 0.9}.get(level, 1.0)
        
        scores = {
            "content": min(10.0, content_score * level_factor),
            "organization": min(10.0, organization_score * level_factor),
            "language": min(10.0, language_score * level_factor),
            "conventions": min(10.0, conventions_score)  # Don't adjust conventions for level
        }
        
        scores["overall"] = sum(scores.values()) / len(scores)
        
        return scores
    
    def score_content_rule_based(self, essay_text: str, prompt_text: str, features: Dict) -> float:
        """
        Score content using rule-based approach
        
        Args:
            essay_text: Essay text
            prompt_text: Writing prompt
            features: Essay features
            
        Returns:
            Content score
        """
        score = 5.0  # Base score
        
        # Word count consideration
        word_count = features.get("word_count", 0)
        if word_count >= 300:
            score += 1.0
        elif word_count >= 200:
            score += 0.5
        elif word_count < 100:
            score -= 1.0
        
        # Evidence and examples
        evidence_indicators = [
            "for example", "according to", "the text states", "evidence shows",
            "the author argues", "research shows", "studies indicate"
        ]
        evidence_count = sum(1 for indicator in evidence_indicators if indicator in essay_text.lower())
        score += min(evidence_count * 0.5, 2.0)
        
        # Thesis detection
        if features.get("has_thesis", False):
            score += 1.0
        
        # Prompt relevance (simplified)
        prompt_keywords = set(re.findall(r'\b\w+\b', prompt_text.lower()))
        essay_keywords = set(re.findall(r'\b\w+\b', essay_text.lower()))
        relevance = len(prompt_keywords & essay_keywords) / max(len(prompt_keywords), 1)
        score += relevance * 2.0
        
        return min(score, 10.0)
    
    def score_organization_rule_based(self, essay_text: str, features: Dict) -> float:
        """
        Score organization using rule-based approach
        
        Args:
            essay_text: Essay text
            features: Essay features
            
        Returns:
            Organization score
        """
        score = 5.0  # Base score
        
        # Paragraph structure
        paragraph_count = features.get("paragraph_count", 0)
        if paragraph_count >= 4:
            score += 1.5
        elif paragraph_count >= 3:
            score += 1.0
        elif paragraph_count < 2:
            score -= 1.0
        
        # Introduction and conclusion
        if features.get("has_introduction", False):
            score += 1.0
        if features.get("has_conclusion", False):
            score += 1.0
        
        # Transitions
        transition_count = features.get("transition_count", 0)
        score += min(transition_count * 0.3, 1.5)
        
        # Logical flow (simplified check)
        sentences = re.split(r'[.!?]+', essay_text)
        if len(sentences) > 3:
            score += 0.5
        
        return min(score, 10.0)
    
    def score_language_rule_based(self, essay_text: str, features: Dict) -> float:
        """
        Score language use using rule-based approach
        
        Args:
            essay_text: Essay text
            features: Essay features
            
        Returns:
            Language score
        """
        score = 5.0  # Base score
        
        # Vocabulary diversity
        vocab_diversity = features.get("vocabulary_diversity", 0)
        if vocab_diversity > 0.7:
            score += 1.5
        elif vocab_diversity > 0.5:
            score += 1.0
        elif vocab_diversity < 0.3:
            score -= 1.0
        
        # Sentence variety
        avg_words_per_sentence = features.get("avg_words_per_sentence", 0)
        if 12 <= avg_words_per_sentence <= 20:
            score += 1.0
        elif avg_words_per_sentence > 25:
            score -= 0.5  # Too complex
        elif avg_words_per_sentence < 8:
            score -= 0.5  # Too simple
        
        # Academic vocabulary
        academic_vocab_ratio = features.get("academic_vocabulary_ratio", 0)
        score += min(academic_vocab_ratio * 10, 2.0)
        
        # Complex sentence structures
        complex_ratio = features.get("complex_sentence_ratio", 0)
        score += min(complex_ratio * 2, 1.0)
        
        return min(score, 10.0)
    
    def score_conventions_rule_based(self, essay_text: str) -> float:
        """
        Score writing conventions using rule-based approach
        
        Args:
            essay_text: Essay text
            
        Returns:
            Conventions score
        """
        score = 8.0  # Start high, deduct for errors
        
        # Basic error detection
        errors = detect_errors(essay_text)
        
        # Deduct points based on error severity
        for error in errors:
            severity = error.get("severity", "medium")
            if severity == "high":
                score -= 0.5
            elif severity == "medium":
                score -= 0.3
            else:
                score -= 0.1
        
        return max(score, 1.0)
    
    def combine_scores(self, ml_scores: Dict[str, float], rule_scores: Dict[str, float], level: str) -> Dict[str, float]:
        """
        Intelligently combine ML and rule-based scores
        
        Args:
            ml_scores: ML-based scores
            rule_scores: Rule-based scores
            level: Difficulty level
            
        Returns:
            Combined scores
        """
        # Weight factors for combining scores
        ml_weight = 0.7  # Prefer ML scores when available
        rule_weight = 0.3
        
        combined = {}
        for aspect in ["content", "organization", "language", "conventions"]:
            ml_score = ml_scores.get(aspect, 6.0)
            rule_score = rule_scores.get(aspect, 6.0)
            
            # If scores are very different, trust rule-based more
            if abs(ml_score - rule_score) > 2.0:
                ml_weight = 0.4
                rule_weight = 0.6
            
            combined[aspect] = ml_score * ml_weight + rule_score * rule_weight
        
        # Calculate overall score
        combined["overall"] = sum(combined[aspect] for aspect in ["content", "organization", "language", "conventions"]) / 4
        
        return combined
    
    def adjust_scores_for_errors(self, scores: Dict[str, float], errors: List[Dict]) -> Dict[str, float]:
        """
        Adjust scores based on detected errors
        
        Args:
            scores: Original scores
            errors: Detected errors
            
        Returns:
            Adjusted scores
        """
        adjusted = scores.copy()
        
        # Count errors by type
        error_counts = {"spelling": 0, "grammar": 0, "punctuation": 0, "style": 0}
        
        for error in errors:
            error_type = error.get("type", "other")
            if error_type in error_counts:
                error_counts[error_type] += 1
        
        # Adjust conventions score based on errors
        total_errors = sum(error_counts.values())
        if total_errors > 0:
            error_penalty = min(total_errors * 0.15, 2.5)
            adjusted["conventions"] = max(adjusted["conventions"] - error_penalty, 1.0)
        
        # Adjust language score for style issues
        if error_counts["style"] > 3:
            style_penalty = min(error_counts["style"] * 0.1, 1.0)
            adjusted["language"] = max(adjusted["language"] - style_penalty, 1.0)
        
        # Recalculate overall score
        adjusted["overall"] = sum(adjusted[aspect] for aspect in ["content", "organization", "language", "conventions"]) / 4
        
        return adjusted
    
    def generate_comprehensive_feedback(self, scores: Dict[str, float], stats: Dict, level: str, errors: List[Dict]) -> List[Dict[str, Any]]:
        """
        Generate comprehensive feedback
        
        Args:
            scores: Final scores
            stats: Basic statistics
            level: Difficulty level
            errors: Detected errors
            
        Returns:
            List of feedback items
        """
        feedback = []
        
        # Overall assessment
        overall_score = scores["overall"]
        if overall_score >= 8.5:
            feedback.append({
                "category": "Overall Assessment",
                "type": "positive",
                "severity": "info",
                "comment": "Excellent essay with strong performance across all areas.",
                "suggestions": ["Continue developing your advanced writing skills", "Consider more complex rhetorical strategies"]
            })
        elif overall_score >= 7.0:
            feedback.append({
                "category": "Overall Assessment", 
                "type": "positive",
                "severity": "info",
                "comment": "Good essay with solid foundation and clear strengths.",
                "suggestions": ["Focus on areas for improvement", "Continue practicing regularly"]
            })
        elif overall_score >= 5.5:
            feedback.append({
                "category": "Overall Assessment",
                "type": "neutral",
                "severity": "info", 
                "comment": "Developing essay with room for improvement in several areas.",
                "suggestions": ["Focus on fundamental writing skills", "Practice essay structure and organization"]
            })
        else:
            feedback.append({
                "category": "Overall Assessment",
                "type": "improvement",
                "severity": "warning",
                "comment": "Essay needs significant development across multiple areas.",
                "suggestions": ["Review basic essay writing principles", "Practice with simpler prompts first", "Seek additional writing support"]
            })
        
        # Content feedback
        content_score = scores["content"]
        if content_score >= 7.5:
            feedback.append({
                "category": "Content Development",
                "type": "positive",
                "severity": "low",
                "comment": "Strong content with good evidence and analysis.",
                "suggestions": ["Continue developing complex arguments", "Consider multiple perspectives"]
            })
        elif content_score >= 6.0:
            feedback.append({
                "category": "Content Development",
                "type": "neutral",
                "severity": "medium",
                "comment": "Good content foundation with room for deeper development.",
                "suggestions": ["Add more specific examples", "Strengthen evidence-to-claim connections", "Develop arguments more thoroughly"]
            })
        else:
            feedback.append({
                "category": "Content Development",
                "type": "improvement",
                "severity": "high",
                "comment": "Content needs significant development and stronger evidence.",
                "suggestions": ["Focus on addressing the prompt directly", "Add relevant examples and evidence", "Develop a clear thesis statement"]
            })
        
        # Organization feedback
        org_score = scores["organization"]
        if org_score >= 7.5:
            feedback.append({
                "category": "Organization",
                "type": "positive",
                "severity": "low",
                "comment": "Well-organized with clear structure and good flow.",
                "suggestions": ["Maintain this organizational strength", "Experiment with advanced transition techniques"]
            })
        elif org_score >= 6.0:
            feedback.append({
                "category": "Organization",
                "type": "neutral",
                "severity": "medium",
                "comment": "Good basic organization with opportunities for improvement.",
                "suggestions": ["Strengthen paragraph transitions", "Ensure clear topic sentences", "Improve conclusion strength"]
            })
        else:
            feedback.append({
                "category": "Organization",
                "type": "improvement",
                "severity": "high",
                "comment": "Essay structure needs significant improvement.",
                "suggestions": ["Create clear introduction with thesis", "Use topic sentences for each paragraph", "Add strong conclusion", "Practice basic essay structure"]
            })
        
        # Language feedback
        lang_score = scores["language"]
        if lang_score >= 7.5:
            feedback.append({
                "category": "Language Use",
                "type": "positive",
                "severity": "low",
                "comment": "Sophisticated language with good variety and precision.",
                "suggestions": ["Continue expanding vocabulary", "Experiment with rhetorical devices"]
            })
        elif lang_score >= 6.0:
            feedback.append({
                "category": "Language Use",
                "type": "neutral",
                "severity": "medium",
                "comment": "Good language use with room for more sophistication.",
                "suggestions": ["Vary sentence structures more", "Use more precise vocabulary", "Avoid word repetition"]
            })
        else:
            feedback.append({
                "category": "Language Use",
                "type": "improvement",
                "severity": "high",
                "comment": "Language use needs development for clarity and variety.",
                "suggestions": ["Practice sentence combining", "Build vocabulary through reading", "Focus on clarity first, then sophistication"]
            })
        
        # Conventions feedback based on errors
        conv_score = scores["conventions"]
        error_count = len(errors)
        if conv_score >= 8.0 and error_count <= 2:
            feedback.append({
                "category": "Writing Conventions",
                "type": "positive",
                "severity": "low",
                "comment": "Excellent command of writing conventions with minimal errors.",
                "suggestions": ["Maintain this high standard", "Continue careful proofreading"]
            })
        elif conv_score >= 6.5:
            feedback.append({
                "category": "Writing Conventions",
                "type": "neutral",
                "severity": "medium",
                "comment": f"Good conventions with {error_count} errors detected.",
                "suggestions": ["Review and correct identified errors", "Proofread more carefully", "Focus on common error patterns"]
            })
        else:
            feedback.append({
                "category": "Writing Conventions",
                "type": "improvement",
                "severity": "high",
                "comment": f"Multiple convention errors detected ({error_count} total).",
                "suggestions": ["Systematic proofreading needed", "Review grammar and punctuation rules", "Consider using writing tools for error checking"]
            })
        
        # Level-specific feedback
        if level == "advanced" and overall_score < 7.0:
            feedback.append({
                "category": "Advanced Level Expectations",
                "type": "improvement",
                "severity": "medium",
                "comment": "For advanced level, higher sophistication is expected.",
                "suggestions": ["Develop more complex arguments", "Use advanced vocabulary and syntax", "Incorporate nuanced analysis"]
            })
        elif level == "beginner" and overall_score >= 7.0:
            feedback.append({
                "category": "Beginner Level Achievement",
                "type": "positive",
                "severity": "info",
                "comment": "Excellent work for beginner level! Consider advancing to intermediate.",
                "suggestions": ["Try intermediate level prompts", "Challenge yourself with more complex topics"]
            })
        
        return feedback
    
    def generate_improvement_suggestions(self, scores: Dict[str, float], errors: List[Dict], level: str) -> List[Dict[str, Any]]:
        """
        Generate specific improvement suggestions
        
        Args:
            scores: Final scores
            errors: Detected errors
            level: Difficulty level
            
        Returns:
            List of improvement suggestions
        """
        improvements = []
        
        # Priority-based improvements
        score_thresholds = {"high": 6.0, "medium": 7.0, "low": 8.0}
        
        for aspect, score in scores.items():
            if aspect == "overall":
                continue
                
            if score < score_thresholds["high"]:
                priority = "high"
            elif score < score_thresholds["medium"]:
                priority = "medium"
            else:
                priority = "low"
            
            if score < score_thresholds["low"]:
                improvement = self.get_improvement_for_aspect(aspect, score, priority, level)
                if improvement:
                    improvements.append(improvement)
        
        # Error-based improvements
        if errors:
            error_improvement = self.get_error_based_improvement(errors)
            if error_improvement:
                improvements.append(error_improvement)
        
        # If no specific improvements, add general ones
        if not improvements:
            improvements.append({
                "area": "General Writing Development",
                "priority": "medium",
                "description": "Continue developing your writing skills across all areas.",
                "tips": [
                    "Read widely to improve vocabulary and style",
                    "Practice writing regularly with varied prompts",
                    "Seek feedback from teachers or peers",
                    "Study model essays in your field"
                ]
            })
        
        return improvements
    
    def get_improvement_for_aspect(self, aspect: str, score: float, priority: str, level: str) -> Dict[str, Any]:
        """
        Get improvement suggestion for specific aspect
        
        Args:
            aspect: Writing aspect (content, organization, etc.)
            score: Current score
            priority: Priority level
            level: Difficulty level
            
        Returns:
            Improvement suggestion
        """
        improvements = {
            "content": {
                "area": "Content Development",
                "description": "Strengthen your argument development and evidence use.",
                "tips": [
                    "Develop a clear, arguable thesis statement",
                    "Use specific examples and evidence from sources",
                    "Explain how evidence supports your claims",
                    "Address counterarguments to strengthen your position",
                    "Ensure all content directly relates to the prompt"
                ]
            },
            "organization": {
                "area": "Essay Organization",
                "description": "Improve the structure and logical flow of your essay.",
                "tips": [
                    "Create a clear introduction with thesis statement",
                    "Use topic sentences to start each body paragraph",
                    "Add transition words and phrases between ideas",
                    "Ensure logical progression of arguments",
                    "Write a strong conclusion that reinforces your thesis"
                ]
            },
            "language": {
                "area": "Language and Style",
                "description": "Enhance your vocabulary and sentence variety.",
                "tips": [
                    "Vary sentence lengths and structures",
                    "Use more precise and sophisticated vocabulary",
                    "Avoid repetitive word choices",
                    "Practice combining simple sentences into complex ones",
                    "Read academic texts to improve language patterns"
                ]
            },
            "conventions": {
                "area": "Writing Conventions",
                "description": "Improve accuracy in grammar, punctuation, and mechanics.",
                "tips": [
                    "Proofread carefully for grammar and spelling errors",
                    "Review punctuation rules and usage",
                    "Check subject-verb agreement throughout",
                    "Use spell-check and grammar tools",
                    "Read your essay aloud to catch errors"
                ]
            }
        }
        
        improvement = improvements.get(aspect, {})
        if improvement:
            improvement["priority"] = priority
            
            # Add level-specific tips
            if level == "advanced" and aspect in ["content", "language"]:
                improvement["tips"].extend([
                    "Incorporate sophisticated rhetorical strategies",
                    "Develop nuanced, complex arguments",
                    "Use discipline-specific vocabulary appropriately"
                ])
            elif level == "beginner":
                improvement["tips"] = improvement["tips"][:3]  # Limit to essential tips
        
        return improvement
    
    def get_error_based_improvement(self, errors: List[Dict]) -> Dict[str, Any]:
        """
        Generate improvement based on detected errors
        
        Args:
            errors: List of detected errors
            
        Returns:
            Error-based improvement suggestion
        """
        if not errors:
            return None
        
        # Count error types
        error_counts = {}
        for error in errors:
            error_type = error.get("type", "other")
            error_counts[error_type] = error_counts.get(error_type, 0) + 1
        
        # Find most common error type
        most_common_error = max(error_counts.items(), key=lambda x: x[1])
        error_type, count = most_common_error
        
        error_improvements = {
            "spelling": {
                "area": "Spelling Accuracy",
                "description": f"Focus on correcting spelling errors ({count} detected).",
                "tips": [
                    "Use spell-check tools during writing",
                    "Keep a personal list of commonly misspelled words",
                    "Practice spelling rules and patterns",
                    "Proofread specifically for spelling errors"
                ]
            },
            "grammar": {
                "area": "Grammar Accuracy", 
                "description": f"Address grammar issues ({count} detected).",
                "tips": [
                    "Review basic grammar rules",
                    "Pay attention to subject-verb agreement",
                    "Check verb tenses for consistency",
                    "Use grammar checking tools"
                ]
            },
            "punctuation": {
                "area": "Punctuation Accuracy",
                "description": f"Improve punctuation usage ({count} errors detected).",
                "tips": [
                    "Review punctuation rules",
                    "Pay attention to comma usage",
                    "Ensure proper sentence endings",
                    "Check spacing around punctuation marks"
                ]
            },
            "style": {
                "area": "Writing Style",
                "description": f"Address style issues ({count} detected).",
                "tips": [
                    "Vary sentence structures for better flow",
                    "Avoid repetitive word choices",
                    "Use active voice when appropriate",
                    "Eliminate wordy or redundant phrases"
                ]
            }
        }
        
        improvement = error_improvements.get(error_type)
        if improvement:
            improvement["priority"] = "high" if count > 5 else "medium"
        
        return improvement
    
    def analyze_essay_structure(self, essay_text: str) -> Dict[str, Any]:
        """
        Analyze essay structure comprehensively
        
        Args:
            essay_text: Essay text
            
        Returns:
            Structure analysis
        """
        paragraphs = essay_text.split('\n\n')
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        
        sentences = re.split(r'[.!?]+', essay_text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # Analyze introduction
        has_introduction = False
        thesis_detected = False
        if paragraphs:
            first_para = paragraphs[0].lower()
            intro_indicators = [
                'in this essay', 'this essay will', 'i will argue',
                'the author suggests', 'this paper', 'the purpose'
            ]
            has_introduction = any(indicator in first_para for indicator in intro_indicators) or len(first_para) > 100
            
            # Thesis detection
            thesis_indicators = [
                'argue', 'claim', 'believe', 'suggest', 'propose',
                'maintain', 'assert', 'contend', 'demonstrate'
            ]
            thesis_detected = any(indicator in first_para for indicator in thesis_indicators)
        
        # Analyze conclusion
        has_conclusion = False
        if paragraphs:
            last_para = paragraphs[-1].lower()
            conclusion_indicators = [
                'in conclusion', 'to conclude', 'in summary',
                'therefore', 'thus', 'overall', 'finally'
            ]
            has_conclusion = any(indicator in last_para for indicator in conclusion_indicators) or len(last_para) > 50
        
        # Count transitions
        transition_words = [
            'first', 'second', 'third', 'next', 'then', 'finally',
            'however', 'furthermore', 'moreover', 'additionally',
            'in addition', 'similarly', 'likewise', 'in contrast',
            'on the other hand', 'meanwhile', 'consequently',
            'therefore', 'thus', 'as a result'
        ]
        
        transition_count = sum(1 for word in transition_words if word in essay_text.lower())
        
        return {
            "has_introduction": has_introduction,
            "has_conclusion": has_conclusion,
            "thesis_detected": thesis_detected,
            "body_paragraphs": max(0, len(paragraphs) - 2) if has_introduction and has_conclusion else max(0, len(paragraphs) - 1),
            "total_paragraphs": len(paragraphs),
            "transition_count": transition_count,
            "avg_paragraph_length": sum(len(p.split()) for p in paragraphs) / max(len(paragraphs), 1),
            "structure_score": self.calculate_structure_score(has_introduction, has_conclusion, thesis_detected, len(paragraphs), transition_count)
        }
    
    def calculate_structure_score(self, has_intro: bool, has_conclusion: bool, has_thesis: bool, para_count: int, transitions: int) -> float:
        """
        Calculate overall structure score
        
        Args:
            has_intro: Has introduction
            has_conclusion: Has conclusion
            has_thesis: Has thesis
            para_count: Paragraph count
            transitions: Transition count
            
        Returns:
            Structure score (1-10)
        """
        score = 5.0
        
        if has_intro:
            score += 1.0
        if has_conclusion:
            score += 1.0
        if has_thesis:
            score += 1.0
        
        # Paragraph count
        if para_count >= 4:
            score += 1.0
        elif para_count >= 3:
            score += 0.5
        elif para_count < 2:
            score -= 1.0
        
        # Transitions
        if transitions >= 3:
            score += 1.0
        elif transitions >= 1:
            score += 0.5
        
        return min(score, 10.0)
    
    def group_errors_by_type(self, errors: List[Dict]) -> Dict[str, List[Dict]]:
        """
        Group errors by type for better organization
        
        Args:
            errors: List of errors
            
        Returns:
            Errors grouped by type
        """
        grouped = {
            "spelling": [],
            "grammar": [],
            "punctuation": [],
            "word_choice": [],
            "style": [],
            "coherence": [],
            "redundancy": [],
            "clarity": []
        }
        
        for error in errors:
            error_type = error.get("type", "other")
            if error_type in grouped:
                grouped[error_type].append(error)
        
        return grouped
    
    def fallback_analysis(self, essay_text: str, prompt_text: str, level: str) -> Dict[str, Any]:
        """
        Fallback analysis when main analysis fails
        
        Args:
            essay_text: Essay text
            prompt_text: Writing prompt
            level: Difficulty level
            
        Returns:
            Basic analysis results
        """
        logger.warning("Using fallback analysis")
        
        # Basic statistics
        stats = self.extract_basic_statistics(essay_text)
        
        # Simple rule-based scoring
        word_count = stats["word_count"]
        base_score = 6.0
        
        if word_count >= 300:
            base_score += 1.0
        elif word_count < 150:
            base_score -= 1.0
        
        scores = {
            "overall": base_score,
            "content": base_score,
            "organization": base_score,
            "language": base_score,
            "conventions": base_score
        }
        
        return {
            "overall_score": base_score,
            "detailed_scores": scores,
            "feedback": [{
                "category": "General",
                "type": "info",
                "severity": "info",
                "comment": "Basic analysis completed. For detailed feedback, please try again.",
                "suggestions": ["Continue practicing writing", "Focus on essay structure"]
            }],
            "improvements": [{
                "area": "General Writing",
                "priority": "medium",
                "description": "Continue developing your writing skills.",
                "tips": ["Practice regularly", "Read model essays", "Seek feedback"]
            }],
            "structure_analysis": {"basic_structure": True},
            "statistics": stats,
            "errors": [],
            "grouped_errors": {},
            "error_count": 0,
            "level": level,
            "analysis_method": "fallback",
            "timestamp": datetime.now().isoformat()
        }

# Singleton instance
comprehensive_analyzer = None

def get_comprehensive_analyzer():
    """
    Get or create the comprehensive analyzer instance
    
    Returns:
        ComprehensiveEssayAnalyzer instance
    """
    global comprehensive_analyzer
    if comprehensive_analyzer is None:
        comprehensive_analyzer = ComprehensiveEssayAnalyzer()
    return comprehensive_analyzer

def analyze_essay_comprehensive(essay_text: str, prompt_text: str, level: str = "intermediate") -> Dict[str, Any]:
    """
    Perform comprehensive essay analysis
    
    Args:
        essay_text: Essay text to analyze
        prompt_text: Writing prompt
        level: Difficulty level
        
    Returns:
        Comprehensive analysis results
    """
    analyzer = get_comprehensive_analyzer()
    return analyzer.analyze_essay_comprehensive(essay_text, prompt_text, level)

def main():
    """
    Main function for essay inference
    """
    try:
        # Check for test mode
        if len(sys.argv) > 1 and sys.argv[1] == "--test":
            print("ML_MODEL_READY")
            sys.exit(0)
        
        # Read input from stdin
        input_data = sys.stdin.read()
        
        if not input_data.strip():
            raise ValueError("No input data provided")
        
        # Parse JSON input
        data = json.loads(input_data)
        
        # Extract required fields
        essay = data.get("essay", "")
        prompt = data.get("prompt", "")
        level = data.get("level", "intermediate")
        
        if not essay:
            raise ValueError("Essay text is required")
        
        if not prompt:
            raise ValueError("Prompt text is required")
        
        # Perform comprehensive analysis
        analysis = analyze_essay_comprehensive(essay, prompt, level)
        
        # Output the result as JSON
        print(json.dumps(analysis, indent=2))
        
    except json.JSONDecodeError as e:
        error_response = {
            "success": False,
            "error": f"Invalid JSON input: {str(e)}"
        }
        print(json.dumps(error_response))
        sys.exit(1)
        
    except ValueError as e:
        error_response = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_response))
        sys.exit(1)
        
    except Exception as e:
        error_response = {
            "success": False,
            "error": f"Analysis failed: {str(e)}"
        }
        print(json.dumps(error_response))
        sys.exit(1)

if __name__ == "__main__":
    main()
