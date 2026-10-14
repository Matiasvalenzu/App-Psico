from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .admin_queries import (
    detalle_usuario,
    embudo,
    exportar_usuarios_csv,
    ingresos,
    listar_usuarios,
    marcar_interna,
    resumen,
    uso_ia,
)
from .permissions import IsSuperUser

CACHE_RESUMEN = "admin_panel_resumen_v1"
CACHE_SEGUNDOS = 300


def _usuario(user_id):
    User = get_user_model()
    return User.objects.select_related("perfil_psicologo", "suscripcion").filter(pk=user_id).first()


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperUser])
def admin_resumen(request):
    data = cache.get(CACHE_RESUMEN)
    if data is None:
        data = resumen()
        cache.set(CACHE_RESUMEN, data, CACHE_SEGUNDOS)
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperUser])
def admin_usuarios(request):
    return Response(listar_usuarios(request.query_params))


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperUser])
def admin_usuarios_export(request):
    contenido = exportar_usuarios_csv(request.query_params)
    response = HttpResponse(contenido, content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = 'attachment; filename="usuarios-psiconex.csv"'
    return response


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated, IsSuperUser])
def admin_usuario_detalle(request, user_id):
    user = _usuario(user_id)
    if user is None:
        return Response({"detail": "Usuario no encontrado."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "PATCH":
        if "es_interna" not in request.data:
            return Response(
                {"detail": "Solo se puede actualizar es_interna desde aquí."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        marcar_interna(user, request.data.get("es_interna"))
        cache.delete(CACHE_RESUMEN)
        user = _usuario(user_id)
    return Response(detalle_usuario(user))


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperUser])
def admin_ingresos(request):
    return Response(ingresos())


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperUser])
def admin_uso(request):
    return Response(uso_ia())


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperUser])
def admin_embudo(request):
    return Response(embudo())
