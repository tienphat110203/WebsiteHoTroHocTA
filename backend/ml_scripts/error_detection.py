#!/usr/bin/env python3
"""
Advanced Error Detection and Correction System for Essay Writing
"""
import re
import json
import numpy as np
import spacy
from typing import List, Dict, Tuple, Any
import logging
from collections import defaultdict, Counter
import string

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler("error_detection.log"), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

class AdvancedErrorDetector:
    """
    Advanced error detection system for comprehensive essay analysis
    """
    def __init__(self):
        """
        Initialize the advanced error detector
        """
        logger.info("Initializing Advanced Error Detector")
        self.initialize_components()
        self.load_error_patterns()
        
    def initialize_components(self):
        """
        Initialize NLP components and models
        """
        try:
            # Load spaCy model
            self.nlp = spacy.load("en_core_web_sm")
            logger.info("spaCy model loaded successfully")
            self.nlp_available = True
        except OSError:
            logger.warning("spaCy model not available, using rule-based detection only")
            self.nlp = None
            self.nlp_available = False
        
        # Error type definitions
        self.error_types = {
            "spelling": "Spelling Error",
            "grammar": "Grammar Error", 
            "punctuation": "Punctuation Error",
            "word_choice": "Word Choice Error",
            "style": "Style Issue",
            "coherence": "Coherence Issue",
            "redundancy": "Redundancy Issue",
            "clarity": "Clarity Issue"
        }
        
    def load_error_patterns(self):
        """
        Load comprehensive error patterns and dictionaries
        """
        # Common spelling errors and corrections
        self.spelling_corrections = {
            # Contractions
            "alot": "a lot",
            "cant": "can't",
            "dont": "don't",
            "doesnt": "doesn't",
            "didnt": "didn't",
            "couldnt": "couldn't",
            "shouldnt": "shouldn't",
            "wouldnt": "wouldn't",
            "wont": "won't",
            "isnt": "isn't",
            "wasnt": "wasn't",
            "werent": "weren't",
            "havent": "haven't",
            "hasnt": "hasn't",
            "hadnt": "hadn't",
            "youre": "you're",
            "youve": "you've",
            "youll": "you'll",
            "youd": "you'd",
            "hes": "he's",
            "shes": "she's",
            "weve": "we've",
            "wed": "we'd",
            "theyd": "they'd",
            "theyve": "they've",
            "thats": "that's",
            "whats": "what's",
            "wheres": "where's",
            "hows": "how's",
            "whos": "who's",
            "whens": "when's",
            "whys": "why's",
            
            # Common misspellings
            "recieve": "receive",
            "seperate": "separate",
            "definately": "definitely",
            "occured": "occurred",
            "begining": "beginning",
            "beleive": "believe",
            "acheive": "achieve",
            "neccessary": "necessary",
            "accomodate": "accommodate",
            "embarass": "embarrass",
            "existance": "existence",
            "independant": "independent",
            "maintainance": "maintenance",
            "occassion": "occasion",
            "priviledge": "privilege",
            "recomend": "recommend",
            "succesful": "successful",
            "tommorrow": "tomorrow",
            "untill": "until",
            "wierd": "weird",
            "goverment": "government",
            "enviroment": "environment",
            "arguement": "argument",
            "judgement": "judgment",
            "knowlege": "knowledge",
            "rythm": "rhythm",
            "speach": "speech",
            "writting": "writing",
            "grammer": "grammar"
        }
        
        # Word choice confusions
        self.word_choice_errors = {
            "affect": ["effect"],
            "effect": ["affect"],
            "accept": ["except"],
            "except": ["accept"],
            "than": ["then"],
            "then": ["than"],
            "there": ["their", "they're"],
            "their": ["there", "they're"],
            "they're": ["there", "their"],
            "your": ["you're"],
            "you're": ["your"],
            "its": ["it's"],
            "it's": ["its"],
            "whose": ["who's"],
            "who's": ["whose"],
            "weather": ["whether"],
            "whether": ["weather"],
            "lose": ["loose"],
            "loose": ["lose"],
            "principal": ["principle"],
            "principle": ["principal"],
            "complement": ["compliment"],
            "compliment": ["complement"],
            "desert": ["dessert"],
            "dessert": ["desert"],
            "advice": ["advise"],
            "advise": ["advice"],
            "breath": ["breathe"],
            "breathe": ["breath"],
            "choose": ["chose"],
            "chose": ["choose"]
        }
        
        # Grammar patterns to detect
        self.grammar_patterns = [
            # Subject-verb agreement
            {
                "pattern": r"\b(he|she|it)\s+(are|were)\b",
                "type": "grammar",
                "message": "Subject-verb agreement error",
                "suggestion": "Use 'is' or 'was' with singular subjects",
                "severity": "high"
            },
            {
                "pattern": r"\b(they|we|you)\s+(is|was)\b",
                "type": "grammar", 
                "message": "Subject-verb agreement error",
                "suggestion": "Use 'are' or 'were' with plural subjects",
                "severity": "high"
            },
            
            # Modal verb errors
            {
                "pattern": r"\bcould of|should of|would of|must of|might of\b",
                "type": "grammar",
                "message": "Incorrect modal verb form",
                "suggestion": "Use 'have' instead of 'of' after modal verbs",
                "severity": "high"
            },
            
            # Double negatives
            {
                "pattern": r"\bdon't\s+\w*n't\b|\bcan't\s+\w*n't\b",
                "type": "grammar",
                "message": "Double negative",
                "suggestion": "Use only one negative in a sentence",
                "severity": "medium"
            },
            
            # Incorrect prepositions
            {
                "pattern": r"\bdifferent than\b",
                "type": "grammar",
                "message": "Incorrect preposition",
                "suggestion": "Use 'different from' instead of 'different than'",
                "severity": "medium"
            },
            
            # Sentence fragments
            {
                "pattern": r"\b(Because|Since|Although|While|If)\s+[^.!?]*\.\s*[A-Z]",
                "type": "grammar",
                "message": "Possible sentence fragment",
                "suggestion": "Complete the dependent clause or connect to main clause",
                "severity": "medium"
            }
        ]
        
        # Punctuation patterns
        self.punctuation_patterns = [
            {
                "pattern": r"[.!?]{2,}",
                "type": "punctuation",
                "message": "Multiple punctuation marks",
                "suggestion": "Use only one punctuation mark",
                "severity": "low"
            },
            {
                "pattern": r"[.!?,;:][a-zA-Z]",
                "type": "punctuation", 
                "message": "Missing space after punctuation",
                "suggestion": "Add space after punctuation marks",
                "severity": "medium"
            },
            {
                "pattern": r"\s+[,;:]",
                "type": "punctuation",
                "message": "Space before punctuation",
                "suggestion": "Remove space before punctuation",
                "severity": "low"
            },
            {
                "pattern": r"[a-zA-Z]\s*$$[^)]*$$\s*[a-zA-Z]",
                "type": "punctuation",
                "message": "Parentheses spacing",
                "suggestion": "Check spacing around parentheses",
                "severity": "low"
            }
        ]
        
        # Style issue patterns
        self.style_patterns = [
            {
                "pattern": r"\bvery\s+very\b",
                "type": "style",
                "message": "Redundant intensifier",
                "suggestion": "Use a single, stronger adjective",
                "severity": "low"
            },
            {
                "pattern": r"\bthat\s+that\b",
                "type": "style", 
                "message": "Repeated word",
                "suggestion": "Remove redundant 'that'",
                "severity": "low"
            },
            {
                "pattern": r"\bin order to\b",
                "type": "style",
                "message": "Wordy phrase",
                "suggestion": "Consider using 'to' instead",
                "severity": "low"
            },
            {
                "pattern": r"\bdue to the fact that\b",
                "type": "style",
                "message": "Wordy phrase",
                "suggestion": "Consider using 'because' instead",
                "severity": "low"
            }
        ]
        
    def detect_all_errors(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect all types of errors in the text
        
        Args:
            text: Essay text to analyze
            
        Returns:
            List of detected errors
        """
        logger.info(f"Analyzing text of length {len(text)} characters")
        
        all_errors = []
        
        # Detect different types of errors
        all_errors.extend(self.detect_spelling_errors(text))
        all_errors.extend(self.detect_grammar_errors(text))
        all_errors.extend(self.detect_punctuation_errors(text))
        all_errors.extend(self.detect_word_choice_errors(text))
        all_errors.extend(self.detect_style_issues(text))
        all_errors.extend(self.detect_coherence_issues(text))
        all_errors.extend(self.detect_redundancy_issues(text))
        all_errors.extend(self.detect_clarity_issues(text))
        
        # Sort errors by position
        all_errors.sort(key=lambda x: x.get("start_pos", 0))
        
        # Remove duplicates and overlapping errors
        filtered_errors = self.filter_overlapping_errors(all_errors)
        
        logger.info(f"Detected {len(filtered_errors)} errors")
        return filtered_errors
    
    def detect_spelling_errors(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect spelling errors
        
        Args:
            text: Text to analyze
            
        Returns:
            List of spelling errors
        """
        errors = []
        
        # Check against known misspellings
        for wrong, correct in self.spelling_corrections.items():
            pattern = r'\b' + re.escape(wrong) + r'\b'
            for match in re.finditer(pattern, text, re.IGNORECASE):
                errors.append({
                    "type": "spelling",
                    "error_type": self.error_types["spelling"],
                    "text": match.group(0),
                    "start_pos": match.start(),
                    "end_pos": match.end(),
                    "suggestion": correct,
                    "explanation": f"'{match.group(0)}' should be '{correct}'",
                    "severity": "medium",
                    "confidence": 0.9
                })
        
        return errors
    
    def detect_grammar_errors(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect grammar errors using patterns
        
        Args:
            text: Text to analyze
            
        Returns:
            List of grammar errors
        """
        errors = []
        
        for pattern_info in self.grammar_patterns:
            pattern = pattern_info["pattern"]
            for match in re.finditer(pattern, text, re.IGNORECASE):
                suggestion = self.generate_grammar_suggestion(match.group(0), pattern_info)
                
                errors.append({
                    "type": "grammar",
                    "error_type": self.error_types["grammar"],
                    "text": match.group(0),
                    "start_pos": match.start(),
                    "end_pos": match.end(),
                    "suggestion": suggestion,
                    "explanation": pattern_info["message"] + ". " + pattern_info["suggestion"],
                    "severity": pattern_info["severity"],
                    "confidence": 0.8
                })
        
        return errors
    
    def detect_punctuation_errors(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect punctuation errors
        
        Args:
            text: Text to analyze
            
        Returns:
            List of punctuation errors
        """
        errors = []
        
        for pattern_info in self.punctuation_patterns:
            pattern = pattern_info["pattern"]
            for match in re.finditer(pattern, text):
                suggestion = self.generate_punctuation_suggestion(match.group(0), pattern_info)
                
                errors.append({
                    "type": "punctuation",
                    "error_type": self.error_types["punctuation"],
                    "text": match.group(0),
                    "start_pos": match.start(),
                    "end_pos": match.end(),
                    "suggestion": suggestion,
                    "explanation": pattern_info["message"] + ". " + pattern_info["suggestion"],
                    "severity": pattern_info["severity"],
                    "confidence": 0.8
                })
        
        return errors
    
    def detect_word_choice_errors(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect word choice errors
        
        Args:
            text: Text to analyze
            
        Returns:
            List of word choice errors
        """
        errors = []
        
        words = re.findall(r'\b\w+\b', text.lower())
        word_positions = {}
        
        # Map word positions
        for match in re.finditer(r'\b\w+\b', text):
            word = match.group(0).lower()
            if word not in word_positions:
                word_positions[word] = []
            word_positions[word].append((match.start(), match.end(), match.group(0)))
        
        # Check for word choice errors
        for word, alternatives in self.word_choice_errors.items():
            if word in word_positions:
                for start_pos, end_pos, original_text in word_positions[word]:
                    # Context-based suggestion (simplified)
                    suggestion = self.get_context_based_suggestion(text, word, alternatives, start_pos)
                    
                    errors.append({
                        "type": "word_choice",
                        "error_type": self.error_types["word_choice"],
                        "text": original_text,
                        "start_pos": start_pos,
                        "end_pos": end_pos,
                        "suggestion": suggestion,
                        "explanation": f"'{original_text}' might be confused with similar words. Check context.",
                        "severity": "medium",
                        "confidence": 0.6
                    })
        
        return errors
    
    def detect_style_issues(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect style issues
        
        Args:
            text: Text to analyze
            
        Returns:
            List of style issues
        """
        errors = []
        
        # Pattern-based style issues
        for pattern_info in self.style_patterns:
            pattern = pattern_info["pattern"]
            for match in re.finditer(pattern, text, re.IGNORECASE):
                suggestion = self.generate_style_suggestion(match.group(0), pattern_info)
                
                errors.append({
                    "type": "style",
                    "error_type": self.error_types["style"],
                    "text": match.group(0),
                    "start_pos": match.start(),
                    "end_pos": match.end(),
                    "suggestion": suggestion,
                    "explanation": pattern_info["message"] + ". " + pattern_info["suggestion"],
                    "severity": pattern_info["severity"],
                    "confidence": 0.7
                })
        
        # Word repetition analysis
        repetition_errors = self.detect_word_repetition(text)
        errors.extend(repetition_errors)
        
        # Passive voice detection
        passive_errors = self.detect_passive_voice(text)
        errors.extend(passive_errors)
        
        return errors
    
    def detect_coherence_issues(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect coherence and flow issues
        
        Args:
            text: Text to analyze
            
        Returns:
            List of coherence issues
        """
        errors = []
        
        paragraphs = text.split('\n\n')
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        
        if len(paragraphs) <= 1:
            return errors
        
        # Check for transition words between paragraphs
        transition_words = [
            'however', 'therefore', 'furthermore', 'moreover', 'consequently',
            'in addition', 'similarly', 'likewise', 'in contrast', 'on the other hand',
            'first', 'second', 'third', 'finally', 'in conclusion', 'to summarize'
        ]
        
        for i in range(1, len(paragraphs)):
            paragraph = paragraphs[i]
            first_sentence = paragraph.split('.')[0].lower()
            
            has_transition = any(word in first_sentence for word in transition_words)
            
            if not has_transition and len(paragraph) > 50:
                # Find position in original text
                start_pos = text.find(paragraph)
                if start_pos != -1:
                    errors.append({
                        "type": "coherence",
                        "error_type": self.error_types["coherence"],
                        "text": first_sentence[:50] + "...",
                        "start_pos": start_pos,
                        "end_pos": start_pos + len(first_sentence),
                        "suggestion": "Add transition words",
                        "explanation": "Consider adding transition words to improve paragraph flow.",
                        "severity": "low",
                        "confidence": 0.6
                    })
        
        return errors
    
    def detect_redundancy_issues(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect redundancy and unnecessary repetition
        
        Args:
            text: Text to analyze
            
        Returns:
            List of redundancy issues
        """
        errors = []
        
        # Detect redundant phrases
        redundant_phrases = [
            r'\bfree gift\b',
            r'\bfuture plans\b', 
            r'\bpast history\b',
            r'\badvance planning\b',
            r'\bclose proximity\b',
            r'\bfinal outcome\b',
            r'\bunexpected surprise\b',
            r'\btrue fact\b'
        ]
        
        for phrase_pattern in redundant_phrases:
            for match in re.finditer(phrase_pattern, text, re.IGNORECASE):
                errors.append({
                    "type": "redundancy",
                    "error_type": self.error_types["redundancy"],
                    "text": match.group(0),
                    "start_pos": match.start(),
                    "end_pos": match.end(),
                    "suggestion": self.get_redundancy_suggestion(match.group(0)),
                    "explanation": "This phrase contains redundant words.",
                    "severity": "low",
                    "confidence": 0.8
                })
        
        return errors
    
    def detect_clarity_issues(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect clarity and readability issues
        
        Args:
            text: Text to analyze
            
        Returns:
            List of clarity issues
        """
        errors = []
        
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        for sentence in sentences:
            words = sentence.split()
            
            # Very long sentences
            if len(words) > 40:
                start_pos = text.find(sentence)
                if start_pos != -1:
                    errors.append({
                        "type": "clarity",
                        "error_type": self.error_types["clarity"],
                        "text": sentence[:50] + "...",
                        "start_pos": start_pos,
                        "end_pos": start_pos + len(sentence),
                        "suggestion": "Break into shorter sentences",
                        "explanation": "This sentence is very long and may be hard to follow.",
                        "severity": "medium",
                        "confidence": 0.7
                    })
        
        return errors
    
    def detect_word_repetition(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect excessive word repetition
        
        Args:
            text: Text to analyze
            
        Returns:
            List of repetition errors
        """
        errors = []
        
        # Count word frequencies
        words = re.findall(r'\b\w+\b', text.lower())
        word_counts = Counter(words)
        
        # Filter out common words
        common_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
            'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
            'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
        }
        
        for word, count in word_counts.items():
            if len(word) > 4 and word not in common_words and count > 5:
                # Find first occurrence for error reporting
                match = re.search(r'\b' + re.escape(word) + r'\b', text, re.IGNORECASE)
                if match:
                    errors.append({
                        "type": "style",
                        "error_type": self.error_types["style"],
                        "text": word,
                        "start_pos": match.start(),
                        "end_pos": match.end(),
                        "suggestion": "Use synonyms for variety",
                        "explanation": f"The word '{word}' appears {count} times. Consider using synonyms.",
                        "severity": "low",
                        "confidence": 0.6
                    })
        
        return errors
    
    def detect_passive_voice(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect passive voice constructions
        
        Args:
            text: Text to analyze
            
        Returns:
            List of passive voice issues
        """
        errors = []
        
        # Simple passive voice detection
        passive_pattern = r'\b(is|are|was|were|be|been|being)\s+\w*ed\b'
        
        for match in re.finditer(passive_pattern, text, re.IGNORECASE):
            # Skip if followed by "by" (which is often intentional passive)
            following_text = text[match.end():match.end()+10]
            if not re.match(r'\s+by\b', following_text, re.IGNORECASE):
                errors.append({
                    "type": "style",
                    "error_type": self.error_types["style"],
                    "text": match.group(0),
                    "start_pos": match.start(),
                    "end_pos": match.end(),
                    "suggestion": "Consider active voice",
                    "explanation": "Consider rewriting in active voice for more direct expression.",
                    "severity": "low",
                    "confidence": 0.5
                })
        
        return errors
    
    def generate_grammar_suggestion(self, text: str, pattern_info: Dict) -> str:
        """
        Generate grammar correction suggestion
        
        Args:
            text: Matched text
            pattern_info: Pattern information
            
        Returns:
            Suggested correction
        """
        text_lower = text.lower()
        
        # Handle specific patterns
        if "could of" in text_lower:
            return text.replace("of", "have").replace("Of", "Have")
        elif "should of" in text_lower:
            return text.replace("of", "have").replace("Of", "Have")
        elif "would of" in text_lower:
            return text.replace("of", "have").replace("Of", "Have")
        elif re.search(r'\b(he|she|it)\s+(are|were)\b', text_lower):
            return re.sub(r'\bare\b', 'is', text, flags=re.IGNORECASE)
        elif re.search(r'\b(they|we|you)\s+(is|was)\b', text_lower):
            return re.sub(r'\bis\b', 'are', text, flags=re.IGNORECASE)
        
        return text + " [needs correction]"
    
    def generate_punctuation_suggestion(self, text: str, pattern_info: Dict) -> str:
        """
        Generate punctuation correction suggestion
        
        Args:
            text: Matched text
            pattern_info: Pattern information
            
        Returns:
            Suggested correction
        """
        if re.match(r'[.!?]{2,}', text):
            return text[0]  # Keep only first punctuation mark
        elif re.match(r'[.!?,;:][a-zA-Z]', text):
            return text[0] + " " + text[1]  # Add space
        elif re.match(r'\s+[,;:]', text):
            return text.strip()  # Remove space before punctuation
        
        return text
    
    def generate_style_suggestion(self, text: str, pattern_info: Dict) -> str:
        """
        Generate style improvement suggestion
        
        Args:
            text: Matched text
            pattern_info: Pattern information
            
        Returns:
            Suggested improvement
        """
        text_lower = text.lower()
        
        if "very very" in text_lower:
            return "extremely"
        elif "in order to" in text_lower:
            return text.replace("in order to", "to").replace("In order to", "To")
        elif "due to the fact that" in text_lower:
            return text.replace("due to the fact that", "because").replace("Due to the fact that", "Because")
        
        return text + " [consider revision]"
    
    def get_context_based_suggestion(self, text: str, word: str, alternatives: List[str], position: int) -> str:
        """
        Get context-based word choice suggestion
        
        Args:
            text: Full text
            word: Word to check
            alternatives: Alternative words
            position: Position of word in text
            
        Returns:
            Best suggestion based on context
        """
        # Simple context analysis
        context_window = 50
        start = max(0, position - context_window)
        end = min(len(text), position + len(word) + context_window)
        context = text[start:end].lower()
        
        # Basic heuristics for common confusions
        if word == "affect" and ("noun" in context or "result" in context):
            return "effect"
        elif word == "effect" and ("verb" in context or "influence" in context):
            return "affect"
        elif word == "than" and ("time" in context or "when" in context):
            return "then"
        elif word == "then" and ("comparison" in context or "more" in context):
            return "than"
        
        # Return first alternative if no specific context clues
        return alternatives[0] if alternatives else word
    
    def get_redundancy_suggestion(self, phrase: str) -> str:
        """
        Get suggestion for redundant phrase
        
        Args:
            phrase: Redundant phrase
            
        Returns:
            Suggested replacement
        """
        redundancy_fixes = {
            "free gift": "gift",
            "future plans": "plans",
            "past history": "history", 
            "advance planning": "planning",
            "close proximity": "proximity",
            "final outcome": "outcome",
            "unexpected surprise": "surprise",
            "true fact": "fact"
        }
        
        return redundancy_fixes.get(phrase.lower(), phrase)
    
    def filter_overlapping_errors(self, errors: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Filter out overlapping errors, keeping the most confident ones
        
        Args:
            errors: List of detected errors
            
        Returns:
            Filtered list of errors
        """
        if not errors:
            return errors
        
        # Sort by position and confidence
        sorted_errors = sorted(errors, key=lambda x: (x.get("start_pos", 0), -x.get("confidence", 0)))
        
        filtered = []
        last_end = -1
        
        for error in sorted_errors:
            start_pos = error.get("start_pos", 0)
            end_pos = error.get("end_pos", start_pos + 1)
            
            # If this error doesn't overlap with the last one, include it
            if start_pos >= last_end:
                filtered.append(error)
                last_end = end_pos
            # If it overlaps but has higher confidence, replace the last one
            elif error.get("confidence", 0) > filtered[-1].get("confidence", 0):
                filtered[-1] = error
                last_end = end_pos
        
        return filtered

# Singleton instance
error_detector = None

def get_error_detector():
    """
    Get or create the error detector instance
    
    Returns:
        AdvancedErrorDetector instance
    """
    global error_detector
    if error_detector is None:
        error_detector = AdvancedErrorDetector()
    return error_detector

def detect_errors(text: str) -> List[Dict[str, Any]]:
    """
    Detect errors in the given text
    
    Args:
        text: The essay text to analyze
        
    Returns:
        List of detected errors with suggestions
    """
    detector = get_error_detector()
    return detector.detect_all_errors(text)

if __name__ == "__main__":
    # Test the error detector
    test_text = """
    The author of "The Challenge of Exploring Venus" presents a compelling argument for why studying Venus is worthwhile despite the challenges. The article effectively uses scientific evidence, historical context, and future possibilities to support this claim.
    
    First, the author provides strong scientific evidence about Venus's unique properties. The extreme temperatures and pressure are described in detail, showing why exploration is difficult. However the author balances this by explaining how these same challenges make Venus scientifically valuable.
    
    In conclusion, the author effectively supports the idea that Venus exploration is worthwhile through a balanced presentation of challenges and benefits
    """
    
    errors = detect_errors(test_text)
    print(json.dumps(errors, indent=2))
