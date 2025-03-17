from django.db import models
from accounts.models import User

class Topic(models.Model):
    """
    Chủ đề học tập (ví dụ: Giao tiếp hàng ngày, Ngữ pháp cơ bản, etc.)
    """
    title = models.CharField(max_length=255)
    description = models.TextField()
    image = models.ImageField(upload_to='topic_images/', null=True, blank=True)
    order = models.IntegerField(default=0)
    
    def __str__(self):
        return self.title

class Lesson(models.Model):
    """
    Bài học trong một chủ đề
    """
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=255)
    description = models.TextField()
    content = models.TextField()
    grammar_explanation = models.TextField(blank=True)
    order = models.IntegerField(default=0)
    
    def __str__(self):
        return f"{self.topic.title} - {self.title}"

class Vocabulary(models.Model):
    """
    Từ vựng được dạy trong các bài học
    """
    word = models.CharField(max_length=255)
    phonetic = models.CharField(max_length=255, blank=True)
    meaning = models.TextField()
    example = models.TextField()
    image = models.ImageField(upload_to='vocabulary_images/', null=True, blank=True)
    audio = models.FileField(upload_to='vocabulary_audio/', null=True, blank=True)
    
    class Meta:
        verbose_name_plural = 'Vocabularies'
    
    def __str__(self):
        return self.word

class LessonVocabulary(models.Model):
    """
    Mối quan hệ giữa bài học và từ vựng
    """
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='vocabularies')
    vocabulary = models.ForeignKey(Vocabulary, on_delete=models.CASCADE, related_name='lessons')
    
    class Meta:
        unique_together = ('lesson', 'vocabulary')
    
    def __str__(self):
        return f"{self.lesson.title} - {self.vocabulary.word}"

class Exercise(models.Model):
    """
    Bài tập cho một bài học
    """
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='exercises')
    title = models.CharField(max_length=255)
    description = models.TextField()
    type = models.CharField(
        max_length=50,
        choices=[
            ('multiple_choice', 'Multiple Choice'),
            ('fill_blank', 'Fill in the Blank'),
            ('matching', 'Matching'),
            ('reordering', 'Reordering'),
            ('pronunciation', 'Pronunciation Practice'),
        ]
    )
    order = models.IntegerField(default=0)
    
    def __str__(self):
        return f"{self.lesson.title} - {self.title}"

class ExerciseQuestion(models.Model):
    """
    Câu hỏi trong một bài tập
    """
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    image = models.ImageField(upload_to='question_images/', null=True, blank=True)
    audio = models.FileField(upload_to='question_audio/', null=True, blank=True)
    order = models.IntegerField(default=0)
    
    def __str__(self):
        return f"{self.exercise.title} - Question {self.order}"

class ExerciseOption(models.Model):
    """
    Lựa chọn cho câu hỏi trắc nghiệm
    """
    question = models.ForeignKey(ExerciseQuestion, on_delete=models.CASCADE, related_name='options')
    option_text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)
    
    def __str__(self):
        return f"{self.question} - {self.option_text}"

class UserProgress(models.Model):
    """
    Theo dõi tiến trình của người dùng đối với các bài học
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='progress')
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    completed = models.BooleanField(default=False)
    completion_date = models.DateTimeField(null=True, blank=True)
    score = models.FloatField(null=True, blank=True)
    
    class Meta:
        unique_together = ('user', 'lesson')
    
    def __str__(self):
        return f"{self.user.username} - {self.lesson.title} - {'Completed' if self.completed else 'In Progress'}"

class UserVocabulary(models.Model):
    """
    Theo dõi từ vựng mà người dùng đã học
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='learned_vocab')
    vocabulary = models.ForeignKey(Vocabulary, on_delete=models.CASCADE)
    learned = models.BooleanField(default=False)
    familiarity_level = models.IntegerField(
        default=0,
        choices=[(0, 'Not Familiar'), (1, 'Slightly Familiar'), (2, 'Familiar'), (3, 'Very Familiar')]
    )
    next_review_date = models.DateField(null=True, blank=True)
    
    class Meta:
        unique_together = ('user', 'vocabulary')
        verbose_name_plural = 'User Vocabularies'
    
    def __str__(self):
        return f"{self.user.username} - {self.vocabulary.word} - Level {self.familiarity_level}"