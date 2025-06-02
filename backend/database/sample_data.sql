-- 1. users
INSERT INTO users (username, email, password_hash, first_name, last_name, profile_picture, created_at, updated_at, last_login, is_active, is_verified, role, bio) VALUES
('nguyenvan', 'nguyenvan@example.com', 'hashed_password_1', 'Văn', 'Nguyễn', 'https://example.com/avatar1.png', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, TRUE, FALSE, 'student', 'Sinh viên đam mê học ngôn ngữ'),
('tranthi', 'tranthi@example.com', 'hashed_password_2', 'Thị', 'Trần', 'https://example.com/avatar2.png', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, TRUE, TRUE, 'instructor', 'Giảng viên tiếng Anh với 5 năm kinh nghiệm'),
('leminh', 'leminh@example.com', 'hashed_password_3', 'Minh', 'Lê', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, TRUE, FALSE, 'student', NULL),
('phamthuy', 'phamthuy@example.com', 'hashed_password_4', 'Thùy', 'Phạm', 'https://example.com/avatar4.png', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, TRUE, TRUE, 'admin', 'Quản trị viên hệ thống'),
('hoangduc', 'hoangduc@example.com', 'hashed_password_5', 'Đức', 'Hoàng', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, TRUE, FALSE, 'student', 'Học viên mới');

-- 2. system_notifications
INSERT INTO system_notifications (title, content, target_role, is_read, created_at, expires_at) VALUES
('Bảo Trì Hệ Thống', 'Hệ thống sẽ bảo trì vào 12h đêm nay', 'all', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 day'),
('Khóa Học Mới', 'Khóa học giao tiếp mới đã ra mắt', 'student', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days'),
('Cập Nhật Tài Liệu', 'Tài liệu mới đã được thêm vào khóa học', 'instructor', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '3 days'),
('Thông Báo Hoàn Tiền', 'Kiểm tra yêu cầu hoàn tiền của bạn', 'admin', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '2 days'),
('Sự Kiện Sắp Tới', 'Tham gia hội thảo tiếng Anh miễn phí', 'all', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 days');

-- 3. ai_analytics
INSERT INTO ai_analytics (date, total_conversations, avg_response_time_seconds, satisfaction_rate, resolution_rate, created_at) VALUES
('2025-04-10', 50, 2.5, 80.00, 70.00, CURRENT_TIMESTAMP),
('2025-04-09', 45, 2.3, 75.00, 65.00, CURRENT_TIMESTAMP),
('2025-04-08', 60, 2.7, 85.00, 80.00, CURRENT_TIMESTAMP),
('2025-04-07', 40, 2.1, 70.00, 60.00, CURRENT_TIMESTAMP),
('2025-04-06', 55, 2.4, 82.00, 75.00, CURRENT_TIMESTAMP);

-- 4. ai_failed_queries
INSERT INTO ai_failed_queries (query_text, count, first_seen, last_seen) VALUES
('Cách làm bài IELTS Writing Task 2', 3, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP),
('Giải nghĩa từ "serendipity"', 2, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP),
('Câu điều kiện loại 3', 5, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP),
('Phát âm từ "schedule"', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Hội thoại giao tiếp tại sân bay', 4, CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP);

-- 5. course_categories
INSERT INTO course_categories (name, description, parent_category_id, created_at) VALUES
('Tiếng Anh Giao Tiếp', 'Các khóa học về giao tiếp', NULL, CURRENT_TIMESTAMP),
('Tiếng Anh IELTS', 'Chuẩn bị cho kỳ thi IELTS', NULL, CURRENT_TIMESTAMP),
('Ngữ Pháp Tiếng Anh', 'Học ngữ pháp chuyên sâu', NULL, CURRENT_TIMESTAMP),
('Từ Vựng Tiếng Anh', 'Mở rộng vốn từ vựng', NULL, CURRENT_TIMESTAMP),
('Phát Âm Tiếng Anh', 'Cải thiện kỹ năng phát âm', NULL, CURRENT_TIMESTAMP);

-- 6. courses
INSERT INTO courses (title, description, instructor_id, difficulty_level, price, duration_minutes, thumbnail_url, is_published, created_at, updated_at, language_skill) VALUES
('Tiếng Anh Giao Tiếp Cơ Bản', 'Khóa học giúp bạn giao tiếp tiếng Anh tự tin', 2, 'beginner', 500000.00, 600, 'https://example.com/thumbnail1.png', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'speaking'),
('Luyện Nghe Tiếng Anh IELTS', 'Khóa học luyện nghe cho kỳ thi IELTS', 2, 'intermediate', 750000.00, 720, 'https://example.com/thumbnail2.png', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'listening'),
('Ngữ Pháp Tiếng Anh Nâng Cao', 'Hiểu rõ ngữ pháp tiếng Anh phức tạp', 2, 'advanced', 900000.00, 900, 'https://example.com/thumbnail3.png', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'grammar'),
('Từ Vựng Tiếng Anh Du Lịch', 'Học từ vựng cần thiết khi đi du lịch', 2, 'all-levels', 300000.00, 360, 'https://example.com/thumbnail4.png', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'vocabulary'),
('Phát Âm Chuẩn Tiếng Anh', 'Cải thiện phát âm như người bản xứ', 2, 'beginner', 450000.00, 480, 'https://example.com/thumbnail5.png', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'pronunciation');

-- 7. user_verification
INSERT INTO user_verification (user_id, token, type, expires_at, used, created_at) VALUES
(1, 'token12345', 'email', CURRENT_TIMESTAMP + INTERVAL '1 day', FALSE, CURRENT_TIMESTAMP),
(2, 'token67890', 'password_reset', CURRENT_TIMESTAMP + INTERVAL '2 hours', FALSE, CURRENT_TIMESTAMP),
(3, 'token11111', 'email', CURRENT_TIMESTAMP + INTERVAL '1 day', TRUE, CURRENT_TIMESTAMP),
(4, 'token22222', 'password_reset', CURRENT_TIMESTAMP + INTERVAL '3 hours', FALSE, CURRENT_TIMESTAMP),
(5, 'token33333', 'email', CURRENT_TIMESTAMP + INTERVAL '1 day', FALSE, CURRENT_TIMESTAMP);

-- 8. system_settings
INSERT INTO system_settings (setting_key, setting_value, description, updated_at, updated_by) VALUES
('max_login_attempts', '5', 'Số lần đăng nhập tối đa', CURRENT_TIMESTAMP, 4),
('session_timeout', '30', 'Thời gian hết phiên (phút)', CURRENT_TIMESTAMP, 4),
('default_language', 'vi', 'Ngôn ngữ mặc định', CURRENT_TIMESTAMP, 4),
('maintenance_mode', 'false', 'Chế độ bảo trì', CURRENT_TIMESTAMP, 4),
('email_smtp_host', 'smtp.example.com', 'Máy chủ SMTP cho email', CURRENT_TIMESTAMP, 4);

-- 9. certificate_templates
INSERT INTO certificate_templates (name, description, html_content, css_content, is_active, created_at, updated_at, created_by) VALUES
('Chứng Chỉ Giao Tiếp', 'Mẫu chứng chỉ cho khóa giao tiếp', '<div>Chứng chỉ giao tiếp cho {{student_name}}</div>', 'div { color: blue; }', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 4),
('Chứng Chỉ IELTS', 'Mẫu chứng chỉ cho khóa IELTS', '<div>Chứng chỉ IELTS cho {{student_name}}</div>', 'div { color: green; }', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 4),
('Chứng Chỉ Ngữ Pháp', 'Mẫu chứng chỉ cho khóa ngữ pháp', '<div>Chứng chỉ ngữ pháp cho {{student_name}}</div>', 'div { color: red; }', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 4),
('Chứng Chỉ Du Lịch', 'Mẫu chứng chỉ cho khóa du lịch', '<div>Chứng chỉ du lịch cho {{student_name}}</div>', 'div { color: purple; }', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 4);

-- 10. ai_conversations
INSERT INTO ai_conversations (user_id, start_time, end_time, duration_seconds, message_count, satisfaction_rating, topic, is_resolved, created_at) VALUES
(1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '10 minutes', 600, 10, 'positive', 'Hỏi về từ vựng', TRUE, CURRENT_TIMESTAMP),
(3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', 300, 8, 'neutral', 'Hỏi về ngữ pháp', FALSE, CURRENT_TIMESTAMP),
(5, CURRENT_TIMESTAMP, NULL, NULL, 5, NULL, 'Hỏi về phát âm', FALSE, CURRENT_TIMESTAMP),
(1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '15 minutes', 900, 12, 'positive', 'Hỏi về giao tiếp', TRUE, CURRENT_TIMESTAMP),
(3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 minutes', 420, 9, 'negative', 'Hỏi về IELTS', FALSE, CURRENT_TIMESTAMP);

-- 11. ai_templates
INSERT INTO ai_templates (name, content, category, last_updated, updated_by) VALUES
('Chào Hỏi AI', 'Xin chào, tôi có thể giúp gì cho bạn?', 'greeting', CURRENT_TIMESTAMP, 4),
('Hỗ Trợ Từ Vựng', 'Bạn cần giải nghĩa từ nào?', 'vocabulary', CURRENT_TIMESTAMP, 4),
('Hỗ Trợ Ngữ Pháp', 'Hãy hỏi tôi về ngữ pháp!', 'grammar', CURRENT_TIMESTAMP, 4),
('Hỗ Trợ Phát Âm', 'Bạn muốn cải thiện phát âm thế nào?', 'pronunciation', CURRENT_TIMESTAMP, 4),
('Hỗ Trợ IELTS', 'Bạn cần luyện kỹ năng nào cho IELTS?', 'ielts', CURRENT_TIMESTAMP, 4);

-- 12. modules
INSERT INTO modules (course_id, title, description, position, created_at, updated_at) VALUES
(1, 'Giới Thiệu Giao Tiếp', 'Tổng quan về giao tiếp cơ bản', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(1, 'Luyện Tập Hội Thoại', 'Thực hành các mẫu câu giao tiếp', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'Luyện Nghe Chủ Đề 1', 'Nghe các đoạn hội thoại ngắn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'Ngữ Pháp Câu Điều Kiện', 'Học câu điều kiện trong tiếng Anh', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 'Từ Vựng Khách Sạn', 'Học từ vựng liên quan đến đặt phòng', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 13. user_courses
INSERT INTO user_courses (user_id, course_id, enrollment_date, completion_date, progress_percentage, is_completed, last_accessed_at) VALUES
(1, 1, CURRENT_TIMESTAMP, NULL, 50.00, FALSE, CURRENT_TIMESTAMP),
(3, 2, CURRENT_TIMESTAMP, NULL, 20.00, FALSE, CURRENT_TIMESTAMP),
(5, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 100.00, TRUE, CURRENT_TIMESTAMP),
(1, 4, CURRENT_TIMESTAMP, NULL, 10.00, FALSE, CURRENT_TIMESTAMP),
(3, 5, CURRENT_TIMESTAMP, NULL, 75.00, FALSE, CURRENT_TIMESTAMP);

-- 14. course_reviews
INSERT INTO course_reviews (course_id, user_id, rating, review_text, created_at, updated_at) VALUES
(1, 1, 4, 'Khóa học dễ hiểu, cần thêm bài tập', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 3, 5, 'Rất hữu ích cho IELTS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 5, 3, 'Nội dung hơi khó', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 1, 4, 'Phù hợp để học du lịch', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 3, 5, 'Phát âm cải thiện rõ rệt', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 15. transactions
INSERT INTO transactions (user_id, course_id, amount, currency, payment_method, transaction_status, transaction_reference, created_at, updated_at) VALUES
(1, 1, 500000.00, 'VND', 'vnpay', 'completed', 'TXN12345', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 2, 750000.00, 'VND', 'momo', 'completed', 'TXN67890', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 3, 900000.00, 'VND', 'credit_card', 'pending', 'TXN11111', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(1, 4, 300000.00, 'VND', 'bank_transfer', 'completed', 'TXN22222', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 5, 450000.00, 'VND', 'vnpay', 'failed', 'TXN33333', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 16. certificate_fields
INSERT INTO certificate_fields (template_id, field_name, field_type, default_value, is_required, position) VALUES
(2, 'student_name', 'text', '{{user.first_name}} {{user.last_name}}', TRUE, 1),
(3, 'course_name', 'text', '{{course.title}}', TRUE, 1),
(4, 'completion_date', 'date', '{{format_date now "DD/MM/YYYY"}}', TRUE, 1),
(5, 'verification_code', 'text', '{{certificate.verification_code}}', TRUE, 1),
(2, 'instructor_name', 'text', '{{course.instructor_name}}', TRUE, 2);

-- 17. certificates
INSERT INTO certificates (user_id, course_id, template_id, verification_code, issue_date, expiry_date, is_revoked, revocation_reason, metadata) VALUES
(1, 1, 1, 'VER12345', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 year', FALSE, NULL, '{"score": 85}'),
(3, 2, 2, 'VER67890', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 year', FALSE, NULL, '{"score": 90}'),
(5, 3, 3, 'VER11111', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 year', TRUE, 'Học viên yêu cầu', '{"score": 75}'),
(1, 4, 4, 'VER22222', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 year', FALSE, NULL, '{"score": 80}'),
(3, 5, 5, 'VER33333', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 year', FALSE, NULL, '{"score": 95}');

-- 18. course_category_mappings
INSERT INTO course_category_mappings (course_id, category_id) VALUES
(1, 1),
(2, 2),
(3, 3),
(4, 4),
(5, 5);

-- 19. lessons
INSERT INTO lessons (module_id, title, description, content, video_url, duration_minutes, position, created_at, updated_at) VALUES
(1, 'Chào Hỏi Cơ Bản', 'Học cách chào hỏi trong giao tiếp', 'Nội dung bài học về chào hỏi', 'https://example.com/video1.mp4', 30, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'Mẫu Câu Hỏi Đáp', 'Luyện tập hỏi và trả lời', 'Nội dung bài học về hỏi đáp', 'https://example.com/video2.mp4', 45, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'Nghe Hội Thoại Du Lịch', 'Luyện nghe hội thoại thực tế', 'Nội dung bài nghe về du lịch', 'https://example.com/video3.mp4', 60, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 'Câu Điều Kiện Loại 1', 'Hiểu và sử dụng câu điều kiện loại 1', 'Nội dung về câu điều kiện', 'https://example.com/video4.mp4', 50, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 'Đặt Phòng Khách Sạn', 'Học cách đặt phòng bằng tiếng Anh', 'Nội dung về đặt phòng', 'https://example.com/video5.mp4', 40, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 20. ai_messages
INSERT INTO ai_messages (conversation_id, sender, content, timestamp) VALUES
(1, 'user', 'Từ "happy" có nghĩa gì?', CURRENT_TIMESTAMP),
(1, 'ai', '"Happy" nghĩa là vui vẻ, hạnh phúc.', CURRENT_TIMESTAMP + INTERVAL '1 minute'),
(2, 'user', 'Câu điều kiện loại 1 là gì?', CURRENT_TIMESTAMP),
(3, 'ai', 'Câu điều kiện loại 1 diễn tả tình huống có thể xảy ra.', CURRENT_TIMESTAMP + INTERVAL '1 minute'),
(4, 'user', 'Làm sao để giao tiếp tự nhiên?', CURRENT_TIMESTAMP);

-- 21. user_notifications
INSERT INTO user_notifications (user_id, notification_id, is_read, read_at, created_at) VALUES
(1, 1, FALSE, NULL, CURRENT_TIMESTAMP),
(3, 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 3, FALSE, NULL, CURRENT_TIMESTAMP),
(1, 4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 5, FALSE, NULL, CURRENT_TIMESTAMP);

-- 22. resources
INSERT INTO resources (lesson_id, title, description, file_url, file_type, created_at) VALUES
(1, 'Tài Liệu Chào Hỏi', 'Danh sách mẫu câu chào hỏi', 'https://example.com/resource1.pdf', 'pdf', CURRENT_TIMESTAMP),
(2, 'Bài Tập Hỏi Đáp', 'Bài tập thực hành hỏi đáp', 'https://example.com/resource2.pdf', 'pdf', CURRENT_TIMESTAMP),
(3, 'File Nghe Du Lịch', 'File audio hội thoại du lịch', 'https://example.com/resource3.mp3', 'audio', CURRENT_TIMESTAMP),
(4, 'Bài Tập Ngữ Pháp', 'Bài tập câu điều kiện', 'https://example.com/resource4.pdf', 'pdf', CURRENT_TIMESTAMP),
(5, 'Từ Vựng Đặt Phòng', 'Danh sách từ vựng đặt phòng', 'https://example.com/resource5.pdf', 'pdf', CURRENT_TIMESTAMP);

-- 23. user_lessons
INSERT INTO user_lessons (user_id, lesson_id, is_completed, progress_percentage, last_accessed_at, notes) VALUES
(1, 1, TRUE, 100.00, CURRENT_TIMESTAMP, 'Hoàn thành bài học chào hỏi'),
(3, 2, FALSE, 50.00, CURRENT_TIMESTAMP, 'Cần luyện thêm hỏi đáp'),
(5, 3, TRUE, 100.00, CURRENT_TIMESTAMP, 'Nghe tốt'),
(1, 4, FALSE, 25.00, CURRENT_TIMESTAMP, 'Khó hiểu câu điều kiện'),
(3, 5, TRUE, 100.00, CURRENT_TIMESTAMP, 'Đặt phòng dễ hiểu');

-- 24. assignments
INSERT INTO assignments (lesson_id, title, description, instructions, due_date, points_possible, assignment_type, is_auto_graded, created_at, updated_at) VALUES
(1, 'Bài Tập Chào Hỏi', 'Luyện tập các mẫu câu chào hỏi', 'Viết 5 câu chào hỏi', CURRENT_TIMESTAMP + INTERVAL '7 days', 10, 'practice', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'Quiz Hỏi Đáp', 'Kiểm tra hỏi đáp giao tiếp', 'Chọn đáp án đúng', CURRENT_TIMESTAMP + INTERVAL '5 days', 20, 'quiz', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'Bài Nghe Du Lịch', 'Phân tích hội thoại du lịch', 'Nghe và trả lời câu hỏi', CURRENT_TIMESTAMP + INTERVAL '10 days', 15, 'essay', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 'Câu Điều Kiện', 'Luyện tập câu điều kiện', 'Hoàn thành 10 câu', CURRENT_TIMESTAMP + INTERVAL '3 days', 25, 'practice', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 'Dự Án Đặt Phòng', 'Thực hành đặt phòng', 'Ghi âm đoạn hội thoại', CURRENT_TIMESTAMP + INTERVAL '14 days', 30, 'project', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 25. refunds
INSERT INTO refunds (transaction_id, refund_amount, refund_reason, refund_status, admin_notes, created_at, processed_at, refunded_by, processed_by) VALUES
(1, 500000.00, 'Không hài lòng với khóa học', 'pending', NULL, CURRENT_TIMESTAMP, NULL, 4, NULL),
(2, 750000.00, 'Hủy khóa học', 'approved', 'Hoàn tiền đã xử lý', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 4, 4),
(3, 300000.00, 'Lỗi thanh toán', 'rejected', 'Không đủ điều kiện hoàn tiền', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 4, 4),
(4, 450000.00, 'Thay đổi kế hoạch học', 'processing', 'Đang xử lý', CURRENT_TIMESTAMP, NULL, 4, NULL),
(5, 900000.00, 'Khóa học không phù hợp', 'pending', NULL, CURRENT_TIMESTAMP, NULL, 4, NULL);

-- 26. questions
INSERT INTO questions (assignment_id, question_text, question_type, points, position) VALUES
(1, 'Cách chào hỏi khi gặp lần đầu?', 'essay', 5, 1),
(2, 'Chọn câu trả lời đúng: How are you?', 'multiple_choice', 4, 1),
(3, 'Hội thoại này nói về chủ đề gì?', 'essay', 10, 1),
(4, 'If I ___ (be) rich, I would travel.', 'fill_blank', 2, 1),
(5, 'Đúng hay Sai: "Can you book a room?" là câu hỏi.', 'true_false', 3, 1);

-- 27. user_submissions
INSERT INTO user_submissions (user_id, assignment_id, submitted_at, score, feedback, is_graded, graded_at, submission_file_url) VALUES
(1, 1, CURRENT_TIMESTAMP, 8.00, 'Tốt, cần thêm ví dụ', TRUE, CURRENT_TIMESTAMP, 'https://example.com/submission1.pdf'),
(3, 2, CURRENT_TIMESTAMP, 16.00, 'Đúng 4/5 câu', TRUE, CURRENT_TIMESTAMP, NULL),
(5, 3, CURRENT_TIMESTAMP, NULL, NULL, FALSE, NULL, 'https://example.com/submission3.mp3'),
(1, 4, CURRENT_TIMESTAMP, 20.00, 'Hoàn thành tốt', TRUE, CURRENT_TIMESTAMP, NULL),
(3, 5, CURRENT_TIMESTAMP, NULL, NULL, FALSE, NULL, 'https://example.com/submission5.mp3');

-- 28. answers
INSERT INTO answers (question_id, answer_text, is_correct, explanation) VALUES
(1, 'Hello, nice to meet you!', TRUE, 'Câu chào hỏi đúng'),
(2, 'I’m fine, thank you.', TRUE, 'Đáp án đúng cho câu hỏi'),
(2, 'Goodbye.', FALSE, 'Không phù hợp'),
(4, 'were', TRUE, 'Đáp án đúng cho câu điều kiện'),
(5, 'True', TRUE, 'Câu này là câu hỏi');