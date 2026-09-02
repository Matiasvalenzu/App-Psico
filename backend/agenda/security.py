import base64
import hmac
import secrets

from django.conf import settings
from django.core import signing


def _digest(salt, value):
    return signing.salted_hmac(
        salt,
        value,
        secret=settings.SECRET_KEY,
        algorithm="sha256",
    ).hexdigest()


def document_digest(profile_id, document_type, normalized_document):
    return _digest(
        "agenda.documento-reserva",
        f"{profile_id}:{document_type}:{normalized_document}",
    )


def otp_digest(verification_id, code):
    return _digest("agenda.otp-reserva", f"{verification_id}:{code}")


def compare_digest(expected, received):
    return hmac.compare_digest(expected, received)


def generate_booking_code():
    raw = base64.b32encode(secrets.token_bytes(10)).decode("ascii").rstrip("=")
    return f"PSX-{raw[:4]}-{raw[4:8]}-{raw[8:12]}-{raw[12:16]}"


def sign_reservation_access(reservation_id, version):
    return signing.dumps(
        {"reservation_id": reservation_id, "version": version},
        salt="agenda.gestion-reserva",
        compress=True,
    )


def unsign_reservation_access(token, max_age=20 * 60):
    return signing.loads(token, salt="agenda.gestion-reserva", max_age=max_age)


def sign_email_verification(verification_id):
    return signing.dumps(
        {"verification_id": str(verification_id)},
        salt="agenda.verificacion-email-reserva",
    )


def unsign_email_verification(token, max_age=30 * 60):
    return signing.loads(
        token,
        salt="agenda.verificacion-email-reserva",
        max_age=max_age,
    )
