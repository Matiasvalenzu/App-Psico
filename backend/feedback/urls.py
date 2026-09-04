from django.urls import path
from .views import (
    FeedbackCreateView,
    MisFeedbacksListView,
    FeedbackAdminListView,
    FeedbackAdminUpdateView,
    FeedbackAdminStatsView,
)

urlpatterns = [
    path("", FeedbackCreateView.as_view(), name="feedback_create"),
    path("mis-reportes/", MisFeedbacksListView.as_view(), name="feedback_mis_reportes"),
    path("admin/list/", FeedbackAdminListView.as_view(), name="feedback_admin_list"),
    path("admin/<int:pk>/update/", FeedbackAdminUpdateView.as_view(), name="feedback_admin_update"),
    path("admin/stats/", FeedbackAdminStatsView.as_view(), name="feedback_admin_stats"),
]
