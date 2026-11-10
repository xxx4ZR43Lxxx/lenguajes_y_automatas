
import yt_dlp
import os

CARPETA = os.path.expanduser("~/Downloads/Videos_YouTube")

os.makedirs(CARPETA, exist_ok=True)

def descargar_video(url):
    opciones = {
        'format': 'bv*+ba/b',
        'merge_output_format': 'mp4',
        'outtmpl': f'{CARPETA}/%(title)s.%(ext)s',
        'noplaylist': True,
    }

    with yt_dlp.YoutubeDL(opciones) as ydl:
        ydl.download([url])

def descargar_audio(url):
    opciones = {
        'format': 'bestaudio/best',
        'outtmpl': f'{CARPETA}/%(title)s.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
    }

    with yt_dlp.YoutubeDL(opciones) as ydl:
        ydl.download([url])

def main():
    print("=" * 40)
    print("       YOUTUBE DOWNLOADER")
    print("=" * 40)

    url = input("\nPega el enlace de YouTube: ")

    print("\n1. Descargar video MP4")
    print("2. Descargar audio MP3")

    opcion = input("\nSelecciona una opción: ")

    try:
        if opcion == "1":
            descargar_video(url)
        elif opcion == "2":
            descargar_audio(url)
        else:
            print("Opción no válida")
            return

        print("\n¡Descarga finalizada!")
        print(f"Ubicación: {CARPETA}")

    except Exception as error:
        print(f"\nError durante la descarga: {error}")

if __name__ == "__main__":
    main()

