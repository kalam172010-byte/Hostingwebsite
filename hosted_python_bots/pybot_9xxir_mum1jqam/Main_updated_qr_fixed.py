import asyncio
import os
import sqlite3
import random
import logging
import time
import aiohttp
import hmac
import hashlib
import urllib.parse
from io import BytesIO

import qrcode
from datetime import datetime, timedelta
from typing import Optional, List, Tuple, Dict, Any

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
# 1. BOT CONFIGURATION & CONSTANTS
# ==============================================================================
BOT_TOKEN = "8632912098:AAE7RMUwVAGCni3jPAZOe-_rc5Yl5vPIUZW"
BOT_USERNAME = "@AKASHFFPANEL11BOT"
ADMIN_ID = int(os.getenv("8808556338", "8808556338")) # Note: "8808556338" as an environment variable name is unconventional but syntactically valid.
ADMIN_CONTACT = "@Akash_12121"

FAMPAY_API_KEY = "YOUR_FAMPAY_API_KEY"  # Replace with your actual API key
FAMPAY_QR_URL = "https://fampay.anujbots.xyz/qr.php"
FAMPAY_VERIFY_URL = "https://fampay.anujbots.xyz/verify.php"

# External API defaults (credentials are stored securely in the SQLite settings table)
RESELLER_API_URL = "https://bantibhaiya.to/api/reseller_v1.php"
PAYMENT_GATEWAY_URL = "https://famgateway.in/api/create-order.php"

USDT_TO_INR = 90.0
VIP_DISCOUNT_PERCENTAGE = 10.0
VIP_PRICE_INR = 1000.0

WELCOME_STICKER_ID = "CAACAgIAAxkBAAEU-WZmH_..."  # Replace with your sticker ID

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

def fmt_curr(amount: float) -> str:
    return f"₹{amount:,.2f}"

def safe_float(val, default=0.0):
    """Safely convert a value to float, return default if fails."""
    if val is None or val == "":
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

# ==============================================================================
# 2. DATABASE FUNCTIONS
# ==============================================================================
def db_query(query: str, params: tuple = (), fetchone: bool = False, fetchall: bool = False, commit: bool = True) -> Any:
    conn = sqlite3.connect('Cuibcc.db')
    c = conn.cursor()
    try:
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
    conn = sqlite3.connect('Cuibcc.db')
    c = conn.cursor()
    
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
        "ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1",
        "ALTER TABLE tickets ADD COLUMN created_at TEXT",
        "ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN warnings INTEGER DEFAULT 0",
        "ALTER TABLE products ADD COLUMN panel_name TEXT DEFAULT ''",
        "ALTER TABLE products ADD COLUMN bantibhaiya_product_pid TEXT DEFAULT ''",
        "ALTER TABLE products ADD COLUMN bantibhaiya_product_duration TEXT DEFAULT ''",
        "ALTER TABLE transactions ADD COLUMN qr_url TEXT",
        "ALTER TABLE transactions ADD COLUMN upi_id TEXT",
        "ALTER TABLE transactions ADD COLUMN expires_at INTEGER"
    ]
    for mig in migrations:
        try: c.execute(mig)
        except sqlite3.OperationalError: pass
    

    default_settings = [
        ('reseller_system_status', 'ON'),
        ('bot_status', 'ON'),
        ('how_to_video', 'None'),
        ('fampay_api_key', FAMPAY_API_KEY),
        ('fampay_upi_id', ''),
        ('fampay_qr_url', FAMPAY_QR_URL),
        ('fampay_verify_url', FAMPAY_VERIFY_URL),
        ('reseller_api_url', RESELLER_API_URL),
        ('reseller_api_key', ''),
        ('reseller_master_key', ''),
        ('payment_gateway_url', PAYMENT_GATEWAY_URL),
        ('payment_gateway_token', ''),
        ('payment_redirect_url', ''),
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
    add_prod_panel_name = State()
    add_prod_name = State()
    add_prod_validity = State()
    add_prod_bantibhaiya_pid = State()
    add_prod_bantibhaiya_duration = State()
    add_prod_device_limit = State()
    add_prod_price = State()
    add_prod_reseller_price = State()
    add_prod_apk = State()
    add_prod_keys = State()
    
    edit_prod_field = State()
    wait_for_new_value = State()
    wait_for_add_keys = State()
    wait_for_delete_key = State()
    
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
    # 1. Check if admin explicitly set an emoji for this *category name* using the dedicated UI
    explicit_emoji_id_from_admin_setting = get_setting(f"cat_emoji_{category}", "")
    if explicit_emoji_id_from_admin_setting and explicit_emoji_id_from_admin_setting.isdigit():
        return explicit_emoji_id_from_admin_setting # This is the raw emoji ID

    # 2. If not, fallback to the predefined internal slot names in DEFAULT_EMOJIS
    slot_map = {
        "ANDROID NON ROOT PANEL": "category_android_non_root",
        "ANDROID ROOT PANEL": "category_android_root",
        "PC PANEL": "category_pc",
    }
    slot = slot_map.get(category)
    if slot:
        # get_emoji_icon retrieves from 'emoji_{slot}' setting, or from DEFAULT_EMOJIS, returning the raw ID
        return get_emoji_icon(slot) 
    return "" # No emoji found

def get_panel_emoji(panel_name: str) -> str:
    stored = get_setting(f"panel_emoji_{panel_name}", "")
    if stored and stored.isdigit():
        return stored
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
            style="primary" # Aiogram 3.x supports style with icon_custom_emoji_id, reverting to original
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
            # The callback 'admin_api_setup' for 'API Gateway Setup' was not handled.
            # Assuming 'admin_setup_binance' is intended for a missing "Binance" gateway setup button.
            InlineKeyboardButton(text="💳 Binance Setup", callback_data="admin_setup_binance", style="primary"),
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

def generate_upi_qr_file(upi_id: str, amount: float) -> BufferedInputFile:
    """Generate a local PNG UPI QR containing the exact payment amount."""
    upi_uri = (
        "upi://pay?"
        + urllib.parse.urlencode({
            "pa": upi_id,
            "pn": "KALAM FF PANEL",
            "am": f"{float(amount):.2f}",
            "cu": "INR",
        })
    )

    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(upi_uri)
    qr.make(fit=True)
    image = qr.make_image()

    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return BufferedInputFile(buffer.getvalue(), filename=f"payment_{int(amount)}.png")


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
    
    base_qr = get_setting('fampay_qr_url', FAMPAY_QR_URL)
    url = f"{base_qr}?upi={urllib.parse.quote(upi_id)}&amount={amount}"
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url) as resp:
                if resp.status == 200:
                    try:
                        result = await resp.json(content_type=None)
                        return result
                    except Exception as e:
                        logger.error(f"Error parsing FamPay response: {e}")
                        return {"status": "error", "message": "Failed to parse response"}
                else:
                    return {"status": "error", "message": f"HTTP Error: {resp.status}"}
        except Exception as e:
            logger.error(f"FamPay API Error: {e}")
            return {"status": "error", "message": str(e)}

async def verify_fampay_payment(order_id: str) -> Dict[str, Any]:
    """Verify payment status with FamPay."""
    api_key = get_setting("fampay_api_key", FAMPAY_API_KEY)
    if not api_key or api_key == "YOUR_FAMPAY_API_KEY":
        return {"status": "error", "message": "FamPay API key not configured"}
    
    url = f"{get_setting('fampay_verify_url', FAMPAY_VERIFY_URL)}?order_id={urllib.parse.quote(order_id)}&api_key={urllib.parse.quote(api_key)}"
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url) as resp:
                if resp.status == 200:
                    try:
                        result = await resp.json(content_type=None)
                        return result
                    except Exception as e:
                        logger.error(f"Error parsing FamPay verify response: {e}")
                        return {"status": "error", "message": "Failed to parse response"}
                else:
                    return {"status": "error", "message": f"HTTP Error: {resp.status}"}
        except Exception as e:
            logger.error(f"FamPay Verify API Error: {e}")
            return {"status": "error", "message": str(e)}

async def run_payment_verification(user_id: int, order_id: str, reply_target: Any) -> None:
    """Run payment verification with FamPay."""
    txn = db_query("SELECT amount_inr, status, timestamp, qr_url, upi_id, expires_at FROM transactions WHERE order_id=?", (order_id,), fetchone=True)
    if not txn:
        err = "❌ Invalid or Fake Order ID detected in system!"
        if isinstance(reply_target, CallbackQuery): await reply_target.answer(err, show_alert=True)
        else: await reply_target.answer(err)
        return
    
    # Check if QR expired
    if txn[5] and time.time() > txn[5]:
        db_query("UPDATE transactions SET status='expired' WHERE order_id=?", (order_id,))
        err_msg = "⏳ <b>QR Code Expired!</b>\nThe 5-minute payment window has expired. Please generate a new QR."
        if isinstance(reply_target, CallbackQuery): await reply_target.message.edit_text(err_msg, reply_markup=back_kb(), parse_mode='HTML')
        else: await reply_target.answer(err_msg, reply_markup=back_kb())
        return
        
    if txn[1] == 'paid':
        msg = "✅ This payment has already been securely credited to your wallet."
        if isinstance(reply_target, CallbackQuery): await reply_target.answer(msg, show_alert=True)
        else: await reply_target.answer(msg)
        return
    elif txn[1] == 'expired':
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
        
        db_query("UPDATE transactions SET status='paid' WHERE order_id=?", (order_id,))
        db_query("UPDATE users SET balance = balance + ? WHERE user_id=?", (amount_received, user_id))
        
        success_msg = f"🎉 <b>PAYMENT VERIFIED!</b>\n\n✅ {fmt_curr(amount_received)} has been added to your wallet.\n🧾 UTR: <code>{utr}</code>\n👤 Sender: {sender_name}\n📅 Time: {payment_time}"
        if isinstance(reply_target, CallbackQuery): await reply_target.message.edit_text(success_msg, reply_markup=back_kb(), parse_mode='HTML')
        else: await reply_target.answer(success_msg, reply_markup=back_kb())
        
        await send_advanced_notification(user_id, "DEPOSIT", amount_received, product=transaction_id, gateway="FamPay")
        log_activity(user_id, "DEPOSIT_SUCCESS", f"Amount: {amount_received}, Gateway: FamPay, Order: {order_id}, UTR: {utr}")
        
    elif result.get("status") == "error":
        # Check if transaction failed specifically
        error_msg = result.get("message", "Payment not received yet")
        if "Transaction failed" in error_msg or "not received" in error_msg:
            fail_msg = f"❌ {error_msg}\n\n<i>Please make sure you sent the exact amount to the correct UPI ID.</i>"
            if isinstance(reply_target, CallbackQuery): await reply_target.answer(fail_msg, show_alert=True)
            else: await reply_target.answer(fail_msg)
        else:
            # Still pending - show QR again with status
            pending_msg = f"⏳ <b>Payment Status: PENDING</b>\n\n{error_msg}\n\n<i>Please wait a moment and verify again.</i>"
            if isinstance(reply_target, CallbackQuery): await reply_target.answer(pending_msg, show_alert=True)
            else: await reply_target.answer(pending_msg)
    else:
        err = f"⚠️ Gateway Error: {result.get('message', 'Unknown Error')}"
        if isinstance(reply_target, CallbackQuery): await reply_target.answer(err, show_alert=True)
        else: await reply_target.answer(err)

async def auto_verify_task() -> None:
    """Auto-verify pending FamPay transactions every 30 seconds."""
    while True:
        await asyncio.sleep(30)  # Check every 30 seconds
        
        api_key = get_setting("fampay_api_key", "")
        if not api_key or api_key == "YOUR_FAMPAY_API_KEY":
            continue
            
        pending_txns = db_query("SELECT order_id, user_id, amount_inr, timestamp, expires_at FROM transactions WHERE status='pending'", fetchall=True)
        if not pending_txns: continue

        for txn in pending_txns:
            order_id, user_id, amount, ts, expires_at = txn
            
            # Check if expired
            if expires_at and time.time() > expires_at:
                db_query("UPDATE transactions SET status='expired' WHERE order_id=?", (order_id,))
                try: 
                    await bot.send_message(user_id, f"⏳ <b>QR Code Expired!</b>\nYour payment window for order <code>{order_id}</code> has timed out. Please generate a new QR code.", parse_mode='HTML')
                except: pass
                continue
            
            # Verify with FamPay
            result = await verify_fampay_payment(order_id)
            
            if result.get("status") == "success":
                txn_data = result.get("data", {})
                amount_received = txn_data.get("amount", amount)
                utr = txn_data.get("utr")
                sender_name = txn_data.get("sender_name")
                payment_time = txn_data.get("payment_time_ist")
                
                db_query("UPDATE transactions SET status='paid' WHERE order_id=?", (order_id,))
                db_query("UPDATE users SET balance = balance + ? WHERE user_id=?", (amount_received, user_id))
                
                try:
                    await bot.send_message(
                        user_id, 
                        f"✨ <b>AUTO-VERIFIED!</b>\n\n✅ Your payment of {fmt_curr(amount_received)} was detected successfully!\n🧾 UTR: <code>{utr}</code>\n👤 Sender: {sender_name}",
                        parse_mode='HTML'
                    )
                except: pass
                
                await send_advanced_notification(user_id, "DEPOSIT", amount_received, product=order_id, gateway="FamPay Auto")
                log_activity(user_id, "DEPOSIT_AUTO_SUCCESS", f"Amount: {amount_received}, Gateway: FamPay Auto, Order: {order_id}, UTR: {utr}")

# ==============================================================================
# 10. ONBOARDING & START
# ==============================================================================
@dp.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    try: await message.answer_sticker(WELCOME_STICKER_ID)
    except: pass 
    
    args = message.text.split()
    if len(args) > 1 and args[1].startswith("v_"):
        order_id = args[1].split("v_")[1]
        msg = await message.answer("🔄 <b>Verifying your payment securely...</b>\n<i>Connecting to gateway...</i>", parse_mode='HTML')
        await run_payment_verification(message.from_user.id, order_id, msg)
        return


    user = db_query("SELECT phone FROM users WHERE user_id=?", (message.from_user.id,), fetchone=True)
    current_username = message.from_user.username or ""
    db_query("UPDATE users SET username=? WHERE user_id=?", (current_username, message.from_user.id))

    if not user or not user[0]:
        db_query("INSERT OR IGNORE INTO users (user_id, first_name, username, joined_date) VALUES (?, ?, ?, ?)",
                 (message.from_user.id, message.from_user.first_name, current_username, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        log_activity(message.from_user.id, "ACCOUNT_CREATED")

    log_activity(message.from_user.id, "CMD_START")
    await send_main_menu(message)

cached_bot_title = None

async def get_bot_display_name() -> str:
    global cached_bot_title
    if cached_bot_title:
        return cached_bot_title
    try:
        me = await bot.get_me()
        if me and me.first_name:
            cached_bot_title = me.first_name.strip()
            return cached_bot_title
    except Exception:
        pass
    return "STORE BOT"

async def send_main_menu(ctx: Any):
    user_id = ctx.from_user.id
    u = db_query("SELECT first_name, username, balance, is_reseller, is_vip, account_type FROM users WHERE user_id=?", (user_id,), fetchone=True)
    
    first_name = html.escape(u[0] if (u and u[0]) else (ctx.from_user.first_name or "Valued Member"))
    raw_user = u[1] if (u and u[1]) else (ctx.from_user.username or "")
    username_str = f"@{html.escape(raw_user)}" if raw_user else "<i>None</i>"
    balance = safe_float(u[2]) if u else 0.0
    
    is_res = bool(u[3]) if u else False
    is_v = bool(u[4]) if u else False
    
    badge = ""
    if is_res and is_v: badge = " 👑🌟 [VIP RESELLER]"
    elif is_res: badge = " 👑 [RESELLER]"
    elif is_v: badge = " 🌟 [VIP MEMBER]"
    
    bot_name = await get_bot_display_name()
    
    header = (
        f"⚡ <b><u>WELCOME TO {html.escape(bot_name.upper())}</u></b> ⚡\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 <b>Name:</b> <b>{first_name}</b>{badge}\n"
        f"🔗 <b>Username:</b> {username_str}\n"
        f"💳 <b>Wallet Balance:</b> <b>{fmt_curr(balance)}</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    )
    
    base_text = get_ui_text("start_menu")
    if "WELCOME" in base_text or "KALAM" in base_text:
        text = header + (
            f"{get_emoji('product_store')} <b>PRODUCT STORE :</b> Instant Keys & Panels\n"
            f"{get_emoji('profile')} <b>MY PROFILE :</b> Account & Order Vault\n"
            f"{get_emoji('add_balance')} <b>ADD BALANCE :</b> Fast UPI & QR Deposit\n"
            f"{get_emoji('tutorial')} <b>TUTORIALS :</b> Setup & Usage Guides\n"
            f"{get_emoji('support')} <b>SUPPORT :</b> 24/7 Admin Assistance\n\n"
            f"👇 <i>Select an option below to continue:</i>"
        )
    else:
        text = header + base_text
        
    kb = main_menu_kb(user_id)
    if isinstance(ctx, Message): 
        await ctx.answer(text, reply_markup=kb, parse_mode='HTML')
    else: 
        await ctx.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

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
    await call.message.edit_text(text, reply_markup=kb, parse_mode='HTML')

# ==============================================================================
# 12. FAMPAY UPI PAYMENT FLOW
# ==============================================================================
@dp.callback_query(F.data == "gateway_inr")
async def add_balance_inr(call: CallbackQuery):
    text = f"💵 <b>— FAMPAY UPI DEPOSIT —</b> 💵\n\nSelect amount to deposit:"
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="₹50", callback_data="pay_50", style="primary"), InlineKeyboardButton(text="₹100", callback_data="pay_100", style="primary")],
        [InlineKeyboardButton(text="₹200", callback_data="pay_200", style="primary"), InlineKeyboardButton(text="₹500", callback_data="pay_500", style="primary")],
        [InlineKeyboardButton(text="₹1000", callback_data="pay_1000", style="primary"), InlineKeyboardButton(text="₹2000", callback_data="pay_2000", style="primary")],
        [InlineKeyboardButton(text="✏️ Custom Amount", callback_data="custom_deposit_keypad