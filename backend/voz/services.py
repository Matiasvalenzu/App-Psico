import math
import os
import subprocess
import tempfile
from functools import lru_cache

from django.conf import settings


def _normalize(values):
    vector = [float(value) for value in values]
    norm = math.sqrt(sum(value * value for value in vector))
    if not norm:
        return vector
    return [value / norm for value in vector]


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


def average_embeddings(embeddings):
    valid = [embedding for embedding in embeddings if embedding]
    if not valid:
        return []

    size = min(len(embedding) for embedding in valid)
    averaged = [sum(embedding[index] for embedding in valid) / len(valid) for index in range(size)]
    return _normalize(averaged)


@lru_cache(maxsize=1)
def get_speaker_encoder():
    try:
        from speechbrain.inference.speaker import EncoderClassifier
    except ImportError:
        from speechbrain.pretrained import EncoderClassifier

    os.makedirs(settings.SPEAKER_EMBEDDING_CACHE_DIR, exist_ok=True)
    return EncoderClassifier.from_hparams(
        source=settings.SPEAKER_EMBEDDING_MODEL,
        savedir=settings.SPEAKER_EMBEDDING_CACHE_DIR,
        run_opts={"device": settings.SPEAKER_EMBEDDING_DEVICE},
    )


def decode_audio_mono(audio_path, start_second=None, end_second=None, sample_rate=16000):
    import numpy as np

    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
    ]
    if start_second is not None:
        command.extend(["-ss", str(float(start_second))])

    command.extend(["-i", audio_path])

    if start_second is not None and end_second is not None:
        command.extend(["-t", str(max(float(end_second) - float(start_second), 0.1))])

    command.extend(
        [
            "-ac",
            "1",
            "-ar",
            str(sample_rate),
            "-f",
            "s16le",
            "pipe:1",
        ]
    )

    result = subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    audio = np.frombuffer(result.stdout, dtype=np.int16).astype(np.float32)
    if audio.size == 0:
        return audio, sample_rate
    return audio / 32768.0, sample_rate


def decode_audio_for_pyannote(audio_path):
    import torch

    audio, sample_rate = decode_audio_mono(audio_path)
    waveform = torch.from_numpy(audio).unsqueeze(0)
    return {"waveform": waveform, "sample_rate": sample_rate}


def get_audio_duration_seconds(audio_path):
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        audio_path,
    ]
    result = subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        return float(result.stdout.decode("utf-8").strip() or 0)
    except ValueError:
        return 0.0


def extract_voice_embedding_from_path(audio_path, start_second=None, end_second=None):
    import torch

    y, sample_rate = decode_audio_mono(audio_path, start_second, end_second)
    if y.size < int(sample_rate * settings.SPEAKER_MIN_TURN_SECONDS):
        return []

    classifier = get_speaker_encoder()
    device = torch.device(settings.SPEAKER_EMBEDDING_DEVICE)
    waveform = torch.from_numpy(y).float().unsqueeze(0).to(device)
    wav_lens = torch.ones(waveform.shape[0], device=waveform.device)
    with torch.no_grad():
        embedding = classifier.encode_batch(waveform, wav_lens=wav_lens)
    values = embedding.squeeze().detach().cpu().tolist()
    if isinstance(values, float):
        values = [values]
    return _normalize(values)


def extract_voice_embedding_from_upload(uploaded_file):
    embedding, _duration = extract_voice_embedding_and_duration_from_upload(uploaded_file)
    return embedding


def extract_voice_embedding_and_duration_from_upload(uploaded_file):
    suffix = os.path.splitext(getattr(uploaded_file, "name", "sample.webm"))[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        for chunk in uploaded_file.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        return extract_voice_embedding_from_path(tmp_path), get_audio_duration_seconds(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
