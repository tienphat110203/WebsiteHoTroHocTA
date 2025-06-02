-- Listening Practice System Schema

-- Listening Content Table
CREATE TABLE listening_content (
    content_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    audio_url VARCHAR(255) NOT NULL,
    transcript TEXT,
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    category VARCHAR(50) CHECK (category IN ('conversation', 'lecture', 'interview', 'news', 'story', 'podcast', 'speech', 'other')),
    accent_type VARCHAR(50),
    duration_seconds INTEGER,
    speaker_count INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL
);

-- Listening Subtitles Table
CREATE TABLE listening_subtitles (
    subtitle_id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES listening_content(content_id) ON DELETE CASCADE,
    start_time DECIMAL(10, 3) NOT NULL,
    end_time DECIMAL(10, 3) NOT NULL,
    text TEXT NOT NULL,
    speaker_label VARCHAR(50),
    confidence_score DECIMAL(5, 4),
    is_auto_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listening Questions Table
CREATE TABLE listening_questions (
    question_id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES listening_content(content_id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) CHECK (question_type IN ('multiple_choice', 'true_false', 'fill_blank', 'short_answer')),
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    time_reference DECIMAL(10, 3),
    explanation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listening Question Options Table
CREATE TABLE listening_question_options (
    option_id SERIAL PRIMARY KEY,
    question_id INTEGER REFERENCES listening_questions(question_id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    position INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listening Sessions Table
CREATE TABLE listening_sessions (
    session_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    content_id INTEGER REFERENCES listening_content(content_id) ON DELETE CASCADE,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    playback_speed DECIMAL(3, 2) DEFAULT 1.0,
    subtitle_enabled BOOLEAN DEFAULT FALSE,
    duration_listened_seconds INTEGER DEFAULT 0,
    completion_percentage DECIMAL(5, 2) DEFAULT 0,
    device_info VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listening User Answers Table
CREATE TABLE listening_user_answers (
    answer_id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES listening_sessions(session_id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES listening_questions(question_id) ON DELETE CASCADE,
    user_answer TEXT,
    is_correct BOOLEAN,
    time_taken_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listening STT Analysis Table
CREATE TABLE listening_stt_analysis (
    analysis_id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES listening_content(content_id) ON DELETE CASCADE,
    model_used VARCHAR(100),
    language_code VARCHAR(10) DEFAULT 'en',
    word_count INTEGER,
    confidence_score DECIMAL(5, 4),
    processing_time_ms INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listening Accent Recognition Table
CREATE TABLE listening_accent_recognition (
    recognition_id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES listening_content(content_id) ON DELETE CASCADE,
    detected_accent VARCHAR(50),
    confidence_score DECIMAL(5, 4),
    accent_features JSONB,
    model_used VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listening Audio Processing Table
CREATE TABLE listening_audio_processing (
    processing_id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES listening_content(content_id) ON DELETE CASCADE,
    original_audio_url VARCHAR(255),
    processed_audio_url VARCHAR(255),
    processing_type VARCHAR(50) CHECK (processing_type IN ('noise_reduction', 'speed_adjustment', 'clarity_enhancement', 'volume_normalization', 'combined')),
    processing_parameters JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listening User Progress Table
CREATE TABLE listening_user_progress (
    progress_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    sessions_completed INTEGER DEFAULT 0,
    total_listening_time_seconds INTEGER DEFAULT 0,
    average_comprehension_score DECIMAL(5, 2) DEFAULT 0,
    best_comprehension_score DECIMAL(5, 2) DEFAULT 0,
    strengths JSONB,
    weaknesses JSONB,
    last_session_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listening Content Feedback Table
CREATE TABLE listening_content_feedback (
    feedback_id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES listening_content(content_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback_text TEXT,
    difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listening ML Models Table
CREATE TABLE listening_ml_models (
    model_id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    model_type VARCHAR(50) CHECK (model_type IN ('stt', 'accent_recognition', 'comprehension_analysis', 'audio_enhancement')),
    model_version VARCHAR(20),
    accuracy_score DECIMAL(5, 4),
    training_date TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    model_parameters JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_listening_content_difficulty ON listening_content(difficulty_level);
CREATE INDEX idx_listening_content_category ON listening_content(category);
CREATE INDEX idx_listening_content_accent ON listening_content(accent_type);
CREATE INDEX idx_listening_subtitles_content ON listening_subtitles(content_id);
CREATE INDEX idx_listening_questions_content ON listening_questions(content_id);
CREATE INDEX idx_listening_sessions_user ON listening_sessions(user_id);
CREATE INDEX idx_listening_sessions_content ON listening_sessions(content_id);
CREATE INDEX idx_listening_user_answers_session ON listening_user_answers(session_id);
CREATE INDEX idx_listening_user_progress_user ON listening_user_progress(user_id);

-- Sample data for testing
INSERT INTO listening_content (title, description, audio_url, transcript, difficulty_level, category, accent_type, duration_seconds)
VALUES 
('Restaurant Conversation', 'A conversation between a waiter and customer at a restaurant', 
 '/audio/restaurant-conversation.mp3', 
 'Waiter: Hello, welcome to our restaurant. Do you have a reservation?
Customer: Yes, I have a reservation for two people at 7:30 under the name Smith.
Waiter: Let me check... Yes, I see your reservation. Please follow me to your table.
Customer: Thank you. Could we have a table by the window?
Waiter: Of course. Here''s your table, and here are the menus. Today''s special is grilled salmon with vegetables.
Customer: That sounds good. Could we see the wine list as well?
Waiter: I''ll be back in a moment with the wine list and some water.',
 'beginner', 'conversation', 'american', 120),

('Job Interview', 'A job interview for a marketing position', 
 '/audio/job-interview.mp3', 
 'Interviewer: Good morning, thanks for coming in today. Could you start by telling me a little about yourself?
Candidate: Good morning. Thank you for this opportunity. I''m a marketing professional with five years of experience in digital marketing. I''ve worked with various companies to develop and implement successful marketing strategies.
Interviewer: That''s great. What would you say is your greatest strength?
Candidate: I believe my greatest strength is my analytical ability. I enjoy analyzing data to understand customer behavior and preferences, which helps in creating targeted marketing campaigns.
Interviewer: And what about weaknesses? We all have them.
Candidate: I sometimes get too focused on details. While this ensures quality work, I''ve learned to balance this by setting clear timelines and priorities.
Interviewer: How do you handle pressure or stressful situations?
Candidate: I try to stay calm and organized. I break down complex problems into manageable tasks and focus on solutions rather than the pressure.',
 'intermediate', 'interview', 'british', 180),

('TED Talk: The Power of Introverts', 'An excerpt from a TED talk about introversion', 
 '/audio/ted-talk-introverts.mp3', 
 'When I was nine years old, I went off to summer camp for the first time. And my mother packed me a suitcase full of books, which to me seemed like a perfectly natural thing to do. Because in my family, reading was the primary group activity. And this might sound antisocial to you, but for us it was really just a different way of being social. You have the animal warmth of your family sitting right next to you, but you are also free to go roaming around the adventureland inside your own mind. And I had this idea that camp was going to be just like this, but better. I had a vision of 10 girls sitting in a cabin, reading books in their matching nightgowns.
Camp was more like a keg party without any alcohol. And on the very first day, our counselor gathered us all together and she taught us a cheer that she said we would be doing every day for the rest of the summer to instill camp spirit. And it went like this: ''R-O-W-D-I-E, that''s the way we spell rowdie. Rowdie, rowdie, let''s get rowdie.'' Yeah. So I couldn''t figure out for the life of me why we were supposed to be so rowdy, or why we had to spell this word incorrectly.',
 'advanced', 'speech', 'american', 240);

-- Insert sample questions
INSERT INTO listening_questions (content_id, question_text, question_type, difficulty_level)
VALUES 
(1, 'How many people is the reservation for?', 'multiple_choice', 'easy'),
(1, 'What time is the reservation?', 'multiple_choice', 'easy'),
(1, 'Where does the customer want to sit?', 'multiple_choice', 'medium'),
(1, 'What is the special of the day?', 'multiple_choice', 'medium'),
(1, 'What does the customer ask to see?', 'multiple_choice', 'easy');

-- Insert sample question options
INSERT INTO listening_question_options (question_id, option_text, is_correct, position)
VALUES 
(1, 'One person', FALSE, 1),
(1, 'Two people', TRUE, 2),
(1, 'Three people', FALSE, 3),
(1, 'Four people', FALSE, 4),
(2, '7:00', FALSE, 1),
(2, '7:15', FALSE, 2),
(2, '7:30', TRUE, 3),
(2, '8:00', FALSE, 4),
(3, 'By the door', FALSE, 1),
(3, 'By the window', TRUE, 2),
(3, 'In the corner', FALSE, 3),
(3, 'Near the kitchen', FALSE, 4),
(4, 'Grilled chicken with rice', FALSE, 1),
(4, 'Grilled salmon with vegetables', TRUE, 2),
(4, 'Pasta with seafood', FALSE, 3),
(4, 'Steak with potatoes', FALSE, 4),
(5, 'The dessert menu', FALSE, 1),
(5, 'The wine list', TRUE, 2),
(5, 'The chef', FALSE, 3),
(5, 'The bill', FALSE, 4);
