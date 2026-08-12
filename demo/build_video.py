"""Render the deterministic two-minute Zoomer demo from captured UI frames."""

from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
AUDIO = ROOT / "audio"
NARRATION = ROOT / "narration"
OVERLAYS = ROOT / "overlays"
RENDER = ROOT / "render"
FONT_REGULAR = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
FONT_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
FPS = 30
SCENE_PADDING_SECONDS = 0.36
NARRATION_DELAY_SECONDS = 0.15


@dataclass(frozen=True)
class Scene:
    number: int
    image: str
    motion: str = "center"

    @property
    def stem(self) -> str:
        return f"{self.number:02d}"


SCENES = (
    Scene(1, "01-intro.png"),
    Scene(2, "02-compare.png", "right"),
    Scene(3, "03-hierarchy.png", "top"),
    Scene(4, "04-mixed-detail.png", "left"),
    Scene(5, "05-question.png", "right"),
    Scene(6, "06-progress.png"),
    Scene(7, "07-extension.png", "right"),
    Scene(8, "08-code.png", "right"),
    Scene(9, "09-closing.png"),
)


def run(*args: str) -> None:
    subprocess.run(args, check=True)


def probe_duration(path: Path) -> float:
    completed = subprocess.run(
        (
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=duration",
            "-of",
            "json",
            str(path),
        ),
        check=True,
        capture_output=True,
        text=True,
    )
    data = json.loads(completed.stdout)
    return float(data["streams"][0]["duration"])


def srt_time(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d},{milliseconds:03d}"


def sentences(text: str) -> list[str]:
    return [
        part.strip()
        for part in re.split(r"(?<=[.!?])\s+", text.strip())
        if part.strip()
    ]


def write_captions(durations: list[float]) -> Path:
    cues: list[str] = []
    cue_number = 1
    scene_start = 0.0
    for scene, duration in zip(SCENES, durations, strict=True):
        text = (NARRATION / f"{scene.stem}.txt").read_text().strip()
        text = text.replace("I D", "ID").replace("U I", "UI")
        parts = sentences(text)
        weights = [len(part.split()) for part in parts]
        speech_duration = duration - SCENE_PADDING_SECONDS
        cursor = scene_start + NARRATION_DELAY_SECONDS
        available = max(speech_duration - NARRATION_DELAY_SECONDS, 0.1)
        for index, (part, weight) in enumerate(zip(parts, weights, strict=True)):
            cue_duration = available * weight / sum(weights)
            end = cursor + cue_duration
            if index == len(parts) - 1:
                end = scene_start + speech_duration
            cues.append(
                f"{cue_number}\n{srt_time(cursor)} --> {srt_time(end)}\n{part}\n"
            )
            cue_number += 1
            cursor = end
        scene_start += duration
    caption_path = RENDER / "zoomer-demo.en.srt"
    caption_path.write_text("\n".join(cues))
    return caption_path


def motion_expression(motion: str) -> tuple[str, str]:
    if motion == "left":
        return ("iw/2-(iw/zoom/2)-8*(zoom-1)/0.025", "ih/2-(ih/zoom/2)")
    if motion == "right":
        return ("iw/2-(iw/zoom/2)+8*(zoom-1)/0.025", "ih/2-(ih/zoom/2)")
    if motion == "top":
        return ("iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)-5*(zoom-1)/0.025")
    return ("iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)")


def render_scene(scene: Scene, duration: float) -> Path:
    frames = round(duration * FPS)
    fade_out_start = max(duration - 0.28, 0.0)
    x_expression, y_expression = motion_expression(scene.motion)
    overlay_path = OVERLAYS / f"{scene.stem}.txt"
    output_path = RENDER / f"scene-{scene.stem}.mp4"
    video_filter = (
        "[0:v]"
        "scale=1920:1080,"
        f"zoompan=z='min(zoom+0.00007,1.025)':x='{x_expression}':y='{y_expression}':"
        f"d={frames}:s=1920x1080:fps={FPS},"
        "drawbox=x=0:y=ih-78:w=iw:h=78:color=0x070a0c@0.90:t=fill,"
        "drawbox=x=0:y=ih-78:w=iw:h=2:color=0x76b900@1:t=fill,"
        f"drawtext=fontfile='{FONT_BOLD}':textfile='{overlay_path}':"
        "fontcolor=white:fontsize=26:x=90:y=main_h-50,"
        "fade=t=in:st=0:d=0.24,"
        f"fade=t=out:st={fade_out_start:.3f}:d=0.28,format=yuv420p[v];"
        f"[1:a]adelay={round(NARRATION_DELAY_SECONDS * 1000)},"
        "loudnorm=I=-16:TP=-2:LRA=7,apad,"
        f"atrim=0:{duration:.6f},"
        "afade=t=in:st=0:d=0.10,"
        f"afade=t=out:st={fade_out_start:.3f}:d=0.25[a]"
    )
    run(
        "ffmpeg",
        "-y",
        "-loop",
        "1",
        "-framerate",
        str(FPS),
        "-i",
        str(ASSETS / scene.image),
        "-i",
        str(AUDIO / f"{scene.stem}.aiff"),
        "-filter_complex",
        video_filter,
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-t",
        f"{duration:.6f}",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-ar",
        "48000",
        "-movflags",
        "+faststart",
        str(output_path),
    )
    return output_path


def main() -> None:
    RENDER.mkdir(exist_ok=True)
    durations = [
        probe_duration(AUDIO / f"{scene.stem}.aiff") + SCENE_PADDING_SECONDS
        for scene in SCENES
    ]
    caption_path = write_captions(durations)
    scene_paths = [
        render_scene(scene, duration)
        for scene, duration in zip(SCENES, durations, strict=True)
    ]
    concat_path = RENDER / "concat.txt"
    concat_path.write_text("".join(f"file '{path.name}'\n" for path in scene_paths))
    joined_path = RENDER / "zoomer-demo-joined.mp4"
    run(
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_path),
        "-c",
        "copy",
        str(joined_path),
    )
    final_path = ROOT / "zoomer-nemo-demo.mp4"
    subtitle_filter = (
        f"subtitles='{caption_path}':"
        "force_style='FontName=Arial,FontSize=10,PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&HCC000000,BorderStyle=3,Outline=1,Shadow=0,"
        "BackColour=&H99000000,MarginV=26,Alignment=2'"
    )
    run(
        "ffmpeg",
        "-y",
        "-i",
        str(joined_path),
        "-i",
        str(caption_path),
        "-vf",
        subtitle_filter,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0",
        "-map",
        "1:0",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-c:a",
        "copy",
        "-c:s",
        "mov_text",
        "-metadata:s:s:0",
        "language=eng",
        "-metadata:s:s:0",
        "title=English",
        "-movflags",
        "+faststart",
        str(final_path),
    )
    print(final_path)


if __name__ == "__main__":
    main()
