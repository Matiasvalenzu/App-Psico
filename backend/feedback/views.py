from django.db.models import Count, Q
from rest_framework import generics, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import FeedbackReport
from .serializers import (
    FeedbackCreateSerializer,
    FeedbackUserListSerializer,
    FeedbackAdminListSerializer,
    FeedbackAdminUpdateSerializer,
)
from .services import (
    notificar_nuevo_feedback,
    notificar_actualizacion_feedback,
)


def is_admin_user(user):
    return bool(
        user
        and user.is_authenticated
        and (
            user.is_staff
            or user.is_superuser
            or user.username.lower() == "admin"
            or getattr(user, "is_admin", False)
        )
    )


class IsAdminUserPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_admin_user(request.user)


class FeedbackCreateView(generics.CreateAPIView):
    serializer_class = FeedbackCreateSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        reporte = serializer.save(usuario=self.request.user)
        notificar_nuevo_feedback(reporte)


class MisFeedbacksListView(generics.ListAPIView):
    serializer_class = FeedbackUserListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return FeedbackReport.objects.filter(usuario=self.request.user).order_by("-created_at")


class FeedbackAdminListView(generics.ListAPIView):
    serializer_class = FeedbackAdminListSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUserPermission]

    def get_queryset(self):
        queryset = FeedbackReport.objects.select_related("usuario", "respondido_por").all()
        estado = self.request.query_params.get("estado")
        tipo = self.request.query_params.get("tipo")
        severidad = self.request.query_params.get("severidad")
        search = self.request.query_params.get("search")

        if estado and estado != "todos":
            queryset = queryset.filter(estado=estado)
        if tipo and tipo != "todos":
            queryset = queryset.filter(tipo=tipo)
        if severidad and severidad != "todos":
            queryset = queryset.filter(severidad=severidad)
        if search:
            queryset = queryset.filter(
                Q(titulo__icontains=search)
                | Q(descripcion__icontains=search)
                | Q(usuario__username__icontains=search)
                | Q(usuario__first_name__icontains=search)
                | Q(usuario__last_name__icontains=search)
                | Q(usuario__email__icontains=search)
            )

        return queryset.order_by("-created_at")


class FeedbackAdminUpdateView(generics.UpdateAPIView):
    queryset = FeedbackReport.objects.all()
    serializer_class = FeedbackAdminUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUserPermission]
    lookup_field = "pk"

    def perform_update(self, serializer):
        old_estado = self.get_object().estado
        old_respuesta = self.get_object().respuesta_admin
        reporte = serializer.save()

        # Si cambió el estado o se agregó/modificó la respuesta, notificar al psicólogo
        if reporte.estado != old_estado or (reporte.respuesta_admin and reporte.respuesta_admin != old_respuesta):
            notificar_actualizacion_feedback(reporte)


class FeedbackAdminStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUserPermission]

    def get(self, request):
        total = FeedbackReport.objects.count()
        nuevos = FeedbackReport.objects.filter(estado="nuevo").count()
        en_revision = FeedbackReport.objects.filter(estado="en_revision").count()
        resueltos = FeedbackReport.objects.filter(estado="resuelto").count()
        
        errores = FeedbackReport.objects.filter(tipo="error").count()
        errores_abiertos = FeedbackReport.objects.filter(tipo="error", estado__in=["nuevo", "en_revision"]).count()
        mejoras = FeedbackReport.objects.filter(tipo="mejora").count()
        felicitaciones = FeedbackReport.objects.filter(tipo="felicitacion").count()

        return Response({
            "total": total,
            "nuevos": nuevos,
            "en_revision": en_revision,
            "resueltos": resueltos,
            "errores": errores,
            "errores_abiertos": errores_abiertos,
            "mejoras": mejoras,
            "felicitaciones": felicitaciones,
        })
