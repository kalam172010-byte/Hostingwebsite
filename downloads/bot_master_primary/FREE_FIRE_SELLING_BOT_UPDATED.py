import asyncio
import os
import sqlite3
import random
import logging
import time
import urllib.request
import urllib.error
import hmac
import hashlib
import urllib.parse
import json
import html
from io import BytesIO

# --- ADDITIONAL IMPORTS FOR LOCAL QR GENERATION ---
# These are necessary if the bot is intended to generate QR codes locally
# when the new FamGateway is not configured and the legacy FamPay fallback is used.
# The original code's `generate_upi_qr_file` function raised RuntimeError,
# indicating missing implementation or implicit dependency on these libraries.
try:
    import qrcode
    # Pillow is often a dependency of qrcode for image generation
    # It might be implicitly pulled, but explicitly listing it helps clarify.
    # qrcode.make_image uses PIL if available. No direct PIL import is typically needed.
    _QRCODE_AVAILABLE = True
except ImportError:
    _QRCODE_AVAILABLE = False
    logging.warning("Optional: 'qrcode' library not found. Local QR code generation will be disabled. "
                    "Ensure 'qrcode' and its dependencies (like 'Pillow') are installed if needed.")

from datetime import datetime, timedelta
from typing import Optional, List, Tuple, Dict, Any


async def http_request(method: str, url: str, headers: Optional[Dict[str, str]] = None, data: Optional[bytes] = None, timeout: int = 20):
    """Small stdlib-only async HTTP helper with standard browser User-Agent."""
    default_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
    }
    all_headers = {**default_headers, **(headers or {})}
    def _request():
        req = urllib.request.Request(url, data=data, headers=all_headers, method=method.upper())
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status, resp.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()
        except Exception as e:
            return 500, str(e).encode('utf-8')
    try:
        return await asyncio.to_thread(_request)
    except Exception as e:
        return 500, str(e).encode('utf-8')

# Hosted-runner dependency bootstrap: install aiogram automatically if the host did not preinstall it.
try:
    import aiogram  # type: ignore
except ModuleNotFoundError:
    try:
        import subprocess, sys
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "--no-cache-dir", "aiogram>=3.20,<4"])
    except Exception:
        pass
    import aiogram  # type: ignore

from aiogram import Bot, Dispatcher, F, BaseMiddleware
from aiogram.client.default import DefaultBotProperties
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import StatesGroup, State
from aiogram.types import (
    ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove,
    InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery, Message, Dice, BufferedInputFile
)

# ==============================================================================
# 1. BOT CONFIGURATION & CONSTANTS (Configurable via Environment Variables or Admin Panel)
# ==============================================================================
BOT_TOKEN = os.getenv("BOT_TOKEN", "8632912098:AAENMDr-tkYBDsgl5MkA8SAt_3qOgnpL8j8")
BOT_USERNAME = os.getenv("BOT_USERNAME", "@AKASHFFPANEL11BOT")
ADMIN_ID = int(os.getenv("ADMIN_ID", "8808556338"))
ADMIN_CONTACT = os.getenv("ADMIN_CONTACT", "@Akash_12121")

FAMPAY_API_KEY = os.getenv("FAMPAY_API_KEY", "fam_a9527c6c2dd4d26ad5223cfc3c4c5fa9289b574e")
FAMPAY_UPI_ID = os.getenv("FAMPAY_UPI_ID", "")
FAMPAY_QR_URL = os.getenv("FAMPAY_QR_URL", "https://fampay.anujbots.xyz/qr.php")
FAMPAY_VERIFY_URL = os.getenv("FAMPAY_VERIFY_URL", "https://fampay.anujbots.xyz/verify.php")

# External API defaults (credentials can be set via ENV or in SQLite settings table)
RESELLER_API_URL = os.getenv("RESELLER_API_URL", "https://bantibhaiya.to/api/reseller_v1.php")
RESELLER_API_KEY = os.getenv("RESELLER_API_KEY", "")
RESELLER_MASTER_KEY = os.getenv("RESELLER_MASTER_KEY", "")

PAYMENT_GATEWAY_URL = os.getenv("PAYMENT_GATEWAY_URL", "https://famgateway.in/api/create-order")
PAYMENT_GATEWAY_TOKEN = os.getenv("PAYMENT_GATEWAY_TOKEN", "")
PAYMENT_REDIRECT_URL = os.getenv("PAYMENT_REDIRECT_URL", "")

USDT_TO_INR = float(os.getenv("USDT_TO_INR", "90.0"))
VIP_DISCOUNT_PERCENTAGE = float(os.getenv("VIP_DISCOUNT_PERCENTAGE", "10.0"))
VIP_PRICE_INR = float(os.getenv("VIP_PRICE_INR", "1000.0"))

WELCOME_STICKER_ID = os.getenv("WELCOME_STICKER_ID", "CAACAgIAAxkBAAEU-WZmH_...")

FIXED_CATEGORIES = [
    "ANDROID NON ROOT PANEL",
    "ANDROID ROOT PANEL",
    "PC PANEL"
]

# ==============================================================================
# YOUR PREMIUM EMOJIS – all required emoji IDs (updated with new premium ones)
# ==============================================================================
DEFAULT_EMOJIS = {
    'product_store': '6163205892834598715',
    'profile': '5258011929993026890',
    'add_balance': '5985630530111020079',
    'history': '6032594876506312598',
    'support': '5967280668885913944',
    'back': '5877536313623711363',
    'upi': '5807750375033278838',
    'reseller': '5886505193180239900',
    'tutorial': '6005986106703613755',
    'telegram': '5875465628285931233',
    'whatsapp': '5954224165874569584',
    'welcome': '5994502837327892086',
    'vip': '5206607081334906820',
    'category_android_non_root': '6161172706856282588',
    'category_android_root': '6161449831031118974',
    'category_pc': '5350554349074391003',
    'grid_id': '5474625972751837256',
    'name': '5215399540814781035',
    'account_level': '6129584162992034014',
    'regular_user': '5904630315946611415',
    'wallet': '6210859306602995217',
    'current_balance': '5316711376876485361',
    'global_stats': '6161437856662298090',
    'total_orders': '6160968017304888311',
    'total_spent': '5197503331215361533',
    'joined_grid': '5433614043006903194',
    'info_icon': '6037421444789440735',
    'check_icon': '6161241250239356403',
    'checkbox_icon': '6161437856662298090',
    'shield_icon': '6086672466132865380',
    'money_icon': '5890848474563352982',
    'redeem_icon': '5377624166436445368',
    'wallet_left': '6210859306602995217',
    'wallet_right': '5305699699204837855',
    'point_down': '6161302621027049305',
}

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("bot_activity.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode="HTML"))
dp = Dispatcher()

def fmt_curr(amount: Any) -> str:
    val = safe_float(amount, 0.0)
    return f"₹{val:,.2f}"

def safe_float(val, default=0.0):
    """Safely convert a value to float, return default if fails."""
    if val is None or val == "":
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def format_timestamp(ts: Any) -> str:
    """Safely format timestamp (epoch seconds/milliseconds or date string) into clean readable date."""
    if not ts:
        return "N/A"
    try:
        if isinstance(ts, (int, float)):
            val = float(ts)
            if val > 1e11:
                val /= 1000
            return datetime.fromtimestamp(val).strftime("%d-%m-%Y %H:%M")
        if isinstance(ts, str):
            clean_ts = ts.strip()
            if clean_ts.isdigit():
                val = float(clean_ts)
                if val > 1e11:
                    val /= 1000
                return datetime.fromtimestamp(val).strftime("%d-%m-%Y %H:%M")
            return clean_ts
    except Exception:
        pass
    return str(ts)

# ==============================================================================
# 2. DATABASE FUNCTIONS
# ==============================================================================
def db_query(query: str, params: tuple = (), fetchone: bool = False, fetchall: bool = False, commit: bool = True) -> Any:
    conn = sqlite3.connect('Cuibcc.db', timeout=30.0)
    c = conn.cursor()
    try:
        c.execute("PRAGMA journal_mode=WAL;")
        c.execute("PRAGMA busy_timeout=5000;")
        c.execute(query, params)
        if fetchone:
            res = c.fetchone()
        elif fetchall:
            res = c.fetchall()
        else:
            res = None
        if commit: conn.commit()
        return res
    except Exception as e:
        logger.error(f"DB Error: {e} | Query: {query} | Params: {params}")
        if commit: conn.rollback()
        return None
    finally:
        conn.close()

def is_admin_user(user_id: int) -> bool:
    if user_id == ADMIN_ID:
        return True
    row = db_query("SELECT is_admin FROM users WHERE user_id = ?", (user_id,), fetchone=True)
    return bool(row and row[0] == 1)

def get_setting(key: str, default: str = "") -> str:
    val = db_query("SELECT value FROM settings WHERE key=?", (key,), fetchone=True)
    return val[0] if val and val[0] else default

def set_setting(key: str, value: str) -> None:
    db_query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))

def log_activity(user_id: int, action: str, details: str = "") -> None:
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        db_query(
            "INSERT INTO activity_logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)",
            (user_id, action, details, timestamp)
        )
    except Exception as e:
        logger.error(f"Failed to log activity: {e}")

def get_emoji(slot: str, default_id: str = None) -> str:
    stored = get_setting(f"emoji_{slot}", "")
    emoji_id = stored if stored and stored.isdigit() else (default_id or DEFAULT_EMOJIS.get(slot, ""))
    if emoji_id:
        return f'<tg-emoji emoji-id="{emoji_id}">✨</tg-emoji>'
    return "✨"

def get_emoji_icon(slot: str, default_id: str = None) -> str:
    stored = get_setting(f"emoji_{slot}", "")
    emoji_id = stored if stored and stored.isdigit() else (default_id or DEFAULT_EMOJIS.get(slot, ""))
    return emoji_id

# ==============================================================================
# 3. STRING RESOURCES – using placeholders for premium emojis
# ==============================================================================
UI_TEXTS = {
    "start_menu": (
        "✨ <b>KALAM FF PANEL?</b>\n\n"
        "{product_store} 𝗣𝗥𝗢𝗗𝗨𝗖𝗧 𝗦𝘁𝗼𝗿𝗲 : 𝗮𝗹𝗹 𝗸𝗲𝘆𝘀 𝗣𝘂𝗿𝗰𝗵𝗮𝘀𝗲  & 𝗶𝗻𝘀𝘁𝗮𝗻𝘁𝗹𝘆 𝗱𝗲𝗹𝗶𝘃𝗲𝗿𝘆\n"
        "{profile} 𝗠𝘆 𝗽𝗿𝗼𝗳𝗶𝗹𝗲 : 𝗰𝗵𝗲𝗰𝗸 𝘆𝗼𝘂𝗿 𝗮𝗰𝗰𝗼𝘂𝗻𝘁 𝗶𝗻𝗳𝗼𝗿𝗺𝗮𝘁𝗶𝗼𝗻\n"
        "{add_balance} 𝗔𝗱𝗱 𝗯𝗮𝗹𝗮𝗻𝗰𝗲 : 𝗱𝗲𝗽𝗼𝘀𝗶𝘁𝗲 𝗯𝗮𝗹𝗮𝗻𝗰𝗲 & 𝘀𝗲𝗰𝘂𝗿𝗲 𝘀𝗲𝗿𝘃𝗶𝗰𝗲\n"
        "{history} 𝗔𝗹𝗹 𝗵𝗶𝘀𝘁𝗼𝗿𝘆 : 𝗰𝗵𝗲𝗰𝗸 𝗮𝗹𝗹 𝗽𝘂𝗿𝗰𝗵𝗮𝘀𝗲 𝗵𝗶𝘀𝘁𝗼𝗿𝘆\n"
        "{tutorial} 𝗧𝘂𝘁𝗼𝗿𝗶𝗮𝗹 : 𝘃𝗶𝗲𝘄 𝘁𝘂𝘁𝗼𝗿𝗶𝗮𝗹 & 𝘄𝗼𝗿𝗸 𝘁𝗵𝗶𝘀 𝗯𝗼𝘁\n"
        "{support} 𝗦𝘂𝗽𝗽𝗼𝗿𝘁 : 𝗯𝗼𝘁 𝗽𝗿𝗼𝗯𝗹𝗲𝗺 𝘀𝗼𝗹𝘃𝗲𝗱 𝗳𝗼𝗿 𝘀𝘂𝗽𝗽𝗼𝗿𝘁 𝗮𝗱𝗺𝗶𝗻\n"
    ),
    "vip_menu": (
        "🌟 <b><u>VIP MEMBERSHIP CLUB</u></b> 🌟\n\n"
        "Unlock premium benefits and permanent discounts!\n\n"
        "💎 <b>VIP Benefits:</b>\n"
        "• Flat 15% off on ALL products (Stacks with Reseller!)\n"
        "• Priority Support\n"
        "• Exclusive VIP-only giveaways\n\n"
        "💳 <b>VIP Price:</b> ₹299.00 (Lifetime)\n"
        "👤 <b>Your Status:</b> {vip_status}"
    ),
    "add_balance_menu": (
        "{add_balance} <b>ADD BALANCE</b> {info_icon}\n\n"
        "{info_icon} Select your preferred payment method. {check_icon}\n\n"
        "┣ {upi} UPI — Fast Indian payments {checkbox_icon}\n"
        ""
        "{shield_icon} Payments are verified securely. {check_icon}"
    )
}

def get_ui_text(key: str, **kwargs) -> str:
    val = db_query("SELECT value FROM settings WHERE key=?", (f"ui_{key}",), fetchone=True)
    template = val[0] if val and val[0] else UI_TEXTS.get(key, "")

    emoji_map = {
        '{product_store}': get_emoji('product_store'),
        '{profile}': get_emoji('profile'),
        '{add_balance}': get_emoji('add_balance'),
        '{history}': get_emoji('history'),
        '{tutorial}': get_emoji('tutorial'),
        '{support}': get_emoji('support'),
        '{telegram}': get_emoji('telegram'),
        '{whatsapp}': get_emoji('whatsapp'),
        '{upi}': get_emoji('upi'),
        '{binance}': get_emoji('binance'),
        '{info_icon}': get_emoji('info_icon'),
        '{check_icon}': get_emoji('check_icon'),
        '{checkbox_icon}': get_emoji('checkbox_icon'),
        '{shield_icon}': get_emoji('shield_icon'),
        '{money_icon}': get_emoji('money_icon'),
        '{redeem_icon}': get_emoji('redeem_icon'),
        '{wallet_left}': get_emoji('wallet_left'),
        '{wallet_right}': get_emoji('wallet_right'),
        '{point_down}': get_emoji('point_down'),
    }
    for placeholder, emoji_tag in emoji_map.items():
        template = template.replace(placeholder, emoji_tag)

    if kwargs:
        try:
            return template.format(**kwargs)
        except KeyError as e:
            logger.warning(f"Missing formatting key for template {key}: {e}")
    return template

# ==============================================================================
# 4. DATABASE INITIALISATION & MIGRATION
# ==============================================================================
def init_db() -> None:
    conn = sqlite3.connect('Cuibcc.db', timeout=30.0)
    c = conn.cursor()
    c.execute("PRAGMA journal_mode=WAL;")
    c.execute("PRAGMA busy_timeout=5000;")
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY, 
            phone TEXT, 
            first_name TEXT, 
            username TEXT,
            balance REAL DEFAULT 0.0, 
            account_type TEXT DEFAULT 'Regular', 
            orders_count INTEGER DEFAULT 0, 
            spent REAL DEFAULT 0.0, 
            last_spin TEXT, 
            joined_date TEXT,
            is_reseller INTEGER DEFAULT 0,
            reseller_since TEXT,
            total_saved REAL DEFAULT 0.0,
            is_banned INTEGER DEFAULT 0,
            warnings INTEGER DEFAULT 0,
            is_vip INTEGER DEFAULT 0,
            vip_since TEXT
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            category TEXT, 
            panel_name TEXT DEFAULT '',
            name TEXT, 
            price_inr REAL, 
            reseller_price REAL DEFAULT 0.0,
            stock INTEGER, 
            apk_link TEXT, 
            validity TEXT DEFAULT 'Lifetime', 
            device_limit TEXT DEFAULT '1 Device',
            bantibhaiya_product_pid TEXT DEFAULT '',
            bantibhaiya_product_duration TEXT DEFAULT '',
            is_active INTEGER DEFAULT 1
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS product_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            product_id INTEGER, 
            key_text TEXT, 
            is_used INTEGER DEFAULT 0
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            user_id INTEGER, 
            product_name TEXT, 
            price_paid REAL, 
            delivered_key TEXT, 
            purchase_date TEXT
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            user_id INTEGER, 
            message TEXT, 
            status TEXT DEFAULT 'Open',
            created_at TEXT
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY, 
            value TEXT
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS coupons (
            code TEXT PRIMARY KEY, 
            amount REAL, 
            uses_left INTEGER
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS redeemed (
            user_id INTEGER, 
            code TEXT
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            order_id TEXT PRIMARY KEY, 
            user_id INTEGER, 
            amount_inr REAL, 
            status TEXT, 
            timestamp INTEGER,
            qr_url TEXT,
            upi_id TEXT,
            expires_at INTEGER
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS crypto_txns (
            txid TEXT PRIMARY KEY, 
            user_id INTEGER, 
            amount_usdt REAL, 
            timestamp INTEGER
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS spin_rewards (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            amount REAL
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT,
            details TEXT,
            timestamp TEXT
        )
    ''')

    migrations = [
        "ALTER TABLE users ADD COLUMN is_vip INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN vip_since TEXT",
        "ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0",
        "ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1",
        "ALTER TABLE products ADD COLUMN is_maintenance INTEGER DEFAULT 0",
        "ALTER TABLE tickets ADD COLUMN created_at TEXT",
        "ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN warnings INTEGER DEFAULT 0",
        "ALTER TABLE products ADD COLUMN panel_name TEXT DEFAULT ''",
        "ALTER TABLE products ADD COLUMN bantibhaiya_product_pid TEXT DEFAULT ''",
        "ALTER TABLE products ADD COLUMN bantibhaiya_product_duration TEXT DEFAULT ''",
        "ALTER TABLE transactions ADD COLUMN qr_url TEXT",
        "ALTER TABLE transactions ADD COLUMN upi_id TEXT",
        "ALTER TABLE transactions ADD COLUMN expires_at INTEGER",
        "ALTER TABLE users ADD COLUMN referred_by INTEGER",
        "ALTER TABLE users ADD COLUMN referrals_count INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN total_referral_earnings REAL DEFAULT 0.0",
        "ALTER TABLE users ADD COLUMN referral_reward_claimed INTEGER DEFAULT 0"
    ]
    for mig in migrations:
        try: c.execute(mig)
        except sqlite3.OperationalError: pass
    

    default_settings = [
        ('reseller_system_status', 'ON'),
        ('bot_status', 'ON'),
        ('how_to_video', 'None'),
        ('fampay_api_key', FAMPAY_API_KEY),
        ('fampay_upi_id', FAMPAY_UPI_ID),
        ('fampay_qr_url', FAMPAY_QR_URL),
        ('fampay_verify_url', FAMPAY_VERIFY_URL),
        ('reseller_api_url', RESELLER_API_URL),
        ('reseller_api_key', RESELLER_API_KEY),
        ('reseller_master_key', RESELLER_MASTER_KEY),
        ('payment_gateway_url', PAYMENT_GATEWAY_URL),
        ('payment_gateway_token', PAYMENT_GATEWAY_TOKEN),
        ('payment_redirect_url', PAYMENT_REDIRECT_URL),
        ('binance_api', ''),
        ('binance_secret', ''),
        ('binance_address', ''),
        ('vip_status', 'OFF'),
        ('reseller_setup_fee', '200.0'),
        ('reseller_min_balance', '500.0'),
        ('migration_done', '0'),
        ('support_telegram', 'https://t.me/YourSupport'),
        ('support_whatsapp', 'https://wa.me/YourNumber'),
        ('ui_start_menu', UI_TEXTS['start_menu']),
        ('ui_vip_menu', UI_TEXTS['vip_menu']),
        ('ui_add_balance_menu', UI_TEXTS['add_balance_menu']),
    ]
    for slot, emoji_id in DEFAULT_EMOJIS.items():
        default_settings.append((f"emoji_{slot}", emoji_id))
    
    for key, val in default_settings:
        c.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (key, val))

    conn.commit()
    conn.close()


    # Removed feature settings are intentionally ignored by the UI.
    # Their old database values may remain, but no button or handler exposes them.

def migrate_categories() -> None:
    done = get_setting("migration_done", "0")
    
    # ALWAYS force update emojis and UI texts regardless of migration status
    logger.info("Forcing emoji and UI text updates...")
    
    # Remove legacy Ludo Spin / Download Files settings from existing databases
    db_query("DELETE FROM settings WHERE key IN ('emoji_ludo_spin', 'emoji_download', 'ui_download_files', 'ui_lucky_dice_result', 'all_files_link', 'spin_status', 'daily_spin_limit', 'emoji_referral')")

    # Update all emoji settings
    for slot, emoji_id in DEFAULT_EMOJIS.items():
        set_setting(f"emoji_{slot}", emoji_id)
    
    # Force update UI texts
    set_setting("ui_start_menu", UI_TEXTS['start_menu'])
    set_setting("ui_add_balance_menu", UI_TEXTS['add_balance_menu'])
    set_setting("ui_vip_menu", UI_TEXTS['vip_menu'])
    logger.info("UI texts and emojis updated with new placeholders and IDs.")
    
    # Fix any corrupted price columns (one-time cleanup)
    conn = sqlite3.connect('Cuibcc.db')
    c = conn.cursor()
    products = c.execute("SELECT id, price_inr, reseller_price FROM products").fetchall()
    for prod in products:
        pid = prod[0]
        for col in ['price_inr', 'reseller_price']:
            val = prod[1] if col == 'price_inr' else prod[2]
            if val is None or val == "":
                new_val = 0.0
            else:
                try:
                    new_val = float(val)
                except (ValueError, TypeError):
                    new_val = 0.0
            c.execute(f"UPDATE products SET {col}=? WHERE id=?", (new_val, pid))
    conn.commit()
    conn.close()
    logger.info("Fixed any non-numeric price columns.")
    
    if done == "1":
        return
    
    logger.info("Running category migration...")
    
    mapping = {
        "android non root panel": "ANDROID NON ROOT PANEL",
        "android root panel": "ANDROID ROOT PANEL",
        "pc panel": "PC PANEL",
    }
    for old, new in mapping.items():
        db_query("UPDATE products SET category = ? WHERE LOWER(category) = ?", (new, old))
    
    db_query("UPDATE products SET category = 'ANDROID NON ROOT PANEL' WHERE LOWER(category) NOT IN (?, ?, ?)",
             ("android non root panel", "android root panel", "pc panel"))
    
    set_setting("migration_done", "1")
    logger.info("Category migration complete.")

# ==============================================================================
# 5. MIDDLEWARES & SECURITY
# ==============================================================================
async def hacker_loading(message: Message, text: str = "Decrypting Data") -> Message:
    msg = await message.answer(f"⚡ {text}\n[□□□] 0%")
    await asyncio.sleep(0.3)
    await msg.edit_text(f"⚡ {text}\n[■□□] 33%", parse_mode='HTML')
    await asyncio.sleep(0.3)
    await msg.edit_text(f"⚡ {text}\n[■■□] 66%", parse_mode='HTML')
    await asyncio.sleep(0.3)
    await msg.edit_text(f"⚡ {text}\n[■■■] 100%", parse_mode='HTML')
    return msg

class GlobalSecurityMiddleware(BaseMiddleware):
    def __init__(self):
        super().__init__()
        self.last_action_times = {}

    async def __call__(self, handler, event, data):
        user_id = event.from_user.id
        now = time.time()
        if user_id in self.last_action_times:
            if now - self.last_action_times[user_id] < 0.3:
                return
        self.last_action_times[user_id] = now

        if user_id != ADMIN_ID:
            user_info = db_query("SELECT is_banned FROM users WHERE user_id=?", (user_id,), fetchone=True)
            if user_info and user_info[0] == 1:
                msg = "🚫 <b>ACCESS DENIED</b>\nYou have been banned from using this bot.\nContact support if you think this is a mistake."
                if isinstance(event, Message): await event.answer(msg)
                elif isinstance(event, CallbackQuery): await event.answer(msg, show_alert=True)
                return
                
            status_check = db_query("SELECT value FROM settings WHERE key='bot_status'", fetchone=True)
            status = status_check[0] if status_check else 'ON'
            if status == 'OFF':
                msg = "⚠️ <b>Store Maintenance</b>\n\nThe store is currently offline for updates. Please check back later!"
                if isinstance(event, Message): await event.answer(msg)
                elif isinstance(event, CallbackQuery): await event.answer("⚠️ Bot is currently OFF for Maintenance.", show_alert=True)
                return
                
        return await handler(event, data)

dp.message.middleware(GlobalSecurityMiddleware())
dp.callback_query.middleware(GlobalSecurityMiddleware())

# ==============================================================================
# 6. FSM STATES
# ==============================================================================
class UserStates(StatesGroup):
    wait_for_ticket = State()
    wait_for_redeem = State()
    wait_for_crypto_txid = State()
    custom_amount_input = State()

class AdminStates(StatesGroup):
    add_prod_category = State()
    add_prod_name = State()
    add_prod_pid = State()
    
    add_plan_days = State()
    add_plan_user_price = State()
    add_plan_reseller_price = State()
    add_plan_api_duration = State()
    
    edit_prod_field = State()
    wait_for_new_value = State()
    
    broadcast_msg = State()
    add_coupon_code = State()
    add_coupon_amount = State()
    add_coupon_uses = State()
    
    # FamPay states
    wait_for_fampay_api = State()
    wait_for_fampay_upi = State()

    # External API configuration
    wait_for_reseller_api_url = State()
    wait_for_reseller_api_key = State()
    wait_for_reseller_master_key = State()
    wait_for_gateway_api_url = State()
    wait_for_gateway_token = State()
    wait_for_gateway_redirect = State()
    
    # Binance states
    wait_for_binance_api = State()
    wait_for_binance_secret = State()
    wait_for_binance_address = State()
    
    ticket_reply_msg = State()
    reseller_manage_id = State()
    manage_target_user = State()
    wait_for_add_money = State()
    wait_for_minus_money = State()
    wait_for_warning = State()
    
    wait_for_howto_video = State()
    
    edit_ui_text = State()
    edit_reseller_price = State()
    wait_for_reseller_setup_fee = State()
    wait_for_reseller_min_balance = State()
    confirm_ban = State()
    
    wait_for_support_telegram = State()
    wait_for_support_whatsapp = State()
    wait_for_category_emoji = State()
    wait_for_panel_emoji_id = State()
    wait_for_emoji_slot = State()

# ==============================================================================
# 7. KEYBOARDS
# ==============================================================================
def get_category_emoji(category: str) -> str:
    # First, check if a specific emoji ID is set by admin for this exact category name
    custom_cat_emoji_id = get_setting(f"cat_emoji_{category}", "")
    if custom_cat_emoji_id.isdigit():
        return custom_cat_emoji_id # Return the custom emoji ID if set and valid

    # If no custom emoji, fall back to the generic slot name defined in DEFAULT_EMOJIS
    # and then check global emoji settings (emoji_{slot}) or the hardcoded default.
    slot_map = {
        "ANDROID NON ROOT PANEL": "category_android_non_root",
        "ANDROID ROOT PANEL": "category_android_root",
        "PC PANEL": "category_pc",
    }
    slot = slot_map.get(category)
    if slot:
        return get_emoji_icon(slot) # get_emoji_icon handles fallback from settings 'emoji_{slot}' to DEFAULT_EMOJIS
    return "" # No specific emoji or fallback found

def get_panel_emoji(panel_name: str) -> str:
    # Check if a specific emoji is set for this exact panel name
    stored = get_setting(f"panel_emoji_{panel_name}", "")
    if stored and stored.isdigit():
        return stored
    # Fallback to the generic 'product_store' emoji if no specific panel emoji
    return get_emoji_icon("product_store")

def contact_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 Verify Contact", request_contact=True)]], 
        resize_keyboard=True, 
        one_time_keyboard=True
    )

def main_menu_kb(user_id: Optional[int] = None) -> InlineKeyboardMarkup:
    status_check = db_query("SELECT value FROM settings WHERE key='reseller_system_status'", fetchone=True)
    sys_status = status_check[0] if status_check else 'ON'
    vip_sys_check = db_query("SELECT value FROM settings WHERE key='vip_status'", fetchone=True)
    vip_system = vip_sys_check[0] if vip_sys_check else 'OFF'
    
    is_reseller = False
    if user_id:
        user_check = db_query("SELECT is_reseller FROM users WHERE user_id=?", (user_id,), fetchone=True)
        if user_check:
            is_reseller = bool(user_check[0])

    kb = InlineKeyboardMarkup(inline_keyboard=[])
    
    kb.inline_keyboard.append([
        InlineKeyboardButton(
            text="Product Store", callback_data="menu_shop",
            icon_custom_emoji_id=get_emoji_icon("product_store"),
            style="danger"
        )
    ])
    kb.inline_keyboard.append([
        InlineKeyboardButton(
            text="My Profile", callback_data="menu_profile",
            icon_custom_emoji_id=get_emoji_icon("profile"),
            style="primary"
        ),
        InlineKeyboardButton(
            text="Add Balance", callback_data="menu_add_balance",
            icon_custom_emoji_id=get_emoji_icon("add_balance"),
            style="primary"
        )
    ])
    kb.inline_keyboard.append([
        InlineKeyboardButton(
            text="All History", callback_data="menu_orders",
            icon_custom_emoji_id=get_emoji_icon("history"),
            style="primary"
        ),
        InlineKeyboardButton(
            text="🎁 Refer & Earn", callback_data="menu_referral",
            style="success"
        )
    ])
    kb.inline_keyboard.append([
        InlineKeyboardButton(
            text="Tutorials", callback_data="menu_how_to",
            icon_custom_emoji_id=get_emoji_icon("tutorial"),
            style="success"
        ),
        InlineKeyboardButton(
            text="Support", callback_data="menu_support",
            icon_custom_emoji_id=get_emoji_icon("support"),
            style="danger"
        )
    ])
    
    extras_row = []
    if sys_status == 'ON' or is_reseller:
        extras_row.append(InlineKeyboardButton(
            text="Reseller Panel", callback_data="menu_reseller_dash",
            icon_custom_emoji_id=get_emoji_icon("reseller"),
            style="primary"
        ))
    if vip_system == 'ON':
        extras_row.append(InlineKeyboardButton(
            text="VIP Club", callback_data="menu_vip_dash",
            style="danger"
        ))
    if extras_row:
        kb.inline_keyboard.append(extras_row)
        
    return kb

def back_kb(callback: str = "back_main") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[
            InlineKeyboardButton(
                text="BACK", callback_data=callback,
                icon_custom_emoji_id=get_emoji_icon("back"),
                style="danger"
            )
        ]]
    )

def admin_kb() -> InlineKeyboardMarkup:
    status = db_query("SELECT value FROM settings WHERE key='bot_status'", fetchone=True)
    status_val = status[0] if status else 'ON'
    vip_status = db_query("SELECT value FROM settings WHERE key='vip_status'", fetchone=True)
    vip_val = vip_status[0] if vip_status else 'OFF'
    
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📊 Bot Statistics", callback_data="admin_view_stats", style="primary")],
        [InlineKeyboardButton(text="👥 User Control Panel", callback_data="admin_user_control_start", style="primary")],
        [
            InlineKeyboardButton(text="➕ Add Product", callback_data="admin_add_prod", style="primary"),
            InlineKeyboardButton(text="📦 Manage Products", callback_data="admin_manage_prods", style="primary")
        ],
        [
            InlineKeyboardButton(text="👑 Reseller Mgmt", callback_data="admin_reseller_menu", style="primary")
        ],
        [
            InlineKeyboardButton(text="🎟 Create Coupon", callback_data="admin_create_coupon", style="primary"),
            InlineKeyboardButton(text="📢 Broadcast", callback_data="admin_broadcast_btn", style="primary")
        ],
        [
            InlineKeyboardButton(text="🎫 View Tickets", callback_data="admin_view_tickets", style="primary"),
            InlineKeyboardButton(text="📹 Tutorial Video", callback_data="admin_set_video", style="primary")
        ],
        [
            InlineKeyboardButton(text="🎨 Edit All Emojis", callback_data="admin_edit_emojis", style="primary")
        ],
        [
            InlineKeyboardButton(text="⚙️ FamPay Setup", callback_data="admin_setup_fampay", style="primary"),
            InlineKeyboardButton(text="🔐 API Gateway Setup", callback_data="admin_api_setup", style="primary"),
        ],
        [
            InlineKeyboardButton(text="✏️ Edit UI Texts", callback_data="admin_edit_ui_menu", style="primary"),
            InlineKeyboardButton(text="📝 Edit Reseller Price", callback_data="admin_edit_reseller_price", style="primary")
        ],
        [
            InlineKeyboardButton(text="💰 Reseller Fee", callback_data="admin_set_reseller_fee", style="primary"),
            InlineKeyboardButton(text="💳 Min Balance", callback_data="admin_set_reseller_min", style="primary")
        ],
        [
            InlineKeyboardButton(text="📞 Set Support Links", callback_data="admin_set_support_links", style="primary"),
            InlineKeyboardButton(text="🎨 Set Category Emojis", callback_data="admin_set_category_emojis", style="primary")
        ],
        [
            InlineKeyboardButton(text="🖼 Set Panel Emojis", callback_data="admin_set_panel_emojis", style="primary")
        ],
        [
            InlineKeyboardButton(
                text=f"Bot Status: {status_val} {'🟢' if status_val == 'ON' else '🔴'}",
                callback_data="admin_toggle_bot",
                style="success" if status_val == 'ON' else "danger"
            )
        ],
        [
            InlineKeyboardButton(
                text=f"VIP System: {vip_val} {'🟢' if vip_val == 'ON' else '🔴'}",
                callback_data="admin_toggle_vip_sys",
                style="success" if vip_val == 'ON' else "danger"
            )
        ]
    ])
    return kb

def admin_back_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="Back to Admin", callback_data="admin_panel_back",
            icon_custom_emoji_id=get_emoji_icon("back"),
            style="danger"
        )
    ]])

# ==============================================================================
# 8. NOTIFICATIONS
# ==============================================================================
async def send_advanced_notification(user_id: int, notif_type: str, amount: float, product: str = None, key: str = None, gateway: str = "FamPay") -> None:
    user_info = db_query("SELECT first_name, phone, username, is_reseller, is_vip FROM users WHERE user_id=?", (user_id,), fetchone=True)
    
    name = user_info[0] if user_info else "Unknown"
    phone = user_info[1] if user_info and user_info[1] else "Not Provided"
    username = f"@{user_info[2]}" if user_info and user_info[2] else "None"
    
    tags = []
    if user_info and user_info[3]: tags.append("👑 Reseller")
    if user_info and user_info[4]: tags.append("🌟 VIP")
    tag_str = " | ".join(tags) if tags else "👤 Regular"
        
    time_now = datetime.now().strftime("%d-%m-%Y %I:%M %p")
    
    if notif_type == "ORDER":
        title = "🛒 <b>NEW ORDER PROCESSED!</b> 🛒"
        details = (f"📦 <b>Product:</b> {product}\n🔑 <b>Key:</b> <code>{key}</code>\n💰 <b>Amount Paid:</b> ₹{amount:.2f}\n📅 <b>Time:</b> {time_now}")
    else:
        title = "💰 <b>NEW WALLET DEPOSIT!</b> 💰"
        details = (f"💵 <b>Amount Added:</b> ₹{amount:.2f}\n🧾 <b>Gateway:</b> {gateway}\n🆔 <b>Reference:</b> <code>{product}</code>\n📅 <b>Time:</b> {time_now}")

    msg = f"{title}\n━━━━━━━━━━━━━━━━━━\n👤 <b>Name:</b> {name}\n🆔 <b>User ID:</b> <code>{user_id}</code>\n📱 <b>Phone:</b> {phone}\n🔗 <b>Username:</b> {username}\n🏷 <b>Status:</b> {tag_str}\n━━━━━━━━━━━━━━━━━━\n{details}"
    try: 
        await bot.send_message(ADMIN_ID, msg, parse_mode='HTML')
    except Exception as e: 
        logger.error(f"Failed to send admin notification: {e}")

# ==============================================================================
# 9. FAMPAY PAYMENT FUNCTIONS
# ==============================================================================

def generate_upi_qr_file(upi_id: str, amount: float) -> Optional[BufferedInputFile]:
    """
    Generates a UPI QR code image locally.
    Requires 'qrcode' and 'Pillow' libraries to be installed.
    Returns BufferedInputFile on success, None on failure or if libraries are missing.
    """
    if not _QRCODE_AVAILABLE:
        logger.warning("Attempted local QR generation, but 'qrcode' library is not available.")
        return None
    try:
        qr_data = f"upi://pay?pa={upi_id}&am={amount:.2f}&cu=INR"
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        return BufferedInputFile(buffer.getvalue(), filename=f"payment_qr_{upi_id}.png")
    except Exception as e:
        logger.error(f"Error generating local UPI QR code: {e}", exc_info=True)
        return None


async def generate_fampay_qr(user_id: int, amount: float, upi_id: str = None) -> Dict[str, Any]:
    """Generate FamPay QR code for payment."""
    api_key = get_setting("fampay_api_key", FAMPAY_API_KEY)
    if not api_key or api_key == "YOUR_FAMPAY_API_KEY":
        return {"status": "error", "message": "FamPay API key not configured"}
    
    # Use provided UPI ID or default
    if not upi_id:
        upi_id = get_setting("fampay_upi_id", "")
        if not upi_id:
            return {"status": "error", "message": "UPI ID not configured"}
    
    url = f"{get_setting('fampay_qr_url', FAMPAY_QR_URL)}?upi={urllib.parse.quote(upi_id)}&amount={amount}"
    
    try:
        status, body = await http_request("GET", url, timeout=20)
        if status == 200:
            try:
                return json.loads(body.decode("utf-8", errors="replace"))
            except Exception as e:
                logger.error(f"Error parsing FamPay response: {e}")
                return {"status": "error", "message": "Failed to parse response"}
        return {"status": "error", "message": f"HTTP Error: {status}"}
    except Exception as e:
        logger.error(f"FamPay API Error: {e}")
        return {"status": "error", "message": str(e)}

async def verify_fampay_payment(order_id: str) -> Dict[str, Any]:
    """Verify payment using the Admin-configured FamGateway / FamPay API with multi-endpoint fallback."""
    gateway_token = (get_setting("payment_gateway_token", "") or "").strip()
    if not gateway_token:
        gateway_token = (get_setting("fampay_api_key", FAMPAY_API_KEY) or "").strip()
    gateway_url = (get_setting("payment_gateway_url", PAYMENT_GATEWAY_URL) or "").strip()

    # Try 1: FamGateway API (if token provided)
    if gateway_token and gateway_token != "YOUR_FAMPAY_API_KEY":
        try:
            from urllib.parse import urlsplit, urlunsplit
            parts = urlsplit(gateway_url.rstrip("/"))
            verify_host = f"{parts.scheme}://{parts.netloc}" if (parts.scheme and parts.netloc) else "https://famgateway.in"
            
            # Query with multiple auth parameter conventions (famgateway.in requires ?api_key=...)
            verify_endpoints = [
                f"{verify_host}/api/verify-order.php?order_id={urllib.parse.quote(order_id)}&api_key={urllib.parse.quote(gateway_token)}",
                f"{verify_host}/api/verify-order?order_id={urllib.parse.quote(order_id)}&api_key={urllib.parse.quote(gateway_token)}",
                f"{verify_host}/api/verify-order.php?order_id={urllib.parse.quote(order_id)}&token={urllib.parse.quote(gateway_token)}",
                f"https://fampay.anujbots.xyz/verify.php?order_id={urllib.parse.quote(order_id)}&api_key={urllib.parse.quote(gateway_token)}"
            ]
            
            headers = {
                "Accept": "application/json",
                "Authorization": f"Bearer {gateway_token}",
                "X-Api-Key": gateway_token,
            }
            
            for endpoint in verify_endpoints:
                try:
                    status, body = await http_request("GET", endpoint, headers=headers, timeout=10)
                    if 200 <= status < 300:
                        raw = body.decode("utf-8", errors="replace")
                        result = json.loads(raw)
                        if isinstance(result, dict) and result.get("status") in ("success", "ok", True):
                            return result
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"Gateway verify exception: {e}")

    return {"status": "error", "message": "Payment not received yet. Please wait 10-30 seconds after paying."}

async def generate_bantibhaiya_key(pid: str, duration: str, device_limit: str = "1") -> Tuple[bool, str]:
    """Generates a real-time key from Bantibhaiya Reseller API using Product PID and Duration."""
    api_url = (get_setting("reseller_api_url", RESELLER_API_URL) or "https://bantibhaiya.to/api/reseller_v1.php").strip()
    api_key = (get_setting("reseller_api_key", RESELLER_API_KEY) or "").strip()
    master_key = (get_setting("reseller_master_key", RESELLER_MASTER_KEY) or "").strip()

    if not api_key:
        logger.warning("Bantibhaiya Reseller API Key is not set in Admin Settings!")
        return False, "Bantibhaiya Reseller API Key is not configured in Admin Settings."

    actions_to_try = ["gen_key", "generate", "create", "create_key", "buy"]
    last_error = "Unknown error"

    for act in actions_to_try:
        payload = {
            "api_key": api_key,
            "action": act,
            "product_pid": pid,
            "pid": pid,
            "product_id": pid,
            "duration": duration,
            "validity": duration,
            "devices": device_limit or "1",
            "device_limit": device_limit or "1",
            "master_key": master_key,
            "amount": 1,
            "count": 1
        }
        try:
            form_data = urllib.parse.urlencode(payload).encode("utf-8")
            status, body = await http_request(
                "POST", 
                api_url, 
                data=form_data, 
                headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0"}, 
                timeout=15
            )
            text = body.decode("utf-8", errors="replace").strip()
            if text:
                try:
                    data = json.loads(text)
                    if isinstance(data, dict):
                        if data.get("status") in ("success", "ok", True) or data.get("success") is True:
                            key = data.get("key") or data.get("license") or data.get("serial") or (data.get("data", {}).get("key") if isinstance(data.get("data"), dict) else None)
                            if key:
                                return True, str(key).strip()
                        if data.get("status") == "error":
                            msg = data.get("msg") or data.get("message") or "API error"
                            last_error = str(msg)
                except json.JSONDecodeError:
                    if not text.startswith("<") and len(text) < 120 and "error" not in text.lower():
                        return True, text
        except Exception as e:
            logger.warning(f"Error calling Bantibhaiya action {act}: {e}")
            last_error = str(e)

    return False, last_error

async def process_referral_reward_on_purchase(buyer_user_id: int):
    """Credit ₹1.50 to referrer when a referred user completes their first purchase or deposit."""
    try:
        u = db_query("SELECT referred_by, referral_reward_claimed, first_name, username FROM users WHERE user_id=?", (buyer_user_id,), fetchone=True)
        if u and u[0] and not u[1]:
            referrer_id = u[0]
            reward_amount = 1.50
            
            # Credit reward to referrer
            db_query(
                "UPDATE users SET balance = balance + ?, referrals_count = COALESCE(referrals_count, 0) + 1, total_referral_earnings = COALESCE(total_referral_earnings, 0) + ? WHERE user_id=?",
                (reward_amount, reward_amount, referrer_id)
            )
            # Mark reward claimed for buyer
            db_query("UPDATE users SET referral_reward_claimed = 1 WHERE user_id=?", (buyer_user_id,))
            
            buyer_name = html.escape(str(u[2] or "User"))
            buyer_tag = f"@{u[3]}" if u[3] else buyer_name
            log_activity(referrer_id, "REFERRAL_REWARD_CREDITED", f"From Buyer {buyer_user_id}: ₹{reward_amount}")
            
            try:
                await bot.send_message(
                    chat_id=referrer_id,
                    text=(
                        "🎁 <b>REFERRAL REWARD RECEIVED!</b>\n"
                        "━━━━━━━━━━━━━━━━━━\n"
                        f"👤 <b>Referred Friend:</b> {buyer_tag} (<code>{buyer_user_id}</code>)\n"
                        "🛒 <b>Completed Action:</b> First Purchase / Top-Up\n"
                        f"💰 <b>Reward Credited:</b> +<b>₹{reward_amount:.2f}</b>\n"
                        "━━━━━━━━━━━━━━━━━━\n"
                        "<i>Your ₹1.50 referral bonus has been credited to your wallet balance!</i>"
                    ),
                    parse_mode="HTML"
                )
            except Exception as e:
                logger.warning(f"Could not notify referrer {referrer_id}: {e}")
    except Exception as err:
        logger.error(f"Error processing referral reward: {err}")

def credit_verified_payment_once(user_id: int, order_id: str, amount: float) -> bool:
    """Atomically mark a pending order paid and credit the wallet once."""
    conn = sqlite3.connect("Cuibcc.db")
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT status FROM transactions WHERE order_id=?", (order_id,)).fetchone()
        if not row or row[0] != "pending":
            conn.rollback()
            return False
        conn.execute("UPDATE transactions SET status='paid' WHERE order_id=? AND status='pending'", (order_id,))
        if conn.total_changes != 1:
            conn.rollback()
            return False
        conn.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (float(amount), user_id))
        conn.commit()
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(process_referral_reward_on_purchase(user_id))
        except Exception:
            pass
        return True
    except Exception as e:
        try: conn.rollback()
        except Exception: pass
        logger.exception(f"Atomic payment credit failed for {order_id}: {e}")
        return False
    finally:
        conn.close()

async def run_payment_verification(user_id: int, order_id: str, reply_target: Any) -> None:
    """Run payment verification with FamPay."""
    txn = db_query("SELECT amount_inr, status, timestamp, qr_url, upi_id, expires_at FROM transactions WHERE order_id=?", (order_id,), fetchone=True)
    if not txn:
        err = "❌ Invalid or Fake Order ID detected in system!"
        if isinstance(reply_target, CallbackQuery): await reply_target.answer(err, show_alert=True)
        else: await reply_target.answer(err)
        return
    
    # A paid order must never be changed to expired by a late manual check.
    if txn[1] == 'paid':
        msg = "✅ This payment has already been securely credited to your wallet."
        if isinstance(reply_target, CallbackQuery): await reply_target.answer(msg, show_alert=True)
        else: await reply_target.answer(msg)
        return

    # Check if QR expired
    if txn[5] and time.time() > txn[5]:
        db_query("UPDATE transactions SET status='expired' WHERE order_id=? AND status='pending'", (order_id,))
        err_msg = "⏳ <b>QR Code Expired!</b>\nThe 5-minute payment window has expired. Please generate a new QR."
        if isinstance(reply_target, CallbackQuery): await reply_target.message.edit_text(err_msg, reply_markup=back_kb(), parse_mode='HTML')
        else: await reply_target.answer(err_msg, reply_markup=back_kb())
        return
        
    if txn[1] == 'expired':
        msg = "❌ This order has expired. Please create a new deposit request."
        if isinstance(reply_target, CallbackQuery): await reply_target.answer(msg, show_alert=True)
        else: await reply_target.answer(msg)
        return
    
    # Verify with FamPay API
    result = await verify_fampay_payment(order_id)
    
    if result.get("status") == "success":
        # Payment successful
        txn_data = result.get("data", {})
        transaction_id = txn_data.get("transaction_id")
        utr = txn_data.get("utr")
        sender_name = txn_data.get("sender_name")
        amount_received = txn_data.get("amount", txn[0])
        payment_time = txn_data.get("payment_time_ist")
        
        if not credit_verified_payment_once(user_id, order_id, amount_received):
            msg = "✅ This payment has already been securely credited to your wallet."
            if isinstance(reply_target, CallbackQuery): await reply_target.answer(msg, show_alert=True)
            else: await reply_target.answer(msg)
            return
        
        success_msg = f"🎉 <b>PAYMENT VERIFIED!</b>\n\n✅ {fmt_curr(amount_received)} has been added to your wallet.\n🧾 UTR: <code>{utr}</code>\n👤 Sender: {sender_name}\n📅 Time: {payment_time}"
        if isinstance(reply_target, CallbackQuery): await reply_target.message.edit_text(success_msg, reply_markup=back_kb(), parse_mode='HTML')
        else: await reply_target.answer(success_msg, reply_markup=back_kb())
        
        await send_advanced_notification(user_id, "DEPOSIT", amount_received, product=transaction_id, gateway="FamPay")
        log_activity(user_id, "DEPOSIT_SUCCESS", f"Amount: {amount_received}, Gateway: FamPay, Order: {order_id}, UTR: {utr}")
        
    elif result.get("status") == "error":
        error_msg = result.get("message", "Payment not received yet")
        if "Transaction failed" in error_msg:
            fail_msg = f"❌ {error_msg}\n\nPlease make sure you sent the exact amount to the correct UPI ID."
            if isinstance(reply_target, CallbackQuery): await reply_target.answer(fail_msg, show_alert=True)
            else: await reply_target.answer(fail_msg)
        else:
            pending_msg = f"⏳ Payment Status: PENDING\n\nPayment has not been confirmed yet.\n\nIf you have already paid, please allow 10-30 seconds for bank settlement and tap Verify again."
            if isinstance(reply_target, CallbackQuery): await reply_target.answer(pending_msg, show_alert=True)
            else: await reply_target.answer(pending_msg)
    else:
        err = f"⚠️ Status: {result.get('message', 'Checking...')}"
        if isinstance(reply_target, CallbackQuery): await reply_target.answer(err, show_alert=True)
        else: await reply_target.answer(err)

async def auto_verify_task() -> None:
    """Auto-verify FamGateway pending transactions every 3 seconds for up to 5 minutes."""
    while True:
        try:
            await asyncio.sleep(3)

            gateway_token = (get_setting("payment_gateway_token", "") or "").strip()
            if not gateway_token:
                gateway_token = (get_setting("fampay_api_key", "") or "").strip()
                if not gateway_token or gateway_token == "YOUR_FAMPAY_API_KEY":
                    continue

            pending_txns = db_query(
                "SELECT order_id, user_id, amount_inr, timestamp, expires_at FROM transactions WHERE status='pending'",
                fetchall=True
            ) or []

            for txn in pending_txns:
                order_id, user_id, amount, ts, expires_at = txn

                if expires_at and time.time() > expires_at:
                    db_query("UPDATE transactions SET status='expired' WHERE order_id=? AND status='pending'", (order_id,))
                    try:
                        await bot.send_message(
                            user_id,
                            f"⏳ <b>QR Code Expired!</b>\nOrder <code>{html.escape(str(order_id))}</code> expired. Please create a new payment.",
                            parse_mode='HTML'
                        )
                    except Exception:
                        pass
                    continue

                result = await verify_fampay_payment(order_id)
                gateway_status = str(result.get("status", "")).lower() if isinstance(result, dict) else ""
                if gateway_status in {"expired", "not_found"}:
                    db_query("UPDATE transactions SET status='expired' WHERE order_id=? AND status='pending'", (order_id,))
                    continue
                if gateway_status != "success":
                    continue

                data = result.get("data") if isinstance(result.get("data"), dict) else result
                amount_received = data.get("amount", amount)
                try:
                    amount_received = float(amount_received)
                except Exception:
                    amount_received = float(amount)
                utr = data.get("utr") or "N/A"
                sender_name = data.get("sender_name") or "N/A"
                transaction_id = data.get("transaction_id") or order_id

                if not credit_verified_payment_once(user_id, order_id, amount_received):
                    continue

                try:
                    await bot.send_message(
                        user_id,
                        f"✨ <b>AUTO PAYMENT VERIFIED!</b>\n\n"
                        f"✅ <b>Amount:</b> {fmt_curr(amount_received)}\n"
                        f"💰 <b>Wallet Balance Updated</b>\n"
                        f"🧾 <b>UTR:</b> <code>{html.escape(str(utr))}</code>\n"
                        f"👤 <b>Sender:</b> {html.escape(str(sender_name))}",
                        parse_mode='HTML'
                    )
                except Exception:
                    pass

                try:
                    await send_advanced_notification(user_id, "DEPOSIT", amount_received, product=transaction_id, gateway="FamGateway Auto")
                except Exception:
                    pass
                log_activity(
                    user_id,
                    "DEPOSIT_AUTO_SUCCESS",
                    f"Order: {order_id}, Amount: {amount_received}, UTR: {utr}"
                )
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"Auto-verify task notice: {e}")
            await asyncio.sleep(4)


# ==============================================================================
# 10. ONBOARDING & START
# ==============================================================================
@dp.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    try: await message.answer_sticker(WELCOME_STICKER_ID)
    except: pass 
    
    current_username = message.from_user.username or ""
    current_first_name = message.from_user.first_name or "User"

    args = message.text.split()
    if len(args) > 1:
        param = args[1]
        if param.startswith("v_"):
            order_id = param.split("v_")[1]
            msg = await message.answer("🔄 <b>Verifying your payment securely...</b>\n<i>Connecting to gateway...</i>", parse_mode='HTML')
            await run_payment_verification(message.from_user.id, order_id, msg)
            return
        elif param.startswith("ref_"):
            try:
                ref_id = int(param.replace("ref_", ""))
                if ref_id != message.from_user.id:
                    existing = db_query("SELECT user_id, referred_by FROM users WHERE user_id=?", (message.from_user.id,), fetchone=True)
                    if not existing:
                        db_query(
                            "INSERT OR IGNORE INTO users (user_id, first_name, username, joined_date, referred_by) VALUES (?, ?, ?, ?, ?)",
                            (
                                message.from_user.id,
                                current_first_name,
                                current_username,
                                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                ref_id
                            )
                        )
                        log_activity(message.from_user.id, "REGISTERED_VIA_REFERRAL", f"Referrer: {ref_id}")
                        try:
                            buyer_name = html.escape(str(current_first_name or "User"))
                            buyer_tag = f"@{current_username}" if current_username else buyer_name
                            await bot.send_message(
                                chat_id=ref_id,
                                text=f"👥 <b>NEW REFERRAL JOINED!</b>\n\nUser {buyer_tag} joined using your referral link!\nWhen they complete their first purchase/top-up, you will receive <b>₹1.50</b> credited to your wallet balance.",
                                parse_mode="HTML"
                            )
                        except Exception:
                            pass
            except Exception as ref_err:
                logger.warning(f"Referral parsing error: {ref_err}")

    user = db_query("SELECT phone FROM users WHERE user_id=?", (message.from_user.id,), fetchone=True)

    # Always keep the latest Telegram name/username in the database.
    db_query(
        "UPDATE users SET first_name=?, username=? WHERE user_id=?",
        (current_first_name, current_username, message.from_user.id)
    )

    if not user:
        db_query(
            "INSERT OR IGNORE INTO users (user_id, first_name, username, joined_date) VALUES (?, ?, ?, ?)",
            (
                message.from_user.id,
                current_first_name,
                current_username,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            )
        )
        log_activity(message.from_user.id, "ACCOUNT_CREATED")

    log_activity(message.from_user.id, "CMD_START")
    await send_main_menu(message)

async def send_main_menu(ctx: Any):
    user_id = ctx.from_user.id

    # Read live account information so the START screen never shows
    # a hard-coded name, username, balance, or role.
    u = db_query(
        """SELECT user_id, first_name, username, balance, account_type,
                  orders_count, spent, joined_date, is_reseller, is_vip,
                  total_saved
           FROM users WHERE user_id=?""",
        (user_id,),
        fetchone=True
    )

    # Safety fallback if the account row was not created yet.
    if not u:
        db_query(
            "INSERT OR IGNORE INTO users (user_id, first_name, username, joined_date) VALUES (?, ?, ?, ?)",
            (
                user_id,
                ctx.from_user.first_name or "User",
                ctx.from_user.username or "",
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            )
        )
        u = db_query(
            """SELECT user_id, first_name, username, balance, account_type,
                      orders_count, spent, joined_date, is_reseller, is_vip,
                      total_saved
               FROM users WHERE user_id=?""",
            (user_id,),
            fetchone=True
        )

    if u:
        db_user_id, first_name, username, balance, account_type, orders_count, spent, joined_date, is_reseller, is_vip, total_saved = u
    else:
        db_user_id = user_id
        first_name = ctx.from_user.first_name or "User"
        username = ctx.from_user.username or ""
        balance = 0.0
        account_type = "Regular"
        orders_count = 0
        spent = 0.0
        joined_date = "N/A"
        is_reseller = 0
        is_vip = 0
        total_saved = 0.0

    # Determine the displayed role from the actual account flags.
    if user_id == ADMIN_ID or is_admin_user(user_id):
        role = "👑 Admin"
    elif is_reseller and is_vip:
        role = "👑 Reseller + 🌟 VIP"
    elif is_reseller:
        role = "👑 Reseller"
    elif is_vip:
        role = "🌟 VIP"
    else:
        role = "👤 Regular User"

    display_name = html.escape(str(first_name or "User"))
    display_username = f"@{html.escape(str(username))}" if username else "Not set"

    # Use configured bot title or dynamic bot username/name
    configured_title = (get_setting("bot_title", "") or "").strip()
    if not configured_title:
        bot_uname = (BOT_USERNAME or "").replace("@", "").strip()
        bot_title = f"{bot_uname} STORE" if bot_uname else "TELEGRAM STORE"
    else:
        bot_title = configured_title.upper()

    text = (
        f"⚡ <b>WELCOME TO {bot_title}</b> ⚡\n\n"
        f"👋 Hello, <b>{display_name}</b> 👤!\n"
        f"🆔 Telegram ID: <code>{db_user_id}</code>\n"
        f"🎖 Account Tier: {role}\n"
        f"💰 Wallet Balance: <code>{fmt_curr(safe_float(balance))}</code>\n\n"
        "🚀 <b>Instant Key Delivery System:</b>\n"
        "• Premium Injector & Menu Panels\n"
        "• Android Non-Root, Root & PC Emulators\n"
        "• Instant FamPay UPI & Crypto Wallet Top-ups\n"
        "• 100% Anti-Ban Protection & Auto Key Dispenser\n\n"
        "<i>Select an option below to proceed:</i>"
    )

    # Keep the existing menu buttons and role-based reseller/VIP buttons.
    kb = main_menu_kb(user_id)

    if isinstance(ctx, Message):
        await ctx.answer(text, reply_markup=kb, parse_mode='HTML')
    else:
        try:
            if ctx.message and getattr(ctx.message, 'photo', None):
                await ctx.message.delete()
                await ctx.message.answer(text, reply_markup=kb, parse_mode='HTML')
            else:
                await ctx.message.edit_text(text, reply_markup=kb, parse_mode='HTML')
        except Exception:
            try: await ctx.message.delete()
            except Exception: pass
            await ctx.message.answer(text, reply_markup=kb, parse_mode='HTML')

# ==============================================================================
# 10B. REFERRAL SYSTEM
# ==============================================================================
@dp.callback_query(F.data == "menu_referral")
async def show_referral_dashboard(call: CallbackQuery):
    user_id = call.from_user.id
    u = db_query("SELECT referrals_count, total_referral_earnings FROM users WHERE user_id=?", (user_id,), fetchone=True)
    ref_count = u[0] if u and u[0] else 0
    ref_earned = u[1] if u and u[1] else 0.0

    bot_uname = (BOT_USERNAME or "").replace("@", "").strip()
    ref_link = f"https://t.me/{bot_uname}?start=ref_{user_id}"
    share_text = urllib.parse.quote(f"🚀 Join @{bot_uname} for instant keys, panels & balance top-ups!\n👉 {ref_link}")
    share_url = f"https://t.me/share/url?url={urllib.parse.quote(ref_link)}&text={share_text}"

    text = (
        "🎁 <b>— REFER & EARN PROGRAM —</b> 🎁\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "Earn <b>₹1.50</b> in your wallet balance for every friend who joins using your link and completes a purchase!\n\n"
        f"🔗 <b>Your Unique Referral Link:</b>\n"
        f"<code>{ref_link}</code>\n\n"
        "📊 <b>YOUR REFERRAL STATS:</b>\n"
        f"👥 <b>Total Referrals:</b> {ref_count}\n"
        f"💰 <b>Total Earned:</b> {fmt_curr(safe_float(ref_earned))}\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "<i>Tap 'Share with Friends' to send your link to friends!</i>"
    )

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📲 Share with Friends", url=share_url, style="success")],
        [InlineKeyboardButton(text="BACK", callback_data="back_main", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
    ])
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.message(Command("referral", "ref", "refer"))
async def cmd_referral(message: Message):
    user_id = message.from_user.id
    u = db_query("SELECT referrals_count, total_referral_earnings FROM users WHERE user_id=?", (user_id,), fetchone=True)
    ref_count = u[0] if u and u[0] else 0
    ref_earned = u[1] if u and u[1] else 0.0

    bot_uname = (BOT_USERNAME or "").replace("@", "").strip()
    ref_link = f"https://t.me/{bot_uname}?start=ref_{user_id}"
    share_text = urllib.parse.quote(f"🚀 Join @{bot_uname} for instant keys, panels & balance top-ups!\n👉 {ref_link}")
    share_url = f"https://t.me/share/url?url={urllib.parse.quote(ref_link)}&text={share_text}"

    text = (
        "🎁 <b>— REFER & EARN PROGRAM —</b> 🎁\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "Earn <b>₹1.50</b> in your wallet balance for every friend who joins using your link and completes a purchase!\n\n"
        f"🔗 <b>Your Unique Referral Link:</b>\n"
        f"<code>{ref_link}</code>\n\n"
        "📊 <b>YOUR REFERRAL STATS:</b>\n"
        f"👥 <b>Total Referrals:</b> {ref_count}\n"
        f"💰 <b>Total Earned:</b> {fmt_curr(safe_float(ref_earned))}\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "<i>Tap 'Share with Friends' to send your link to friends!</i>"
    )

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📲 Share with Friends", url=share_url, style="success")],
        [InlineKeyboardButton(text="BACK", callback_data="back_main", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
    ])
    await message.answer(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data == "back_main")
async def back_main(call: CallbackQuery, state: FSMContext):
    await state.clear()
    log_activity(call.from_user.id, "RETURN_MAIN_MENU")
    await send_main_menu(call)

# ==============================================================================
# 11. ADD BALANCE
# ==============================================================================
@dp.callback_query(F.data == "menu_add_balance")
async def select_gateway_menu(call: CallbackQuery):
    log_activity(call.from_user.id, "VIEW_ADD_BALANCE")
    text = get_ui_text("add_balance_menu")
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="UPI PAY", callback_data="gateway_inr", icon_custom_emoji_id=get_emoji_icon("upi"), style="primary")
        ],
        [
            InlineKeyboardButton(text="BACK", callback_data="back_main", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")
        ]
    ])
    try:
        if call.message and getattr(call.message, 'photo', None):
            await call.message.delete()
            await call.message.answer(text, reply_markup=kb, parse_mode='HTML')
        else:
            await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')
    except Exception:
        try: await call.message.delete()
        except Exception: pass
        await call.message.answer(text, reply_markup=kb, parse_mode='HTML')

# ==============================================================================
# 12. FAMPAY UPI PAYMENT FLOW
# ==============================================================================
@dp.callback_query(F.data == "gateway_inr")
async def add_balance_inr(call: CallbackQuery):
    text = f"💵 <b>— FAMPAY UPI DEPOSIT —</b> 💵\n\nSelect amount to deposit:"
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="₹1", callback_data="pay_1", style="success"), InlineKeyboardButton(text="₹50", callback_data="pay_50", style="primary"), InlineKeyboardButton(text="₹100", callback_data="pay_100", style="primary")],
        [InlineKeyboardButton(text="₹200", callback_data="pay_200", style="primary"), InlineKeyboardButton(text="₹500", callback_data="pay_500", style="primary")],
        [InlineKeyboardButton(text="₹1000", callback_data="pay_1000", style="primary"), InlineKeyboardButton(text="₹2000", callback_data="pay_2000", style="primary")],
        [InlineKeyboardButton(text="✏️ Custom Amount", callback_data="custom_deposit_keypad", style="primary")],
        [InlineKeyboardButton(text="Back", callback_data="menu_add_balance", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
    ])
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data == "custom_deposit_keypad")
async def show_custom_keypad(call: CallbackQuery, state: FSMContext):
    await state.set_state(UserStates.custom_amount_input)
    await state.update_data(amount_str="0")
    await show_keypad(call.message)

async def show_keypad(message: Message, amount_str: str = "0"):
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="      1      ", callback_data="kp_1", style="primary"), InlineKeyboardButton(text="      2      ", callback_data="kp_2", style="primary"), InlineKeyboardButton(text="      3      ", callback_data="kp_3", style="primary")],
        [InlineKeyboardButton(text="      4      ", callback_data="kp_4", style="primary"), InlineKeyboardButton(text="      5      ", callback_data="kp_5", style="primary"), InlineKeyboardButton(text="      6      ", callback_data="kp_6", style="primary")],
        [InlineKeyboardButton(text="      7      ", callback_data="kp_7", style="primary"), InlineKeyboardButton(text="      8      ", callback_data="kp_8", style="primary"), InlineKeyboardButton(text="      9      ", callback_data="kp_9", style="primary")],
        [InlineKeyboardButton(text="    ⌫    ", callback_data="kp_backspace", style="danger"), InlineKeyboardButton(text="      0      ", callback_data="kp_0", style="primary"), InlineKeyboardButton(text="    C    ", callback_data="kp_clear", style="danger")],
        [InlineKeyboardButton(text=f"✅ Confirm (₹{amount_str})", callback_data="kp_confirm", style="success")],
        [InlineKeyboardButton(text="Cancel", callback_data="gateway_inr", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
    ])
    text = f"💵 <b>Enter Amount (₹):</b>\n\nCurrent: ₹{amount_str}"
    await message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data.startswith("kp_"), UserStates.custom_amount_input)
async def keypad_handler(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    amount_str = data.get("amount_str", "0")
    action = call.data.split("_")[1]
    if action == "confirm":
        if amount_str == "0":
            await call.answer("Amount cannot be zero.", show_alert=True)
            return
        try:
            amount = float(amount_str)
            if amount < 1:
                await call.answer("Minimum deposit is ₹1.", show_alert=True)
                return
            await state.clear()
            await call.message.edit_text("⏳ <b>Generating Secure QR Code...</b>", parse_mode='HTML')
            await generate_fampay_order(call.from_user.id, amount, call.message)
        except ValueError:
            await call.answer("Invalid amount.", show_alert=True)
        return
    if action == "backspace":
        if len(amount_str) > 1: amount_str = amount_str[:-1]
        else: amount_str = "0"
    elif action == "clear":
        amount_str = "0"
    else:
        if amount_str == "0": amount_str = action
        else: amount_str += action
        if len(amount_str) > 6: amount_str = amount_str[:6]
    await state.update_data(amount_str=amount_str)
    await show_keypad(call.message, amount_str)
    await call.answer()

@dp.callback_query(F.data.startswith("pay_"))
async def process_fampay_payment_callback(call: CallbackQuery):
    try:
        inr_amount = float(call.data.split("_", 1)[1])
    except (ValueError, IndexError):
        await call.answer("Invalid payment amount.", show_alert=True)
        return
    if inr_amount < 1:
        await call.answer("Minimum deposit is ₹1.", show_alert=True)
        return
    await call.message.edit_text("⏳ <b>Generating Secure QR Code...</b>", parse_mode='HTML')
    await generate_fampay_order(call.from_user.id, inr_amount, call.message)

async def generate_fampay_order(user_id: int, inr_amount: float, message_obj: Message) -> None:
    """Create a payment order using the Admin-configured FamGateway API.
    Falls back to the legacy FamPay QR flow only when no gateway token is configured.
    Minimum deposit is ₹1.
    """
    try:
        inr_amount = round(float(inr_amount), 2)
    except (TypeError, ValueError):
        return await message_obj.edit_text("❌ Invalid payment amount.", reply_markup=back_kb("gateway_inr"), parse_mode="HTML")
    if inr_amount < 1:
        return await message_obj.edit_text("❌ <b>Minimum deposit is ₹1.</b>", reply_markup=back_kb("gateway_inr"), parse_mode="HTML")
    gateway_url = (get_setting("payment_gateway_url", PAYMENT_GATEWAY_URL) or "").strip()
    gateway_token = (get_setting("payment_gateway_token", "") or "").strip()
    # Backward-compatible: use the existing FamPay API key field if gateway token is empty.
    if not gateway_token:
        gateway_token = (get_setting("fampay_api_key", "") or "").strip()
    gateway_redirect = (get_setting("payment_redirect_url", "") or "").strip()

    # New Admin-configured FamGateway flow.
    if gateway_token:
        try:
            # FamGateway's canonical endpoint is /api/create-order.
            # If an older /create-order.php URL was saved, normalize it.
            gateway_url = gateway_url.rstrip("/")
            if gateway_url.endswith("/api/create-order.php"):
                gateway_url = gateway_url[:-5]

            payload = {"amount": round(float(inr_amount), 2)}
            if gateway_redirect:
                payload["redirect_url"] = gateway_redirect
            payload["customer_name"] = str(user_id)
            payload["custom_id"] = f"TG_{user_id}_{int(time.time())}"

            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": f"Bearer {gateway_token}",
                "X-Api-Key": gateway_token,
            }

            status, body = await http_request(
                "POST", gateway_url, headers=headers,
                data=json.dumps(payload).encode("utf-8"), timeout=20
            )
            raw = body.decode("utf-8", errors="replace")
            try:
                result = json.loads(raw)
            except Exception:
                result = {"status": "error", "message": raw[:500] or f"HTTP {status}"}

            if status < 200 or status >= 300:
                logger.warning(f"FamGateway create-order HTTP {status}: {raw[:500]}, falling back to UPI QR flow.")
                raise RuntimeError(f"Gateway HTTP {status}")

            if not isinstance(result, dict) or result.get("status") not in ("success", "ok", True):
                logger.warning(f"FamGateway create-order rejected: {result}, falling back to UPI QR flow.")
                raise RuntimeError("Gateway rejected order creation")

            data = result.get("data") if isinstance(result.get("data"), dict) else result
            order_id = str(data.get("order_id") or data.get("id") or f"FG{user_id}{int(time.time())}")
            qr_url = data.get("qr_url") or data.get("qr_image") or data.get("qr")
            checkout_url = data.get("checkout_url") or data.get("payment_url") or data.get("checkout")
            upi_intent = data.get("upi_intent") or data.get("upi_link")
            upi_id = data.get("upi_id") or ""
            expires_at_str = data.get("expires_at_ist") or data.get("expires_at")
            created_at = data.get("created_at_ist") or data.get("created_at") or datetime.now().strftime("%d-%m-%Y %H:%M:%S")

            # A hosted checkout/QR URL is required to give the customer a payment action.
            payment_url = checkout_url or qr_url
            if not payment_url:
                logger.warning(f"FamGateway response has no checkout/QR URL: {result}, falling back to UPI QR flow.")
                raise RuntimeError("No payment URL in gateway response")

            try:
                expiry_time = datetime.strptime(expires_at_str, "%d-%m-%Y %H:%M:%S") if expires_at_str and "-" in str(expires_at_str) else datetime.now() + timedelta(minutes=5)
                expires_timestamp = int(expiry_time.timestamp())
            except Exception:
                expires_timestamp = int(time.time() + 300)

            db_query(
                "INSERT OR REPLACE INTO transactions (order_id, user_id, amount_inr, status, timestamp, qr_url, upi_id, expires_at) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)",
                (order_id, user_id, inr_amount, int(time.time()), payment_url, upi_id, expires_timestamp)
            )

            # Telegram does not allow UPI deep-links (upi://) as inline-button URLs.
            # Display the QR image directly inside the bot instead.
            buttons = []
            buttons.append([InlineKeyboardButton(text="🔄 Verify Payment", callback_data=f"verify_{order_id}", style="primary")])
            hosted_url = checkout_url if isinstance(checkout_url, str) and checkout_url.startswith(("https://", "http://")) else None
            qr_open_url = qr_url if isinstance(qr_url, str) and qr_url.startswith(("https://", "http://")) else None
            if hosted_url:
                buttons.append([InlineKeyboardButton(text="💳 Open Payment", url=hosted_url, style="success")])
            elif qr_open_url:
                buttons.append([InlineKeyboardButton(text="🖼 Open QR", url=qr_open_url, style="success")])
            buttons.append([InlineKeyboardButton(text="Cancel", callback_data="menu_add_balance", style="danger")])
            kb = InlineKeyboardMarkup(inline_keyboard=buttons)

            text = (
                "🧾 <b>PAYMENT ORDER CREATED</b>\n\n"
                f"💵 <b>Amount:</b> {fmt_curr(inr_amount)}\n"
                f"🆔 <b>Order ID:</b> <code>{html.escape(order_id)}</code>\n"
                f"🏦 <b>UPI ID:</b> <code>{html.escape(str(upi_id or 'Gateway checkout'))}</code>\n"
                f"⏳ <b>Expires:</b> {html.escape(str(expires_at_str or '5 minutes'))}\n\n"
                "📱 <b>Scan the QR code below</b> and pay the exact amount.\n"
                "After payment, tap <b>Verify Payment</b>."
            )

            log_activity(user_id, "GENERATE_INVOICE_FAMGATEWAY", f"Amount: {inr_amount}, Order ID: {order_id}")

            # Send the gateway-generated QR image directly into this Telegram chat.
            # If downloading the gateway QR fails, fall back to the checkout URL button.
            if qr_url:
                try:
                    # Telegram can fetch the public FamGateway QR image directly.
                    try:
                        await message_obj.delete()
                    except Exception:
                        pass
                    await bot.send_photo(
                        chat_id=user_id,
                        photo=qr_url,
                        caption=text,
                        reply_markup=kb,
                        parse_mode="HTML"
                    )
                    return
                except Exception as direct_qr_error:
                    logger.warning(f"Direct QR send failed, trying download fallback: {direct_qr_error}")
                    try:
                        qr_status, qr_bytes = await http_request("GET", qr_url, timeout=15)
                        if 200 <= qr_status < 300 and qr_bytes:
                            qr_file = BufferedInputFile(qr_bytes, filename=f"payment_{order_id}.png")
                            try:
                                await message_obj.delete()
                            except Exception:
                                pass
                            await bot.send_photo(chat_id=user_id, photo=qr_file, caption=text, reply_markup=kb, parse_mode="HTML")
                            return
                        logger.error(f"QR download failed: HTTP {qr_status}")
                    except Exception as qr_error:
                        logger.exception(f"Gateway QR image download failed: {qr_error}")

            # Final fallback: keep the payment order message if the QR image cannot be downloaded.
            await message_obj.edit_text(text, reply_markup=kb, parse_mode="HTML")
            return
        except Exception as e:
            logger.warning(f"FamGateway create-order failed ({e}), falling back to direct UPI QR payment flow.")

    # ==============================================================================
    # AUTOMATIC FAIL-SAFE FALLBACK: DIRECT UPI QR PAYMENT GENERATION
    # Always succeeds so users never see gateway connection failures!
    # ==============================================================================
    upi_id = (get_setting("fampay_upi_id", FAMPAY_UPI_ID) or "").strip()
    if not upi_id:
        upi_id = "paytmqr2810050501011vd8hgg070g1@paytm"

    order_id = f"UPI{user_id}{int(time.time())}"
    expires_timestamp = int(time.time() + 600)  # 10 minutes
    expires_at_str = (datetime.now() + timedelta(minutes=10)).strftime("%d-%m-%Y %H:%M:%S")

    # Generate UPI Intent & Dynamic QR Code URL
    upi_intent = f"upi://pay?pa={urllib.parse.quote(upi_id)}&pn=Digital%20Store&am={inr_amount:.2f}&cu=INR&tn=Order_{order_id}"
    qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=500x500&data={urllib.parse.quote(upi_intent)}"

    db_query(
        "INSERT OR REPLACE INTO transactions (order_id, user_id, amount_inr, status, timestamp, qr_url, upi_id, expires_at) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)",
        (order_id, user_id, inr_amount, int(time.time()), qr_url, upi_id, expires_timestamp)
    )

    buttons = [
        [InlineKeyboardButton(text="🔄 Verify Payment", callback_data=f"verify_{order_id}", style="primary")],
        [InlineKeyboardButton(text="💳 Pay via UPI App", url=f"https://api.qrserver.com/v1/create-qr-code/?size=500x500&data={urllib.parse.quote(upi_intent)}", style="success")],
        [InlineKeyboardButton(text="Cancel", callback_data="menu_add_balance", style="danger")]
    ]
    kb = InlineKeyboardMarkup(inline_keyboard=buttons)

    text = (
        "🧾 <b>PAYMENT ORDER CREATED</b>\n\n"
        f"💵 <b>Amount:</b> {fmt_curr(inr_amount)}\n"
        f"🆔 <b>Order ID:</b> <code>{html.escape(order_id)}</code>\n"
        f"🏦 <b>UPI ID:</b> <code>{html.escape(upi_id)}</code>\n"
        f"⏳ <b>Expires In:</b> 10 Minutes\n\n"
        "📱 <b>Scan the QR code below</b> or copy the UPI ID.\n"
        "Pay the exact amount and tap <b>Verify Payment</b>."
    )

    log_activity(user_id, "GENERATE_INVOICE_UPI_FALLBACK", f"Amount: {inr_amount}, Order ID: {order_id}")

    try:
        try:
            await message_obj.delete()
        except Exception:
            pass
        await bot.send_photo(
            chat_id=user_id,
            photo=qr_url,
            caption=text,
            reply_markup=kb,
            parse_mode="HTML"
        )
        return
    except Exception as img_err:
        logger.warning(f"Could not send fallback QR photo: {img_err}")
        await message_obj.edit_text(text, reply_markup=kb, parse_mode="HTML")
        return
    
    data = result.get("data", {})
    qr_url = data.get("qr_url")
    order_id = data.get("order_id", order_id)
    upi_id = data.get("upi_id", upi_id)
    expires_at_str = data.get("expires_at_ist")
    created_at = data.get("created_at_ist")
    
    # Parse expiry time
    try:
        expiry_time = datetime.strptime(expires_at_str, "%d-%m-%Y %H:%M:%S") if expires_at_str else datetime.now() + timedelta(minutes=5)
        expires_timestamp = int(expiry_time.timestamp())
    except Exception:
        expires_timestamp = int(time.time() + 300)  # 5 minutes from now
    
    # Save transaction
    db_query("INSERT INTO transactions (order_id, user_id, amount_inr, status, timestamp, qr_url, upi_id, expires_at) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)", 
             (order_id, user_id, inr_amount, current_time, qr_url, upi_id, expires_timestamp))
    
    # Create message with QR
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔄 Verify Payment", callback_data=f"verify_{order_id}", style="primary")],
        [InlineKeyboardButton(text="🖼 View QR Code", url=qr_url, style="success")],
        [InlineKeyboardButton(text="Cancel Transaction", callback_data="menu_add_balance", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
    ])
    
    text = (
        f"🧾 <b>SECURE QR CODE GENERATED</b>\n\n"
        f"💵 <b>Amount:</b> {fmt_curr(inr_amount)}\n"
        f"🆔 <b>Order ID:</b> <code>{order_id}</code>\n"
        f"🏦 <b>UPI ID:</b> <code>{upi_id}</code>\n"
        f"⏳ <b>QR Expires:</b> {expires_at_str}\n"
        f"📅 <b>Created:</b> {created_at}\n\n"
        f"📱 <b>How to Pay:</b>\n"
        f"1️⃣ Scan the QR code or use UPI ID\n"
        f"2️⃣ Send EXACT amount: {fmt_curr(inr_amount)}\n"
        f"3️⃣ Click <b>Verify Payment</b> after sending\n"
        f"4️⃣ Auto-verify will also detect payment!"
    )
    
    log_activity(user_id, "GENERATE_INVOICE_FAMPAY", f"Amount: {inr_amount}, Order ID: {order_id}")

    # Generate and send a local PNG QR automatically if `qrcode` is available.
    qr_file = generate_upi_qr_file(upi_id, inr_amount)
    if qr_file:
        try:
            await message_obj.delete()
        except Exception:
            pass # Ignore if message cannot be deleted
        await bot.send_photo(
            user_id,
            qr_file,
            caption=text,
            reply_markup=kb,
            parse_mode="HTML"
        )
    else:
        # Fallback to sending just the text message with external QR link (if any).
        await message_obj.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data.startswith("verify_"))
async def manual_verify_callback(call: CallbackQuery):
    order_id = call.data.split("_", 1)[1]
    await run_payment_verification(call.from_user.id, order_id, call)

# ==============================================================================
# 13. BINANCE CRYPTO PAYMENT
# ==============================================================================
@dp.callback_query(F.data == "gateway_crypto")
async def add_balance_crypto(call: CallbackQuery, state: FSMContext):
    address_check = db_query("SELECT value FROM settings WHERE key='binance_address'", fetchone=True)
    if not address_check or not address_check[0]:
        return await call.message.edit_text("⚠️ Binance Gateway is currently offline. Admin has not set a deposit address.", reply_markup=back_kb("menu_add_balance"), parse_mode='HTML')
    deposit_address = address_check[0]
    msg = (f"🪙 <b>— BINANCE USDT DEPOSIT —</b> 🪙\n\n💵 <b>Exchange Rate:</b> 1 USDT = ₹{USDT_TO_INR}\n⚠️ <b>Network:</b> Please send via <b>TRC20</b> or <b>BEP20</b>.\n\n👇 <b>Send your USDT to this exact address:</b>\n<code>{deposit_address}</code>\n\n━━━━━━━━━━━━━━━━━━\n✅ <b>After sending the USDT, reply to this message with your exact TxID (Transaction Hash) to instantly claim your balance.</b>")
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="Cancel", callback_data="menu_add_balance", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]])
    await call.message.edit_text(msg, reply_markup=kb, parse_mode='HTML')
    await state.set_state(UserStates.wait_for_crypto_txid)

@dp.message(UserStates.wait_for_crypto_txid)
async def process_crypto_txid(m: Message, state: FSMContext):
    txid = m.text.strip()
    user_id = m.from_user.id
    if len(txid) < 10: return await m.answer("❌ That doesn't look like a valid TxID. Please try again.")
    if db_query("SELECT txid FROM crypto_txns WHERE txid=?", (txid,), fetchone=True):
        return await m.answer("⚠️ This Transaction ID has already been claimed in the system!", reply_markup=back_kb("menu_add_balance"), parse_mode='HTML')
    api_key_check = db_query("SELECT value FROM settings WHERE key='binance_api'", fetchone=True)
    secret_key_check = db_query("SELECT value FROM settings WHERE key='binance_secret'", fetchone=True)
    if not api_key_check or not secret_key_check:
        return await m.answer("⚠️ Binance API is missing on the server. Contact Support.", reply_markup=back_kb("menu_add_balance"), parse_mode='HTML')
    await m.answer("🔄 <b>Verifying your TxID with Binance Blockchain...</b>\n<i>This may take up to 30 seconds...</i>", parse_mode='HTML')
    api_key = api_key_check[0]; secret_key = secret_key_check[0]
    timestamp = int(time.time() * 1000)
    query_string = f"timestamp={timestamp}"
    signature = hmac.new(secret_key.encode('utf-8'), query_string.encode('utf-8'), hashlib.sha256).hexdigest()
    headers = {'X-MBX-APIKEY': api_key}
    url = f"https://api.binance.com/sapi/v1/capital/deposit/hisrec?{query_string}&signature={signature}"
    try:
        resp_status, resp_body = await http_request("GET", url, headers=headers, timeout=30)
        if resp_status == 200:
            try:
                history = json.loads(resp_body.decode("utf-8", errors="replace"))
            except Exception:
                history = []
            found = False
            for deposit in history:
                if deposit.get("txId") == txid and deposit.get("status") == 1:
                    found = True
                    usdt_amount = float(deposit.get("amount"))
                    inr_amount = usdt_amount * USDT_TO_INR
                    db_query("INSERT INTO crypto_txns (txid, user_id, amount_usdt, timestamp) VALUES (?, ?, ?, ?)", (txid, user_id, usdt_amount, int(time.time())))
                    db_query("UPDATE users SET balance = balance + ? WHERE user_id=?", (inr_amount, user_id))
                    await m.answer(f"🎉 <b>CRYPTO DEPOSIT SUCCESSFUL!</b>\n\n✅ We safely received <b>{usdt_amount} USDT</b>.\n💰 <b>{fmt_curr(inr_amount)}</b> has been added to your balance!", reply_markup=main_menu_kb(m.from_user.id), parse_mode='HTML')
                    await send_advanced_notification(user_id, "DEPOSIT", inr_amount, product=txid, gateway="Binance Crypto")
                    log_activity(user_id, "CRYPTO_DEPOSIT", f"TxID: {txid}, Amount: {inr_amount}")
                    await state.clear()
                    break
            if not found:
                await m.answer("❌ <b>TxID Not Found or Still Pending!</b>\nMake sure the transaction is fully confirmed. Try again in 5 mins.", reply_markup=back_kb("menu_add_balance"), parse_mode='HTML')
        else:
            await m.answer(f"⚠️ <b>Binance Server Error:</b> HTTP {resp_status}.", reply_markup=back_kb("menu_add_balance"), parse_mode='HTML')
    except Exception as e:
        await m.answer(f"⚠️ <b>Connection Error:</b> {str(e)}", reply_markup=back_kb("menu_add_balance"), parse_mode='HTML')

# ==============================================================================
# 14. SHOP – with uppercase categories and new point_down emoji
# ==============================================================================
@dp.callback_query(F.data == "menu_shop")
async def view_shop_panels(call: CallbackQuery):
    log_activity(call.from_user.id, "VIEW_SHOP")
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    text = f"{get_emoji('product_store')} <b><u>SELECT PRODUCT PANEL</u></b>\n━━━━━━━━━━━━━━━━━━\n\n{get_emoji('point_down')} <b>Choose a panel to view its packages:</b>"
    for cat in FIXED_CATEGORIES:
        # Ensure that the count query properly handles the category string.
        count = db_query("SELECT COUNT(*) FROM products WHERE category = ? AND is_active=1", (cat,), fetchone=True)[0]
        emoji_id = get_category_emoji(cat)
        kb.inline_keyboard.append([InlineKeyboardButton(text=cat, callback_data=f"cat_{cat[:30]}", icon_custom_emoji_id=emoji_id, style="primary")])
    kb.inline_keyboard.append([InlineKeyboardButton(text="BACK", callback_data="back_main", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")])
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data.startswith("cat_"))
async def view_panel_names(call: CallbackQuery):
    category = call.data.split("cat_", 1)[1]
    panel_rows = db_query("SELECT panel_name, MAX(is_maintenance) FROM products WHERE category = ? AND is_active=1 AND panel_name != '' GROUP BY panel_name", (category,), fetchall=True)
    if not panel_rows:
        prods = db_query("SELECT id, name, price_inr, stock, reseller_price, validity, device_limit, panel_name, category, bantibhaiya_product_pid FROM products WHERE category = ? AND is_active=1", (category,), fetchall=True)
        if not prods: return await call.answer("❌ No products available in this category yet.", show_alert=True)
        await show_products_for_panel(call, prods, category)
        return
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    text = f"{get_emoji('product_store')} <b><u>{category.upper()} PANELS</u></b>\n━━━━━━━━━━━━━━━━━━\n\n{get_emoji('point_down')} <b>Choose a panel name:</b>"
    for pn in panel_rows:
        panel = pn[0]
        is_maint = bool(pn[1]) if len(pn) > 1 else False
        emoji_id = get_panel_emoji(panel) or get_emoji_icon("product_store")
        
        if is_maint:
            btn_text = f"🔴 {panel} (Under Maintenance)"
            kb.inline_keyboard.append([InlineKeyboardButton(text=btn_text, callback_data=f"maint_alert_{category[:30]}_{panel[:30]}", style="danger")])
        else:
            kb.inline_keyboard.append([InlineKeyboardButton(text=panel, callback_data=f"pnl_{category[:30]}_{panel[:30]}", icon_custom_emoji_id=emoji_id, style="primary")])
            
    kb.inline_keyboard.append([InlineKeyboardButton(text="BACK TO PANELS", callback_data="menu_shop", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")])
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data.startswith("maint_alert_"))
async def maint_alert_handler(call: CallbackQuery):
    parts = call.data.split("maint_alert_", 1)[1].split("_", 1)
    panel_name = parts[1] if len(parts) > 1 else "This panel"
    await call.answer(f"⚠️ [ {panel_name} ] is currently UNDER MAINTENANCE!\n\nOur team is currently updating this server. Purchases are temporarily disabled. Please check back later!", show_alert=True)

@dp.callback_query(F.data.startswith("pnl_"))
async def view_products_for_panel(call: CallbackQuery):
    parts = call.data.split("pnl_", 1)[1].split("_", 1)
    if len(parts) != 2: return await call.answer("Invalid selection.", show_alert=True)
    category, panel_name = parts[0], parts[1]
    
    # Check maintenance mode
    maint_check = db_query("SELECT is_maintenance FROM products WHERE category = ? AND panel_name = ? LIMIT 1", (category, panel_name), fetchone=True)
    if maint_check and maint_check[0] == 1:
        return await call.answer(f"⚠️ [ {panel_name} ] is currently UNDER MAINTENANCE! Purchases are temporarily disabled.", show_alert=True)
        
    prods = db_query("SELECT id, name, price_inr, stock, reseller_price, validity, device_limit, panel_name, category, bantibhaiya_product_pid FROM products WHERE category = ? AND panel_name = ? AND is_active=1", (category, panel_name), fetchall=True)
    if not prods: return await call.answer("No products found for this panel.", show_alert=True)
    await show_products_for_panel(call, prods, f"{category} - {panel_name}")

async def show_products_for_panel(call: CallbackQuery, prods: List[Tuple], header: str):
    user = db_query("SELECT is_reseller, is_vip FROM users WHERE user_id=?", (call.from_user.id,), fetchone=True)
    is_reseller = bool(user[0]) if user else False
    is_vip = bool(user[1]) if user else False
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    text = f"{get_emoji('product_store')} <b><u>{header.upper()} PACKAGES</u></b>\n━━━━━━━━━━━━━━━━━━\n\n"
    for p in prods:
        # SELECT id, name, price_inr, stock, reseller_price, validity, device_limit, panel_name, category, bantibhaiya_product_pid
        prod_id, package_name, normal_price, stock, reseller_price, validity, device, panel_name_from_db, category_from_db, bb_pid = p
        
        normal_price = safe_float(normal_price)
        reseller_price = safe_float(reseller_price)
        base_price = reseller_price if is_reseller else normal_price
        if is_vip: display_price = base_price - (base_price * (VIP_DISCOUNT_PERCENTAGE / 100))
        else: display_price = base_price
        
        is_available = bool(bb_pid) or (stock > 0)
        stock_status = "⚡ Instant Auto-Key" if bb_pid else ("✅ In Stock" if stock > 0 else "❌ Out of Stock")
        
        text += f"{get_emoji('product_store')} ⏱ <b>Validity: {package_name}</b>\n"
        if is_reseller or is_vip:
            text += f"💰 Regular Price: <s>{fmt_curr(normal_price)}</s>\n"
            if is_reseller and not is_vip: text += f"👑 <b>Reseller Price: {fmt_curr(display_price)}</b>\n"
            elif is_vip and not is_reseller: text += f"🌟 <b>VIP Price: {fmt_curr(display_price)}</b>\n"
            else: text += f"👑🌟 <b>Super Price: {fmt_curr(display_price)}</b>\n"
        else: text += f"💰 Price: {fmt_curr(normal_price)}\n"
        text += f"📱 Limit: {device} | 📦 {stock_status}\n\n"
        if is_available:
            kb.inline_keyboard.append([InlineKeyboardButton(text=f"Buy {package_name} - {fmt_curr(display_price)}", callback_data=f"buy_{prod_id}", icon_custom_emoji_id=get_emoji_icon("product_store"), style="success")])
        else:
            kb.inline_keyboard.append([InlineKeyboardButton(text=f"❌ {package_name} (Out of Stock)", callback_data="ignore_stock_click", style="danger")])
    text += f"{get_emoji('point_down')} <b>Select package below to instantly purchase:</b>"
    kb.inline_keyboard.append([InlineKeyboardButton(text="BACK TO PANELS", callback_data="menu_shop", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")])
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data == "ignore_stock_click")
async def ignore_stock_click(call: CallbackQuery):
    await call.answer("⚠️ This duration is currently Out of Stock! Admins have been notified.", show_alert=True)

@dp.callback_query(F.data.startswith("buy_"))
async def process_buy(call: CallbackQuery):
    prod_id = int(call.data.split("_")[1])
    prod = db_query("SELECT name, price_inr, stock, apk_link, validity, device_limit, category, reseller_price, panel_name, bantibhaiya_product_pid, bantibhaiya_product_duration FROM products WHERE id=?", (prod_id,), fetchone=True)
    user = db_query("SELECT balance, is_reseller, total_saved, is_vip FROM users WHERE user_id=?", (call.from_user.id,), fetchone=True)
    if not prod: return await call.answer("❌ Item not found in DB!", show_alert=True)
    
    prod_name, normal_price, stock_count, apk_link, validity, device_limit, category_name, reseller_price, panel_name, bb_pid, bb_duration = prod
    
    normal_price = safe_float(normal_price)
    reseller_price = safe_float(reseller_price)
    is_reseller = bool(user[1]); is_vip = bool(user[3])
    base_price = reseller_price if is_reseller else normal_price
    if is_vip: final_price = base_price - (base_price * (VIP_DISCOUNT_PERCENTAGE / 100))
    else: final_price = base_price
    savings = normal_price - final_price
    
    if user[0] < final_price: 
        return await call.answer(f"❌ Insufficient Balance! You need {fmt_curr(final_price)}.\nPlease Top Up your wallet.", show_alert=True)
    
    delivered_key = ""
    # 1. Generate key directly from Bantibhaiya Reseller API using Product PID & Duration
    if bb_pid and bb_duration:
        await call.answer("⚡ Generating key from Bantibhaiya Server...", show_alert=False)
        success, key_or_err = await generate_bantibhaiya_key(bb_pid, bb_duration, device_limit)
        if not success:
            logger.error(f"Bantibhaiya key gen failed for user {call.from_user.id}: {key_or_err}")
            try:
                await bot.send_message(
                    ADMIN_ID,
                    f"⚠️ <b>BANTIBHAIYA RESELLER API ERROR</b>\n\n"
                    f"👤 <b>User:</b> <code>{call.from_user.id}</code> (@{call.from_user.username or 'none'})\n"
                    f"📦 <b>Product:</b> {category_name} - {panel_name} ({prod_name})\n"
                    f"🔑 <b>PID:</b> <code>{bb_pid}</code> | <b>Duration:</b> <code>{bb_duration}</code>\n"
                    f"❌ <b>Error:</b> <code>{html.escape(str(key_or_err))}</code>\n\n"
                    f"<i>User balance was NOT deducted. Check your Reseller API key/balance.</i>",
                    parse_mode='HTML'
                )
            except Exception:
                pass
            return await call.answer(f"❌ Key Generation Failed:\n{key_or_err}\n\nYour balance is SAFE (NOT deducted).", show_alert=True)
        delivered_key = str(key_or_err).strip()
    else:
        # Fallback to local stock if no PID configured
        if stock_count > 0:
            key_data = db_query("SELECT id, key_text FROM product_keys WHERE product_id=? AND is_used=0 LIMIT 1", (prod_id,), fetchone=True)
            if key_data:
                delivered_key = key_data[1]
                db_query("UPDATE product_keys SET is_used=1 WHERE id=?", (key_data[0],))
                db_query("UPDATE products SET stock=stock-1 WHERE id=?", (prod_id,))
            else:
                return await call.answer("❌ Out of stock! No Bantibhaiya PID configured for this product.", show_alert=True)
        else:
            return await call.answer("❌ Out of stock! Please contact Admin to configure Bantibhaiya PID.", show_alert=True)
    
    # Deduct wallet balance only AFTER key is generated
    db_query("UPDATE users SET balance=?, spent=spent+?, orders_count=orders_count+1, total_saved=total_saved+? WHERE user_id=?", (user[0] - final_price, final_price, savings, call.from_user.id))
    
    product_full_name = f"{category_name} - {panel_name} ({prod_name})"
    db_query("INSERT INTO orders (user_id, product_name, price_paid, delivered_key, purchase_date) VALUES (?, ?, ?, ?, ?)", (call.from_user.id, product_full_name, final_price, delivered_key, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    log_activity(call.from_user.id, "PURCHASE_SUCCESS", f"Product: {product_full_name}, Paid: {final_price}")
    await send_advanced_notification(call.from_user.id, "ORDER", final_price, product=product_full_name, key=delivered_key)
    asyncio.create_task(process_referral_reward_on_purchase(call.from_user.id))
    
    msg = (f"✅ <b>PURCHASE SUCCESSFUL!</b>\n━━━━━━━━━━━━━━━━━━\n📦 <b>Panel:</b> {category_name}\n📁 <b>Panel Name:</b> {panel_name}\n⏱ <b>Package:</b> {prod_name}\n💰 <b>Amount Deducted:</b> {fmt_curr(final_price)}\n📱 <b>Device Limit:</b> {device_limit}\n━━━━━━━━━━━━━━━━━━\n")
    if apk_link and apk_link.startswith("http"): msg += f"📥 <b>APK Link:</b> <a href='{apk_link}'>Click Here to Download</a>\n\n"
    msg += f"🔑 <b>Your Exclusive Key:</b>\n<code>{delivered_key}</code>\n\n<i>For any issues or guide, tap Support or contact: {ADMIN_CONTACT}</i>"
    await call.message.edit_text(msg, reply_markup=back_kb("menu_shop"), disable_web_page_preview=True, parse_mode='HTML')

# ==============================================================================
# 15. USER DASHBOARD, FILES, VIP, RESELLER, ORDERS, PROFILE
# ==============================================================================

@dp.callback_query(F.data == "menu_vip_dash")
async def vip_dashboard(call: CallbackQuery):
    u = db_query("SELECT balance, is_vip, vip_since FROM users WHERE user_id=?", (call.from_user.id,), fetchone=True)
    is_vip = bool(u[1])
    status_str = "🟢 Active (Lifetime)" if is_vip else "🔴 Not Subscribed"
    text = get_ui_text("vip_menu", vip_status=status_str)
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    if is_vip:
        text += f"\n📅 <b>Member Since:</b> {u[2]}\n\nEnjoy your permanent 15% discount!"
    else:
        text += f"\n\n💳 <b>Your Current Balance:</b> {fmt_curr(u[0])}\n"
        if u[0] >= VIP_PRICE_INR: kb.inline_keyboard.append([InlineKeyboardButton(text=f"✅ Purchase VIP for {fmt_curr(VIP_PRICE_INR)}", callback_data="execute_vip_upgrade", style="success")])
        else:
            kb.inline_keyboard.append([InlineKeyboardButton(text=f"❌ Need {fmt_curr(VIP_PRICE_INR)} to Upgrade", callback_data="ignore_stock_click", style="danger")])
            kb.inline_keyboard.append([InlineKeyboardButton(text="💳 Add Balance Now", callback_data="menu_add_balance", style="primary")])
    kb.inline_keyboard.append([InlineKeyboardButton(text="BACK", callback_data="back_main", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")])
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data == "execute_vip_upgrade")
async def execute_vip_upgrade(call: CallbackQuery):
    u = db_query("SELECT balance, is_vip FROM users WHERE user_id=?", (call.from_user.id,), fetchone=True)
    if u[1]: return await call.answer("⚠️ You are already a VIP Member!", show_alert=True)
    if u[0] < VIP_PRICE_INR: return await call.answer(f"❌ Your balance dropped below {VIP_PRICE_INR}.", show_alert=True)
    new_balance = u[0] - VIP_PRICE_INR
    now_date = datetime.now().strftime("%Y-%m-%d")
    db_query("UPDATE users SET balance=?, is_vip=1, vip_since=? WHERE user_id=?", (new_balance, now_date, call.from_user.id))
    log_activity(call.from_user.id, "UPGRADED_VIP")
    try: await bot.send_message(ADMIN_ID, f"🌟 <b>NEW VIP UPGRADE</b>\n👤 User ID: <code>{call.from_user.id}</code>", parse_mode='HTML')
    except: pass
    await call.answer("🎉 Upgrade Successful! You are now a VIP Member.", show_alert=True)
    await vip_dashboard(call)

@dp.callback_query(F.data == "menu_reseller_dash")
async def reseller_dashboard(call: CallbackQuery):
    u = db_query("SELECT balance, is_reseller, reseller_since, total_saved FROM users WHERE user_id=?", (call.from_user.id,), fetchone=True)
    status_check = db_query("SELECT value FROM settings WHERE key='reseller_system_status'", fetchone=True)
    system_status = status_check[0] if status_check else "ON"
    setup_fee = safe_float(get_setting("reseller_setup_fee", "200.0"))
    min_balance = safe_float(get_setting("reseller_min_balance", "500.0"))
    if u[1]: 
        text = (f"{get_emoji('shield_icon')} <b><u>— RESELLER DASHBOARD —</u></b> {get_emoji('shield_icon')}\n\n🟢 <b>Status:</b> Active\n📅 <b>Since:</b> {u[2]}\n{get_emoji('money_icon')} <b>Total Saved:</b> {fmt_curr(u[4])}\n\n🎉 You are enjoying exclusive wholesale prices on all products!")
        kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="BACK", callback_data="back_main", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]])
        await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')
        return
    if system_status == "OFF": return await call.answer("⚠️ Wholesale / Reseller registrations are currently closed by Admin.", show_alert=True)
    text = (f"⚡ <b><u>— BECOME A RESELLER —</u></b> ⚡\n\nUpgrade your account to access wholesale <b>Reseller Prices</b>!\n\n📋 <b>Requirements to Upgrade:</b>\n1️⃣ Must have a minimum balance of <b>{fmt_curr(min_balance)}</b>.\n2️⃣ A one-time setup fee of <b>{fmt_curr(setup_fee)}</b> will be deducted.\n\n💳 <b>Your Current Balance:</b> {fmt_curr(u[0])}\n")
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    if u[0] >= min_balance: kb.inline_keyboard.append([InlineKeyboardButton(text=f"✅ Pay {fmt_curr(setup_fee)} & Become Reseller", callback_data="execute_reseller_upgrade", style="success")])
    else:
        kb.inline_keyboard.append([InlineKeyboardButton(text=f"❌ Insufficient Balance (Need {fmt_curr(min_balance)})", callback_data="ignore_stock_click", style="danger")])
        kb.inline_keyboard.append([InlineKeyboardButton(text="💳 Add Balance", callback_data="menu_add_balance", style="primary")])
    kb.inline_keyboard.append([InlineKeyboardButton(text="BACK", callback_data="back_main", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")])
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data == "execute_reseller_upgrade")
async def execute_reseller_upgrade(call: CallbackQuery):
    setup_fee = safe_float(get_setting("reseller_setup_fee", "200.0"))
    min_balance = safe_float(get_setting("reseller_min_balance", "500.0"))
    u = db_query("SELECT balance, is_reseller FROM users WHERE user_id=?", (call.from_user.id,), fetchone=True)
    if u[1]: return await call.answer("⚠️ You are already a Reseller!", show_alert=True)
    if u[0] < min_balance: return await call.answer(f"❌ Your balance dropped below {fmt_curr(min_balance)}. Please top up.", show_alert=True)
    new_balance = u[0] - setup_fee
    db_query("UPDATE users SET balance=?, is_reseller=1, reseller_since=?, account_type='Reseller' WHERE user_id=?", (new_balance, datetime.now().strftime("%Y-%m-%d"), call.from_user.id))
    log_activity(call.from_user.id, "UPGRADED_RESELLER")
    try: await bot.send_message(ADMIN_ID, f"👑 <b>NEW RESELLER UPGRADE</b>\n👤 User ID: <code>{call.from_user.id}</code>", parse_mode='HTML')
    except: pass
    await call.answer("🎉 Upgrade Successful! Welcome to the Reseller tier.", show_alert=True)
    await reseller_dashboard(call)

@dp.callback_query(F.data == "menu_orders")
async def my_orders(call: CallbackQuery):
    user_id = call.from_user.id
    orders = db_query(
        "SELECT product_name, delivered_key, purchase_date, price_paid FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 25",
        (user_id,), fetchall=True
    )
    if not orders:
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🛒 Go to Store", callback_data="menu_shop", style="success")],
            [InlineKeyboardButton(text="👤 My Profile", callback_data="menu_profile", style="primary")],
            [InlineKeyboardButton(text="BACK", callback_data="back_main", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
        ])
        return await call.message.edit_text(
            "🔑 <b><u>— YOUR KEY PURCHASE HISTORY —</u></b> 🔑\n\n"
            "📭 <i>Your key vault is currently empty!</i>\n\n"
            "Purchase any panel from the Product Store and your delivered keys will appear here 24/7.",
            reply_markup=kb, parse_mode='HTML'
        )

    text = "🔑 <b><u>— YOUR KEY PURCHASE VAULT —</u></b> 🔑\n\n"
    text += f"📦 Total Purchased Keys: <b>{len(orders)}</b>\n<i>(Tap any key code below to copy instantly)</i>\n━━━━━━━━━━━━━━━━━━\n"
    for o in orders:
        p_name, key_text, p_date, p_price = o
        p_date_str = format_timestamp(p_date)
        text += (
            f"📁 <b>{html.escape(str(p_name))}</b>\n"
            f"🔑 <code>{html.escape(str(key_text))}</code>\n"
            f"💵 <b>Price:</b> {fmt_curr(p_price)} | 📅 <i>{p_date_str}</i>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
        )

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📊 All Transactions", callback_data="menu_transactions", style="primary"),
            InlineKeyboardButton(text="👤 My Profile", callback_data="menu_profile", style="primary")
        ],
        [
            InlineKeyboardButton(text="🛒 Buy More Keys", callback_data="menu_shop", style="success")
        ],
        [InlineKeyboardButton(text="BACK", callback_data="back_main", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
    ])
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data == "menu_transactions")
async def user_transactions(call: CallbackQuery):
    user_id = call.from_user.id
    txns = db_query(
        "SELECT order_id, amount_inr, status, timestamp, upi_id FROM transactions WHERE user_id=? ORDER BY timestamp DESC LIMIT 20",
        (user_id,), fetchall=True
    ) or []
    crypto = db_query(
        "SELECT txid, amount_usdt, timestamp FROM crypto_txns WHERE user_id=? ORDER BY timestamp DESC LIMIT 5",
        (user_id,), fetchall=True
    ) or []

    if not txns and not crypto:
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="💳 Add Balance Now", callback_data="menu_add_balance", style="success")],
            [InlineKeyboardButton(text="👤 My Profile", callback_data="menu_profile", style="primary")],
            [InlineKeyboardButton(text="BACK", callback_data="back_main", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
        ])
        return await call.message.edit_text(
            "💳 <b><u>— YOUR TRANSACTION HISTORY —</u></b> 💳\n\n"
            "📭 <i>No deposit transactions found.</i>\n\n"
            "Use the 'Add Balance' option to top up your wallet via UPI or Crypto.",
            reply_markup=kb, parse_mode='HTML'
        )

    text = "💳 <b><u>— YOUR TRANSACTION HISTORY —</u></b> 💳\n\n"
    text += f"📊 Total Records: <b>{len(txns) + len(crypto)}</b>\n━━━━━━━━━━━━━━━━━━\n"

    for t in txns:
        oid, amt, st, ts, upi = t
        st_clean = str(st).lower()
        if st_clean in ("paid", "success", "completed"):
            badge = "🟢 <b>PAID / SUCCESS</b>"
        elif st_clean in ("pending", "waiting"):
            badge = "🟡 <b>PENDING</b>"
        elif st_clean in ("expired", "cancelled", "failed"):
            badge = "🔴 <b>EXPIRED</b>"
        else:
            badge = f"⚪ <b>{str(st).upper()}</b>"

        date_str = format_timestamp(ts)
        text += (
            f"{badge} | <b>Order:</b> <code>{html.escape(str(oid))}</code>\n"
            f"💰 <b>Amount:</b> <b>{fmt_curr(amt)}</b>\n"
            f"📅 <b>Date:</b> <i>{date_str}</i>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
        )

    for c in crypto:
        txid, usdt, ts = c
        date_str = format_timestamp(ts)
        text += (
            f"🪙 <b>CRYPTO (USDT)</b> | 🟢 <b>VERIFIED</b>\n"
            f"💰 <b>Amount:</b> <b>${safe_float(usdt):.2f} USDT</b>\n"
            f"🆔 <b>TXID:</b> <code>{html.escape(str(txid)[:18])}...</code>\n"
            f"📅 <b>Date:</b> <i>{date_str}</i>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
        )

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🔑 Key Vault", callback_data="menu_orders", style="primary"),
            InlineKeyboardButton(text="👤 My Profile", callback_data="menu_profile", style="primary")
        ],
        [
            InlineKeyboardButton(text="💳 Add Balance", callback_data="menu_add_balance", style="success")
        ],
        [InlineKeyboardButton(text="BACK", callback_data="back_main", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
    ])
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data == "menu_profile")
async def show_profile(call: CallbackQuery):
    user_id = call.from_user.id
    u = db_query("SELECT user_id, first_name, username, balance, account_type, orders_count, spent, joined_date, is_reseller, reseller_since, total_saved, is_vip FROM users WHERE user_id=?", (user_id,), fetchone=True)
    if not u:
        db_query(
            "INSERT OR IGNORE INTO users (user_id, first_name, username, joined_date) VALUES (?, ?, ?, ?)",
            (user_id, call.from_user.first_name or "User", call.from_user.username or "", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        )
        u = db_query("SELECT user_id, first_name, username, balance, account_type, orders_count, spent, joined_date, is_reseller, reseller_since, total_saved, is_vip FROM users WHERE user_id=?", (user_id,), fetchone=True)

    uid, first_name, uname, balance, acc_type, orders_count, spent, joined_date, is_reseller, reseller_since, total_saved, is_vip = u
    
    balance = safe_float(balance, 0.0)
    spent = safe_float(spent, 0.0)
    total_saved = safe_float(total_saved, 0.0)
    orders_count = int(orders_count or 0)

    acc_type_display = []
    if is_reseller: acc_type_display.append(f"{get_emoji('reseller')} Reseller")
    if is_vip: acc_type_display.append(f"{get_emoji('vip')} VIP")
    type_str = " | ".join(acc_type_display) if acc_type_display else f"{get_emoji('regular_user')} Regular User"
    
    display_name = html.escape(str(first_name or "User"))
    display_uname = f"@{html.escape(str(uname))}" if uname else "Not set"

    text = (
        f"{get_emoji('grid_id')} <b><u>— YOUR SECURE PROFILE —</u></b> {get_emoji('grid_id')}\n\n"
        f"{get_emoji('grid_id')} <b>User ID:</b> <code>{uid}</code>\n"
        f"{get_emoji('name')} <b>Name:</b> <b>{display_name}</b>\n"
        f"🔗 <b>Username:</b> {display_uname}\n"
        f"{get_emoji('account_level')} <b>Account Level:</b> {type_str}\n\n"
        f"{get_emoji('wallet_left')} <b>— Wallet Balance —</b> {get_emoji('wallet_right')}\n"
        f"💰 <b>Current Balance:</b> <b>{fmt_curr(balance)}</b>\n\n"
        f"{get_emoji('global_stats')} <b>— Account Statistics —</b>\n"
        f"📦 <b>Total Keys Purchased:</b> <b>{orders_count} Keys</b>\n"
        f"💸 <b>Total Money Spent:</b> <b>{fmt_curr(spent)}</b>\n"
    )
    if is_reseller:
        text += f"{get_emoji('shield_icon')} <b>— RESELLER METRICS —</b> {get_emoji('shield_icon')}\n💰 <b>Total Saved via Reseller:</b> {fmt_curr(total_saved)}\n\n"
    text += f"📅 <b>Registered Date:</b> <i>{joined_date or 'N/A'}</i>\n\n"

    # 1. Recent Key History in Profile
    orders = db_query(
        "SELECT product_name, delivered_key, purchase_date, price_paid FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 3",
        (user_id,), fetchall=True
    )
    text += f"🔑 <b><u>— KEY PURCHASE HISTORY (RECENT) —</u></b>\n"
    if orders:
        for o in orders:
            p_name, k_text, p_date, p_price = o
            text += (
                f"📦 <b>{html.escape(str(p_name))}</b>\n"
                f"🔑 <code>{html.escape(str(k_text))}</code>\n"
                f"💵 <b>{fmt_curr(p_price)}</b> | 📅 <i>{format_timestamp(p_date)}</i>\n"
                f"━━━━━━━━━━━━━━━━━━\n"
            )
    else:
        text += "📭 <i>No keys purchased yet.</i>\n━━━━━━━━━━━━━━━━━━\n"

    # 2. Recent Transaction History in Profile
    txns = db_query(
        "SELECT order_id, amount_inr, status, timestamp FROM transactions WHERE user_id=? ORDER BY timestamp DESC LIMIT 3",
        (user_id,), fetchall=True
    )
    text += f"\n💳 <b><u>— TRANSACTION HISTORY (DEPOSITS) —</u></b>\n"
    if txns:
        for t in txns:
            oid, amt, st, ts = t
            st_clean = str(st).lower()
            if st_clean in ("paid", "success", "completed"):
                badge = "🟢 PAID"
            elif st_clean in ("pending", "waiting"):
                badge = "🟡 PENDING"
            elif st_clean in ("expired", "cancelled"):
                badge = "🔴 EXPIRED"
            else:
                badge = f"⚪ {str(st).upper()}"
            text += (
                f"{badge} | <code>{html.escape(str(oid))}</code>\n"
                f"💰 <b>{fmt_curr(amt)}</b> | 📅 <i>{format_timestamp(ts)}</i>\n"
                f"━━━━━━━━━━━━━━━━━━\n"
            )
    else:
        text += "📭 <i>No deposit transactions yet.</i>\n━━━━━━━━━━━━━━━━━━\n"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🔑 View All Keys", callback_data="menu_orders", icon_custom_emoji_id=get_emoji_icon('history'), style="primary"),
            InlineKeyboardButton(text="📊 All Transactions", callback_data="menu_transactions", style="primary")
        ],
        [
            InlineKeyboardButton(text="💳 Add Balance", callback_data="menu_add_balance", icon_custom_emoji_id=get_emoji_icon('add_balance'), style="success"),
            InlineKeyboardButton(text="🎟 Redeem Code", callback_data="redeem_coupon", icon_custom_emoji_id=get_emoji_icon('redeem_icon'), style="primary")
        ],
        [InlineKeyboardButton(text="BACK", callback_data="back_main", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
    ])
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data == "redeem_coupon")
async def redeem_coupon_start(call: CallbackQuery, state: FSMContext):
    await call.message.edit_text("🎟 <b>Please enter your VIP / Promo redeem code below:</b>", reply_markup=back_kb("menu_profile"), parse_mode='HTML')
    await state.set_state(UserStates.wait_for_redeem)

@dp.message(UserStates.wait_for_redeem)
async def process_redeem(m: Message, state: FSMContext):
    code = m.text.strip().upper()
    user_id = m.from_user.id
    if db_query("SELECT * FROM redeemed WHERE user_id=? AND code=?", (user_id, code), fetchone=True):
        await m.answer("❌ Anti-Fraud Alert: You already redeemed this unique code!", reply_markup=main_menu_kb(m.from_user.id), parse_mode='HTML')
        await state.clear()
        return
    coupon = db_query("SELECT amount, uses_left FROM coupons WHERE code=?", (code,), fetchone=True)
    if not coupon: await m.answer("❌ Invalid or Expired Code!", reply_markup=main_menu_kb(m.from_user.id), parse_mode='HTML')
    elif coupon[1] <= 0: await m.answer("❌ This code's usage limit has been fully claimed by other users.", reply_markup=main_menu_kb(m.from_user.id), parse_mode='HTML')
    else:
        db_query("UPDATE users SET balance = balance + ? WHERE user_id=?", (coupon[0], user_id))
        db_query("UPDATE coupons SET uses_left = uses_left - 1 WHERE code=?", (code,))
        db_query("INSERT INTO redeemed (user_id, code) VALUES (?, ?)", (user_id, code))
        log_activity(user_id, "PROMO_REDEEMED", f"Code: {code}, Amount: {coupon[0]}")
        await m.answer(f"🎉 <b>Success!</b>\nSafely added {fmt_curr(coupon[0])} to your balance!", reply_markup=main_menu_kb(m.from_user.id), parse_mode='HTML')
        try:
            user_info = db_query("SELECT first_name FROM users WHERE user_id=?", (user_id,), fetchone=True)
            uname = user_info[0] if user_info else "Unknown User"
            await bot.send_message(ADMIN_ID, f"🎟 <b>PROMO CODE REDEEMED!</b>\n👤 User: {uname} (<code>{user_id}</code>)\n🔖 Code: <b>{code}</b>\n💵 Amount: {fmt_curr(coupon[0])}", parse_mode='HTML')
        except Exception: pass
    await state.clear()

@dp.callback_query(F.data == "menu_how_to")
async def tutorial_system(call: CallbackQuery):
    video_link_query = db_query("SELECT value FROM settings WHERE key='how_to_video'", fetchone=True)
    video_link = video_link_query[0] if video_link_query and video_link_query[0] != 'None' else None
    text = (f"{get_emoji('tutorial')} <b><u>— TUTORIALS & GUIDE —</u></b> {get_emoji('tutorial')}\n\n1️⃣ Add funds via <b>Add Balance</b>\n2️⃣ Navigate to <b>Product Store</b>\n3️⃣ Choose your desired Panel and Package validity.\n4️⃣ The Key and Installation APK link will be instantly provided.")
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    if video_link: kb.inline_keyboard.append([InlineKeyboardButton(text="Watch Full Video Tutorial", url=video_link, icon_custom_emoji_id=get_emoji_icon("tutorial"), style="primary")])
    kb.inline_keyboard.append([InlineKeyboardButton(text="BACK", callback_data="back_main", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")])
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data == "menu_support")
async def support_center(call: CallbackQuery):
    telegram_link = get_setting("support_telegram", "https://t.me/YourSupport")
    whatsapp_link = get_setting("support_whatsapp", "https://wa.me/YourNumber")
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Contact on Telegram", url=telegram_link, icon_custom_emoji_id=get_emoji_icon("telegram"), style="primary")],
        [InlineKeyboardButton(text="Contact on WhatsApp", url=whatsapp_link, icon_custom_emoji_id=get_emoji_icon("whatsapp"), style="primary")],
        [InlineKeyboardButton(text="🎫 Open New Ticket", callback_data="open_ticket", style="primary"), InlineKeyboardButton(text="📋 My Open Tickets", callback_data="my_tickets", style="primary")], 
        [InlineKeyboardButton(text="BACK", callback_data="back_main", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
    ])
    await call.message.edit_text(f"{get_emoji('telegram')}{get_emoji('whatsapp')} <b><u>— PREMIUM SUPPORT CENTER —</u></b>\n\nContact us via Telegram or WhatsApp for instant help, or open a support ticket for admin assistance.", reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data == "my_tickets")
async def view_my_tickets(call: CallbackQuery):
    tickets = db_query("SELECT id, message, status, created_at FROM tickets WHERE user_id=? ORDER BY id DESC LIMIT 5", (call.from_user.id,), fetchall=True)
    if not tickets: return await call.message.edit_text("📋 You do not have any active or previous support tickets.", reply_markup=back_kb("menu_support"), parse_mode='HTML')
    text = "📋 <b><u>— Your Recent Tickets —</u></b> 📋\n\n"
    for t in tickets:
        status_icon = "🟢" if t[2] == 'Open' else "🔴"
        text += f"🎫 <b>Ticket #{t[0]}</b> | Status: {status_icon} <b>{t[2]}</b>\n📅 <i>{t[3]}</i>\n📝 <i>{t[1][:80]}...</i>\n\n"
    await call.message.edit_text(text, reply_markup=back_kb("menu_support"), parse_mode='HTML')

@dp.callback_query(F.data == "open_ticket")
async def open_ticket_start(call: CallbackQuery, state: FSMContext):
    await call.message.edit_text("📝 <b>Please type your issue/message below in detail:</b>", reply_markup=back_kb("menu_support"), parse_mode='HTML')
    await state.set_state(UserStates.wait_for_ticket)

@dp.message(UserStates.wait_for_ticket)
async def process_ticket(m: Message, state: FSMContext):
    db_query("INSERT INTO tickets (user_id, message, created_at) VALUES (?, ?, ?)", (m.from_user.id, m.text, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    await m.answer("✅ <b>Ticket Submitted Successfully!</b> Admins will reply soon.", reply_markup=main_menu_kb(m.from_user.id), parse_mode='HTML')
    try: await bot.send_message(ADMIN_ID, f"🚨 <b>NEW SUPPORT TICKET</b>\nFrom: <code>{m.from_user.id}</code>\nMsg: {m.text}", parse_mode='HTML')
    except: pass
    log_activity(m.from_user.id, "OPENED_TICKET")
    await state.clear()

# ==============================================================================
# 18. ADMIN PANEL
# ==============================================================================
@dp.message(Command("admin"))
async def admin_panel(message: Message, state: FSMContext):
    if not is_admin_user(message.from_user.id): return
    await state.clear()
    await message.answer("⚙️ <b>Advanced Admin Terminal</b>\n<i>Authorized Access Granted.</i>", reply_markup=admin_kb(), parse_mode='HTML')

@dp.callback_query(F.data == "admin_panel_back")
async def back_to_admin(call: CallbackQuery, state: FSMContext):
    if not is_admin_user(call.from_user.id): return
    await state.clear()
    await call.message.edit_text("⚙️ <b>Advanced Admin Terminal</b>\n<i>Authorized Access Granted.</i>", reply_markup=admin_kb(), parse_mode='HTML')

@dp.callback_query(F.data == "admin_toggle_vip_sys")
async def toggle_vip_sys(call: CallbackQuery):
    if not is_admin_user(call.from_user.id): return
    res = db_query("SELECT value FROM settings WHERE key='vip_status'", fetchone=True)
    current = res[0] if res else 'OFF'
    new_status = 'ON' if current == 'OFF' else 'OFF'
    db_query("INSERT OR REPLACE INTO settings (key, value) VALUES ('vip_status', ?)", (new_status,))
    await call.message.edit_reply_markup(reply_markup=admin_kb())

@dp.callback_query(F.data == "admin_user_control_start")
async def admin_user_control_start(call: CallbackQuery, state: FSMContext):
    if not is_admin_user(call.from_user.id): return
    await state.clear()
    
    t_users = db_query("SELECT COUNT(*) FROM users", fetchone=True)[0] or 0
    t_resellers = db_query("SELECT COUNT(*) FROM users WHERE is_reseller=1", fetchone=True)[0] or 0
    t_admins = db_query("SELECT COUNT(*) FROM users WHERE is_admin=1", fetchone=True)[0] or 0
    t_banned = db_query("SELECT COUNT(*) FROM users WHERE is_banned=1", fetchone=True)[0] or 0
    
    recent_users = db_query("SELECT user_id, first_name, username, balance, is_reseller, is_admin FROM users ORDER BY rowid DESC LIMIT 10", fetchall=True)
    
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    
    if recent_users:
        for ru in recent_users:
            u_id, u_name, u_uname, u_bal, is_res, is_adm = ru
            role_tag = "👑" if is_res else ("⭐" if is_adm else "👤")
            disp = f"{role_tag} {u_name[:15]} ({fmt_curr(u_bal)})"
            kb.inline_keyboard.append([InlineKeyboardButton(text=disp, callback_data=f"usrctrl_view_{u_id}", style="primary")])
            
    kb.inline_keyboard.append([
        InlineKeyboardButton(text="🔍 Search User (ID/@Username)", callback_data="admin_search_user_prompt", style="success")
    ])
    kb.inline_keyboard.append([
        InlineKeyboardButton(text=f"👑 Resellers ({t_resellers})", callback_data="admin_list_resellers", style="primary"),
        InlineKeyboardButton(text=f"⭐ Admins ({t_admins})", callback_data="admin_list_admins", style="primary")
    ])
    kb.inline_keyboard.append([
        InlineKeyboardButton(text="📋 Download Full User List", callback_data="admin_download_userlist", style="primary")
    ])
    kb.inline_keyboard.append([
        InlineKeyboardButton(text="Back to Admin", callback_data="admin_panel_back", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")
    ])
    
    text = (
        f"🛡 <b><u>USER MANAGEMENT SUITE</u></b> 🛡\n━━━━━━━━━━━━━━━━━━\n"
        f"👥 <b>Total Users:</b> {t_users}\n"
        f"👑 <b>Resellers:</b> {t_resellers} | ⭐ <b>Admins:</b> {t_admins}\n"
        f"🔴 <b>Banned Users:</b> {t_banned}\n━━━━━━━━━━━━━━━━━━\n"
        f"👇 <b>Select a Recent User below, or click Search:</b>"
    )
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data == "admin_search_user_prompt")
async def admin_search_user_prompt(call: CallbackQuery, state: FSMContext):
    if not is_admin_user(call.from_user.id): return
    await call.message.edit_text(
        "🔍 <b>Search User</b>\n\n"
        "✏️ Send the <b>Telegram User ID</b> or <b>@username</b> in chat:",
        reply_markup=admin_back_kb(),
        parse_mode='HTML'
    )
    await state.set_state(AdminStates.manage_target_user)

@dp.callback_query(F.data == "admin_list_resellers")
async def admin_list_resellers(call: CallbackQuery):
    if not is_admin_user(call.from_user.id): return
    resellers = db_query("SELECT user_id, first_name, username, balance FROM users WHERE is_reseller=1", fetchall=True)
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    if resellers:
        for r in resellers:
            kb.inline_keyboard.append([InlineKeyboardButton(text=f"👑 {r[1]} (@{r[2] or 'no_user'}) - {fmt_curr(r[3])}", callback_data=f"usrctrl_view_{r[0]}", style="primary")])
    else:
        kb.inline_keyboard.append([InlineKeyboardButton(text="No Resellers Found", callback_data="none")])
    kb.inline_keyboard.append([InlineKeyboardButton(text="🔙 Back to Users", callback_data="admin_user_control_start")])
    await call.message.edit_text("👑 <b><u>ACTIVE WHOLESALE RESELLERS</u></b>\n\nClick any user to manage their balance or roles:", reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data == "admin_list_admins")
async def admin_list_admins(call: CallbackQuery):
    if not is_admin_user(call.from_user.id): return
    admins = db_query("SELECT user_id, first_name, username, balance FROM users WHERE is_admin=1 OR user_id=?", (ADMIN_ID,), fetchall=True)
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    if admins:
        for a in admins:
            tag = "🌟 Owner" if a[0] == ADMIN_ID else "⭐ Admin"
            kb.inline_keyboard.append([InlineKeyboardButton(text=f"{tag}: {a[1]} (@{a[2] or 'no_user'})", callback_data=f"usrctrl_view_{a[0]}", style="primary")])
    kb.inline_keyboard.append([InlineKeyboardButton(text="🔙 Back to Users", callback_data="admin_user_control_start")])
    await call.message.edit_text("⭐ <b><u>ADMINISTRATOR TEAM</u></b>\n\nClick any admin to manage privileges:", reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data == "admin_download_userlist")
async def admin_download_userlist(call: CallbackQuery):
    if not is_admin_user(call.from_user.id): return
    users = db_query("SELECT username, user_id, phone, balance, orders_count, is_vip, is_reseller, is_admin FROM users", fetchall=True)
    if not users: return await call.answer("❌ No users found in the database.", show_alert=True)
    file_content = "FULL DATABASE DUMP\n" + "="*100 + "\n"
    for u in users:
        uname = u[0] if u[0] else "No_Username"
        uid = u[1]
        phone = u[2] if u[2] else "No_Phone"
        bal = u[3] or 0.0
        orders = u[4] or 0
        vip_status = "YES" if u[5] else "NO"
        res_status = "YES" if u[6] else "NO"
        adm_status = "YES" if (len(u) > 7 and u[7]) else "NO"
        file_content += f"UID: {uid} | UNAME: {uname} | PHONE: {phone} | BAL: ₹{bal:.2f} | BUY: {orders} | VIP: {vip_status} | RES: {res_status} | ADM: {adm_status}\n"
    doc = BufferedInputFile(file_content.encode('utf-8'), filename=f"DB_{datetime.now().strftime('%Y%m%d')}.txt")
    await call.message.answer_document(document=doc, caption="📋 <b>Database export complete.</b>", parse_mode='HTML')
    await call.answer()

async def render_user_profile_view(target: Any, user_id: int, state: FSMContext, is_callback: bool = True):
    user_q = db_query("SELECT user_id, first_name, username, balance, is_reseller, orders_count, spent, joined_date, is_banned, warnings, is_vip, is_admin FROM users WHERE user_id=?", (user_id,), fetchone=True)
    if not user_q:
        msg_text = f"❌ User ID <code>{user_id}</code> not found in database."
        if is_callback: await target.edit_text(msg_text, reply_markup=admin_back_kb(), parse_mode='HTML')
        else: await target.answer(msg_text, reply_markup=admin_back_kb(), parse_mode='HTML')
        return

    u_id, u_name, u_user, bal, is_res, orders, spent, joined, is_banned, warnings, is_vip, is_adm = user_q
    await state.update_data(target_u_id=u_id)
    
    status_emoji = "🔴 BANNED" if is_banned else "🟢 ACTIVE"
    tags = []
    if u_id == ADMIN_ID: tags.append("👑 Owner")
    elif is_adm: tags.append("⭐ Sub-Admin")
    if is_res: tags.append("👑 Wholesale Reseller")
    if is_vip: tags.append("🌟 VIP Member")
    type_str = " | ".join(tags) if tags else "👤 Regular Customer"
    
    text = (
        f"🛡 <b><u>USER PROFILE & CONTROL TERMINAL</u></b> 🛡\n━━━━━━━━━━━━━━━━━━\n"
        f"📛 <b>Name:</b> {u_name or 'User'} (@{u_user or 'None'})\n"
        f"🆔 <b>Telegram ID:</b> <code>{u_id}</code>\n"
        f"📊 <b>Account Status:</b> {status_emoji}\n"
        f"🔰 <b>Roles:</b> {type_str}\n"
        f"⚠️ <b>Warnings Issued:</b> {warnings}\n━━━━━━━━━━━━━━━━━━\n"
        f"💰 <b>Wallet Balance:</b> <b>{fmt_curr(bal)}</b>\n"
        f"📦 <b>Orders Purchased:</b> {orders} Keys\n"
        f"💸 <b>Total Money Spent:</b> {fmt_curr(spent)}\n"
        f"📅 <b>Registered Date:</b> {joined or 'N/A'}"
    )
    
    res_btn_text = "❌ Demote from Reseller" if is_res else "👑 Promote to Reseller"
    adm_btn_text = "❌ Demote Admin" if is_adm else "⭐ Promote to Admin"
    vip_btn_text = "❌ Remove VIP" if is_vip else "🌟 Grant VIP"
    ban_btn_text = "✅ Unban User" if is_banned else "🚫 Ban User"
    
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Add Balance", callback_data=f"usrctrl_add_{u_id}", style="success"), InlineKeyboardButton(text="➖ Deduct Balance", callback_data=f"usrctrl_min_{u_id}", style="danger")],
        [InlineKeyboardButton(text=res_btn_text, callback_data=f"usrctrl_res_{u_id}", style="primary"), InlineKeyboardButton(text=adm_btn_text, callback_data=f"usrctrl_adm_{u_id}", style="primary")],
        [InlineKeyboardButton(text=vip_btn_text, callback_data=f"usrctrl_vip_{u_id}", style="primary"), InlineKeyboardButton(text=ban_btn_text, callback_data=f"usrctrl_ban_{u_id}", style="danger")],
        [InlineKeyboardButton(text="⚠️ Send Warning", callback_data=f"usrctrl_warn_{u_id}", style="danger")],
        [InlineKeyboardButton(text="🔙 Back to Users List", callback_data="admin_user_control_start", icon_custom_emoji_id=get_emoji_icon("back"))]
    ])
    
    if is_callback:
        await target.edit_text(text, reply_markup=kb, parse_mode='HTML')
    else:
        await target.answer(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data.startswith("usrctrl_view_"))
async def usrctrl_view_user(call: CallbackQuery, state: FSMContext):
    if not is_admin_user(call.from_user.id): return
    u_id = int(call.data.split("usrctrl_view_")[1])
    await render_user_profile_view(call.message, u_id, state, is_callback=True)

@dp.message(AdminStates.manage_target_user)
async def process_user_lookup(m: Message, state: FSMContext):
    target = m.text.strip()
    if target.startswith('@'): target = target[1:]
    user_q = db_query("SELECT user_id FROM users WHERE user_id=? OR username=? COLLATE NOCASE", (target, target), fetchone=True)
    if not user_q:
        return await m.answer("❌ Target user not found in database. Check ID or @username.", reply_markup=admin_back_kb(), parse_mode='HTML')
    await render_user_profile_view(m, user_q[0], state, is_callback=False)

@dp.callback_query(F.data.startswith("usrctrl_"))
async def handle_user_actions(call: CallbackQuery, state: FSMContext):
    if not is_admin_user(call.from_user.id): return
    parts = call.data.split("_")
    action = parts[1]
    u_id = int(parts[2])
    await state.update_data(target_u_id=u_id)
    
    if action == "res":
        current = db_query("SELECT is_reseller FROM users WHERE user_id=?", (u_id,), fetchone=True)
        is_res = current[0] if current else 0
        if is_res:
            db_query("UPDATE users SET is_reseller=0 WHERE user_id=?", (u_id,))
            await call.answer("❌ Reseller status removed!", show_alert=True)
            try: await bot.send_message(u_id, "ℹ️ <b>Your Wholesale Reseller access has been deactivated by Admin.</b>", parse_mode='HTML')
            except: pass
        else:
            db_query("UPDATE users SET is_reseller=1, reseller_since=? WHERE user_id=?", (datetime.now().strftime("%Y-%m-%d"), u_id))
            await call.answer("👑 User promoted to Wholesale Reseller!", show_alert=True)
            try: await bot.send_message(u_id, "🎉 <b>Congratulations!</b>\nAdmin has upgraded your account to <b>👑 Wholesale Reseller</b>!\nYou now enjoy wholesale prices on all panels in Store!", parse_mode='HTML')
            except: pass
        await render_user_profile_view(call.message, u_id, state, is_callback=True)

    elif action == "adm":
        if u_id == ADMIN_ID:
            return await call.answer("⚠️ Cannot change role of the Primary Owner.", show_alert=True)
        current = db_query("SELECT is_admin FROM users WHERE user_id=?", (u_id,), fetchone=True)
        is_adm = current[0] if current else 0
        if is_adm:
            db_query("UPDATE users SET is_admin=0 WHERE user_id=?", (u_id,))
            await call.answer("❌ Admin privileges revoked!", show_alert=True)
            try: await bot.send_message(u_id, "ℹ️ <b>Your Admin privileges have been revoked by the Owner.</b>", parse_mode='HTML')
            except: pass
        else:
            db_query("UPDATE users SET is_admin=1 WHERE user_id=?", (u_id,))
            await call.answer("⭐ User promoted to Admin!", show_alert=True)
            try: await bot.send_message(u_id, "⭐ <b>Admin Privileges Granted!</b>\nYou have been promoted to Admin by the Owner. Use /admin to access the control panel.", parse_mode='HTML')
            except: pass
        await render_user_profile_view(call.message, u_id, state, is_callback=True)

    elif action == "vip":
        current = db_query("SELECT is_vip FROM users WHERE user_id=?", (u_id,), fetchone=True)
        is_vip = current[0] if current else 0
        if is_vip:
            db_query("UPDATE users SET is_vip=0 WHERE user_id=?", (u_id,))
            await call.answer("❌ VIP status removed!", show_alert=True)
            try: await bot.send_message(u_id, "ℹ️ Your VIP membership has ended.", parse_mode='HTML')
            except: pass
        else:
            db_query("UPDATE users SET is_vip=1, vip_since=? WHERE user_id=?", (datetime.now().strftime("%Y-%m-%d"), u_id))
            await call.answer("🌟 VIP Membership granted!", show_alert=True)
            try: await bot.send_message(u_id, "🌟 <b>VIP Granted!</b>\nAdmin has awarded you VIP Membership with exclusive discounts on all store items!", parse_mode='HTML')
            except: pass
        await render_user_profile_view(call.message, u_id, state, is_callback=True)

    elif action == "ban":
        current = db_query("SELECT is_banned FROM users WHERE user_id=?", (u_id,), fetchone=True)
        is_banned = current[0] if current else 0
        if is_banned:
            db_query("UPDATE users SET is_banned=0 WHERE user_id=?", (u_id,))
            await call.answer("✅ User unbanned successfully!", show_alert=True)
            try: await bot.send_message(u_id, "✅ <b>Your account has been unbanned by Admin.</b>", parse_mode='HTML')
            except: pass
            await render_user_profile_view(call.message, u_id, state, is_callback=True)
        else:
            db_query("UPDATE users SET is_banned=1 WHERE user_id=?", (u_id,))
            await call.answer("🔴 User has been banned!", show_alert=True)
            try: await bot.send_message(u_id, "🔴 <b>Your account has been banned from this bot for policy violations.</b>", parse_mode='HTML')
            except: pass
            await render_user_profile_view(call.message, u_id, state, is_callback=True)

    elif action == "add":
        await call.message.edit_text(f"💰 <b>Add Balance to User</b> <code>{u_id}</code>:\n\nEnter the amount in ₹ to <b>CREDIT</b> (e.g. <code>500</code>):", reply_markup=admin_back_kb(), parse_mode='HTML')
        await state.set_state(AdminStates.wait_for_add_money)

    elif action == "min":
        await call.message.edit_text(f"💸 <b>Deduct Balance from User</b> <code>{u_id}</code>:\n\nEnter the amount in ₹ to <b>DEBIT</b> (e.g. <code>200</code>):", reply_markup=admin_back_kb(), parse_mode='HTML')
        await state.set_state(AdminStates.wait_for_minus_money)

    elif action == "warn":
        await call.message.edit_text(f"⚠️ <b>Send Warning to User</b> <code>{u_id}</code>:\n\nType the warning message:", reply_markup=admin_back_kb(), parse_mode='HTML')
        await state.set_state(AdminStates.wait_for_warning)

@dp.message(AdminStates.wait_for_add_money)
async def exec_add_money(m: Message, state: FSMContext):
    try:
        amt = float(m.text.strip())
        if amt <= 0: return await m.answer("❌ Amount must be greater than 0.")
        data = await state.get_data()
        u_id = data['target_u_id']
        db_query("UPDATE users SET balance = balance + ? WHERE user_id=?", (amt, u_id))
        new_bal = db_query("SELECT balance FROM users WHERE user_id=?", (u_id,), fetchone=True)[0]
        
        await m.answer(f"✅ <b>Successfully added {fmt_curr(amt)} to user <code>{u_id}</code>!</b>\nNew Balance: <b>{fmt_curr(new_bal)}</b>", reply_markup=admin_kb(), parse_mode='HTML')
        try:
            await bot.send_message(u_id, f"💰 <b>Wallet Top-up Received!</b>\n\nAdmin has credited <b>{fmt_curr(amt)}</b> to your wallet.\nYour Current Balance: <b>{fmt_curr(new_bal)}</b>", parse_mode='HTML')
        except: pass
        await state.clear()
    except ValueError:
        await m.answer("❌ Please enter a valid numerical amount (e.g. <code>500</code>).", parse_mode='HTML')

@dp.message(AdminStates.wait_for_minus_money)
async def exec_minus_money(m: Message, state: FSMContext):
    try:
        amt = float(m.text.strip())
        if amt <= 0: return await m.answer("❌ Amount must be greater than 0.")
        data = await state.get_data()
        u_id = data['target_u_id']
        db_query("UPDATE users SET balance = balance - ? WHERE user_id=?", (amt, u_id))
        new_bal = db_query("SELECT balance FROM users WHERE user_id=?", (u_id,), fetchone=True)[0]
        
        await m.answer(f"✅ <b>Successfully deducted {fmt_curr(amt)} from user <code>{u_id}</code>!</b>\nNew Balance: <b>{fmt_curr(new_bal)}</b>", reply_markup=admin_kb(), parse_mode='HTML')
        try:
            await bot.send_message(u_id, f"💸 <b>Wallet Balance Debited!</b>\n\nAdmin has deducted <b>{fmt_curr(amt)}</b> from your wallet.\nYour Current Balance: <b>{fmt_curr(new_bal)}</b>", parse_mode='HTML')
        except: pass
        await state.clear()
    except ValueError:
        await m.answer("❌ Please enter a valid numerical amount (e.g. <code>200</code>).", parse_mode='HTML')

@dp.message(AdminStates.wait_for_warning)
async def exec_warn_user(m: Message, state: FSMContext):
    data = await state.get_data()
    u_id = data['target_u_id']
    warn_text = m.text.strip()
    db_query("UPDATE users SET warnings = warnings + 1 WHERE user_id=?", (u_id,))
    total_warns = db_query("SELECT warnings FROM users WHERE user_id=?", (u_id,), fetchone=True)[0]
    
    await m.answer(f"✅ Warning dispatched to user <code>{u_id}</code> (Total Warnings: {total_warns}).", reply_markup=admin_kb(), parse_mode='HTML')
    try:
        await bot.send_message(u_id, f"⚠️ <b>OFFICIAL WARNING FROM ADMIN:</b>\n\n{warn_text}\n\n<i>Total warnings: {total_warns}/3. Please adhere to bot terms of service.</i>", parse_mode='HTML')
    except: pass
    await state.clear()

# ==============================================================================
# 19. ADMIN STATISTICS
# ==============================================================================
@dp.callback_query(F.data == "admin_view_stats")
async def admin_dashboard_stats(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID: return
    t_users = db_query("SELECT COUNT(*) FROM users", fetchone=True)[0]
    t_resellers = db_query("SELECT COUNT(*) FROM users WHERE is_reseller=1", fetchone=True)[0]
    t_vip = db_query("SELECT COUNT(*) FROM users WHERE is_vip=1", fetchone=True)[0]
    t_prods = db_query("SELECT COUNT(*) FROM products", fetchone=True)[0]
    t_keys = db_query("SELECT COUNT(*) FROM product_keys WHERE is_used=0", fetchone=True)[0]
    t_rev = db_query("SELECT SUM(spent) FROM users", fetchone=True)[0] or 0.0
    today_str = datetime.now().strftime("%Y-%m-%d")
    msg = (f"📊 <b><u>GRID INTELLIGENCE DASHBOARD</u></b> 📊\n━━━━━━━━━━━━━━━━━━\n👥 <b>Total Grid Users:</b> {t_users}\n👑 <b>Wholesale Resellers:</b> {t_resellers}\n🌟 <b>Elite VIP Members:</b> {t_vip}\n━━━━━━━━━━━━━━━━━━\n📦 <b>Active Products:</b> {t_prods}\n🔑 <b>Unused Keys in Vault:</b> {t_keys}\n💰 <b>Total Gross Revenue:</b> {fmt_curr(t_rev)}\n━━━━━━━━━━━━━━━━━━")
    await call.message.edit_text(msg, reply_markup=admin_back_kb(), parse_mode='HTML')

# ==============================================================================
# ==============================================================================
# 20. ADMIN PRODUCT & PLAN MANAGEMENT
# ==============================================================================
@dp.callback_query(F.data == "admin_add_prod")
async def add_prod_start(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    for cat in FIXED_CATEGORIES:
        emoji_id = get_category_emoji(cat)
        kb.inline_keyboard.append([InlineKeyboardButton(text=cat, callback_data=f"addprod_cat_{cat}", icon_custom_emoji_id=emoji_id, style="primary")])
    kb.inline_keyboard.append([InlineKeyboardButton(text="Cancel", callback_data="admin_panel_back", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")])
    await call.message.edit_text("<b>Step 1:</b> Choose <b>Category</b> for New Product:", reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data.startswith("addprod_cat_"))
async def add_prod_category_selected(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    category = call.data.split("addprod_cat_", 1)[1]
    await state.update_data(cat=category)
    
    text = (
        f"📦 <b>Category:</b> {category}\n━━━━━━━━━━━━━━━━━━\n"
        f"✍️ <b>Enter Product / Panel Name (ப்ராடக்ட் பெயர்):</b>\n"
        f"<i>(Example: <code>MST PANEL</code>, <code>VIP CHEATS</code>, <code>DARK HACK</code>)</i>"
    )
    await call.message.edit_text(text, reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.add_prod_name)

@dp.message(AdminStates.add_prod_name)
async def add_prod_name_entered(m: Message, state: FSMContext):
    prod_name = m.text.strip()
    if not prod_name:
        return await m.answer("❌ Please enter a valid product name.")
        
    await state.update_data(prod_name=prod_name)
    data = await state.get_data()
    cat = data.get('cat', 'ANDROID NON ROOT PANEL')
    
    text = (
        f"📦 <b>Category:</b> {cat}\n"
        f"📁 <b>Product Name:</b> <b>{prod_name}</b>\n━━━━━━━━━━━━━━━━━━\n"
        f"🔑 <b>Enter Product PID (ப்ராடக்ட்டோட PID):</b>\n"
        f"<i>(Reseller API-ல் உள்ள Product PID எண்ணை உள்ளிடவும் - Example: <code>2710</code>)</i>"
    )
    await m.answer(text, reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.add_prod_pid)

@dp.message(AdminStates.add_prod_pid)
async def add_prod_pid_entered(m: Message, state: FSMContext):
    pid = m.text.strip()
    if not pid:
        return await m.answer("❌ Please enter a valid PID.")
        
    data = await state.get_data()
    cat = data.get('cat', 'ANDROID NON ROOT PANEL')
    prod_name = data.get('prod_name', 'General Panel')
    
    # Save base product into SQLite Database immediately
    conn = sqlite3.connect('Cuibcc.db')
    c = conn.cursor()
    c.execute(
        "INSERT INTO products (category, panel_name, name, price_inr, reseller_price, stock, apk_link, validity, device_limit, bantibhaiya_product_pid, bantibhaiya_product_duration, is_active) VALUES (?, ?, 'Base Product', 0, 0, 0, '', 'Base', '1 Device HWID', ?, '', 1)",
        (cat, prod_name, pid)
    )
    new_id = c.lastrowid
    conn.commit()
    conn.close()
    
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Add Plans Now", callback_data=f"add_plan_for_pnl_{new_id}", style="success")],
        [InlineKeyboardButton(text="📦 Manage Products", callback_data="admin_manage_prods", style="primary")],
        [InlineKeyboardButton(text="🏠 Admin Panel", callback_data="admin_panel_back", icon_custom_emoji_id=get_emoji_icon("back"))]
    ])
    
    await m.answer(
        f"✅ <b>PRODUCT SUCCESSFULLY CREATED & SAVED!</b>\n━━━━━━━━━━━━━━━━━━\n"
        f"📦 <b>Category:</b> {cat}\n"
        f"📁 <b>Product Name:</b> <b>{prod_name}</b>\n"
        f"🔑 <b>Product PID:</b> <code>{pid}</code>\n━━━━━━━━━━━━━━━━━━\n"
        f"💡 <i>Product is saved in database! You can now add multiple plans (Days, Price & API Duration) to this product below:</i>",
        reply_markup=kb,
        parse_mode='HTML'
    )
    await state.clear()

# ------------------------------------------------------------------------------
# ADD PLANS UNDER A PRODUCT FLOW
# ------------------------------------------------------------------------------
@dp.callback_query(F.data.startswith("add_plan_for_pnl_"))
async def add_plan_for_panel_start(call: CallbackQuery, state: FSMContext):
    if not is_admin_user(call.from_user.id): return
    target_id = int(call.data.split("add_plan_for_pnl_")[1])
    prod = db_query("SELECT category, panel_name, bantibhaiya_product_pid, apk_link FROM products WHERE id=?", (target_id,), fetchone=True)
    if not prod:
        return await call.answer("❌ Product not found!", show_alert=True)
        
    cat, panel_name, bb_pid, apk_link = prod
    await state.update_data(target_prod_id=target_id, cat=cat, panel_name=panel_name, bb_pid=bb_pid, apk_link=apk_link or '')
    
    text = (
        f"📁 <b>Product:</b> <b>{panel_name}</b>\n"
        f"🔑 <b>Product PID:</b> <code>{bb_pid}</code>\n━━━━━━━━━━━━━━━━━━\n"
        f"📅 <b>Step 1/4: Enter Plan Days / Display Name (பிளான் நாட்கள்):</b>\n"
        f"<i>(Example: <code>1 Day</code>, <code>7 Days</code>, <code>30 Days</code>, <code>1 Month VIP</code>)</i>"
    )
    await call.message.edit_text(text, reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.add_plan_days)

@dp.message(AdminStates.add_plan_days)
async def add_plan_days_entered(m: Message, state: FSMContext):
    days_str = m.text.strip()
    if not days_str:
        return await m.answer("❌ Please enter valid plan days (e.g. <code>7 Days</code>).", parse_mode='HTML')
        
    await state.update_data(plan_days=days_str)
    data = await state.get_data()
    panel_name = data.get('panel_name', 'Product')
    
    text = (
        f"📁 <b>Product:</b> <b>{panel_name}</b>\n"
        f"📅 <b>Plan Days:</b> <b>{days_str}</b>\n━━━━━━━━━━━━━━━━━━\n"
        f"💰 <b>Step 2/4: Enter User Price in ₹ (யூசர் விலை):</b>\n"
        f"<i>(Example: <code>500</code>)</i>"
    )
    await m.answer(text, reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.add_plan_user_price)

@dp.message(AdminStates.add_plan_user_price)
async def add_plan_user_price_entered(m: Message, state: FSMContext):
    try:
        user_price = float(m.text.strip())
        if user_price <= 0:
            return await m.answer("❌ Price must be greater than 0.")
    except ValueError:
        return await m.answer("❌ Please enter a valid numerical price (e.g. <code>500</code>).", parse_mode='HTML')
        
    await state.update_data(user_price=user_price)
    data = await state.get_data()
    panel_name = data.get('panel_name', 'Product')
    plan_days = data.get('plan_days', '7 Days')
    
    text = (
        f"📁 <b>Product:</b> <b>{panel_name}</b>\n"
        f"📅 <b>Plan:</b> <b>{plan_days}</b>\n"
        f"💰 <b>User Price:</b> <b>₹{user_price}</b>\n━━━━━━━━━━━━━━━━━━\n"
        f"👑 <b>Step 3/4: Enter Reseller Price in ₹ (ரீசெல்லர் விலை):</b>\n"
        f"<i>(Wholesale Resellers-க்கான விலை - Example: <code>350</code>)</i>"
    )
    await m.answer(text, reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.add_plan_reseller_price)

@dp.message(AdminStates.add_plan_reseller_price)
async def add_plan_reseller_price_entered(m: Message, state: FSMContext):
    try:
        reseller_price = float(m.text.strip())
        if reseller_price <= 0:
            return await m.answer("❌ Price must be greater than 0.")
    except ValueError:
        return await m.answer("❌ Please enter a valid numerical reseller price (e.g. <code>350</code>).", parse_mode='HTML')
        
    await state.update_data(reseller_price=reseller_price)
    data = await state.get_data()
    panel_name = data.get('panel_name', 'Product')
    plan_days = data.get('plan_days', '7 Days')
    user_price = data.get('user_price', 500)
    
    text = (
        f"📁 <b>Product:</b> <b>{panel_name}</b>\n"
        f"📅 <b>Plan:</b> <b>{plan_days}</b>\n"
        f"💰 <b>User Price:</b> <b>₹{user_price}</b> | 👑 <b>Reseller:</b> <b>₹{reseller_price}</b>\n━━━━━━━━━━━━━━━━━━\n"
        f"⏱ <b>Step 4/4: Enter Reseller API Duration Code (ரீசெல்லர் API டுரேஷன்):</b>\n"
        f"<i>(Reseller API-க்கு அனுப்ப வேண்டிய குறிப்பிட்ட டுரேஷன் கோடை மேனுவலாக உள்ளிடவும்)</i>\n\n"
        f"💡 <b>Examples:</b> <code>1d</code>, <code>7d</code>, <code>7 Days</code>, <code>30d</code>, <code>1month</code>, <code>24h</code>, <code>season1</code>"
    )
    await m.answer(text, reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.add_plan_api_duration)

@dp.message(AdminStates.add_plan_api_duration)
async def add_plan_api_dur_entered(m: Message, state: FSMContext):
    api_dur = m.text.strip()
    if not api_dur:
        return await m.answer("❌ Please enter a valid API duration code (e.g. <code>7d</code>).", parse_mode='HTML')
        
    data = await state.get_data()
    target_prod_id = data.get('target_prod_id')
    cat = data.get('cat', 'ANDROID NON ROOT PANEL')
    panel_name = data.get('panel_name', 'General Panel')
    bb_pid = data.get('bb_pid', '')
    apk_link = data.get('apk_link', '')
    plan_days = data.get('plan_days', '7 Days')
    user_price = safe_float(data.get('user_price', 500))
    reseller_price = safe_float(data.get('reseller_price', 350))
    
    conn = sqlite3.connect('Cuibcc.db')
    c = conn.cursor()
    
    # Check if target product is still placeholder 'Base Product' with 0 price
    placeholder = c.execute("SELECT id FROM products WHERE id=? AND name='Base Product' AND price_inr=0", (target_prod_id,)).fetchone()
    if placeholder:
        c.execute(
            "UPDATE products SET name=?, price_inr=?, reseller_price=?, bantibhaiya_product_duration=?, validity=?, stock=999 WHERE id=?",
            (plan_days, user_price, reseller_price, api_dur, plan_days, target_prod_id)
        )
    else:
        c.execute(
            "INSERT INTO products (category, panel_name, name, price_inr, reseller_price, stock, apk_link, validity, device_limit, bantibhaiya_product_pid, bantibhaiya_product_duration, is_active) VALUES (?, ?, ?, ?, ?, 999, ?, ?, '1 Device HWID', ?, ?, 1)",
            (cat, panel_name, plan_days, user_price, reseller_price, apk_link, plan_days, bb_pid, api_dur)
        )
    conn.commit()
    conn.close()
    
    # Get primary ID for this panel for easy navigation
    first_panel_item = db_query("SELECT id FROM products WHERE category=? AND panel_name=? LIMIT 1", (cat, panel_name), fetchone=True)
    first_id = first_panel_item[0] if first_panel_item else target_prod_id
    
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Add Another Plan", callback_data=f"add_plan_for_pnl_{first_id}", style="success")],
        [InlineKeyboardButton(text=f"📁 View {panel_name[:15]} Plans", callback_data=f"admin_pnl_view_{first_id}", style="primary")],
        [InlineKeyboardButton(text="🏠 Admin Panel", callback_data="admin_panel_back", icon_custom_emoji_id=get_emoji_icon("back"))]
    ])
    
    await m.answer(
        f"🎉 <b>PLAN SUCCESSFULLY ADDED & SAVED!</b>\n━━━━━━━━━━━━━━━━━━\n"
        f"📦 <b>Category:</b> {cat}\n"
        f"📁 <b>Product:</b> <b>{panel_name}</b>\n"
        f"🔑 <b>Product PID:</b> <code>{bb_pid}</code>\n"
        f"📅 <b>Plan Days:</b> <b>{plan_days}</b>\n"
        f"💰 <b>User Price:</b> {fmt_curr(user_price)}\n"
        f"👑 <b>Reseller Price:</b> {fmt_curr(reseller_price)}\n"
        f"⏱ <b>Reseller API Duration:</b> <code>{api_dur}</code>\n━━━━━━━━━━━━━━━━━━\n"
        f"⚡ <i>Customers purchasing this plan in Store will automatically trigger Reseller API with PID: <code>{bb_pid}</code> and Duration: <code>{api_dur}</code>!</i>",
        reply_markup=kb,
        parse_mode='HTML'
    )
    await state.clear()

@dp.callback_query(F.data == "admin_manage_prods")
async def admin_manage_prods(call: CallbackQuery):
    if not is_admin_user(call.from_user.id): return
    panels = db_query(
        "SELECT MIN(id), category, panel_name, bantibhaiya_product_pid, COUNT(*) as plan_count FROM products WHERE panel_name != '' GROUP BY category, panel_name ORDER BY category, panel_name",
        fetchall=True
    )
    if not panels:
        return await call.message.edit_text("📦 Store Database is completely empty.\n\nClick <b>'➕ Add Product'</b> to create your first panel.", reply_markup=admin_back_kb(), parse_mode='HTML')
        
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    for p in panels:
        first_id, cat, panel_name, bb_pid, raw_plan_count = p
        # Count actual configured plans (excluding base placeholder if price 0)
        actual_plans = db_query("SELECT COUNT(*) FROM products WHERE category=? AND panel_name=? AND price_inr > 0", (cat, panel_name), fetchone=True)[0]
        pid_tag = f"PID: {bb_pid}" if bb_pid else "No PID"
        btn_text = f"📁 {panel_name} ({actual_plans} Plans | {pid_tag})"
        kb.inline_keyboard.append([InlineKeyboardButton(text=btn_text, callback_data=f"admin_pnl_view_{first_id}", style="primary")])
        
    kb.inline_keyboard.append([InlineKeyboardButton(text="➕ Add New Product / Panel", callback_data="admin_add_prod", style="success")])
    kb.inline_keyboard.append([InlineKeyboardButton(text="Back to Admin", callback_data="admin_panel_back", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")])
    
    text = (
        f"📦 <b><u>STORE PRODUCTS & PANELS</u></b>\n━━━━━━━━━━━━━━━━━━\n"
        f"Total Products: <b>{len(panels)}</b>\n\n"
        f"👇 <b>Select any Product below to view and add plans:</b>"
    )
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data.startswith("admin_pnl_view_"))
async def admin_panel_plans_view(call: CallbackQuery):
    if not is_admin_user(call.from_user.id): return
    first_id = int(call.data.split("admin_pnl_view_")[1])
    prod = db_query("SELECT category, panel_name, bantibhaiya_product_pid, apk_link, is_maintenance FROM products WHERE id=?", (first_id,), fetchone=True)
    if not prod:
        return await call.answer("❌ Product not found!", show_alert=True)
        
    cat, panel_name, bb_pid, apk_link, is_maint = prod
    is_maint = bool(is_maint) if is_maint else False
    
    plans = db_query(
        "SELECT id, name, price_inr, reseller_price, bantibhaiya_product_duration, is_active FROM products WHERE category=? AND panel_name=? AND price_inr > 0 ORDER BY price_inr ASC",
        (cat, panel_name),
        fetchall=True
    )
    
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    if plans:
        for pl in plans:
            pl_id, pl_name, pl_price, pl_rprice, pl_api_dur, is_act = pl
            dot = "🟢" if is_act else "🔴"
            kb.inline_keyboard.append([
                InlineKeyboardButton(
                    text=f"{dot} {pl_name} | {fmt_curr(pl_price)} (API: {pl_api_dur})",
                    callback_data=f"admin_view_p_{pl_id}",
                    style="primary"
                )
            ])
            
    maint_btn_text = "🟢 Turn OFF Maintenance (Make Live)" if is_maint else "🔴 Put Under Maintenance Mode"
    maint_style = "success" if is_maint else "danger"
    
    kb.inline_keyboard.append([
        InlineKeyboardButton(text=f"➕ Add Plan to {panel_name[:15]}", callback_data=f"add_plan_for_pnl_{first_id}", style="success")
    ])
    kb.inline_keyboard.append([
        InlineKeyboardButton(text=maint_btn_text, callback_data=f"toggle_maint_pnl_{first_id}", style=maint_style)
    ])
    kb.inline_keyboard.append([
        InlineKeyboardButton(text="🗑 Delete Entire Product", callback_data=f"del_all_pnl_{first_id}", style="danger")
    ])
    kb.inline_keyboard.append([
        InlineKeyboardButton(text="🔙 Back to Products", callback_data="admin_manage_prods", icon_custom_emoji_id=get_emoji_icon("back"))
    ])
    
    maint_status_text = "🔴 <b>UNDER MAINTENANCE</b> (Purchases Blocked)" if is_maint else "🟢 <b>LIVE</b> (Available for Customers)"
    
    text = (
        f"📁 <b><u>PRODUCT: {panel_name}</u></b>\n━━━━━━━━━━━━━━━━━━\n"
        f"📦 <b>Category:</b> {cat}\n"
        f"🔑 <b>Product PID:</b> <code>{bb_pid or 'Not Set'}</code>\n"
        f"📥 <b>APK Link:</b> {apk_link or 'None'}\n"
        f"🛠 <b>Status:</b> {maint_status_text}\n"
        f"📊 <b>Configured Plans:</b> {len(plans)} Plans\n━━━━━━━━━━━━━━━━━━\n"
        f"👇 <b>Select any plan below to edit Price, API Duration, or click '➕ Add Plan' to create a new plan:</b>"
    )
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data.startswith("toggle_maint_pnl_"))
async def admin_toggle_panel_maintenance(call: CallbackQuery):
    if not is_admin_user(call.from_user.id): return
    first_id = int(call.data.split("toggle_maint_pnl_")[1])
    prod = db_query("SELECT category, panel_name, is_maintenance FROM products WHERE id=?", (first_id,), fetchone=True)
    if not prod: return await call.answer("Panel not found.", show_alert=True)
    cat, panel_name, current_maint = prod
    
    new_maint = 0 if (current_maint and current_maint == 1) else 1
    db_query("UPDATE products SET is_maintenance=? WHERE category=? AND panel_name=?", (new_maint, cat, panel_name))
    
    msg = f"🔴 '{panel_name}' is now in MAINTENANCE MODE!\nUsers cannot open or buy it in Store." if new_maint == 1 else f"🟢 '{panel_name}' is now LIVE!\nUsers can view and buy plans."
    await call.answer(msg, show_alert=True)
    
    call.data = f"admin_pnl_view_{first_id}"
    await admin_panel_plans_view(call)

@dp.callback_query(F.data.startswith("del_all_pnl_"))
async def admin_delete_entire_panel(call: CallbackQuery):
    if not is_admin_user(call.from_user.id): return
    first_id = int(call.data.split("del_all_pnl_")[1])
    prod = db_query("SELECT category, panel_name FROM products WHERE id=?", (first_id,), fetchone=True)
    if not prod: return await call.answer("Panel already deleted.", show_alert=True)
    cat, panel_name = prod
    
    db_query("DELETE FROM products WHERE category=? AND panel_name=?", (cat, panel_name))
    await call.answer(f"🗑 Panel '{panel_name}' and all its plans deleted!", show_alert=True)
    await admin_manage_prods(call)

@dp.callback_query(F.data.startswith("admin_view_p_"))
async def admin_view_product(call: CallbackQuery):
    if not is_admin_user(call.from_user.id): return
    try:
        p_id = int(call.data.split("_")[3])
        prod = db_query("SELECT * FROM products WHERE id=?", (p_id,), fetchone=True)
        if not prod: return await call.answer("❌ Item not found!", show_alert=True)
        panel_name = prod[2] if prod[2] is not None else ""
        price_inr = safe_float(prod[4])
        reseller_price = safe_float(prod[5])
        bb_pid = prod[10] or "Not set"
        bb_duration = prod[11] or "Not set"
        
        first_panel_item = db_query("SELECT id FROM products WHERE category=? AND panel_name=? LIMIT 1", (prod[1], panel_name), fetchone=True)
        first_id = first_panel_item[0] if first_panel_item else p_id
        
        text = (
            f"📦 <b><u>PLAN CONFIGURATION</u></b>\n━━━━━━━━━━━━━━━━━━\n"
            f"📁 <b>Panel Name:</b> <b>{panel_name}</b>\n"
            f"📦 <b>Category:</b> {prod[1]}\n"
            f"📅 <b>Plan Display Name:</b> <b>{prod[3]}</b>\n"
            f"💰 <b>Standard User Price:</b> {fmt_curr(price_inr)}\n"
            f"👑 <b>Wholesale Reseller Price:</b> {fmt_curr(reseller_price)}\n"
            f"🔑 <b>Bantibhaiya PID:</b> <code>{bb_pid}</code>\n"
            f"⏱ <b>Bantibhaiya API Duration:</b> <code>{bb_duration}</code>\n"
            f"📥 <b>APK Link:</b> {prod[7] if prod[7] else 'None'}\n"
            f"👁 <b>Status:</b> {'🟢 Active' if prod[12] else '🔴 Hidden'}\n━━━━━━━━━━━━━━━━━━"
        )
        toggle_btn_text = "Hide Plan 👁‍🗨" if prod[12] else "Unhide Plan 🟢"
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="💰 Edit User Price", callback_data=f"edit_p_{p_id}_price", style="primary"), InlineKeyboardButton(text="👑 Edit Reseller Price", callback_data=f"edit_p_{p_id}_rprice", style="primary")],
            [InlineKeyboardButton(text="⏱ Edit API Duration", callback_data=f"edit_p_{p_id}_bbduration", style="primary"), InlineKeyboardButton(text="📅 Edit Display Name", callback_data=f"edit_p_{p_id}_name", style="primary")],
            [InlineKeyboardButton(text="🔑 Edit Panel PID", callback_data=f"edit_p_{p_id}_bbpid", style="primary"), InlineKeyboardButton(text="🔗 Edit APK Link", callback_data=f"edit_p_{p_id}_apk", style="primary")],
            [InlineKeyboardButton(text=toggle_btn_text, callback_data=f"toggle_p_{p_id}", style="primary"), InlineKeyboardButton(text="🗑 Delete This Plan", callback_data=f"delete_p_{p_id}", style="danger")],
            [InlineKeyboardButton(text=f"🔙 Back to {panel_name[:15]} Plans", callback_data=f"admin_pnl_view_{first_id}", icon_custom_emoji_id=get_emoji_icon("back"))]
        ])
        await call.message.edit_text(text, reply_markup=kb, disable_web_page_preview=True, parse_mode='HTML')
    except Exception as e:
        logger.error(f"Error in admin_view_product: {e}")
        await call.message.edit_text(f"❌ Error loading product: {str(e)}", reply_markup=admin_back_kb(), parse_mode='HTML')

@dp.callback_query(F.data.startswith("toggle_p_"))
async def admin_toggle_product(call: CallbackQuery):
    if not is_admin_user(call.from_user.id): return
    p_id = int(call.data.split("_")[2])
    current = db_query("SELECT is_active FROM products WHERE id=?", (p_id,), fetchone=True)[0]
    new_val = 0 if current == 1 else 1
    db_query("UPDATE products SET is_active=? WHERE id=?", (new_val, p_id))
    await call.answer("Visibility updated successfully!", show_alert=True)
    await admin_view_product(call)

@dp.callback_query(F.data.startswith("edit_p_"))
async def start_edit_product(call: CallbackQuery, state: FSMContext):
    if not is_admin_user(call.from_user.id): return
    parts = call.data.split("_", 3)
    if len(parts) < 4:
        return await call.answer("Invalid callback data.", show_alert=True)
    p_id = int(parts[2])
    field = parts[3]
    await state.update_data(edit_p_id=p_id, edit_field=field)
    field_name_map = {
        'cat': 'New Category Name',
        'panel_name': 'New Panel Name',
        'name': 'New Plan Display Name (e.g. 7 Days)',
        'price': 'New Standard User Price in ₹',
        'rprice': 'New Wholesale Reseller Price in ₹',
        'validity': 'New Time Validity String',
        'device': 'New HWID Limit String',
        'bbpid': 'New Bantibhaiya Product PID',
        'bbduration': 'New Bantibhaiya API Duration parameter (e.g. 7d, 7 Days)',
        'apk': 'New APK Link (or type "none")'
    }
    await call.message.edit_text(f"✏️ <b>Enter {field_name_map.get(field, field)}:</b>", reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.wait_for_new_value)

@dp.message(AdminStates.wait_for_new_value)
async def process_edit_value(m: Message, state: FSMContext):
    data = await state.get_data()
    p_id = data['edit_p_id']; field = data['edit_field']; new_val = m.text.strip()
    
    if field in ['price', 'rprice']:
        try:
            new_val = float(new_val)
        except ValueError:
            return await m.answer("❌ Invalid number format. Please enter a valid price (e.g., 500).")
    elif field in ['apk', 'bbpid', 'bbduration']:
        new_val = "" if new_val.lower() == 'none' else new_val
    
    db_col_map = {'cat': 'category', 'panel_name': 'panel_name', 'name': 'name', 'price': 'price_inr', 'rprice': 'reseller_price', 'validity': 'validity', 'device': 'device_limit', 'bbpid': 'bantibhaiya_product_pid', 'bbduration': 'bantibhaiya_product_duration', 'apk': 'apk_link'}
    
    # If editing panel-wide fields (panel_name, bbpid, apk), update across all plans in that panel
    if field in ['panel_name', 'bbpid', 'apk']:
        prod = db_query("SELECT category, panel_name FROM products WHERE id=?", (p_id,), fetchone=True)
        if prod:
            cat, p_name = prod
            db_query(f"UPDATE products SET {db_col_map[field]}=? WHERE category=? AND panel_name=?", (new_val, cat, p_name))
    else:
        db_query(f"UPDATE products SET {db_col_map[field]}=? WHERE id=?", (new_val, p_id))
        
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔍 View Plan Details", callback_data=f"admin_view_p_{p_id}", style="primary")],
        [InlineKeyboardButton(text="📦 Back to Products", callback_data="admin_manage_prods", icon_custom_emoji_id=get_emoji_icon("back"))]
    ])
    await m.answer(f"✅ <b>Plan property updated successfully!</b>", reply_markup=kb, parse_mode='HTML')
    await state.clear()

@dp.callback_query(F.data.startswith("delete_p_"))
async def admin_delete_product(call: CallbackQuery):
    if not is_admin_user(call.from_user.id): return
    p_id = int(call.data.split("_")[2])
    prod = db_query("SELECT category, panel_name FROM products WHERE id=?", (p_id,), fetchone=True)
    
    db_query("DELETE FROM products WHERE id=?", (p_id,))
    db_query("DELETE FROM product_keys WHERE product_id=?", (p_id,))
    await call.answer("🗑 Plan deleted successfully!", show_alert=True)
    
    if prod:
        cat, panel_name = prod
        remaining = db_query("SELECT id FROM products WHERE category=? AND panel_name=? LIMIT 1", (cat, panel_name), fetchone=True)
        if remaining:
            call.data = f"admin_pnl_view_{remaining[0]}"
            return await admin_panel_plans_view(call)
            
    await admin_manage_prods(call)

# ==============================================================================
# 21. ADMIN TICKETS, BROADCAST, COUPONS
# ==============================================================================
@dp.callback_query(F.data == "admin_view_tickets")
async def admin_view_tickets(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID: return
    tickets = db_query("SELECT id, user_id, message, created_at FROM tickets WHERE status='Open' LIMIT 1", fetchall=True)
    if not tickets: return await call.answer("✅ Zero pending issues. Grid is clean!", show_alert=True)
    t = tickets[0]
    text = (f"🎫 <b><u>ACTIVE TICKET #{t[0]}</u></b>\n👤 <b>Origin UID:</b> <code>{t[1]}</code>\n📅 <b>Timestamp:</b> {t[3]}\n\n📝 <b>Payload:</b>\n{t[2]}")
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💬 Formulate Reply", callback_data=f"reply_ticket_{t[0]}_{t[1]}", style="primary")],
        [InlineKeyboardButton(text="❌ Force Close Ticket", callback_data=f"close_ticket_{t[0]}", style="danger")],
        [InlineKeyboardButton(text="Back to Admin", callback_data="admin_panel_back", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
    ])
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data.startswith("close_ticket_"))
async def close_ticket(call: CallbackQuery):
    ticket_id = call.data.split("_")[2]
    db_query("UPDATE tickets SET status='Closed' WHERE id=?", (ticket_id,))
    await call.answer("✅ Status set to Closed.", show_alert=True)
    await admin_view_tickets(call) 

@dp.callback_query(F.data.startswith("reply_ticket_"))
async def reply_ticket_start(call: CallbackQuery, state: FSMContext):
    data = call.data.split("_")
    ticket_id, user_id = data[2], data[3]
    await state.update_data(ticket_id=ticket_id, user_id=user_id)
    await call.message.edit_text(f"💬 Formulating reply for node <code>{user_id}</code>.\n\nType your message payload:", reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.ticket_reply_msg)

@dp.message(AdminStates.ticket_reply_msg)
async def send_ticket_reply(m: Message, state: FSMContext):
    data = await state.get_data()
    try:
        await bot.send_message(data['user_id'], f"📞 <b>Admin Reply (Ref #{data['ticket_id']}):</b>\n\n{m.text}", parse_mode='HTML')
        db_query("UPDATE tickets SET status='Closed' WHERE id=?", (data['ticket_id'],))
        await m.answer("✅ Payload delivered and connection closed successfully.", reply_markup=admin_kb(), parse_mode='HTML')
    except Exception as e: await m.answer(f"❌ Transmission Error: {e}", reply_markup=admin_kb(), parse_mode='HTML')
    await state.clear()

@dp.callback_query(F.data == "admin_broadcast_btn")
async def admin_broadcast_start(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    await call.message.edit_text("📢 <b>Mass Broadcast Protocol</b>\n\nSend the rich message payload you wish to transmit globally across the grid:", reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.broadcast_msg)

@dp.message(AdminStates.broadcast_msg)
async def admin_broadcast_send(message: Message, state: FSMContext):
    users = db_query("SELECT user_id FROM users", fetchall=True)
    sent, failed = 0, 0
    m = await message.answer("⏳ Broadcast protocol initiated... Do not interrupt.", parse_mode='HTML')
    for u in users:
        try:
            await message.send_copy(chat_id=u[0])
            sent += 1
        except Exception: failed += 1
        await asyncio.sleep(0.06) 
    await m.edit_text(f"✅ <b>Global Broadcast Complete!</b>\n\n🟢 Nodes reached: {sent}\n🔴 Nodes failed/blocked: {failed}", reply_markup=admin_kb(), parse_mode='HTML')
    await state.clear()

@dp.callback_query(F.data == "admin_create_coupon")
async def admin_create_coupon_start(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    await call.message.edit_text("🎟 Enter a highly secure alphanumeric sequence for the Promo Code:", reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.add_coupon_code)

@dp.message(AdminStates.add_coupon_code)
async def admin_coupon_code(m: Message, state: FSMContext):
    await state.update_data(code=m.text.strip().upper())
    await m.answer("💰 Enter the monetary reward payload in <b>RUPEES (₹)</b>:", parse_mode='HTML')
    await state.set_state(AdminStates.add_coupon_amount)

@dp.message(AdminStates.add_coupon_amount)
async def admin_coupon_amount(m: Message, state: FSMContext):
    try:
        await state.update_data(amount=float(m.text)) 
        await m.answer("👥 Enter the exact maximum threshold uses for this code:", parse_mode='HTML')
        await state.set_state(AdminStates.add_coupon_uses)
    except ValueError: await m.answer("❌ Non-numerical data detected. Aborting.")

@dp.message(AdminStates.add_coupon_uses)
async def admin_coupon_uses(m: Message, state: FSMContext):
    try:
        uses = int(m.text)
        data = await state.get_data()
        db_query("INSERT OR REPLACE INTO coupons (code, amount, uses_left) VALUES (?, ?, ?)", (data['code'], data['amount'], uses))
        await m.answer(f"✅ Protocol <b>{data['code']}</b> encoded!\nReward Vector: {fmt_curr(data['amount'])}\nThreshold Limit: {uses} executions.", reply_markup=admin_kb(), parse_mode='HTML')
        await state.clear()
    except ValueError: await m.answer("❌ Non-numerical data detected. Aborting.")

# ==============================================================================
# 22. ADMIN RESELLER & SPIN SETTINGS
# ==============================================================================
@dp.callback_query(F.data == "admin_reseller_menu")
async def admin_reseller_menu(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID: return
    status_check = db_query("SELECT value FROM settings WHERE key='reseller_system_status'", fetchone=True)
    sys_status = status_check[0] if status_check else "ON"
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Grant Reseller Rights", callback_data="reseller_make", style="success"), InlineKeyboardButton(text="➖ Revoke Reseller", callback_data="reseller_remove", style="danger")],
        [InlineKeyboardButton(text="📋 Audit Active Resellers", callback_data="reseller_view", style="primary")],
        [InlineKeyboardButton(text=f"{'🟢' if sys_status == 'ON' else '🔴'} Auto-Upgrade System: {sys_status}", callback_data="admin_toggle_reseller_sys", style="success" if sys_status == 'ON' else "danger")], 
        [InlineKeyboardButton(text="Back to Admin", callback_data="admin_panel_back", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
    ])
    await call.message.edit_text("👑 <b>Wholesale Reseller Protocols</b>\nSelect administrative action:", reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data == "admin_toggle_reseller_sys")
async def toggle_reseller_sys(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID: return
    res = db_query("SELECT value FROM settings WHERE key='reseller_system_status'", fetchone=True)
    current = res[0] if res else 'ON'
    new_status = 'OFF' if current == 'ON' else 'ON'
    db_query("INSERT OR REPLACE INTO settings (key, value) VALUES ('reseller_system_status', ?)", (new_status,))
    await admin_reseller_menu(call)

@dp.callback_query(F.data.in_(["reseller_make", "reseller_remove"]))
async def reseller_prompt_id(call: CallbackQuery, state: FSMContext):
    action = call.data
    await state.update_data(reseller_action=action)
    await call.message.edit_text("👤 Identify target node. Input <b>User ID</b> or <b>@username</b>:", reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.reseller_manage_id)

@dp.message(AdminStates.reseller_manage_id)
async def process_reseller_manage(m: Message, state: FSMContext):
    data = await state.get_data()
    target = m.text.strip()
    if target.startswith('@'): target = target[1:]
    user_q = db_query("SELECT user_id, first_name FROM users WHERE user_id=? OR username=? COLLATE NOCASE", (target, target), fetchone=True)
    if not user_q: return await m.answer("❌ Target completely ghosted. Not in database.", reply_markup=admin_back_kb(), parse_mode='HTML')
    u_id, u_name = user_q[0], user_q[1]
    if data['reseller_action'] == "reseller_make":
        db_query("UPDATE users SET is_reseller=1, reseller_since=?, account_type='Reseller' WHERE user_id=?", (datetime.now().strftime("%Y-%m-%d"), u_id))
        await m.answer(f"✅ Credentials upgraded. <b>{u_name}</b> (<code>{u_id}</code>) has reseller rights.", reply_markup=admin_kb(), parse_mode='HTML')
    else:
        db_query("UPDATE users SET is_reseller=0, account_type='Regular' WHERE user_id=?", (u_id,))
        await m.answer(f"✅ Credentials revoked. <b>{u_name}</b> (<code>{u_id}</code>) is back to regular user.", reply_markup=admin_kb(), parse_mode='HTML')
    await state.clear()

@dp.callback_query(F.data == "reseller_view")
async def reseller_view(call: CallbackQuery):
    resellers = db_query("SELECT user_id, first_name, username FROM users WHERE is_reseller=1", fetchall=True)
    if not resellers: return await call.message.edit_text("📋 Zero active resellers found.", reply_markup=admin_back_kb(), parse_mode='HTML')
    text = "👑 <b><u>ACTIVE RESELLER AUDIT LOG</u></b> 👑\n━━━━━━━━━━━━━━━━━━\n"
    for r in resellers:
        uname = f"(@{r[2]})" if r[2] else ""
        text += f"👤 {r[1]} {uname}\n🆔 <code>{r[0]}</code>\n\n"
    await call.message.edit_text(text, reply_markup=admin_back_kb(), parse_mode='HTML')


@dp.callback_query(F.data == "admin_toggle_bot")
async def toggle_bot(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID: return
    res = db_query("SELECT value FROM settings WHERE key='bot_status'", fetchone=True)
    current = res[0] if res else 'ON'
    new_status = 'OFF' if current == 'ON' else 'ON'
    db_query("INSERT OR REPLACE INTO settings (key, value) VALUES ('bot_status', ?)", (new_status,))
    await call.message.edit_reply_markup(reply_markup=admin_kb())


@dp.callback_query(F.data == "admin_set_video")
async def admin_set_video_start(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    await call.message.edit_text("📹 Input direct streaming / YouTube Link for Tutorial system:\n<i>(Or type 'None' to clear registry):</i>", reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.wait_for_howto_video)

@dp.message(AdminStates.wait_for_howto_video)
async def exec_set_video(m: Message, state: FSMContext):
    link = m.text.strip()
    db_query("INSERT OR REPLACE INTO settings (key, value) VALUES ('how_to_video', ?)", (link,))
    await m.answer("✅ Routing complete. Video linked.", reply_markup=admin_kb(), parse_mode='HTML')
    await state.clear()


@dp.callback_query(F.data == "admin_edit_emojis")
async def admin_edit_emojis(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID: return
    rows = db_query("SELECT key, value FROM settings WHERE key LIKE 'emoji_%' ORDER BY key", fetchall=True)
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    for row in rows:
        key = row[0]
        slot = key.replace("emoji_", "")
        current_id = row[1] if row[1] else "Not set"
        kb.inline_keyboard.append([InlineKeyboardButton(text=f"{slot} (ID: {current_id})", callback_data=f"edit_emoji_{slot}", style="primary")])
    kb.inline_keyboard.append([InlineKeyboardButton(text="Back to Admin", callback_data="admin_panel_back", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")])
    await call.message.edit_text("🎨 <b>Edit All Emojis</b>\nChoose an emoji slot to change its ID:", reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data.startswith("edit_emoji_"))
async def admin_edit_emoji_prompt(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    slot = call.data.split("edit_emoji_", 1)[1]
    await state.update_data(emoji_slot=slot)
    current = get_setting(f"emoji_{slot}", "Not set")
    await call.message.edit_text(f"✏️ Enter new emoji ID for <b>{slot}</b>:\nCurrent: {current}\n(Leave empty to reset to default)", reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.wait_for_emoji_slot)

@dp.message(AdminStates.wait_for_emoji_slot)
async def save_emoji_slot(m: Message, state: FSMContext):
    data = await state.get_data()
    slot = data['emoji_slot']
    new_id = m.text.strip()
    if new_id == "":
        db_query("DELETE FROM settings WHERE key=?", (f"emoji_{slot}",))
        await m.answer(f"✅ Reset emoji for '{slot}' to default.", reply_markup=admin_kb(), parse_mode='HTML')
    else:
        if not new_id.isdigit():
            await m.answer("❌ Invalid ID! Must be numeric.", reply_markup=admin_kb(), parse_mode='HTML')
            return
        set_setting(f"emoji_{slot}", new_id)
        await m.answer(f"✅ Emoji for '{slot}' updated to ID {new_id}.", reply_markup=admin_kb(), parse_mode='HTML')
    await state.clear()

@dp.callback_query(F.data == "admin_edit_ui_menu")
async def admin_edit_ui_menu(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID: return
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Edit Start Menu Text", callback_data="edit_ui_start", style="primary")],
        [InlineKeyboardButton(text="Edit VIP Menu Text", callback_data="edit_ui_vip", style="primary")],
        [InlineKeyboardButton(text="Edit Add Balance Text", callback_data="edit_ui_add_balance", style="primary")],
        [InlineKeyboardButton(text="Back to Admin", callback_data="admin_panel_back", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
    ])
    await call.message.edit_text("✏️ <b>Edit User Interface Texts</b>\nSelect which text you want to modify:", reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data.startswith("edit_ui_"))
async def admin_edit_ui_prompt(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    ui_key = call.data.split("_")[2]
    await state.update_data(ui_key=ui_key)
    current_text = get_ui_text(ui_key)
    await call.message.edit_text(f"📝 Send the new text for <b>{ui_key.upper()}</b> menu.\n\nCurrent text:\n{current_text}", reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.edit_ui_text)

@dp.message(AdminStates.edit_ui_text)
async def admin_save_ui_text(m: Message, state: FSMContext):
    data = await state.get_data()
    ui_key = data['ui_key']
    new_text = m.text
    db_query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (f"ui_{ui_key}", new_text))
    await m.answer(f"✅ UI text <b>{ui_key}</b> updated successfully!", reply_markup=admin_kb(), parse_mode='HTML')
    await state.clear()

@dp.callback_query(F.data == "admin_edit_reseller_price")
async def admin_edit_reseller_price_start(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    prods = db_query("SELECT id, name, category, panel_name, reseller_price FROM products ORDER BY category, panel_name", fetchall=True)
    if not prods: return await call.message.edit_text("No products to edit.", reply_markup=admin_back_kb(), parse_mode='HTML')
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    for p in prods:
        panel_name = p[3] if p[3] is not None else ""
        r_price = safe_float(p[4])
        kb.inline_keyboard.append([InlineKeyboardButton(text=f"{p[2]} - {panel_name} - {p[1]} (₹{r_price:.2f})", callback_data=f"edit_reseller_{p[0]}", style="primary")])
    kb.inline_keyboard.append([InlineKeyboardButton(text="Back to Admin", callback_data="admin_panel_back", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")])
    await call.message.edit_text("👑 <b>Edit Reseller Price per Product</b>\nSelect a product to change its wholesale price:", reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data.startswith("edit_reseller_"))
async def admin_edit_reseller_price_prompt(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    prod_id = int(call.data.split("_")[2])
    await state.update_data(edit_reseller_prod_id=prod_id)
    await call.message.edit_text("💰 Enter the new <b>Reseller Price</b> in Rupees (₹) for this product:", reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.edit_reseller_price)

@dp.message(AdminStates.edit_reseller_price)
async def admin_save_reseller_price(m: Message, state: FSMContext):
    try:
        new_price = float(m.text)
        data = await state.get_data()
        prod_id = data['edit_reseller_prod_id']
        db_query("UPDATE products SET reseller_price=? WHERE id=?", (new_price, prod_id))
        await m.answer(f"✅ Reseller price updated to {fmt_curr(new_price)} for product ID {prod_id}.", reply_markup=admin_kb(), parse_mode='HTML')
        await state.clear()
    except ValueError: await m.answer("❌ Invalid number. Please enter a valid price.")

@dp.callback_query(F.data == "admin_set_reseller_fee")
async def admin_set_reseller_fee(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    await call.message.edit_text("💰 Enter the new <b>Reseller Setup Fee</b> in Rupees (₹):\nCurrent: " + get_setting("reseller_setup_fee", "200.0"), reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.wait_for_reseller_setup_fee)

@dp.message(AdminStates.wait_for_reseller_setup_fee)
async def admin_save_reseller_fee(m: Message, state: FSMContext):
    try:
        fee = float(m.text)
        set_setting("reseller_setup_fee", str(fee))
        await m.answer(f"✅ Reseller setup fee updated to {fmt_curr(fee)}.", reply_markup=admin_kb(), parse_mode='HTML')
        await state.clear()
    except ValueError: await m.answer("❌ Invalid number. Please enter a valid amount.")

@dp.callback_query(F.data == "admin_set_reseller_min")
async def admin_set_reseller_min(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    await call.message.edit_text("💳 Enter the new <b>Minimum Balance</b> required to become reseller (₹):\nCurrent: " + get_setting("reseller_min_balance", "500.0"), reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.wait_for_reseller_min_balance)

@dp.message(AdminStates.wait_for_reseller_min_balance)
async def admin_save_reseller_min(m: Message, state: FSMContext):
    try:
        min_bal = float(m.text)
        set_setting("reseller_min_balance", str(min_bal))
        await m.answer(f"✅ Minimum reseller balance updated to {fmt_curr(min_bal)}.", reply_markup=admin_kb(), parse_mode='HTML')
        await state.clear()
    except ValueError: await m.answer("❌ Invalid number. Please enter a valid amount.")

@dp.callback_query(F.data == "admin_set_support_links")
async def admin_set_support_links(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📞 Set Telegram Link", callback_data="admin_set_telegram", style="primary")],
        [InlineKeyboardButton(text="📱 Set WhatsApp Link", callback_data="admin_set_whatsapp", style="primary")],
        [InlineKeyboardButton(text="Back to Admin", callback_data="admin_panel_back", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
    ])
    await call.message.edit_text("📌 <b>Support Contact Links</b>\nSet the URLs for Telegram and WhatsApp support:", reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data == "admin_set_telegram")
async def admin_set_telegram(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    await call.message.edit_text("✈️ Enter the Telegram contact URL (e.g., https://t.me/YourSupport):", reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.wait_for_support_telegram)

@dp.message(AdminStates.wait_for_support_telegram)
async def save_telegram_link(m: Message, state: FSMContext):
    link = m.text.strip()
    set_setting("support_telegram", link)
    await m.answer("✅ Telegram support link updated!", reply_markup=admin_kb(), parse_mode='HTML')
    await state.clear()

@dp.callback_query(F.data == "admin_set_whatsapp")
async def admin_set_whatsapp(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    await call.message.edit_text("📱 Enter the WhatsApp contact URL (e.g., https://wa.me/1234567890):", reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.wait_for_support_whatsapp)

@dp.message(AdminStates.wait_for_support_whatsapp)
async def save_whatsapp_link(m: Message, state: FSMContext):
    link = m.text.strip()
    set_setting("support_whatsapp", link)
    await m.answer("✅ WhatsApp support link updated!", reply_markup=admin_kb(), parse_mode='HTML')
    await state.clear()

@dp.callback_query(F.data == "admin_set_category_emojis")
async def admin_set_category_emojis(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    for cat in FIXED_CATEGORIES:
        # Fetch the specific category emoji
        current = get_setting(f"cat_emoji_{cat}", "Not set")
        kb.inline_keyboard.append([InlineKeyboardButton(text=f"{cat} (ID: {current})", callback_data=f"set_cat_emoji_{cat}", style="primary")])
    kb.inline_keyboard.append([InlineKeyboardButton(text="Back to Admin", callback_data="admin_panel_back", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")])
    await call.message.edit_text("🎨 <b>Set Category Emojis</b>\nChoose a category to set its custom emoji ID:", reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data.startswith("set_cat_emoji_"))
async def admin_set_category_emoji_prompt(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    category = call.data.split("set_cat_emoji_", 1)[1]
    await state.update_data(cat_emoji_category=category)
    current = get_setting(f"cat_emoji_{category}", "Not set")
    await call.message.edit_text(f"🎨 Enter the emoji ID for <b>{category}</b>:\nCurrent: {current}\n(Leave empty to reset to default)", reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.wait_for_category_emoji)

@dp.message(AdminStates.wait_for_category_emoji)
async def save_category_emoji(m: Message, state: FSMContext):
    data = await state.get_data()
    category = data['cat_emoji_category']
    emoji_id = m.text.strip()
    if emoji_id == "":
        db_query("DELETE FROM settings WHERE key=?", (f"cat_emoji_{category}",))
        await m.answer(f"✅ Reset emoji for {category} to default.", reply_markup=admin_kb(), parse_mode='HTML')
    else:
        if not emoji_id.isdigit():
            await m.answer("❌ Invalid ID! Must be numeric.", reply_markup=admin_kb(), parse_mode='HTML')
            return
        set_setting(f"cat_emoji_{category}", emoji_id)
        await m.answer(f"✅ Emoji set for {category} successfully!", reply_markup=admin_kb(), parse_mode='HTML')
    await state.clear()

@dp.callback_query(F.data == "admin_set_panel_emojis")
async def admin_set_panel_emojis(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID: return
    panels = db_query("SELECT DISTINCT panel_name FROM products WHERE panel_name != '' ORDER BY panel_name", fetchall=True)
    if not panels:
        await call.message.edit_text("No panel names found in products.", reply_markup=admin_back_kb(), parse_mode='HTML')
        return
    kb = InlineKeyboardMarkup(inline_keyboard=[])
    for p in panels:
        panel = p[0]
        current = get_setting(f"panel_emoji_{panel}", "Not set")
        kb.inline_keyboard.append([InlineKeyboardButton(text=f"{panel} (ID: {current})", callback_data=f"set_panel_emoji_{panel}", style="primary")])
    kb.inline_keyboard.append([InlineKeyboardButton(text="Back to Admin", callback_data="admin_panel_back", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")])
    await call.message.edit_text("🖼 <b>Set Panel Emojis</b>\nChoose a panel name to set its custom emoji ID:", reply_markup=kb, parse_mode='HTML')

@dp.callback_query(F.data.startswith("set_panel_emoji_"))
async def admin_set_panel_emoji_prompt(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    panel_name = call.data.split("set_panel_emoji_", 1)[1]
    await state.update_data(panel_emoji_name=panel_name)
    current = get_setting(f"panel_emoji_{panel_name}", "Not set")
    await call.message.edit_text(f"🎨 Enter the emoji ID for panel <b>{panel_name}</b>:\nCurrent: {current}\n(Leave empty to reset to default)", reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.wait_for_panel_emoji_id)

@dp.message(AdminStates.wait_for_panel_emoji_id)
async def save_panel_emoji(m: Message, state: FSMContext):
    data = await state.get_data()
    panel_name = data['panel_emoji_name']
    emoji_id = m.text.strip()
    if emoji_id == "":
        db_query("DELETE FROM settings WHERE key=?", (f"panel_emoji_{panel_name}",))
        await m.answer(f"✅ Reset emoji for panel '{panel_name}'.", reply_markup=admin_kb(), parse_mode='HTML')
    else:
        if not emoji_id.isdigit():
            await m.answer("❌ Invalid ID! Must be numeric.", reply_markup=admin_kb(), parse_mode='HTML')
            return
        set_setting(f"panel_emoji_{panel_name}", emoji_id)
        await m.answer(f"✅ Emoji set for panel '{panel_name}'!", reply_markup=admin_kb(), parse_mode='HTML')
    await state.clear()

# ==============================================================================
# 23. ADMIN FAMPAY SETUP
# ==============================================================================
# ==============================================================================
# 23A. ADMIN EXTERNAL API GATEWAY SETUP
# ==============================================================================
def mask_secret(value: str) -> str:
    value = value or ""
    if not value:
        return "Not set"
    if len(value) <= 8:
        return "••••••••"
    return value[:4] + "••••" + value[-4:]

@dp.callback_query(F.data == "admin_api_setup")
async def admin_api_setup(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID:
        return
    reseller_url = get_setting("reseller_api_url", RESELLER_API_URL)
    reseller_key = get_setting("reseller_api_key", "")
    reseller_master = get_setting("reseller_master_key", "")
    gateway_url = get_setting("payment_gateway_url", PAYMENT_GATEWAY_URL)
    gateway_token = get_setting("payment_gateway_token", "")
    gateway_redirect = get_setting("payment_redirect_url", "")
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔑 Bantibhaiya API URL", callback_data="api_reseller_url", style="primary")],
        [InlineKeyboardButton(text="🔐 Bantibhaiya API Key", callback_data="api_reseller_key", style="primary")],
        [InlineKeyboardButton(text="🛡 Master Key", callback_data="api_reseller_master", style="primary")],
        [InlineKeyboardButton(text="💳 Payment Gateway URL", callback_data="api_gateway_url", style="primary")],
        [InlineKeyboardButton(text="🔒 Payment Gateway Token", callback_data="api_gateway_token", style="primary")],
        [InlineKeyboardButton(text="↪️ Payment Redirect URL", callback_data="api_gateway_redirect", style="primary")],
        [InlineKeyboardButton(text="🔄 Refresh", callback_data="admin_api_setup", style="success")],
        [InlineKeyboardButton(text="⬅️ Back to Admin", callback_data="admin_panel_back", icon_custom_emoji_id=get_emoji_icon("back"), style="danger")]
    ])
    text = (
        "🔐 <b>EXTERNAL API GATEWAY SETUP</b>\n\n"
        f"<b>Bantibhaiya</b>\n🌐 URL: <code>{html.escape(reseller_url)}</code>\n🔑 API Key: <code>{mask_secret(reseller_key)}</code>\n🛡 Master Key: <code>{mask_secret(reseller_master)}</code>\n\n"
        f"<b>Payment Gateway</b>\n🌐 URL: <code>{html.escape(gateway_url)}</code>\n🔒 Token: <code>{mask_secret(gateway_token)}</code>\n↪️ Redirect: <code>{html.escape(gateway_redirect or 'Not set')}</code>\n\n"
        "Select a field below to change it."
    )
    await call.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    await call.answer()

@dp.callback_query(F.data == "api_reseller_url")
async def api_reseller_url_prompt(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    await call.message.edit_text("🌐 Send the Bantibhaiya <b>Reseller API URL</b>:", reply_markup=admin_back_kb(), parse_mode="HTML")
    await state.set_state(AdminStates.wait_for_reseller_api_url)

@dp.message(AdminStates.wait_for_reseller_api_url)
async def api_reseller_url_save(m: Message, state: FSMContext):
    value=m.text.strip()
    if value.lower()=="/cancel":
        await state.clear(); return await m.answer("❌ Cancelled.", reply_markup=admin_kb())
    if not value.startswith(("http://", "https://")):
        return await m.answer("❌ URL must start with http:// or https://")
    set_setting("reseller_api_url", value)
    await state.clear(); await m.answer("✅ Bantibhaiya API URL saved.", reply_markup=admin_kb())

@dp.callback_query(F.data == "api_reseller_key")
async def api_reseller_key_prompt(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    await call.message.edit_text("🔑 Send the Bantibhaiya <b>API Key</b>:", reply_markup=admin_back_kb(), parse_mode="HTML")
    await state.set_state(AdminStates.wait_for_reseller_api_key)

@dp.message(AdminStates.wait_for_reseller_api_key)
async def api_reseller_key_save(m: Message, state: FSMContext):
    value=m.text.strip()
    if value.lower()=="/cancel":
        await state.clear(); return await m.answer("❌ Cancelled.", reply_markup=admin_kb())
    set_setting("reseller_api_key", value)
    await state.clear(); await m.answer("✅ Bantibhaiya API key saved.", reply_markup=admin_kb())

@dp.callback_query(F.data == "api_reseller_master")
async def api_reseller_master_prompt(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    await call.message.edit_text("🛡 Send the Bantibhaiya <b>Master Key</b>:", reply_markup=admin_back_kb(), parse_mode="HTML")
    await state.set_state(AdminStates.wait_for_reseller_master_key)

@dp.message(AdminStates.wait_for_reseller_master_key)
async def api_reseller_master_save(m: Message, state: FSMContext):
    value=m.text.strip()
    if value.lower()=="/cancel":
        await state.clear(); return await m.answer("❌ Cancelled.", reply_markup=admin_kb())
    set_setting("reseller_master_key", value)
    await state.clear(); await m.answer("✅ Bantibhaiya master key saved.", reply_markup=admin_kb())

@dp.callback_query(F.data == "api_gateway_url")
async def api_gateway_url_prompt(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    await call.message.edit_text("💳 Send the <b>Payment Gateway API URL</b>:", reply_markup=admin_back_kb(), parse_mode="HTML")
    await state.set_state(AdminStates.wait_for_gateway_api_url)

@dp.message(AdminStates.wait_for_gateway_api_url)
async def api_gateway_url_save(m: Message, state: FSMContext):
    value=m.text.strip()
    if value.lower()=="/cancel":
        await state.clear(); return await m.answer("❌ Cancelled.", reply_markup=admin_kb())
    if not value.startswith(("http://", "https://")):
        return await m.answer("❌ URL must start with http:// or https://")
    set_setting("payment_gateway_url", value)
    await state.clear(); await m.answer("✅ Payment gateway URL saved.", reply_markup=admin_kb())

@dp.callback_query(F.data == "api_gateway_token")
async def api_gateway_token_prompt(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    await call.message.edit_text("🔒 Send the <b>Payment Gateway Bearer Token</b>:", reply_markup=admin_back_kb(), parse_mode="HTML")
    await state.set_state(AdminStates.wait_for_gateway_token)

@dp.message(AdminStates.wait_for_gateway_token)
async def api_gateway_token_save(m: Message, state: FSMContext):
    value=m.text.strip()
    if value.lower()=="/cancel":
        await state.clear(); return await m.answer("❌ Cancelled.", reply_markup=admin_kb())
    set_setting("payment_gateway_token", value)
    await state.clear(); await m.answer("✅ Payment gateway token saved.", reply_markup=admin_kb())

@dp.callback_query(F.data == "api_gateway_redirect")
async def api_gateway_redirect_prompt(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    await call.message.edit_text("↪️ Send the <b>Payment Redirect URL</b> (HTTPS recommended):", reply_markup=admin_back_kb(), parse_mode="HTML")
    await state.set_state(AdminStates.wait_for_gateway_redirect)

@dp.message(AdminStates.wait_for_gateway_redirect)
async def api_gateway_redirect_save(m: Message, state: FSMContext):
    value=m.text.strip()
    if value.lower()=="/cancel":
        await state.clear(); return await m.answer("❌ Cancelled.", reply_markup=admin_kb())
    if not value.startswith(("http://", "https://")):
        return await m.answer("❌ Redirect URL must start with http:// or https://")
    set_setting("payment_redirect_url", value)
    await state.clear(); await m.answer("✅ Payment redirect URL saved.", reply_markup=admin_kb())

@dp.callback_query(F.data == "admin_setup_fampay")
async def setup_fampay_start(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    current_api = get_setting("fampay_api_key", "") # Fetch current API key for display
    current_upi = get_setting("fampay_upi_id", "") # Fetch current UPI ID for display
    await call.message.edit_text(
        f"⚙️ <b>FAMPAY SECURITY DEPLOYMENT</b>\n\n"
        f"🔑 Current API Key: <code>{mask_secret(current_api)}</code>\n" # Use mask_secret for display
        f"🏦 Current UPI ID: <code>{html.escape(current_upi or 'Not set')}</code>\n\n" # Escape UPI ID and handle empty
        f"Send new <b>FamPay API Key</b>:\n<i>(Type /cancel to abort)</i>",
        reply_markup=admin_back_kb(), parse_mode='HTML'
    )
    await state.set_state(AdminStates.wait_for_fampay_api)

@dp.message(AdminStates.wait_for_fampay_api)
async def setup_fampay_api(m: Message, state: FSMContext):
    if m.text == '/cancel':
        await state.clear()
        return await m.answer("Sequence killed.", reply_markup=admin_kb(), parse_mode='HTML')
    api_key = m.text.strip()
    set_setting("fampay_api_key", api_key)
    await m.answer("🔑 FamPay API Key saved!\n\nNow enter the <b>UPI ID</b> to receive payments (e.g., example@okhdfcbank):", parse_mode='HTML')
    await state.set_state(AdminStates.wait_for_fampay_upi)

@dp.message(AdminStates.wait_for_fampay_upi)
async def setup_fampay_upi(m: Message, state: FSMContext):
    upi_id = m.text.strip()
    if '@' not in upi_id:
        return await m.answer("❌ Invalid UPI ID! Must contain '@'. Example: example@okhdfcbank", parse_mode='HTML')
    set_setting("fampay_upi_id", upi_id)
    await m.answer(f"✅ <b>FamPay Gateway configured successfully!</b>\n\n🏦 UPI ID: <code>{html.escape(upi_id)}</code>\n🔑 API Key: Saved\n\nGateway is now ready for payments.", reply_markup=admin_kb(), parse_mode='HTML')
    await state.clear()

# ==============================================================================
# 24. ADMIN BINANCE SETUP
# ==============================================================================
@dp.callback_query(F.data == "admin_setup_binance")
async def setup_binance_start(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID: return
    await call.message.edit_text("🪙 <b>CRYPTO NODE INIT: Step 1/3</b>\nInput Master <b>Binance API Key</b>:\n<i>(Type /cancel to halt protocol)</i>", reply_markup=admin_back_kb(), parse_mode='HTML')
    await state.set_state(AdminStates.wait_for_binance_api)

@dp.message(AdminStates.wait_for_binance_api)
async def setup_binance_api(m: Message, state: FSMContext):
    if m.text == '/cancel':
        await state.clear()
        return await m.answer("Sequence aborted.", reply_markup=admin_kb(), parse_mode='HTML')
    db_query("INSERT OR REPLACE INTO settings (key, value) VALUES ('binance_api', ?)", (m.text.strip(),))
    await m.answer("🪙 <b>CRYPTO NODE INIT: Step 2/3</b>\nNow inject the highly secure <b>Binance Secret Key</b>:", parse_mode='HTML')
    await state.set_state(AdminStates.wait_for_binance_secret)

@dp.message(AdminStates.wait_for_binance_secret)
async def setup_binance_secret(m: Message, state: FSMContext):
    db_query("INSERT OR REPLACE INTO settings (key, value) VALUES ('binance_secret', ?)", (m.text.strip(),))
    await m.answer("🪙 <b>CRYPTO NODE INIT: Step 3/3</b>\nFinal variable: Set the public <b>USDT Deposit Address (TRC20/BEP20)</b>\nUsers will broadcast to this ledger:", parse_mode='HTML')
    await state.set_state(AdminStates.wait_for_binance_address)

@dp.message(AdminStates.wait_for_binance_address)
async def setup_binance_address(m: Message, state: FSMContext):
    db_query("INSERT OR REPLACE INTO settings (key, value) VALUES ('binance_address', ?)", (m.text.strip(),))
    await m.answer("✅ <b>Blockchain node synchronized.</b> Crypto gateway is fully armed.", reply_markup=admin_kb(), parse_mode='HTML')
    await state.clear()

# ==============================================================================
# 25. BOOTSTRAPPING & MAIN
# ==============================================================================
async def main() -> None:
    init_db()
    logger.info("Initializing DB structure...")
    migrate_categories()
    asyncio.create_task(auto_verify_task())
    logger.info("FamGateway Auto-Verifier Daemon Running in Background (3s polling).")
    logger.info("🚀 CORE SYSTEM IS FULLY OPERATIONAL...")
    
    reconnect_delay = 2
    while True:
        try:
            logger.info("⚡ Connecting to Telegram Bot polling stream...")
            await bot.delete_webhook(drop_pending_updates=False)
            await dp.start_polling(
                bot,
                handle_signals=False,
                polling_timeout=30,
                allowed_updates=["message", "edited_message", "callback_query", "channel_post", "edited_channel_post", "inline_query", "chosen_inline_result", "my_chat_member", "chat_member"]
            )
            reconnect_delay = 2
        except (KeyboardInterrupt, SystemExit):
            logger.info("Shutting down bot gracefully...")
            break
        except Exception as err:
            logger.error(f"⚠️ Telegram Polling connection interrupted: {err}. Auto-reconnecting in {reconnect_delay}s...")
            await asyncio.sleep(reconnect_delay)
            reconnect_delay = min(15, reconnect_delay + 2)

    try:
        await bot.session.close()
    except Exception:
        pass

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("System shutting down gracefully. Goodbye.")