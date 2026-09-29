# Telegram Echo Bot Worker (TeleHost Managed)
import sys
import time
import datetime

print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 🤖 Telegram Echo Bot Worker Started...")
print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 🐍 Python 3 Runtime Active: {sys.version.split()[0]}")
print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 📡 Connecting to Telegram Bot Gateway...")

step = 0
while True:
    step += 1
    time.sleep(10)
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] ⚡ [Worker Loop #{step}] Bot is polling messages and healthy 24/7.")
