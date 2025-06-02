-- CORE TABLES ONLY - Used in current implementation

-- Users & Authentication
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    profile_picture VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    role VARCHAR(20) CHECK (role IN ('student', 'instructor', 'admin')) DEFAULT 'student',
    bio TEXT
);

CREATE TABLE user_verification (
    verification_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('email', 'password_reset')),
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses & Content Management
CREATE TABLE courses (
    course_id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    instructor_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'all-levels')),
    price DECIMAL(10, 2) DEFAULT 0.00,
    duration_minutes INTEGER,
    thumbnail_url VARCHAR(255),
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    language_skill VARCHAR(50) CHECK (language_skill IN ('listening', 'speaking', 'reading', 'writing', 'vocabulary', 'grammar', 'pronunciation', 'all'))
);

CREATE TABLE modules (
    module_id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(course_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    position INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lessons (
    lesson_id SERIAL PRIMARY KEY,
    module_id INTEGER REFERENCES modules(module_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    content TEXT,
    video_url VARCHAR(255),
    duration_minutes INTEGER,
    position INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE resources (
    resource_id SERIAL PRIMARY KEY,
    lesson_id INTEGER REFERENCES lessons(lesson_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    file_url VARCHAR(255),
    file_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Learning & Progress
CREATE TABLE user_courses (
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(course_id) ON DELETE CASCADE,
    enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completion_date TIMESTAMP,
    progress_percentage DECIMAL(5, 2) DEFAULT 0.00,
    is_completed BOOLEAN DEFAULT FALSE,
    last_accessed_at TIMESTAMP,
    PRIMARY KEY (user_id, course_id)
);

CREATE TABLE user_lessons (
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    lesson_id INTEGER REFERENCES lessons(lesson_id) ON DELETE CASCADE,
    is_completed BOOLEAN DEFAULT FALSE,
    progress_percentage DECIMAL(5, 2) DEFAULT 0.00,
    last_accessed_at TIMESTAMP,
    notes TEXT,
    PRIMARY KEY (user_id, lesson_id)
);

-- Assignments & Assessments
CREATE TABLE assignments (
    assignment_id SERIAL PRIMARY KEY,
    lesson_id INTEGER REFERENCES lessons(lesson_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    instructions TEXT,
    due_date TIMESTAMP,
    points_possible INTEGER,
    assignment_type VARCHAR(50) CHECK (assignment_type IN ('quiz', 'essay', 'practice', 'project')),
    is_auto_graded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE questions (
    question_id SERIAL PRIMARY KEY,
    assignment_id INTEGER REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) CHECK (question_type IN ('multiple_choice', 'true_false', 'fill_blank', 'essay', 'matching')),
    points INTEGER DEFAULT 1,
    position INTEGER
);

CREATE TABLE answers (
    answer_id SERIAL PRIMARY KEY,
    question_id INTEGER REFERENCES questions(question_id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    is_correct BOOLEAN,
    explanation TEXT
);

CREATE TABLE user_submissions (
    submission_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    assignment_id INTEGER REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    score DECIMAL(5, 2),
    feedback TEXT,
    is_graded BOOLEAN DEFAULT FALSE,
    graded_at TIMESTAMP,
    submission_file_url VARCHAR(255),
    audio_url VARCHAR(255),
    submission_type VARCHAR(50) CHECK (submission_type IN ('text', 'file', 'audio', 'mixed'))
);

-- Payments & Transactions
CREATE TABLE transactions (
    transaction_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    course_id INTEGER REFERENCES courses(course_id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'VND',
    payment_method VARCHAR(50) CHECK (payment_method IN ('vnpay', 'momo', 'credit_card', 'bank_transfer')),
    transaction_status VARCHAR(50) CHECK (transaction_status IN ('pending', 'completed', 'failed', 'refunded')),
    transaction_reference VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refunds (
    refund_id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    refund_amount DECIMAL(10, 2) NOT NULL,
    refund_reason TEXT,
    refund_status VARCHAR(20) CHECK (refund_status IN ('pending', 'approved', 'rejected', 'processing')) DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    refunded_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    processed_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL
);

-- Ratings & Reviews
CREATE TABLE course_reviews (
    review_id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(course_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Administration
CREATE TABLE system_notifications (
    notification_id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    target_role VARCHAR(20) CHECK (target_role IN ('all', 'student', 'instructor', 'admin')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE TABLE user_notifications (
    user_notification_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    notification_id INTEGER REFERENCES system_notifications(notification_id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL
);

-- Certificate System
CREATE TABLE certificate_templates (
    template_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    html_content TEXT NOT NULL,
    css_content TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE certificate_fields (
    field_id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES certificate_templates(template_id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    default_value TEXT,
    is_required BOOLEAN DEFAULT false,
    position INTEGER,
    UNIQUE(template_id, field_name)
);

CREATE TABLE certificates (
    certificate_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES certificate_templates(template_id) ON DELETE CASCADE,
    verification_code VARCHAR(64) UNIQUE NOT NULL,
    issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiry_date TIMESTAMP,
    is_revoked BOOLEAN DEFAULT false,
    revocation_reason TEXT,
    metadata JSONB,
    UNIQUE(user_id, course_id)
);

-- AI Conversation System
CREATE TABLE ai_conversations (
    conversation_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    message_count INTEGER DEFAULT 0,
    satisfaction_rating VARCHAR(20) CHECK (satisfaction_rating IN ('positive', 'neutral', 'negative')),
    topic VARCHAR(100),
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_messages (
    message_id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES ai_conversations(conversation_id) ON DELETE CASCADE,
    sender VARCHAR(10) CHECK (sender IN ('user', 'ai', 'system')),
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_courses_instructor ON courses(instructor_id);
CREATE INDEX idx_lessons_module ON lessons(module_id);
CREATE INDEX idx_user_courses_user ON user_courses(user_id);
CREATE INDEX idx_user_courses_course ON user_courses(course_id);
CREATE INDEX idx_user_lessons_user ON user_lessons(user_id);
CREATE INDEX idx_user_lessons_lesson ON user_lessons(lesson_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_refunds_transaction ON refunds(transaction_id);
CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id);

-- Insert default certificate template
INSERT INTO certificate_templates (name, description, html_content, css_content, is_active)
VALUES (
    'Default Course Completion',
    'Default template for course completion certificates',
    '<div class="certificate">
        <div class="certificate-header">
            <h1 class="certificate-title">Certificate of Completion</h1>
        </div>
        <div class="certificate-body">
            <p class="certificate-statement">This is to certify that</p>
            <p class="certificate-name">{{student_name}}</p>
            <p class="certificate-statement">has successfully completed the course</p>
            <p class="certificate-course">{{course_name}}</p>
            <p class="certificate-date">on {{completion_date}}</p>
        </div>
        <div class="certificate-footer">
            <div class="certificate-signature">
                <p class="signature-name">{{instructor_name}}</p>
                <p class="signature-title">Instructor</p>
            </div>
            <div class="certificate-verification">
                <p class="verification-text">Verification Code: {{verification_code}}</p>
            </div>
        </div>
    </div>',
    '.certificate { width: 1000px; height: 700px; padding: 50px; border: 10px solid #2a4365; background-color: #fff; color: #2d3748; font-family: "Times New Roman", Times, serif; } .certificate-title { font-size: 48px; font-weight: bold; color: #2a4365; text-align: center; } .certificate-name { font-size: 42px; font-weight: bold; color: #2a4365; text-align: center; margin: 20px 0; } .certificate-course { font-size: 32px; font-weight: bold; text-align: center; margin: 20px 0; }',
    true
);