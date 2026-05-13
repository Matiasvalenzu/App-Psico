import math
import os
import subprocess
import tempfile


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


def extract_voice_embedding_from_path(audio_path, start_second=None, end_second=None):
    import numpy as np

    y, sample_rate = decode_audio_mono(audio_path, start_second, end_second)
    if y.size < sample_rate // 4:
        return []

    frame_size = 400
    hop = 160
    if y.size < frame_size:
        y = np.pad(y, (0, frame_size - y.size))

    frames = []
    for start in range(0, max(y.size - frame_size + 1, 1), hop):
        frames.append(y[start : start + frame_size])
    frames = np.array(frames, dtype=np.float32)

    rms = np.sqrt(np.mean(frames * frames, axis=1) + 1e-12)
    zcr = np.mean(np.abs(np.diff(np.signbit(frames), axis=1)), axis=1)

    windowed = y[: min(y.size, sample_rate * 10)]
    spectrum = np.abs(np.fft.rfft(windowed * np.hanning(windowed.size)))
    spectrum = spectrum / (np.sum(spectrum) + 1e-12)
    bands = np.array_split(spectrum, 32)
    band_energy = np.array([band.sum() for band in bands], dtype=np.float32)

    features = np.concatenate(
        [
            np.array(
                [
                    float(np.mean(y)),
                    float(np.std(y)),
                    float(np.sqrt(np.mean(y * y) + 1e-12)),
                    float(np.max(np.abs(y))),
                ],
                dtype=np.float32,
            ),
            np.array(
                [
                    float(np.mean(rms)),
                    float(np.std(rms)),
                    float(np.percentile(rms, 25)),
                    float(np.percentile(rms, 75)),
                ],
                dtype=np.float32,
            ),
            np.array(
                [
                    float(np.mean(zcr)),
                    float(np.std(zcr)),
                    float(np.percentile(zcr, 25)),
                    float(np.percentile(zcr, 75)),
                ],
                dtype=np.float32,
            ),
            band_energy,
        ]
    )
    return _normalize(features.tolist())


def extract_voice_embedding_from_upload(uploaded_file):
    suffix = os.path.splitext(getattr(uploaded_file, "name", "sample.webm"))[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        for chunk in uploaded_file.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        return extract_voice_embedding_from_path(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
