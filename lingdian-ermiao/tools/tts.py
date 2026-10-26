"""Generate one narration line with edge-tts. Usage: tts.py voice rate out.mp3 out.srt "text" """
import asyncio, os, ssl, sys
import edge_tts, edge_tts.communicate as c
if os.environ.get("SSL_CERT_FILE"):  # e.g. behind a TLS-intercepting proxy
    c._SSL_CTX = ssl.create_default_context(cafile=os.environ["SSL_CERT_FILE"])

async def main(voice, rate, out, vtt, text):
    com = edge_tts.Communicate(text, voice, rate=rate, boundary="SentenceBoundary")
    subs = edge_tts.SubMaker()
    with open(out, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] in ("WordBoundary", "SentenceBoundary"):
                subs.feed(ch)
    with open(vtt, "w") as f:
        f.write(subs.get_srt())

asyncio.run(main(*sys.argv[1:6]))
