import serial
import time

def read_sensor(port="/dev/ttyS0"):
    try:
        print(f"📡 Membuka port {port}...")
        ser = serial.Serial(
            port=port,
            baudrate=9600,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            timeout=1
        )

        # Request yang sudah kamu buktikan berhasil
        request = bytearray([0xFF, 0x03, 0x00, 0x09, 0x00, 0x07])  # register 0x09, 7 words
        request += bytearray([0xC1, 0xD4])  # hardcoded CRC dari script kerja kamu

        ser.write(request)
        time.sleep(1)
        response = ser.read(256)
        ser.close()

        if not response or len(response) < 17:
            print("❌ Response kosong atau terlalu pendek:", response)
            return None

        print("✅ Raw response:", response.hex())

        # Parsing sesuai posisi byte seperti yang kamu lakukan
        temp = round(int.from_bytes(response[3:5], byteorder='big') / 100 - 40, 2)
        hum = round(int.from_bytes(response[5:7], byteorder='big') / 100, 2)
        press = round(int.from_bytes(response[7:9], byteorder='big') / 10, 2)
        wspeed = round(int.from_bytes(response[9:11], byteorder='big') / 100, 2)
        wdir = round(int.from_bytes(response[11:13], byteorder='big') / 10, 2)
        rain = round(int.from_bytes(response[13:15], byteorder='big') / 10, 2)
        srad = int.from_bytes(response[15:17], byteorder='big')

        print(f"✅ Parsed values: Temp={temp}, Hum={hum}, Press={press}, WSpeed={wspeed}, WDir={wdir}, Rain={rain}, Srad={srad}")
        return (temp, hum, press, wspeed, wdir, rain, srad)

    except Exception as e:
        print("❌ Exception saat membaca sensor:", e)
        return None
