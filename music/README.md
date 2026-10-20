# Napster music library

Add audio files you have permission to publish here, then add entries to
`library.json`. Paths are relative to the website root, not this directory.

```json
[
  {
    "title": "Track title",
    "artist": "Artist name",
    "src": "music/track.mp3",
    "source": "https://soundcloud.com/artist/track"
  }
]
```

`source` is an optional artist/track credit link. It is not a streaming source.
Use creator-provided downloads or files the creator has authorized for hosting.
SoundCloud page links cannot be used as audio files. No SoundCloud widget,
account, API key, advertising, or analytics is loaded by this player.

The Open files button adds files to that visitor's current browser session only;
it does not upload or publish them. Liked track IDs are saved in that browser.
The shared library is empty until actual authorized tracks are added. No demo
music is published. Browser-supported formats include MP3, WAV, and Ogg; support
for other formats varies by browser. Waveforms are decoded from the selected
audio file (up to 32 MB) when possible; playback still works without a waveform.
