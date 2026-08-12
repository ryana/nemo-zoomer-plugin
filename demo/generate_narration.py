"""Generate Zoomer demo narration with NVIDIA MagpieTTS on a CUDA host."""

from __future__ import annotations

import argparse
from pathlib import Path

import soundfile as sf
import torch
from nemo.collections.tts.models import MagpieTTSModel

ROOT = Path(__file__).resolve().parent
NARRATION = ROOT / "narration"
AUDIO = ROOT / "audio"
MODEL = "nvidia/magpie_tts_multilingual_357m"
SAMPLE_RATE = 22_050
SCENES = tuple(f"{number:02d}" for number in range(1, 10))
SPEAKERS = {
    "Aria": 0,
    "Jason": 1,
    "John": 2,
    "Leo": 3,
    "Sofia": 4,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--speaker", choices=SPEAKERS, default="Sofia")
    parser.add_argument("--scenes", nargs="+", choices=SCENES, default=SCENES)
    parser.add_argument("--output-dir", type=Path, default=AUDIO)
    return parser.parse_args()


def prepare_for_speech(text: str) -> str:
    """Apply explicit pronunciations while leaving caption text unchanged."""
    return (
        text.replace("—", ", ")
        .replace("’", "'")
        .replace("NeMo", "| ˈ n ɛ m o ʊ |")
        .replace("UI", "U I")
        .replace("ID", "I D")
    )


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    model = MagpieTTSModel.from_pretrained(MODEL).eval().cuda()

    with torch.inference_mode():
        for scene in args.scenes:
            text = (NARRATION / f"{scene}.txt").read_text().strip()
            audio, audio_length = model.do_tts(
                prepare_for_speech(text),
                language="en",
                apply_TN=False,
                speaker_index=SPEAKERS[args.speaker],
            )
            sample_count = int(audio_length.reshape(-1)[0].item())
            samples = audio.reshape(-1)[:sample_count].detach().cpu().numpy()
            output_path = args.output_dir / f"{scene}.wav"
            sf.write(output_path, samples, SAMPLE_RATE, subtype="PCM_16")
            print(f"generated {output_path} with {MODEL}/{args.speaker}")


if __name__ == "__main__":
    main()
