-- Writing Practice System Tables

-- Bảng gợi ý viết
CREATE TABLE writing_prompts (
    prompt_id SERIAL PRIMARY KEY,
    prompt_name VARCHAR(200) NOT NULL,
    assignment TEXT NOT NULL,
    source_text_1 TEXT,
    source_text_2 TEXT,
    source_text_3 TEXT,
    source_text_4 TEXT,
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'intermediate',
    category VARCHAR(50) DEFAULT 'general',
    time_limit_minutes INTEGER DEFAULT 45,
    min_word_count INTEGER DEFAULT 50,
    max_word_count INTEGER DEFAULT 500,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL
);

-- Viết bảng nộp bài
CREATE TABLE writing_submissions (
    submission_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    prompt_id INTEGER REFERENCES writing_prompts(prompt_id) ON DELETE CASCADE,
    essay_text TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    time_spent_seconds INTEGER,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_analyzed BOOLEAN DEFAULT FALSE,
    analysis_version VARCHAR(10) DEFAULT '1.0'
);

-- Writing analysis results table
CREATE TABLE writing_analysis (
    analysis_id SERIAL PRIMARY KEY,
    submission_id INTEGER REFERENCES writing_submissions(submission_id) ON DELETE CASCADE,
    overall_score DECIMAL(3,1) NOT NULL,
    content_score DECIMAL(3,1) NOT NULL,
    organization_score DECIMAL(3,1) NOT NULL,
    language_score DECIMAL(3,1) NOT NULL,
    conventions_score DECIMAL(3,1) NOT NULL,
    feedback JSONB,
    improvements JSONB,
    structure_analysis JSONB,
    statistics JSONB,
    error_count INTEGER DEFAULT 0,
    analysis_method VARCHAR(20) CHECK (analysis_method IN ('ml', 'rule_based', 'hybrid')) DEFAULT 'rule_based',
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Writing errors table
CREATE TABLE writing_errors (
    error_id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES writing_analysis(analysis_id) ON DELETE CASCADE,
    error_type VARCHAR(20) CHECK (error_type IN ('spelling', 'grammar', 'punctuation', 'word_choice', 'style', 'coherence')),
    error_text VARCHAR(500) NOT NULL,
    start_position INTEGER NOT NULL,
    end_position INTEGER NOT NULL,
    suggestion VARCHAR(500),
    explanation TEXT,
    severity VARCHAR(10) CHECK (severity IN ('low', 'medium', 'high')) DEFAULT 'medium',
    confidence DECIMAL(3,2) DEFAULT 0.80
);

-- Writing progress tracking table
CREATE TABLE writing_progress (
    progress_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    level VARCHAR(20) CHECK (level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'intermediate',
    essays_completed INTEGER DEFAULT 0,
    total_words_written INTEGER DEFAULT 0,
    total_time_spent_seconds INTEGER DEFAULT 0,
    average_score DECIMAL(3,1) DEFAULT 0.0,
    best_score DECIMAL(3,1) DEFAULT 0.0,
    improvement_trend VARCHAR(10) CHECK (improvement_trend IN ('improving', 'stable', 'declining')) DEFAULT 'stable',
    strengths JSONB,
    weaknesses JSONB,
    last_essay_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, level)
);

-- Writing tips table
CREATE TABLE writing_tips (
    tip_id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    level VARCHAR(20) CHECK (level IN ('beginner', 'intermediate', 'advanced', 'all')) DEFAULT 'all',
    tip_text TEXT NOT NULL,
    example TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample essays table
CREATE TABLE sample_essays (
    sample_id SERIAL PRIMARY KEY,
    prompt_id INTEGER REFERENCES writing_prompts(prompt_id) ON DELETE CASCADE,
    essay_text TEXT NOT NULL,
    score DECIMAL(3,1) NOT NULL,
    score_breakdown JSONB,
    level VARCHAR(20) CHECK (level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'intermediate',
    feedback TEXT,
    word_count INTEGER NOT NULL,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_writing_prompts_level ON writing_prompts(difficulty_level);
CREATE INDEX idx_writing_prompts_active ON writing_prompts(is_active);
CREATE INDEX idx_writing_submissions_user ON writing_submissions(user_id);
CREATE INDEX idx_writing_submissions_prompt ON writing_submissions(prompt_id);
CREATE INDEX idx_writing_submissions_date ON writing_submissions(submitted_at);
CREATE INDEX idx_writing_analysis_submission ON writing_analysis(submission_id);
CREATE INDEX idx_writing_errors_analysis ON writing_errors(analysis_id);
CREATE INDEX idx_writing_errors_type ON writing_errors(error_type);
CREATE INDEX idx_writing_progress_user ON writing_progress(user_id);
CREATE INDEX idx_sample_essays_prompt ON sample_essays(prompt_id);
CREATE INDEX idx_sample_essays_level ON sample_essays(level);

-- Insert sample writing prompts
INSERT INTO writing_prompts (prompt_name, assignment, source_text_1, difficulty_level, category, min_word_count, max_word_count) VALUES
('Exploring Venus', 
'In "The Challenge of Exploring Venus," the author suggests studying Venus is a worthy pursuit despite the dangers it presents. Using details from the article, write an essay evaluating how well the author supports this idea.',
'The Challenge of Exploring Venus

Venus, sometimes called the "Evening Star," is one of the brightest points of light in the night sky, making it simple for even an amateur stargazer to spot. The planet has a thick atmosphere of almost 97 percent carbon dioxide blankets Venus. Even more challenging are the clouds of highly corrosive sulfuric acid in Venus''s atmosphere. On the planet''s surface, temperatures average over 800 degrees Fahrenheit, and the atmospheric pressure is 90 times greater than what we experience on our own planet. These conditions are far more extreme than anything humans encounter on Earth; such an environment would crush a submarine accustomed to diving to the deepest parts of our oceans and would liquefy many metals. Notable, Venus has the hottest surface temperature of any planet in our solar system, even though Mercury is closer to our sun.

Beyond high pressure and heat, Venusian geology and weather present additional impediments to not only human exploration but also to simple robotic missions. Erupting volcanoes, powerful earthquakes, and frequent lightning strikes to probes seeking to land on its surface contribute to the inhospitable conditions. However, peering at Venus from a ship orbiting or hovering safely above the fray is not the equivalent of a detailed study of the planet.

Astronomers are fascinated by Venus because it may well once have been the most Earth-like planet in our solar system. Long ago, Venus was probably covered largely with oceans and could have supported various forms of life, just as Earth does today. Today, Venus still has some features that are analogous to those on Earth. The planet has a surface of rocky sediment and includes familiar features such as valleys, mountains, and craters. Furthermore, recall that Venus can sometimes be seen from Earth, so Venus has value as a research subject, and a nearby laboratory for scientists who seek to understand those types of environments.

The author concludes that our travels on Earth and beyond should not be limited by dangers and doubts but should be expanded to meet the very edges of imagination and innovation. Venus would allow scientists to gain insight into a planet that shares the most characteristics with Earth within our solar system and would contribute to our knowledge about our own planet as well.',
'intermediate', 'analysis', 150, 400),

('Technology in Education',
'In "The Challenge of Exploring Venus," the author suggests studying Venus is a worthy pursuit despite the dangers it presents. Using details from the article, write an essay evaluating how well the author supports this idea.',
'Making Mona Lisa Smile

The use of technology to read the emotional expressions of students in a classroom is valuable. Students in a classroom are often bored, confused, or frustrated, and these emotions can negatively impact their learning. By using technology that can detect and analyze facial expressions, teachers can better understand how their students are feeling and adjust their teaching methods accordingly.

The Facial Action Coding System enables computers to identify human emotions by analyzing facial expressions. Dr. Huang and his colleague are experts at developing better ways for humans and computers to communicate. In fact, we humans perform this same impressive "calculation" every day. For instance, you can probably tell how a friend is feeling simply by the look on her or his face. Of course, most of us would have trouble actually describing each facial trait that conveys happy, worried, etc. Yet Dr. Huang observes that artists such as da Vinci studied human anatomy to help them paint facial expressions more accurately. "The same technology can make computer-animated faces more expressive—for videogames or video surgery," Dr. Huang predicts. "A classroom computer could recognize when a student is becoming confused or bored," Dr. Huang predicts. "Then it could modify the lesson, like an effective human instructor."

The use of this technology in classrooms could revolutionize education by providing real-time feedback about student engagement and understanding. When a computer can detect that a student is confused, it can immediately provide additional explanations or examples. When it detects boredom, it can introduce more engaging content or activities. This personalized approach to learning could help ensure that no student falls behind and that each student receives the support they need to succeed.',
'intermediate', 'argument', 150, 400),

('Driverless Cars Debate',
'Driverless cars are coming. Write an essay arguing whether the development of these cars is a positive or negative advancement for society. Use evidence from multiple perspectives to support your position.',
'Driverless Cars are Coming

The road to the truly autonomous vehicle has been long and winding, but recent advances in technology suggest that fully self-driving cars may soon become a reality. Major technology companies and automotive manufacturers are investing billions of dollars in developing autonomous vehicle technology, and several companies have already begun testing self-driving cars on public roads.

Proponents of autonomous vehicles argue that they will make roads safer by eliminating human error, which is responsible for approximately 94% of serious traffic crashes. Self-driving cars don''t get tired, distracted, or intoxicated, and they can react faster than human drivers to dangerous situations. Additionally, autonomous vehicles could provide mobility to people who are unable to drive traditional cars, such as the elderly or visually impaired.

However, critics raise concerns about the technology''s reliability and the potential consequences of system failures. They point to several high-profile accidents involving semi-autonomous vehicles as evidence that the technology is not yet ready for widespread deployment. There are also concerns about job displacement, as millions of people work as professional drivers, and about privacy and security issues related to the data collected by these vehicles.

The debate over autonomous vehicles reflects broader questions about the role of technology in society and how we balance innovation with safety and social responsibility.',
'advanced', 'argument', 200, 500),

('Social Media Impact',
'Write an essay examining the impact of social media on teenage relationships and communication. Consider both positive and negative effects in your analysis.',
'The Social Media Generation

Today''s teenagers have grown up in an era of unprecedented connectivity. Social media platforms like Instagram, TikTok, Snapchat, and Twitter have fundamentally changed how young people communicate, form relationships, and view themselves and others.

On one hand, social media has created new opportunities for connection and self-expression. Teenagers can maintain friendships across long distances, find communities of people who share their interests, and access information and support on topics that matter to them. Social media has also given young people powerful tools for creativity and activism, allowing them to share their art, organize events, and advocate for causes they believe in.

However, research has also identified concerning trends associated with heavy social media use among teenagers. Studies have linked excessive social media use to increased rates of anxiety, depression, and sleep problems among young people. The constant comparison with others'' curated online personas can lead to feelings of inadequacy and low self-esteem. Cyberbullying has emerged as a serious problem, with some teenagers experiencing harassment that follows them home through their devices.

The challenge for parents, educators, and teenagers themselves is learning how to harness the benefits of social media while minimizing its potential harms.',
'intermediate', 'analysis', 150, 400);

-- Insert writing tips
INSERT INTO writing_tips (category, level, tip_text, example) VALUES
('general', 'all', 'Start with a clear thesis statement that directly addresses the prompt.', 'In "The Challenge of Exploring Venus," the author effectively supports the idea that studying Venus is worthwhile by presenting compelling scientific evidence and addressing potential counterarguments.'),
('general', 'all', 'Use specific examples from the text to support your arguments.', 'The author notes that "Venus has the hottest surface temperature of any planet in our solar system," which demonstrates the extreme conditions that make exploration challenging.'),
('organization', 'all', 'Use transition words to connect your ideas smoothly.', 'Furthermore, the author explains... However, critics might argue... In addition to this evidence...'),
('organization', 'beginner', 'Structure your essay with an introduction, body paragraphs, and conclusion.', 'Introduction: State your thesis\nBody: Present evidence and analysis\nConclusion: Summarize your argument'),
('content', 'intermediate', 'Address counterarguments to strengthen your position.', 'While some might argue that the dangers outweigh the benefits, the author effectively counters this by...'),
('content', 'advanced', 'Analyze the author''s rhetorical strategies and their effectiveness.', 'The author''s use of scientific data and expert testimony creates credibility, while vivid descriptions of Venus''s harsh conditions appeal to readers'' emotions.'),
('language', 'all', 'Vary your sentence structures to create more engaging writing.', 'Instead of: "Venus is hot. Venus is dangerous. Venus is hard to explore." Try: "Venus, with its extreme heat and dangerous conditions, presents significant challenges for exploration."'),
('language', 'intermediate', 'Use precise vocabulary to express your ideas clearly.', 'Instead of "good evidence," use "compelling evidence," "convincing data," or "substantial proof."'),
('conventions', 'all', 'Proofread your essay for grammar, spelling, and punctuation errors.', 'Check for common errors like subject-verb agreement, comma splices, and apostrophe usage.');

-- Insert sample essays
INSERT INTO sample_essays (prompt_id, essay_text, score, level, feedback, word_count) VALUES
(1, 'In "The Challenge of Exploring Venus," the author presents a compelling argument that studying Venus is a worthy scientific pursuit despite the significant dangers involved. Through the use of scientific evidence, logical reasoning, and acknowledgment of counterarguments, the author effectively supports this position.

The author begins by establishing the extreme dangers of Venus exploration, noting that the planet has "temperatures average over 800 degrees Fahrenheit" and "atmospheric pressure is 90 times greater than what we experience on our own planet." These vivid details help readers understand the magnitude of the challenges involved. However, rather than using these facts to discourage exploration, the author uses them to emphasize the remarkable nature of the scientific endeavor.

The strongest support for the author''s argument comes from the scientific rationale for studying Venus. The author explains that "Venus was probably covered largely with oceans and could have supported various forms of life, just as Earth does today." This connection to Earth''s history provides a compelling reason why Venus research could benefit our understanding of our own planet. The author further strengthens this point by noting that Venus "shares the most characteristics with Earth within our solar system."

The author also acknowledges the limitations of current exploration methods, stating that "peering at Venus from a ship orbiting or hovering safely above the fray is not the equivalent of a detailed study of the planet." This honest assessment of current capabilities demonstrates the author''s credibility and shows awareness of the challenges while maintaining that they can be overcome.

In conclusion, the author effectively supports the argument for Venus exploration by balancing acknowledgment of the dangers with compelling scientific justifications. The logical progression from establishing challenges to presenting benefits creates a persuasive case for continued research efforts.', 8.5, 'intermediate', 'Strong analysis with good use of textual evidence. Well-organized with clear thesis and supporting arguments.', 267);
