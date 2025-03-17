from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    """
    Mở rộng model User mặc định của Django với các trường bổ sung
    """
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)
    bio = models.TextField(blank=True)
    language_level = models.CharField(
        max_length=2,
        choices=[
            ('A1', 'Beginner'),
            ('A2', 'Elementary'),
            ('B1', 'Intermediate'),
            ('B2', 'Upper Intermediate'),
            ('C1', 'Advanced'),
            ('C2', 'Proficient'),
        ],
        default='A1'
    )
    learning_goal = models.CharField(max_length=255, blank=True)
    daily_goal_minutes = models.IntegerField(default=30)
    weekly_goal_days = models.IntegerField(default=5)
    
    def __str__(self):
        return self.username

class UserStreak(models.Model):
    """
    Theo dõi chuỗi ngày học liên tiếp của người dùng
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='streak')
    current_streak = models.IntegerField(default=0)
    longest_streak = models.IntegerField(default=0)
    last_activity_date = models.DateField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.user.username}'s streak: {self.current_streak} days"

class UserActivity(models.Model):
    """
    Lưu trữ hoạt động học tập hàng ngày của người dùng
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activities')
    date = models.DateField(auto_now_add=True)
    minutes_studied = models.IntegerField(default=0)
    
    class Meta:
        unique_together = ('user', 'date')
        verbose_name_plural = 'User Activities'
    
    def __str__(self):
        return f"{self.user.username} - {self.date} - {self.minutes_studied} minutes"