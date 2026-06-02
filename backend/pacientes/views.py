from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Paciente
from .serializers import PacienteSerializer, PacienteListSerializer


class PacienteViewSet(viewsets.ModelViewSet):
    queryset = Paciente.objects.all()
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["activo"]
    search_fields = ["nombre", "apellido", "motivo_consulta"]
    ordering_fields = ["apellido", "nombre", "created_at", "updated_at"]
    ordering = ["apellido", "nombre"]

    def get_serializer_class(self):
        if self.action == "list":
            return PacienteListSerializer
        return PacienteSerializer

    def get_queryset(self):
        return super().get_queryset().filter(psicologo=self.request.user)

    def perform_create(self, serializer):
        serializer.save(psicologo=self.request.user)
