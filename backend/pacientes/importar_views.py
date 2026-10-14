import json
import os
from datetime import timedelta

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .importacion import (
    ArchivoImportacionInvalido,
    aplicar,
    errores_csv,
    evaluar_filas,
    indice_existentes,
    leer_archivo,
    plantilla_xlsx,
    sugerir_con_ia,
    sugerir_mapeo,
)
from .models import ImportacionPacientes, Paciente


def _archivo(request):
    archivo = request.FILES.get("archivo")
    if not archivo:
        raise ArchivoImportacionInvalido("Adjunta un archivo.")
    datos = archivo.read()
    nombre = archivo.name
    ruta = archivo.temporary_file_path() if hasattr(archivo, "temporary_file_path") else ""
    archivo.close()
    if ruta and os.path.exists(ruta):
        os.remove(ruta)
    return nombre, datos


def _mapeo(request):
    crudo = request.data.get("mapeo") or request.POST.get("mapeo") or {}
    if isinstance(crudo, str):
        crudo = json.loads(crudo or "{}")
    return {str(k): v for k, v in crudo.items()}


def _error(exc):
    return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class PlantillaImportacionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        respuesta = HttpResponse(
            plantilla_xlsx(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        respuesta["Content-Disposition"] = 'attachment; filename="plantilla-pacientes.xlsx"'
        return respuesta


class AnalizarImportacionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            nombre, datos = _archivo(request)
            encabezados, filas = leer_archivo(nombre, datos)
        except ArchivoImportacionInvalido as exc:
            return _error(exc)
        mapeo = sugerir_mapeo(encabezados, filas[:3])
        return Response(
            {
                "encabezados": encabezados,
                "muestra": [[str(c or "") for c in fila] for fila in filas[:3]],
                "mapeo": mapeo,
                "filas": len(filas),
            }
        )


class SugerirImportacionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        encabezados = request.data.get("encabezados") or []
        muestra = request.data.get("muestra") or []
        if not isinstance(encabezados, list) or not isinstance(muestra, list):
            return _error(ArchivoImportacionInvalido("Faltan los encabezados."))
        try:
            return Response({"mapeo": sugerir_con_ia(encabezados[:20], muestra[:3])})
        except ArchivoImportacionInvalido as exc:
            return _error(exc)
        except Exception:
            return Response({"detail": "No se pudo sugerir el mapeo."}, status=status.HTTP_502_BAD_GATEWAY)


class PrevisualizarImportacionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            nombre, datos = _archivo(request)
            encabezados, filas = leer_archivo(nombre, datos)
            evaluacion = evaluar_filas(
                encabezados, filas, _mapeo(request), indice_existentes(Paciente.objects.filter(psicologo=request.user))
            )
        except (ArchivoImportacionInvalido, json.JSONDecodeError) as exc:
            return _error(exc)
        return Response(evaluacion)


class ConfirmarImportacionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            nombre, datos = _archivo(request)
            encabezados, filas = leer_archivo(nombre, datos)
            evaluacion = evaluar_filas(
                encabezados, filas, _mapeo(request), indice_existentes(Paciente.objects.filter(psicologo=request.user))
            )
            decisiones = request.data.get("decisiones") or request.POST.get("decisiones") or {}
            if isinstance(decisiones, str):
                decisiones = json.loads(decisiones or "{}")
            creados, actualizados, omitidos, anteriores, errores = aplicar(
                evaluacion["filas"], {str(k): v for k, v in decisiones.items()}, request.user
            )
        except (ArchivoImportacionInvalido, json.JSONDecodeError) as exc:
            return _error(exc)
        registro = ImportacionPacientes.objects.create(
            psicologo=request.user,
            creados=len(creados),
            actualizados=len(actualizados),
            omitidos=len(omitidos),
            snapshot={"creados": [c["paciente"] for c in creados], "anteriores": anteriores},
        )
        return Response(
            {
                "id": registro.id,
                "creados": len(creados),
                "actualizados": len(actualizados),
                "omitidos": len(omitidos),
                "deshacer_hasta": timezone.now() + timedelta(hours=24),
                "errores_csv": errores_csv(errores),
            },
            status=status.HTTP_201_CREATED,
        )


class DeshacerImportacionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        registro = ImportacionPacientes.objects.filter(pk=pk, psicologo=request.user).first()
        if not registro:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if registro.deshecha_at:
            return _error(ArchivoImportacionInvalido("Esta importación ya se deshizo."))
        if timezone.now() - registro.created_at > timedelta(hours=24):
            return _error(ArchivoImportacionInvalido("Pasaron más de 24 horas. Ya no se puede deshacer."))
        no_borrados = []
        for paciente_id in registro.snapshot.get("creados", []):
            paciente = Paciente.objects.filter(pk=paciente_id, psicologo=request.user).first()
            if not paciente:
                continue
            if paciente.sesiones.exists() or paciente.cobros.exists():
                no_borrados.append(paciente_id)
                continue
            paciente.delete()
        for anterior in registro.snapshot.get("anteriores", []):
            paciente = Paciente.objects.filter(pk=anterior["id"], psicologo=request.user).first()
            if not paciente:
                continue
            for campo, valor in anterior.items():
                if campo == "id":
                    continue
                setattr(paciente, campo, valor or None if campo == "fecha_nacimiento" else valor or "")
            paciente.save(update_fields=["telefono_whatsapp", "email_contacto", "direccion", "comuna", "prevision", "fecha_nacimiento", "updated_at"])
        registro.deshecha_at = timezone.now()
        registro.save(update_fields=["deshecha_at"])
        return Response({"deshecha": True, "no_borrados": no_borrados})
