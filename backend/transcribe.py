from pathlib import Path
import subprocess
import sys

# Resolve the whisper binary/model via the platform-aware helper so we have a
# single source of truth. On Windows (MSVC) the binary lives at
# whisper.cpp/build/bin/Release/whisper-cli.exe, not build/bin/whisper-cli.
from whisper_utils import get_whisper_binary, get_model_path

def transcribe_audio(audio_path: str) -> str:
    # Convert string path to Path object
    audio_path = Path(audio_path)

    assert audio_path.exists(), f"File not found: {audio_path}"

    whisper_binary = get_whisper_binary()  # platform-aware; builds if missing
    model_path = get_model_path()

    result = subprocess.run([
        whisper_binary,
        "-m", model_path,
        "-f", str(audio_path)
    ], capture_output=True, text=True)

    if result.returncode != 0:
        print("Whisper failed:")
        print(result.stderr)
        return ""

    return result.stdout

# --- CLI usage ---
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py path/to/audio.wav")
        sys.exit(1)

    audio_file = Path(sys.argv[1])
    output = transcribe_audio(audio_file)
    print("\n TRANSCRIPTION RESULT:")
    print(output)

