import hashlib
import math
import re
from functools import lru_cache

from django.conf import settings

TOKEN_RE = re.compile(r"[\wáéíóúñü]+", re.IGNORECASE)


@lru_cache(maxsize=1)
def _load_sentence_transformer():
    if not settings.EMBEDDING_USE_MODEL:
        return None

    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(settings.EMBEDDING_MODEL)
    except Exception:
        return None


def normalize_embedding(values, dimensions=None):
    dimensions = dimensions or settings.EMBEDDING_DIMENSIONS
    vector = [float(value) for value in values[:dimensions]]
    if len(vector) < dimensions:
        vector.extend([0.0] * (dimensions - len(vector)))

    norm = math.sqrt(sum(value * value for value in vector))
    if not norm:
        return vector
    return [value / norm for value in vector]


def deterministic_text_embedding(text, dimensions=None):
    dimensions = dimensions or settings.EMBEDDING_DIMENSIONS
    vector = [0.0] * dimensions
    tokens = TOKEN_RE.findall((text or "").lower())

    for token in tokens:
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign

    return normalize_embedding(vector, dimensions)


def generate_text_embedding(text):
    model = _load_sentence_transformer()
    if model is not None:
        try:
            values = model.encode(text or "", normalize_embeddings=True).tolist()
            return normalize_embedding(values)
        except Exception:
            pass

    return deterministic_text_embedding(text)


def cosine_similarity(left, right):
    if not left or not right:
        return 0.0

    size = min(len(left), len(right))
    if size == 0:
        return 0.0

    left_norm = math.sqrt(sum(float(value) * float(value) for value in left[:size]))
    right_norm = math.sqrt(sum(float(value) * float(value) for value in right[:size]))
    if not left_norm or not right_norm:
        return 0.0

    dot = sum(float(left[index]) * float(right[index]) for index in range(size))
    return dot / (left_norm * right_norm)
