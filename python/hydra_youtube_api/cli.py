# hydra_youtube_api/cli.py
import argparse
import asyncio
import json
import time  # Import the time module
from . import get_data, filter_formats, get_lyrics

async def main():
    parser = argparse.ArgumentParser(description="Fast and simple API for YouTube and YouTube Music.")
    parser.add_argument("video_id", help="YouTube video ID")
    parser.add_argument("--bestaudio", action="store_true", help="Fetch the best audio format")
    parser.add_argument("--bestvideo", action="store_true", help="Fetch the best video format")
    parser.add_argument("--lowestaudio", action="store_true", help="Fetch the lowest quality audio format")
    parser.add_argument("--lowestvideo", action="store_true", help="Fetch the lowest quality video format")
    parser.add_argument("--videoandaudio", action="store_true", help="Fetch a format with both video and audio")
    parser.add_argument("--videoonly", action="store_true", help="Fetch a video-only format")
    parser.add_argument("--audioonly", action="store_true", help="Fetch an audio-only format")
    parser.add_argument("--lyrics", action="store_true", help="Fetch lyrics for the video")
    parser.add_argument("--ms", action="store_true", help="Measure and print the total time taken for the process")
    args = parser.parse_args()

    start_time = time.time()  # Record the start time

    video_id = args.video_id

    data = await get_data(video_id, client_name="ios")

    if args.bestaudio:
        best_audio = filter_formats(data, filter_type="bestaudio")
        if best_audio:
            print("Best Audio Format:")
            print(json.dumps(best_audio, indent=4))
        else:
            print("No audio format found.")

    elif args.bestvideo:
        best_video = filter_formats(data, filter_type="bestvideo")
        if best_video:
            print("Best Video Format:")
            print(json.dumps(best_video, indent=4))
        else:
            print("No video format found.")

    elif args.lowestaudio:
        lowest_audio = filter_formats(data, filter_type="lowestaudio")
        if lowest_audio:
            print("Lowest Audio Format:")
            print(json.dumps(lowest_audio, indent=4))
        else:
            print("No audio format found.")

    elif args.lowestvideo:
        lowest_video = filter_formats(data, filter_type="lowestvideo")
        if lowest_video:
            print("Lowest Video Format:")
            print(json.dumps(lowest_video, indent=4))
        else:
            print("No video format found.")

    elif args.videoandaudio:
        video_and_audio = filter_formats(data, filter_type="videoandaudio")
        if video_and_audio:
            print("Video and Audio Format:")
            print(json.dumps(video_and_audio, indent=4))
        else:
            print("No format with both video and audio found.")

    elif args.videoonly:
        video_only = filter_formats(data, filter_type="videoonly")
        if video_only:
            print("Video-Only Format:")
            print(json.dumps(video_only, indent=4))
        else:
            print("No video-only format found.")

    elif args.audioonly:
        audio_only = filter_formats(data, filter_type="audioonly")
        if audio_only:
            print("Audio-Only Format:")
            print(json.dumps(audio_only, indent=4))
        else:
            print("No audio-only format found.")

    elif args.lyrics:
        lyrics = await get_lyrics(video_id)
        if lyrics:
            print("Lyrics:")
            print(lyrics)
        else:
            print("No lyrics found.")

    else:
        print(json.dumps(data, indent=4))

    if args.ms:
        end_time = time.time()  # Record the end time
        total_time = end_time - start_time  # Calculate the total time taken
        print(f"\nTotal time taken: {total_time:.2f} seconds")  # Print the total time

def cli():
    asyncio.run(main())

if __name__ == "__main__":
    cli()