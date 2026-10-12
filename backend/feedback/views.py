import logging
from email.utils import formataddr, parseaddr
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db.models import Count, Q
from rest_framework import generics, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

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


class PublicAporteFeedbackView(APIView):
    """
    Endpoint público para recibir aportes y feedback de la comunidad clínica
    desde la landing page (botón 'Quiero aportar').
    Envía un correo a matias@datnexia.com con los datos recibidos.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data
        nombre = str(data.get("nombre", "")).strip()
        email = str(data.get("email", "")).strip()
        especialidad = str(data.get("especialidad", "")).strip()
        comentario = str(data.get("comentario", "")).strip()

        if not email or "@" not in email:
            return Response(
                {"error": "Por favor ingresa un correo electrónico válido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not comentario:
            return Response(
                {"error": "Por favor escribe tu comentario o aporte."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        destinatario = "matias@datnexia.com"
        asunto = f"[Psiconex] Nuevo aporte de la comunidad: {nombre or email}"
        if especialidad:
            asunto += f" ({especialidad})"

        cuerpo_texto = (
            f"Se ha recibido un nuevo aporte desde la sección de comunidad clínica (landing):\n\n"
            f"Nombre: {nombre or 'No indicado'}\n"
            f"Correo: {email}\n"
            f"Especialidad / Área: {especialidad or 'No indicada'}\n\n"
            f"Comentario / Aporte:\n"
            f"--------------------------------------------------\n"
            f"{comentario}\n"
            f"--------------------------------------------------\n"
        )

        cuerpo_html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; padding: 20px;">
          <h2 style="color: #6366f1; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0;">Nuevo aporte a Psiconex</h2>
          <p style="font-size: 15px; color: #475569;">Se ha recibido un nuevo mensaje desde el formulario <strong>Quiero aportar</strong> en la landing page:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold; width: 140px; color: #64748b;">Nombre:</td><td style="color: #0f172a;">{nombre or 'No indicado'}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold; color: #64748b;">Correo:</td><td><a href="mailto:{email}" style="color: #6366f1; text-decoration: underline;">{email}</a></td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; font-weight: bold; color: #64748b;">Especialidad:</td><td style="color: #0f172a;">{especialidad or 'No indicada'}</td></tr>
          </table>
          <div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 16px 20px; border-radius: 6px; margin: 24px 0;">
            <p style="margin: 0 0 8px; font-weight: bold; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Comentario / Aporte:</p>
            <p style="margin: 0; white-space: pre-wrap; font-size: 15px; line-height: 1.6; color: #1e293b;">{comentario}</p>
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
            Puedes responder directamente a este correo para escribirle a {nombre or email}.
          </p>
        </div>
        """

        try:
            from_addr = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@datnexia.com")
            from_name = getattr(settings, "EMAIL_FROM_NAME", "Psiconex")
            from_header = formataddr((from_name, parseaddr(from_addr)[1] or from_addr))
            msg = EmailMultiAlternatives(
                subject=asunto,
                body=cuerpo_texto,
                from_email=from_header,
                to=[destinatario],
                reply_to=[email],
            )
            msg.attach_alternative(cuerpo_html, "text/html")
            msg.send(fail_silently=False)
            return Response({"ok": True, "mensaje": "Aporte enviado con éxito."})
        except Exception as e:
            logger.error("Error al enviar email de aporte público: %s", e)
            return Response(
                {"error": "No se pudo enviar el mensaje por correo. Por favor intenta más tarde o escribe directamente a matias@datnexia.com."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

