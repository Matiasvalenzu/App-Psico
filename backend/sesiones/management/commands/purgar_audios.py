from django.core.management.base import BaseCommand

from sesiones.audio import purgar_audios


class Command(BaseCommand):
    help = "Borra los audios que ya no deben conservarse (sesiones completadas, fallidas antiguas o inexistentes)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Solo informa, no borra.")

    def handle(self, *args, **options):
        archivos, total_bytes = purgar_audios(dry_run=options["dry_run"])
        accion = "Se borrarían" if options["dry_run"] else "Borrados"
        self.stdout.write(f"{accion}: {archivos} archivos ({total_bytes / 1_048_576:.1f} MB)")
